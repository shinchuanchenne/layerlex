import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, getApiErrorMessage } from "./api";
import {
  createDeck,
  deleteDeck,
  listAllDecks,
  listDecks,
  retrieveDeck,
  updateDeck,
  type Deck,
  type DeckCreateInput,
} from "./decks";

const deck: Deck = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Lesson 13",
  description: "Chapter vocabulary",
  sort_order: 13,
  created_at: "2026-07-17T01:00:00Z",
  updated_at: "2026-07-17T01:00:00Z",
};

const createPayload: DeckCreateInput = {
  name: "Lesson 13",
  description: "Chapter vocabulary",
  sort_order: 13,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deck API client", () => {
  it("lists decks with backend pagination", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [deck], total: 1, offset: 10, limit: 20 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await listDecks({ offset: 10, limit: 20 });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/decks?offset=10&limit=20", {
      headers: {},
    });
  });

  it("retrieves, creates, updates, and deletes through typed paths", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(deck), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(deck), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...deck, name: "Lesson 14" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await retrieveDeck(deck.id);
    await createDeck(createPayload);
    await updateDeck(deck.id, { name: "Lesson 14" });
    await deleteDeck(deck.id);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/decks/" + deck.id, {
      headers: {},
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/decks", {
      method: "POST",
      body: JSON.stringify(createPayload),
      headers: { "Content-Type": "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/v1/decks/" + deck.id, {
      method: "PATCH",
      body: JSON.stringify({ name: "Lesson 14" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/v1/decks/" + deck.id, {
      method: "DELETE",
      headers: {},
    });
  });

  it("loads every page for the deck selector without reordering", async () => {
    const laterDeck = { ...deck, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [deck],
            total: 2,
            offset: 0,
            limit: 200,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [laterDeck],
            total: 2,
            offset: 1,
            limit: 200,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(listAllDecks()).resolves.toEqual([deck, laterDeck]);
  });

  it("fails clearly when pagination stops before total", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [deck],
            total: 2,
            offset: 0,
            limit: 200,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [], total: 2, offset: 1, limit: 200 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(listAllDecks()).rejects.toThrow(
      "before the complete deck list was loaded",
    );
  });

  it("surfaces backend conflict messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Deck contains outer cards" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    let error: unknown;
    try {
      await deleteDeck(deck.id);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409 });
    expect(getApiErrorMessage(error)).toBe("Deck contains outer cards");
  });
});
