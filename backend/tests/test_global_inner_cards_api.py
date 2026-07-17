from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models import InnerCard, OuterCard
from tests.conftest import TEST_DECK_ID

OUTER_CARDS_URL = "/api/v1/outer-cards"
INNER_CARDS_URL = "/api/v1/inner-cards"


def create_outer_card(client: TestClient, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "deck_id": str(TEST_DECK_ID),
        "term": "経験",
        "meaning": "經驗",
    }
    payload.update(overrides)
    response = client.post(OUTER_CARDS_URL, json=payload)
    assert response.status_code == 201
    return response.json()


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
    response = client.post(
        f"{OUTER_CARDS_URL}/{outer_card_id}/inner-cards",
        json=payload,
    )
    assert response.status_code == 201
    return response.json()


def seed_globally_ordered_cards(sqlite_engine: Engine) -> list[str]:
    oldest = datetime(2026, 1, 1, tzinfo=UTC)
    newer = datetime(2026, 1, 2, tzinfo=UTC)
    newest = datetime(2026, 1, 3, tzinfo=UTC)
    outer_first = OuterCard(
        id=UUID("10000000-0000-4000-8000-000000000003"),
        deck_id=TEST_DECK_ID,
        term="first parent",
        meaning="first",
        sort_order=0,
        created_at=newest,
        updated_at=newest,
    )
    outer_tie_first = OuterCard(
        id=UUID("20000000-0000-4000-8000-000000000001"),
        deck_id=TEST_DECK_ID,
        term="tie parent first",
        meaning="tie first",
        sort_order=1,
        created_at=oldest,
        updated_at=oldest,
    )
    outer_tie_second = OuterCard(
        id=UUID("20000000-0000-4000-8000-000000000002"),
        deck_id=TEST_DECK_ID,
        term="tie parent second",
        meaning="tie second",
        sort_order=1,
        created_at=oldest,
        updated_at=oldest,
    )
    outer_later = OuterCard(
        id=UUID("20000000-0000-4000-8000-000000000000"),
        deck_id=TEST_DECK_ID,
        term="later parent",
        meaning="later",
        sort_order=1,
        created_at=newer,
        updated_at=newer,
    )
    empty_outer = OuterCard(
        deck_id=TEST_DECK_ID,
        term="empty parent",
        meaning="empty",
        sort_order=-1,
        created_at=oldest,
        updated_at=oldest,
    )

    inner_cards = [
        InnerCard(
            id=UUID("30000000-0000-4000-8000-000000000001"),
            outer_card_id=outer_first.id,
            expression="first parent item",
            meaning="first",
            sort_order=4,
            created_at=newest,
            updated_at=newest,
        ),
        InnerCard(
            id=UUID("40000000-0000-4000-8000-000000000004"),
            outer_card_id=outer_tie_first.id,
            expression="inner sort first",
            meaning="inner sort",
            sort_order=0,
            created_at=newest,
            updated_at=newest,
        ),
        InnerCard(
            id=UUID("40000000-0000-4000-8000-000000000001"),
            outer_card_id=outer_tie_first.id,
            expression="inner id first",
            meaning="inner id",
            sort_order=1,
            created_at=oldest,
            updated_at=oldest,
        ),
        InnerCard(
            id=UUID("40000000-0000-4000-8000-000000000002"),
            outer_card_id=outer_tie_first.id,
            expression="inner id second",
            meaning="inner id",
            sort_order=1,
            created_at=oldest,
            updated_at=oldest,
        ),
        InnerCard(
            id=UUID("40000000-0000-4000-8000-000000000003"),
            outer_card_id=outer_tie_first.id,
            expression="inner created later",
            meaning="inner created",
            sort_order=1,
            created_at=newer,
            updated_at=newer,
        ),
        InnerCard(
            outer_card_id=outer_tie_second.id,
            expression="second tied parent item",
            meaning="second tied parent",
        ),
        InnerCard(
            outer_card_id=outer_later.id,
            expression="later parent item",
            meaning="later parent",
        ),
    ]
    expected = [card.expression for card in inner_cards]

    with Session(sqlite_engine) as session:
        session.add_all(
            [
                outer_first,
                outer_tie_first,
                outer_tie_second,
                outer_later,
                empty_outer,
            ]
        )
        session.add_all(inner_cards)
        session.commit()

    return expected


def test_global_list_is_empty_with_default_pagination(api_client: TestClient) -> None:
    response = api_client.get(INNER_CARDS_URL)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "offset": 0, "limit": 50}


def test_global_list_returns_all_parents_without_duplicates(
    api_client: TestClient,
) -> None:
    empty_outer = create_outer_card(api_client, term="empty", sort_order=-1)
    first_outer = create_outer_card(api_client, term="first", sort_order=0)
    second_outer = create_outer_card(api_client, term="second", sort_order=1)
    first = create_inner_card(api_client, first_outer["id"], expression="first")
    second = create_inner_card(api_client, first_outer["id"], expression="second")
    third = create_inner_card(api_client, second_outer["id"], expression="third")

    response = api_client.get(INNER_CARDS_URL)

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == [
        first["id"],
        second["id"],
        third["id"],
    ]
    assert [item["outer_card_id"] for item in body["items"]] == [
        first_outer["id"],
        first_outer["id"],
        second_outer["id"],
    ]
    assert len({item["id"] for item in body["items"]}) == 3
    assert empty_outer["id"] not in {item["outer_card_id"] for item in body["items"]}
    assert body["total"] == 3


def test_global_list_uses_stable_parent_and_inner_ordering(
    api_client: TestClient,
    sqlite_engine: Engine,
) -> None:
    expected = seed_globally_ordered_cards(sqlite_engine)

    response = api_client.get(INNER_CARDS_URL)

    assert response.status_code == 200
    assert [item["expression"] for item in response.json()["items"]] == expected


def test_global_pagination_runs_after_ordering_and_crosses_parent_boundary(
    api_client: TestClient,
    sqlite_engine: Engine,
) -> None:
    expected = seed_globally_ordered_cards(sqlite_engine)

    response = api_client.get(INNER_CARDS_URL, params={"offset": 3, "limit": 3})

    assert response.status_code == 200
    body = response.json()
    assert [item["expression"] for item in body["items"]] == expected[3:6]
    assert body["total"] == len(expected)
    assert body["offset"] == 3
    assert body["limit"] == 3

    beyond = api_client.get(INNER_CARDS_URL, params={"offset": 100, "limit": 10})
    assert beyond.status_code == 200
    assert beyond.json()["items"] == []
    assert beyond.json()["total"] == len(expected)


@pytest.mark.parametrize("params", [{"offset": -1}, {"limit": 0}, {"limit": 201}])
def test_global_list_rejects_invalid_pagination(
    api_client: TestClient,
    params: dict[str, int],
) -> None:
    response = api_client.get(INNER_CARDS_URL, params=params)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field_name", "value", "search"),
    [
        ("expression", "Keep Going", "keep"),
        ("reading", "つづける", "つづ"),
        ("meaning", "持續進行", "持續"),
        ("usage_note", "口語常用", "口語"),
    ],
)
def test_global_list_searches_supported_fields_across_parents(
    api_client: TestClient,
    field_name: str,
    value: str,
    search: str,
) -> None:
    first_outer = create_outer_card(api_client, term="first", sort_order=1)
    second_outer = create_outer_card(api_client, term="second", sort_order=0)
    matched_fields: dict[str, object] = {field_name: value}
    if field_name != "expression":
        matched_fields["expression"] = "target expression"
    matched = create_inner_card(
        api_client,
        first_outer["id"],
        **matched_fields,
    )
    create_inner_card(
        api_client,
        second_outer["id"],
        expression="unrelated",
        meaning="nothing relevant",
    )

    response = api_client.get(INNER_CARDS_URL, params={"search": f"  {search}  "})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert [item["id"] for item in body["items"]] == [matched["id"]]
    assert body["items"][0][field_name] == value


def test_global_whitespace_search_behaves_like_no_search_and_preserves_order(
    api_client: TestClient,
) -> None:
    later_outer = create_outer_card(api_client, term="later", sort_order=2)
    earlier_outer = create_outer_card(api_client, term="earlier", sort_order=1)
    later = create_inner_card(api_client, later_outer["id"], expression="later")
    earlier = create_inner_card(api_client, earlier_outer["id"], expression="earlier")

    response = api_client.get(INNER_CARDS_URL, params={"search": "   \t "})

    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert [item["id"] for item in response.json()["items"]] == [
        earlier["id"],
        later["id"],
    ]


def test_global_search_preserves_parent_and_inner_ordering(api_client: TestClient) -> None:
    later_outer = create_outer_card(api_client, term="later", sort_order=2)
    earlier_outer = create_outer_card(api_client, term="earlier", sort_order=1)
    later = create_inner_card(
        api_client,
        later_outer["id"],
        expression="shared later",
        sort_order=0,
    )
    earlier_second = create_inner_card(
        api_client,
        earlier_outer["id"],
        expression="shared second",
        sort_order=2,
    )
    earlier_first = create_inner_card(
        api_client,
        earlier_outer["id"],
        expression="shared first",
        sort_order=1,
    )
    create_inner_card(api_client, earlier_outer["id"], expression="excluded")

    response = api_client.get(INNER_CARDS_URL, params={"search": "shared"})

    assert response.status_code == 200
    assert response.json()["total"] == 3
    assert [item["id"] for item in response.json()["items"]] == [
        earlier_first["id"],
        earlier_second["id"],
        later["id"],
    ]


def test_global_search_excludes_notes_and_unrelated_cards(api_client: TestClient) -> None:
    outer = create_outer_card(api_client)
    create_inner_card(api_client, outer["id"], expression="unrelated", notes="secret token")
    create_inner_card(api_client, outer["id"], expression="another", meaning="another")

    response = api_client.get(INNER_CARDS_URL, params={"search": "secret token"})

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["total"] == 0


def test_global_list_serialises_read_schema_without_relationships(
    api_client: TestClient,
) -> None:
    outer = create_outer_card(api_client)
    created = create_inner_card(
        api_client,
        outer["id"],
        reading=None,
        usage_note=None,
        notes=None,
    )

    response = api_client.get(INNER_CARDS_URL)

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item == created
    assert str(UUID(item["id"])) == item["id"]
    assert item["reading"] is None
    assert item["usage_note"] is None
    assert item["notes"] is None
    for field_name in ("created_at", "updated_at"):
        parsed = datetime.fromisoformat(item[field_name].replace("Z", "+00:00"))
        assert parsed.utcoffset() == timedelta(0)
    assert "outer_card" not in item
    assert "inner_cards" not in item


def test_global_collection_preserves_existing_inner_routes(api_client: TestClient) -> None:
    first_outer = create_outer_card(api_client, term="first")
    second_outer = create_outer_card(api_client, term="second")
    first = create_inner_card(api_client, first_outer["id"], expression="first")
    create_inner_card(api_client, second_outer["id"], expression="second")

    retrieved = api_client.get(f"{INNER_CARDS_URL}/{first['id']}")
    assert retrieved.status_code == 200
    assert retrieved.json()["id"] == first["id"]

    updated = api_client.patch(
        f"{INNER_CARDS_URL}/{first['id']}",
        json={"meaning": "updated"},
    )
    assert updated.status_code == 200
    assert updated.json()["meaning"] == "updated"

    parent_list = api_client.get(
        f"{OUTER_CARDS_URL}/{first_outer['id']}/inner-cards",
    )
    assert parent_list.status_code == 200
    assert [item["outer_card_id"] for item in parent_list.json()["items"]] == [first_outer["id"]]

    deleted = api_client.delete(f"{INNER_CARDS_URL}/{first['id']}")
    assert deleted.status_code == 204
    assert api_client.get(f"{INNER_CARDS_URL}/{first['id']}").status_code == 404
    assert api_client.get(f"{INNER_CARDS_URL}/not-a-uuid").status_code == 422
    assert api_client.get(f"{INNER_CARDS_URL}/{uuid4()}").status_code == 404


def test_openapi_documents_global_inner_card_collection(api_client: TestClient) -> None:
    response = api_client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    global_collection = schema["paths"]["/api/v1/inner-cards"]["get"]
    detail_path = schema["paths"]["/api/v1/inner-cards/{inner_card_id}"]

    assert set(detail_path) >= {"get", "patch", "delete"}
    assert "200" in global_collection["responses"]
    assert "422" in global_collection["responses"]
    parameters = {parameter["name"]: parameter for parameter in global_collection["parameters"]}
    assert set(parameters) == {"offset", "limit", "search"}
    assert parameters["offset"]["schema"]["default"] == 0
    assert parameters["offset"]["schema"]["minimum"] == 0
    assert parameters["limit"]["schema"]["default"] == 50
    assert parameters["limit"]["schema"]["minimum"] == 1
    assert parameters["limit"]["schema"]["maximum"] == 200
    response_schema = global_collection["responses"]["200"]["content"]["application/json"]["schema"]
    assert response_schema["$ref"].endswith("/InnerCardListResponse")
