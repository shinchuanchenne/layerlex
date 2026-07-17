import { beforeEach, describe, expect, it, vi } from "vitest";

import { listInnerCards, type InnerCard } from "./innerCards";
import { listOuterCards, type OuterCard } from "./outerCards";
import {
  fetchCompleteOuterReviewInnerContent,
  fetchCompleteOuterReviewDeck,
  OUTER_REVIEW_INNER_PAGE_SIZE,
  OUTER_REVIEW_PAGE_SIZE,
  outerReviewKeys,
} from "./outerReview";

vi.mock("./innerCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./innerCards")>();
  return { ...actual, listInnerCards: vi.fn() };
});

vi.mock("./outerCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./outerCards")>();
  return { ...actual, listOuterCards: vi.fn() };
});

function card(index: number): OuterCard {
  return {
    id: "00000000-0000-4000-8000-" + String(index).padStart(12, "0"),
    deck_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    term: "term-" + index,
    reading: null,
    part_of_speech: null,
    meaning: "meaning-" + index,
    jlpt_level: null,
    notes: null,
    sort_order: index,
    created_at: "2026-07-14T01:00:00Z",
    updated_at: "2026-07-14T01:00:00Z",
  };
}

function innerCard(index: number, outerCardId = "outer-card-id"): InnerCard {
  return {
    id: "10000000-0000-4000-8000-" + String(index).padStart(12, "0"),
    outer_card_id: outerCardId,
    expression: "expression-" + index,
    reading: null,
    meaning: "meaning-" + index,
    usage_note: null,
    notes: null,
    sort_order: index,
    created_at: "2026-07-14T01:00:00Z",
    updated_at: "2026-07-14T01:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("complete ordered outer review deck", () => {
  it("returns an empty deck from an empty first page", async () => {
    vi.mocked(listOuterCards).mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: OUTER_REVIEW_PAGE_SIZE,
    });

    await expect(fetchCompleteOuterReviewDeck()).resolves.toEqual([]);
    expect(listOuterCards).toHaveBeenCalledTimes(1);
  });

  it("preserves the stable order supplied by the API", async () => {
    const ordered = [card(2), card(7), card(9)];
    vi.mocked(listOuterCards).mockResolvedValue({
      items: ordered,
      total: ordered.length,
      offset: 0,
      limit: OUTER_REVIEW_PAGE_SIZE,
    });

    const deck = await fetchCompleteOuterReviewDeck();

    expect(deck.map((item) => item.id)).toEqual(ordered.map((item) => item.id));
  });

  it("loads every page and does not silently truncate after 200 cards", async () => {
    const allCards = Array.from({ length: 401 }, (_, index) => card(index));
    vi.mocked(listOuterCards).mockImplementation(async (params) => ({
      items: allCards.slice(params.offset, params.offset + params.limit),
      total: allCards.length,
      offset: params.offset,
      limit: params.limit,
    }));

    const deck = await fetchCompleteOuterReviewDeck();

    expect(deck).toHaveLength(401);
    expect(deck[400].term).toBe("term-400");
    expect(listOuterCards).toHaveBeenNthCalledWith(1, {
      search: "",
      offset: 0,
      limit: 200,
    });
    expect(listOuterCards).toHaveBeenNthCalledWith(2, {
      search: "",
      offset: 200,
      limit: 200,
    });
    expect(listOuterCards).toHaveBeenNthCalledWith(3, {
      search: "",
      offset: 400,
      limit: 200,
    });
  });

  it("fails clearly if pagination stops before total is reached", async () => {
    vi.mocked(listOuterCards)
      .mockResolvedValueOnce({
        items: [card(0)],
        total: 2,
        offset: 0,
        limit: OUTER_REVIEW_PAGE_SIZE,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 2,
        offset: 1,
        limit: OUTER_REVIEW_PAGE_SIZE,
      });

    await expect(fetchCompleteOuterReviewDeck()).rejects.toThrow(
      "stopped before the complete review deck",
    );
  });
});

describe("complete outer-review inner content", () => {
  it("scopes its query key to the selected outer card", () => {
    expect(outerReviewKeys.innerContent("outer-1")).toEqual([
      "outer-review",
      "inner-content",
      "outer-1",
    ]);
    expect(outerReviewKeys.innerContent("outer-2")).not.toEqual(
      outerReviewKeys.innerContent("outer-1"),
    );
  });

  it("returns an empty collection from an empty page", async () => {
    vi.mocked(listInnerCards).mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: OUTER_REVIEW_INNER_PAGE_SIZE,
    });

    await expect(
      fetchCompleteOuterReviewInnerContent("outer-card-id"),
    ).resolves.toEqual([]);
    expect(listInnerCards).toHaveBeenCalledWith("outer-card-id", {
      search: "",
      offset: 0,
      limit: 200,
    });
  });

  it("loads and preserves one API page in stable order", async () => {
    const ordered = [innerCard(4), innerCard(8), innerCard(11)];
    vi.mocked(listInnerCards).mockResolvedValue({
      items: ordered,
      total: ordered.length,
      offset: 0,
      limit: OUTER_REVIEW_INNER_PAGE_SIZE,
    });

    const result = await fetchCompleteOuterReviewInnerContent("outer-card-id");

    expect(result.map((item) => item.id)).toEqual(
      ordered.map((item) => item.id),
    );
    expect(listInnerCards).toHaveBeenCalledTimes(1);
  });

  it("loads multiple pages and more than 200 inner cards", async () => {
    const allInnerCards = Array.from({ length: 405 }, (_, index) =>
      innerCard(index),
    );
    vi.mocked(listInnerCards).mockImplementation(
      async (_outerCardId, params) => ({
        items: allInnerCards.slice(params.offset, params.offset + params.limit),
        total: allInnerCards.length,
        offset: params.offset,
        limit: params.limit,
      }),
    );

    const result = await fetchCompleteOuterReviewInnerContent("outer-card-id");

    expect(result).toHaveLength(405);
    expect(result[404].expression).toBe("expression-404");
    expect(listInnerCards).toHaveBeenNthCalledWith(2, "outer-card-id", {
      search: "",
      offset: 200,
      limit: 200,
    });
    expect(listInnerCards).toHaveBeenNthCalledWith(3, "outer-card-id", {
      search: "",
      offset: 400,
      limit: 200,
    });
  });

  it("fails clearly if pagination stops before total", async () => {
    vi.mocked(listInnerCards)
      .mockResolvedValueOnce({
        items: [innerCard(0)],
        total: 2,
        offset: 0,
        limit: OUTER_REVIEW_INNER_PAGE_SIZE,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 2,
        offset: 1,
        limit: OUTER_REVIEW_INNER_PAGE_SIZE,
      });

    await expect(
      fetchCompleteOuterReviewInnerContent("outer-card-id"),
    ).rejects.toThrow("stopped before the complete inner content");
  });
});
