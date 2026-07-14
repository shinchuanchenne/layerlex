from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models import InnerCard, OuterCard

OUTER_CARDS_URL = "/api/v1/outer-cards"
NOT_FOUND_RESPONSE = {"detail": "Outer card not found"}


def create_card(client: TestClient, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "term": "スケジュール",
        "meaning": "行程、計畫",
    }
    payload.update(overrides)
    response = client.post(OUTER_CARDS_URL, json=payload)
    assert response.status_code == 201
    return response.json()


def test_create_outer_card_with_all_fields(api_client: TestClient) -> None:
    response = api_client.post(
        OUTER_CARDS_URL,
        json={
            "term": "スケジュール",
            "reading": "スケジュール",
            "part_of_speech": "名詞",
            "meaning": "行程、計畫",
            "jlpt_level": "N4",
            "notes": "工作與日常生活",
            "sort_order": 7,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["term"] == "スケジュール"
    assert body["reading"] == "スケジュール"
    assert body["part_of_speech"] == "名詞"
    assert body["meaning"] == "行程、計畫"
    assert body["jlpt_level"] == "N4"
    assert body["notes"] == "工作與日常生活"
    assert body["sort_order"] == 7
    assert "inner_cards" not in body


def test_create_with_required_fields_uses_defaults(api_client: TestClient) -> None:
    card = create_card(api_client)

    assert card["sort_order"] == 0
    assert card["reading"] is None
    assert card["part_of_speech"] is None
    assert card["jlpt_level"] is None
    assert card["notes"] is None


def test_create_trims_strings_and_normalises_optional_blanks(api_client: TestClient) -> None:
    response = api_client.post(
        OUTER_CARDS_URL,
        json={
            "term": "  確認  ",
            "reading": "   ",
            "part_of_speech": "  動詞  ",
            "meaning": "  確認、核實  ",
            "jlpt_level": "\t",
            "notes": "  常用詞  ",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["term"] == "確認"
    assert body["meaning"] == "確認、核實"
    assert body["reading"] is None
    assert body["part_of_speech"] == "動詞"
    assert body["jlpt_level"] is None
    assert body["notes"] == "常用詞"


@pytest.mark.parametrize("field_name", ["term", "meaning"])
def test_create_rejects_blank_required_fields(
    api_client: TestClient,
    field_name: str,
) -> None:
    payload = {"term": "予定", "meaning": "預定"}
    payload[field_name] = "   "

    response = api_client.post(OUTER_CARDS_URL, json=payload)

    assert response.status_code == 422


def test_create_serialises_uuid_and_utc_datetimes(api_client: TestClient) -> None:
    card = create_card(api_client)

    card_id = UUID(str(card["id"]))
    assert str(card_id) == card["id"]
    assert len(str(card["id"])) == 36

    for field_name in ("created_at", "updated_at"):
        value = str(card[field_name])
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        assert parsed.utcoffset() == timedelta(0)


def test_list_empty(api_client: TestClient) -> None:
    response = api_client.get(OUTER_CARDS_URL)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "offset": 0, "limit": 50}


def test_list_uses_stable_ordering(
    api_client: TestClient,
    sqlite_engine: Engine,
) -> None:
    older = datetime(2026, 1, 1, tzinfo=UTC)
    newer = datetime(2026, 1, 2, tzinfo=UTC)
    cards = [
        OuterCard(
            id=UUID("00000000-0000-0000-0000-000000000003"),
            term="third",
            meaning="third",
            sort_order=1,
            created_at=newer,
            updated_at=newer,
        ),
        OuterCard(
            id=UUID("00000000-0000-0000-0000-000000000002"),
            term="second",
            meaning="second",
            sort_order=1,
            created_at=older,
            updated_at=older,
        ),
        OuterCard(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            term="first",
            meaning="first",
            sort_order=1,
            created_at=older,
            updated_at=older,
        ),
        OuterCard(term="before all", meaning="before", sort_order=0),
    ]
    with Session(sqlite_engine) as session:
        session.add_all(cards)
        session.commit()

    response = api_client.get(OUTER_CARDS_URL)

    assert response.status_code == 200
    assert [item["term"] for item in response.json()["items"]] == [
        "before all",
        "first",
        "second",
        "third",
    ]
    assert response.json()["total"] == 4


def test_list_pagination_preserves_total(api_client: TestClient) -> None:
    for index in range(5):
        create_card(api_client, term=f"term-{index}", sort_order=index)

    response = api_client.get(OUTER_CARDS_URL, params={"offset": 1, "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert [item["term"] for item in body["items"]] == ["term-1", "term-2"]
    assert body["total"] == 5
    assert body["offset"] == 1
    assert body["limit"] == 2


@pytest.mark.parametrize(
    ("search", "expected_term"),
    [
        ("schedule", "Schedule"),
        ("かくにん", "確認"),
        ("累積經驗", "経験"),
    ],
)
def test_list_searches_term_reading_and_meaning_case_insensitively(
    api_client: TestClient,
    search: str,
    expected_term: str,
) -> None:
    create_card(api_client, term="Schedule", reading="スケジュール", meaning="plan")
    create_card(api_client, term="確認", reading="かくにん", meaning="verification")
    create_card(api_client, term="経験", reading="けいけん", meaning="累積經驗")

    response = api_client.get(OUTER_CARDS_URL, params={"search": f"  {search}  "})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert [item["term"] for item in body["items"]] == [expected_term]


@pytest.mark.parametrize(
    "params",
    [
        {"offset": -1},
        {"limit": 0},
        {"limit": 201},
    ],
)
def test_list_rejects_invalid_pagination(
    api_client: TestClient,
    params: dict[str, int],
) -> None:
    response = api_client.get(OUTER_CARDS_URL, params=params)

    assert response.status_code == 422


def test_retrieve_existing_card(api_client: TestClient) -> None:
    created = create_card(api_client, term="必要", meaning="必要")

    response = api_client.get(f"{OUTER_CARDS_URL}/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created
    assert "inner_cards" not in response.json()


def test_retrieve_missing_card(api_client: TestClient) -> None:
    response = api_client.get(f"{OUTER_CARDS_URL}/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == NOT_FOUND_RESPONSE


def test_retrieve_rejects_invalid_uuid(api_client: TestClient) -> None:
    response = api_client.get(f"{OUTER_CARDS_URL}/not-a-uuid")

    assert response.status_code == 422


def test_update_one_field_and_preserve_unspecified_fields(api_client: TestClient) -> None:
    created = create_card(
        api_client,
        reading="スケジュール",
        part_of_speech="名詞",
        notes="keep me",
    )

    response = api_client.patch(
        f"{OUTER_CARDS_URL}/{created['id']}",
        json={"meaning": "日程"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["meaning"] == "日程"
    assert body["term"] == created["term"]
    assert body["reading"] == created["reading"]
    assert body["part_of_speech"] == created["part_of_speech"]
    assert body["notes"] == created["notes"]


def test_update_multiple_fields_and_normalise_optional_blank(api_client: TestClient) -> None:
    created = create_card(api_client, reading="old", sort_order=1)

    response = api_client.patch(
        f"{OUTER_CARDS_URL}/{created['id']}",
        json={"term": "  新しい予定  ", "reading": "  ", "sort_order": 9},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["term"] == "新しい予定"
    assert body["reading"] is None
    assert body["sort_order"] == 9


@pytest.mark.parametrize("field_name", ["term", "meaning"])
def test_update_rejects_blank_required_fields(
    api_client: TestClient,
    field_name: str,
) -> None:
    created = create_card(api_client)

    response = api_client.patch(
        f"{OUTER_CARDS_URL}/{created['id']}",
        json={field_name: "  "},
    )

    assert response.status_code == 422


def test_update_rejects_empty_body(api_client: TestClient) -> None:
    created = create_card(api_client)

    response = api_client.patch(f"{OUTER_CARDS_URL}/{created['id']}", json={})

    assert response.status_code == 422


def test_update_preserves_created_at_and_changes_updated_at(api_client: TestClient) -> None:
    created = create_card(api_client)

    response = api_client.patch(
        f"{OUTER_CARDS_URL}/{created['id']}",
        json={"notes": "new note"},
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["created_at"] == created["created_at"]
    assert updated["updated_at"] > created["updated_at"]


def test_update_without_real_change_preserves_updated_at(api_client: TestClient) -> None:
    created = create_card(api_client, term="予定")

    response = api_client.patch(
        f"{OUTER_CARDS_URL}/{created['id']}",
        json={"term": "  予定  "},
    )

    assert response.status_code == 200
    assert response.json()["updated_at"] == created["updated_at"]


def test_update_missing_card(api_client: TestClient) -> None:
    response = api_client.patch(
        f"{OUTER_CARDS_URL}/{uuid4()}",
        json={"term": "予定"},
    )

    assert response.status_code == 404
    assert response.json() == NOT_FOUND_RESPONSE


def test_delete_outer_card(api_client: TestClient) -> None:
    created = create_card(api_client)

    response = api_client.delete(f"{OUTER_CARDS_URL}/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert api_client.get(f"{OUTER_CARDS_URL}/{created['id']}").status_code == 404


def test_delete_missing_card(api_client: TestClient) -> None:
    response = api_client.delete(f"{OUTER_CARDS_URL}/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == NOT_FOUND_RESPONSE


def test_delete_cascades_to_inner_cards(
    api_client: TestClient,
    sqlite_engine: Engine,
) -> None:
    outer_card = OuterCard(term="経験", meaning="經驗")
    inner_card = InnerCard(
        outer_card_id=outer_card.id,
        expression="経験を積む",
        meaning="累積經驗",
    )
    with Session(sqlite_engine) as session:
        session.add(outer_card)
        session.add(inner_card)
        session.commit()
        outer_id = outer_card.id
        inner_id = inner_card.id

    response = api_client.delete(f"{OUTER_CARDS_URL}/{outer_id}")

    assert response.status_code == 204
    with Session(sqlite_engine) as session:
        assert session.get(InnerCard, inner_id) is None


def test_openapi_documents_outer_card_contract(api_client: TestClient) -> None:
    response = api_client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    collection_path = schema["paths"][OUTER_CARDS_URL]
    item_path = schema["paths"][f"{OUTER_CARDS_URL}/{{outer_card_id}}"]
    assert collection_path["post"]["responses"].get("201") is not None
    assert collection_path["get"]["responses"].get("200") is not None
    assert item_path["get"]["responses"].get("200") is not None
    assert item_path["patch"]["responses"].get("200") is not None
    assert item_path["delete"]["responses"].get("204") is not None

    component_schemas = schema["components"]["schemas"]
    for schema_name in (
        "OuterCardCreate",
        "OuterCardUpdate",
        "OuterCardRead",
        "OuterCardListResponse",
    ):
        assert schema_name in component_schemas
    assert "inner_cards" not in component_schemas["OuterCardRead"]["properties"]
