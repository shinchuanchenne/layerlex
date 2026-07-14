from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models import InnerCard, OuterCard

OUTER_CARDS_URL = "/api/v1/outer-cards"
INNER_CARDS_URL = "/api/v1/inner-cards"
OUTER_NOT_FOUND = {"detail": "Outer card not found"}
INNER_NOT_FOUND = {"detail": "Inner card not found"}


def create_outer_card(client: TestClient, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {"term": "経験", "meaning": "經驗"}
    payload.update(overrides)
    response = client.post(OUTER_CARDS_URL, json=payload)
    assert response.status_code == 201
    return response.json()


def inner_collection_url(outer_card_id: object) -> str:
    return f"{OUTER_CARDS_URL}/{outer_card_id}/inner-cards"


def create_inner_card(
    client: TestClient,
    outer_card_id: object,
    **overrides: object,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "expression": "経験を積む",
        "meaning": "累積經驗",
    }
    payload.update(overrides)
    response = client.post(inner_collection_url(outer_card_id), json=payload)
    assert response.status_code == 201
    return response.json()


def test_create_inner_card_with_all_fields(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)

    response = api_client.post(
        inner_collection_url(outer["id"]),
        json={
            "expression": "経験を積む",
            "reading": "けいけんをつむ",
            "meaning": "累積經驗",
            "usage_note": "常與仕事搭配",
            "notes": "重要搭配",
            "sort_order": 7,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["outer_card_id"] == outer["id"]
    assert body["expression"] == "経験を積む"
    assert body["reading"] == "けいけんをつむ"
    assert body["meaning"] == "累積經驗"
    assert body["usage_note"] == "常與仕事搭配"
    assert body["notes"] == "重要搭配"
    assert body["sort_order"] == 7
    assert "outer_card" not in body


def test_create_with_required_fields_uses_defaults(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)

    card = create_inner_card(api_client, outer["id"])

    assert card["sort_order"] == 0
    assert card["reading"] is None
    assert card["usage_note"] is None
    assert card["notes"] is None


def test_create_trims_strings_and_normalises_optional_blanks(
    api_client: TestClient,
) -> None:
    outer = create_outer_card(api_client)

    response = api_client.post(
        inner_collection_url(outer["id"]),
        json={
            "expression": "  経験を積む  ",
            "reading": "   ",
            "meaning": "  累積經驗  ",
            "usage_note": "\t",
            "notes": "  常用搭配  ",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["expression"] == "経験を積む"
    assert body["meaning"] == "累積經驗"
    assert body["reading"] is None
    assert body["usage_note"] is None
    assert body["notes"] == "常用搭配"


@pytest.mark.parametrize("field_name", ["expression", "meaning"])
def test_create_rejects_blank_required_fields(
    api_client: TestClient,
    field_name: str,
) -> None:
    outer = create_outer_card(api_client)
    payload = {"expression": "経験を積む", "meaning": "累積經驗"}
    payload[field_name] = "  "

    response = api_client.post(inner_collection_url(outer["id"]), json=payload)

    assert response.status_code == 422


def test_create_rejects_unknown_fields(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)

    response = api_client.post(
        inner_collection_url(outer["id"]),
        json={"expression": "例", "meaning": "例子", "unknown": True},
    )

    assert response.status_code == 422


def test_create_missing_parent(api_client: TestClient) -> None:
    response = api_client.post(
        inner_collection_url(uuid4()),
        json={"expression": "例", "meaning": "例子"},
    )

    assert response.status_code == 404
    assert response.json() == OUTER_NOT_FOUND


def test_create_rejects_invalid_parent_uuid(api_client: TestClient) -> None:
    response = api_client.post(
        inner_collection_url("not-a-uuid"),
        json={"expression": "例", "meaning": "例子"},
    )

    assert response.status_code == 422


def test_create_serialises_uuid_and_utc_datetimes(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    card = create_inner_card(api_client, outer["id"])

    card_id = UUID(str(card["id"]))
    assert str(card_id) == card["id"]
    assert len(str(card["id"])) == 36

    for field_name in ("created_at", "updated_at"):
        parsed = datetime.fromisoformat(str(card[field_name]).replace("Z", "+00:00"))
        assert parsed.utcoffset() == timedelta(0)


def test_list_empty_for_existing_parent(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)

    response = api_client.get(inner_collection_url(outer["id"]))

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "offset": 0, "limit": 50}


def test_list_returns_only_requested_parents_cards(api_client: TestClient) -> None:
    first_outer = create_outer_card(api_client, term="経験")
    second_outer = create_outer_card(api_client, term="予定")
    create_inner_card(api_client, first_outer["id"], expression="first")
    create_inner_card(api_client, first_outer["id"], expression="second")
    create_inner_card(api_client, second_outer["id"], expression="excluded")

    response = api_client.get(inner_collection_url(first_outer["id"]))

    assert response.status_code == 200
    body = response.json()
    assert [item["expression"] for item in body["items"]] == ["first", "second"]
    assert body["total"] == 2


def test_list_uses_stable_ordering(
    api_client: TestClient,
    sqlite_engine: Engine,
) -> None:
    older = datetime(2026, 1, 1, tzinfo=UTC)
    newer = datetime(2026, 1, 2, tzinfo=UTC)
    outer = OuterCard(term="経験", meaning="經驗")
    cards = [
        InnerCard(
            id=UUID("00000000-0000-0000-0000-000000000003"),
            outer_card_id=outer.id,
            expression="third",
            meaning="third",
            sort_order=1,
            created_at=newer,
            updated_at=newer,
        ),
        InnerCard(
            id=UUID("00000000-0000-0000-0000-000000000002"),
            outer_card_id=outer.id,
            expression="second",
            meaning="second",
            sort_order=1,
            created_at=older,
            updated_at=older,
        ),
        InnerCard(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            outer_card_id=outer.id,
            expression="first",
            meaning="first",
            sort_order=1,
            created_at=older,
            updated_at=older,
        ),
        InnerCard(
            outer_card_id=outer.id,
            expression="before all",
            meaning="before",
            sort_order=0,
        ),
    ]
    with Session(sqlite_engine) as session:
        session.add(outer)
        session.add_all(cards)
        session.commit()
        outer_id = outer.id

    response = api_client.get(inner_collection_url(outer_id))

    assert response.status_code == 200
    assert [item["expression"] for item in response.json()["items"]] == [
        "before all",
        "first",
        "second",
        "third",
    ]


def test_list_pagination_preserves_filtered_total(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    for index in range(5):
        create_inner_card(
            api_client,
            outer["id"],
            expression=f"expression-{index}",
            sort_order=index,
        )

    response = api_client.get(
        inner_collection_url(outer["id"]),
        params={"offset": 1, "limit": 2},
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["expression"] for item in body["items"]] == [
        "expression-1",
        "expression-2",
    ]
    assert body["total"] == 5
    assert body["offset"] == 1
    assert body["limit"] == 2


@pytest.mark.parametrize(
    ("field_name", "value", "search"),
    [
        ("expression", "Keep Going", "keep"),
        ("reading", "つづける", "つづ"),
        ("meaning", "持續進行", "持續"),
        ("usage_note", "口語常用", "口語"),
    ],
)
def test_list_searches_supported_fields(
    api_client: TestClient,
    field_name: str,
    value: str,
    search: str,
) -> None:
    outer = create_outer_card(api_client)
    create_inner_card(api_client, outer["id"], **{field_name: value})
    create_inner_card(api_client, outer["id"], expression="unrelated", meaning="none")

    response = api_client.get(
        inner_collection_url(outer["id"]),
        params={"search": f"  {search}  "},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0][field_name] == value


def test_list_missing_parent(api_client: TestClient) -> None:
    response = api_client.get(inner_collection_url(uuid4()))

    assert response.status_code == 404
    assert response.json() == OUTER_NOT_FOUND


@pytest.mark.parametrize("params", [{"offset": -1}, {"limit": 0}, {"limit": 201}])
def test_list_rejects_invalid_pagination(
    api_client: TestClient,
    params: dict[str, int],
) -> None:
    outer = create_outer_card(api_client)

    response = api_client.get(inner_collection_url(outer["id"]), params=params)

    assert response.status_code == 422


def test_retrieve_existing_card_includes_outer_card_id(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(api_client, outer["id"])

    response = api_client.get(f"{INNER_CARDS_URL}/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created
    assert response.json()["outer_card_id"] == outer["id"]


def test_retrieve_missing_card(api_client: TestClient) -> None:
    response = api_client.get(f"{INNER_CARDS_URL}/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == INNER_NOT_FOUND


def test_retrieve_rejects_invalid_uuid(api_client: TestClient) -> None:
    response = api_client.get(f"{INNER_CARDS_URL}/not-a-uuid")

    assert response.status_code == 422


def test_update_one_field_and_preserve_unspecified_fields(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(
        api_client,
        outer["id"],
        reading="けいけんをつむ",
        usage_note="keep me",
        notes="also keep",
    )

    response = api_client.patch(
        f"{INNER_CARDS_URL}/{created['id']}",
        json={"meaning": "增加經驗"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["meaning"] == "增加經驗"
    assert body["expression"] == created["expression"]
    assert body["reading"] == created["reading"]
    assert body["usage_note"] == created["usage_note"]
    assert body["notes"] == created["notes"]
    assert body["outer_card_id"] == created["outer_card_id"]


def test_update_multiple_fields_and_normalise_optional_blank(
    api_client: TestClient,
) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(api_client, outer["id"], reading="old", sort_order=1)

    response = api_client.patch(
        f"{INNER_CARDS_URL}/{created['id']}",
        json={"expression": "  新しい例  ", "reading": "  ", "sort_order": 9},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["expression"] == "新しい例"
    assert body["reading"] is None
    assert body["sort_order"] == 9


def test_update_rejects_outer_card_id_change(api_client: TestClient) -> None:
    first_outer = create_outer_card(api_client, term="first")
    second_outer = create_outer_card(api_client, term="second")
    created = create_inner_card(api_client, first_outer["id"])

    response = api_client.patch(
        f"{INNER_CARDS_URL}/{created['id']}",
        json={"outer_card_id": second_outer["id"]},
    )

    assert response.status_code == 422
    retrieved = api_client.get(f"{INNER_CARDS_URL}/{created['id']}").json()
    assert retrieved["outer_card_id"] == first_outer["id"]


@pytest.mark.parametrize("field_name", ["expression", "meaning"])
def test_update_rejects_blank_required_fields(
    api_client: TestClient,
    field_name: str,
) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(api_client, outer["id"])

    response = api_client.patch(
        f"{INNER_CARDS_URL}/{created['id']}",
        json={field_name: "  "},
    )

    assert response.status_code == 422


@pytest.mark.parametrize("field_name", ["expression", "meaning", "sort_order"])
def test_update_rejects_null_required_fields(
    api_client: TestClient,
    field_name: str,
) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(api_client, outer["id"])

    response = api_client.patch(
        f"{INNER_CARDS_URL}/{created['id']}",
        json={field_name: None},
    )

    assert response.status_code == 422


def test_update_rejects_empty_body(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(api_client, outer["id"])

    response = api_client.patch(f"{INNER_CARDS_URL}/{created['id']}", json={})

    assert response.status_code == 422


def test_update_preserves_created_at_and_changes_updated_at(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(api_client, outer["id"])

    response = api_client.patch(
        f"{INNER_CARDS_URL}/{created['id']}",
        json={"notes": "new note"},
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["created_at"] == created["created_at"]
    assert updated["updated_at"] > created["updated_at"]


def test_update_without_real_change_preserves_updated_at(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(api_client, outer["id"], expression="経験を積む")

    response = api_client.patch(
        f"{INNER_CARDS_URL}/{created['id']}",
        json={"expression": "  経験を積む  "},
    )

    assert response.status_code == 200
    assert response.json()["updated_at"] == created["updated_at"]


def test_update_missing_card(api_client: TestClient) -> None:
    response = api_client.patch(
        f"{INNER_CARDS_URL}/{uuid4()}",
        json={"expression": "例"},
    )

    assert response.status_code == 404
    assert response.json() == INNER_NOT_FOUND


def test_delete_inner_card_preserves_parent_and_siblings(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    deleted = create_inner_card(api_client, outer["id"], expression="delete")
    sibling = create_inner_card(api_client, outer["id"], expression="keep")

    response = api_client.delete(f"{INNER_CARDS_URL}/{deleted['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert api_client.get(f"{INNER_CARDS_URL}/{deleted['id']}").status_code == 404
    assert api_client.get(f"{INNER_CARDS_URL}/{sibling['id']}").status_code == 200
    assert api_client.get(f"{OUTER_CARDS_URL}/{outer['id']}").status_code == 200


def test_delete_missing_card(api_client: TestClient) -> None:
    response = api_client.delete(f"{INNER_CARDS_URL}/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == INNER_NOT_FOUND


def test_delete_rejects_invalid_uuid(api_client: TestClient) -> None:
    response = api_client.delete(f"{INNER_CARDS_URL}/not-a-uuid")

    assert response.status_code == 422


def test_deleting_outer_card_cascades_to_all_inner_cards(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    inner_cards = [
        create_inner_card(api_client, outer["id"], expression=f"inner-{index}")
        for index in range(2)
    ]

    response = api_client.delete(f"{OUTER_CARDS_URL}/{outer['id']}")

    assert response.status_code == 204
    for inner_card in inner_cards:
        assert api_client.get(f"{INNER_CARDS_URL}/{inner_card['id']}").status_code == 404


def test_openapi_documents_inner_card_contract(api_client: TestClient) -> None:
    response = api_client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    collection_path = schema["paths"]["/api/v1/outer-cards/{outer_card_id}/inner-cards"]
    item_path = schema["paths"]["/api/v1/inner-cards/{inner_card_id}"]

    for operation, success_status in (
        (collection_path["post"], "201"),
        (collection_path["get"], "200"),
        (item_path["get"], "200"),
        (item_path["patch"], "200"),
        (item_path["delete"], "204"),
    ):
        assert success_status in operation["responses"]
        assert "404" in operation["responses"]
        assert "422" in operation["responses"]

    component_schemas = schema["components"]["schemas"]
    for schema_name in (
        "InnerCardCreate",
        "InnerCardUpdate",
        "InnerCardRead",
        "InnerCardListResponse",
    ):
        assert schema_name in component_schemas
    assert "outer_card_id" in component_schemas["InnerCardRead"]["properties"]
    assert "outer_card" not in component_schemas["InnerCardRead"]["properties"]
