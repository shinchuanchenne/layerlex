from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TEST_DECK_ID

DECKS_URL = "/api/v1/decks"
OUTER_CARDS_URL = "/api/v1/outer-cards"
INNER_CARDS_URL = "/api/v1/inner-cards"
DECK_NOT_FOUND = {"detail": "Deck not found"}
DECK_NOT_EMPTY = {"detail": "Deck contains outer cards"}


def create_deck(client: TestClient, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {"name": "Lesson 13"}
    payload.update(overrides)
    response = client.post(DECKS_URL, json=payload)
    assert response.status_code == 201
    return response.json()


def create_outer_card(
    client: TestClient,
    deck_id: object,
    **overrides: object,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "deck_id": deck_id,
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


def test_create_deck_normalises_fields_and_serialises_uuid_and_utc(
    api_client: TestClient,
) -> None:
    response = api_client.post(
        DECKS_URL,
        json={
            "name": "  Lesson 13  ",
            "description": "  Chapter vocabulary  ",
            "sort_order": 7,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Lesson 13"
    assert body["description"] == "Chapter vocabulary"
    assert body["sort_order"] == 7
    assert str(UUID(body["id"])) == body["id"]
    for field_name in ("created_at", "updated_at"):
        parsed = datetime.fromisoformat(body[field_name].replace("Z", "+00:00"))
        assert parsed.utcoffset() == timedelta(0)
    assert "outer_cards" not in body


def test_create_deck_uses_defaults_and_normalises_blank_description(
    api_client: TestClient,
) -> None:
    deck = create_deck(api_client, description="   ")

    assert deck["description"] is None
    assert deck["sort_order"] == 0


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "   "},
        {"description": "missing name"},
        {"name": "Lesson", "unknown": "field"},
    ],
)
def test_create_deck_rejects_invalid_payloads(
    api_client: TestClient,
    payload: dict[str, object],
) -> None:
    response = api_client.post(DECKS_URL, json=payload)

    assert response.status_code == 422


def test_list_decks_uses_stable_order_and_pagination(api_client: TestClient) -> None:
    create_deck(api_client, name="Later", sort_order=2)
    first = create_deck(api_client, name="First tied", sort_order=1)
    second = create_deck(api_client, name="Second tied", sort_order=1)

    response = api_client.get(DECKS_URL, params={"offset": 1, "limit": 2})

    assert response.status_code == 200
    body = response.json()
    all_decks = api_client.get(DECKS_URL, params={"limit": 200}).json()["items"]
    assert [item["id"] for item in all_decks if item["sort_order"] == 1] == [
        first["id"],
        second["id"],
    ]
    assert [item["name"] for item in body["items"]] == [
        "First tied",
        "Second tied",
    ]
    assert body["total"] == 4
    assert body["offset"] == 1
    assert body["limit"] == 2


@pytest.mark.parametrize("params", [{"offset": -1}, {"limit": 0}, {"limit": 201}])
def test_list_decks_rejects_invalid_pagination(
    api_client: TestClient,
    params: dict[str, int],
) -> None:
    assert api_client.get(DECKS_URL, params=params).status_code == 422


def test_retrieve_update_and_no_op_timestamp_behaviour(api_client: TestClient) -> None:
    created = create_deck(
        api_client,
        name="Lesson 13",
        description="old",
        sort_order=1,
    )

    retrieved = api_client.get(f"{DECKS_URL}/{created['id']}")
    assert retrieved.status_code == 200
    assert retrieved.json() == created

    updated = api_client.patch(
        f"{DECKS_URL}/{created['id']}",
        json={"name": "  Lesson 14  ", "description": "  ", "sort_order": 3},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Lesson 14"
    assert updated.json()["description"] is None
    assert updated.json()["sort_order"] == 3
    assert updated.json()["created_at"] == created["created_at"]
    assert updated.json()["updated_at"] > created["updated_at"]

    no_op = api_client.patch(
        f"{DECKS_URL}/{created['id']}",
        json={"name": "  Lesson 14  "},
    )
    assert no_op.status_code == 200
    assert no_op.json()["updated_at"] == updated.json()["updated_at"]


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": "  "},
        {"name": None},
        {"sort_order": None},
        {"unknown": "field"},
    ],
)
def test_update_deck_rejects_invalid_payloads(
    api_client: TestClient,
    payload: dict[str, object],
) -> None:
    deck = create_deck(api_client)

    response = api_client.patch(f"{DECKS_URL}/{deck['id']}", json=payload)

    assert response.status_code == 422


def test_missing_and_invalid_deck_ids(api_client: TestClient) -> None:
    missing_id = uuid4()

    assert api_client.get(f"{DECKS_URL}/{missing_id}").json() == DECK_NOT_FOUND
    assert (
        api_client.patch(f"{DECKS_URL}/{missing_id}", json={"name": "Missing"}).json()
        == DECK_NOT_FOUND
    )
    assert api_client.delete(f"{DECKS_URL}/{missing_id}").json() == DECK_NOT_FOUND
    assert api_client.get(f"{DECKS_URL}/not-a-uuid").status_code == 422


def test_delete_empty_deck(api_client: TestClient) -> None:
    deck = create_deck(api_client)

    response = api_client.delete(f"{DECKS_URL}/{deck['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert api_client.get(f"{DECKS_URL}/{deck['id']}").status_code == 404


def test_delete_non_empty_deck_returns_409_without_deleting_cards(
    api_client: TestClient,
) -> None:
    deck = create_deck(api_client)
    card = create_outer_card(api_client, deck["id"])

    response = api_client.delete(f"{DECKS_URL}/{deck['id']}")

    assert response.status_code == 409
    assert response.json() == DECK_NOT_EMPTY
    assert api_client.get(f"{DECKS_URL}/{deck['id']}").status_code == 200
    assert api_client.get(f"{OUTER_CARDS_URL}/{card['id']}").status_code == 200


def test_outer_card_creation_requires_an_existing_deck(api_client: TestClient) -> None:
    missing = api_client.post(
        OUTER_CARDS_URL,
        json={"term": "経験", "meaning": "經驗"},
    )
    unknown = api_client.post(
        OUTER_CARDS_URL,
        json={
            "deck_id": str(uuid4()),
            "term": "経験",
            "meaning": "經驗",
        },
    )

    assert missing.status_code == 422
    assert unknown.status_code == 404
    assert unknown.json() == DECK_NOT_FOUND


def test_outer_card_read_move_and_invalid_move(api_client: TestClient) -> None:
    first_deck = create_deck(api_client, name="Lesson 13")
    second_deck = create_deck(api_client, name="Lesson 14")
    card = create_outer_card(api_client, first_deck["id"])

    assert card["deck_id"] == first_deck["id"]

    moved = api_client.patch(
        f"{OUTER_CARDS_URL}/{card['id']}",
        json={"deck_id": second_deck["id"]},
    )
    assert moved.status_code == 200
    assert moved.json()["deck_id"] == second_deck["id"]

    rejected = api_client.patch(
        f"{OUTER_CARDS_URL}/{card['id']}",
        json={"deck_id": str(uuid4())},
    )
    assert rejected.status_code == 404
    assert rejected.json() == DECK_NOT_FOUND
    assert api_client.get(f"{OUTER_CARDS_URL}/{card['id']}").json()["deck_id"] == second_deck["id"]

    null_move = api_client.patch(
        f"{OUTER_CARDS_URL}/{card['id']}",
        json={"deck_id": None},
    )
    assert null_move.status_code == 422


def test_outer_card_filter_preserves_global_and_deck_ordering(
    api_client: TestClient,
) -> None:
    first_deck = create_deck(api_client, name="Lesson 13")
    second_deck = create_deck(api_client, name="Lesson 14")
    first = create_outer_card(
        api_client,
        first_deck["id"],
        term="first",
        sort_order=1,
    )
    second = create_outer_card(
        api_client,
        first_deck["id"],
        term="second",
        sort_order=2,
    )
    other = create_outer_card(
        api_client,
        second_deck["id"],
        term="other",
        sort_order=0,
    )

    filtered = api_client.get(
        OUTER_CARDS_URL,
        params={"deck_id": first_deck["id"]},
    )
    global_list = api_client.get(OUTER_CARDS_URL)

    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["items"]] == [
        first["id"],
        second["id"],
    ]
    assert filtered.json()["total"] == 2
    assert [item["id"] for item in global_list.json()["items"]] == [
        other["id"],
        first["id"],
        second["id"],
    ]


def test_outer_card_filter_combines_with_search_and_validates_uuid(
    api_client: TestClient,
) -> None:
    first_deck = create_deck(api_client, name="Lesson 13")
    second_deck = create_deck(api_client, name="Lesson 14")
    matched = create_outer_card(
        api_client,
        first_deck["id"],
        term="Schedule",
        meaning="plan",
    )
    create_outer_card(
        api_client,
        second_deck["id"],
        term="Schedule",
        meaning="other plan",
    )

    response = api_client.get(
        OUTER_CARDS_URL,
        params={"deck_id": first_deck["id"], "search": "schedule"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert [item["id"] for item in response.json()["items"]] == [matched["id"]]
    unknown = api_client.get(
        OUTER_CARDS_URL,
        params={"deck_id": str(uuid4())},
    )
    assert unknown.status_code == 404
    assert unknown.json() == DECK_NOT_FOUND
    assert api_client.get(OUTER_CARDS_URL, params={"deck_id": "not-a-uuid"}).status_code == 422


def test_inner_cards_remain_attached_when_outer_card_moves(
    api_client: TestClient,
) -> None:
    first_deck = create_deck(api_client, name="Lesson 13")
    second_deck = create_deck(api_client, name="Lesson 14")
    outer = create_outer_card(api_client, first_deck["id"])
    inner = create_inner_card(api_client, outer["id"])

    response = api_client.patch(
        f"{OUTER_CARDS_URL}/{outer['id']}",
        json={"deck_id": second_deck["id"]},
    )

    assert response.status_code == 200
    assert response.json()["deck_id"] == second_deck["id"]
    retrieved_inner = api_client.get(f"{INNER_CARDS_URL}/{inner['id']}")
    assert retrieved_inner.status_code == 200
    assert retrieved_inner.json()["outer_card_id"] == outer["id"]
    parent_list = api_client.get(f"{OUTER_CARDS_URL}/{outer['id']}/inner-cards")
    assert [item["id"] for item in parent_list.json()["items"]] == [inner["id"]]


def test_openapi_documents_decks_and_outer_card_deck_contract(
    api_client: TestClient,
) -> None:
    response = api_client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    collection = schema["paths"][DECKS_URL]
    detail = schema["paths"][f"{DECKS_URL}/{{deck_id}}"]
    assert set(collection) >= {"get", "post"}
    assert set(detail) >= {"get", "patch", "delete"}
    assert "201" in collection["post"]["responses"]
    assert "200" in collection["get"]["responses"]
    assert "204" in detail["delete"]["responses"]
    assert "404" in detail["delete"]["responses"]
    assert "409" in detail["delete"]["responses"]

    component_schemas = schema["components"]["schemas"]
    for schema_name in ("DeckCreate", "DeckUpdate", "DeckRead", "DeckListResponse"):
        assert schema_name in component_schemas
    assert "outer_cards" not in component_schemas["DeckRead"]["properties"]
    assert "deck_id" in component_schemas["OuterCardCreate"]["required"]
    assert "deck_id" in component_schemas["OuterCardRead"]["properties"]

    outer_list_parameters = {
        parameter["name"] for parameter in schema["paths"][OUTER_CARDS_URL]["get"]["parameters"]
    }
    assert outer_list_parameters == {"offset", "limit", "search", "deck_id"}
    assert str(TEST_DECK_ID) == "11111111-1111-4111-8111-111111111111"
