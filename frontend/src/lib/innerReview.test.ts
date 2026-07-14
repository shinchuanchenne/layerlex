import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listAllInnerCards,
  type InnerCard,
  type InnerCardListResponse,
} from "./innerCards";
import {
  fetchCompleteInnerReviewDeck,
  INNER_REVIEW_PAGE_SIZE,
} from "./innerReview";

vi.mock("./innerCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./innerCards")>();
  return { ...actual, listAllInnerCards: vi.fn() };
});

function makeCard(index: number): InnerCard {
  return {
    id: "00000000-0000-4000-8000-" + String(index).padStart(12, "0"),
    outer_card_id: "11111111-1111-4111-8111-111111111111",
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

function page(
  items: InnerCard[],
  total: number,
  offset: number,
): InnerCardListResponse {
  return { items, total, offset, limit: INNER_REVIEW_PAGE_SIZE };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("complete ordered inner-review deck loader", () => {
  it("returns an empty first page", async () => {
    vi.mocked(listAllInnerCards).mockResolvedValue(page([], 0, 0));

    await expect(fetchCompleteInnerReviewDeck()).resolves.toEqual([]);
    expect(listAllInnerCards).toHaveBeenCalledWith({
      search: "",
      offset: 0,
      limit: 200,
    });
  });

  it("loads beyond 200 cards and preserves API order", async () => {
    const cards = Array.from({ length: 405 }, (_, index) => makeCard(index));
    vi.mocked(listAllInnerCards).mockImplementation(async ({ offset }) =>
      page(cards.slice(offset, offset + 200), cards.length, offset),
    );

    const result = await fetchCompleteInnerReviewDeck();

    expect(result.map((card) => card.id)).toEqual(cards.map((card) => card.id));
    expect(listAllInnerCards).toHaveBeenNthCalledWith(1, {
      search: "",
      offset: 0,
      limit: 200,
    });
    expect(listAllInnerCards).toHaveBeenNthCalledWith(2, {
      search: "",
      offset: 200,
      limit: 200,
    });
    expect(listAllInnerCards).toHaveBeenNthCalledWith(3, {
      search: "",
      offset: 400,
      limit: 200,
    });
  });

  it("fails clearly when pagination stops before total", async () => {
    vi.mocked(listAllInnerCards)
      .mockResolvedValueOnce(page([makeCard(0)], 2, 0))
      .mockResolvedValueOnce(page([], 2, 1));

    await expect(fetchCompleteInnerReviewDeck()).rejects.toThrow(
      "stopped before the complete review deck",
    );
  });

  it("rejects duplicate cards instead of building a repeated deck", async () => {
    const card = makeCard(0);
    vi.mocked(listAllInnerCards).mockResolvedValue(page([card, card], 2, 0));

    await expect(fetchCompleteInnerReviewDeck()).rejects.toThrow(
      "returned a duplicate card",
    );
  });
});
