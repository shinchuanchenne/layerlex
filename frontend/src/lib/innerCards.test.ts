import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, getApiErrorMessage } from "./api";
import {
  createInnerCard,
  deleteInnerCard,
  listAllInnerCards,
  listInnerCards,
  retrieveInnerCard,
  updateInnerCard,
  type InnerCard,
  type InnerCardCreateInput,
} from "./innerCards";

const outerCardId = "11111111-1111-4111-8111-111111111111";
const innerCardId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const card: InnerCard = {
  id: innerCardId,
  outer_card_id: outerCardId,
  expression: "経験を積む",
  reading: null,
  meaning: "累積經驗",
  usage_note: null,
  notes: null,
  sort_order: 0,
  created_at: "2026-07-14T01:00:00Z",
  updated_at: "2026-07-14T01:00:00Z",
};
const createPayload: InnerCardCreateInput = {
  expression: card.expression,
  reading: null,
  meaning: card.meaning,
  usage_note: null,
  notes: null,
  sort_order: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("inner-card API client", () => {
  it("uses the parent-scoped list path and backend query parameters", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [card], total: 1, offset: 10, limit: 20 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await listInnerCards(outerCardId, {
      search: "経験",
      offset: 10,
      limit: 20,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/outer-cards/" +
        outerCardId +
        "/inner-cards?offset=10&limit=20&search=%E7%B5%8C%E9%A8%93",
      { headers: {} },
    );
  });

  it("uses the global collection path for the independent review source", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [card], total: 1, offset: 20, limit: 50 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await listAllInnerCards({ search: "搭配", offset: 20, limit: 50 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/inner-cards?offset=20&limit=50&search=%E6%90%AD%E9%85%8D",
      { headers: {} },
    );
  });

  it("uses direct retrieve and update paths without a parent payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(card), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    await retrieveInnerCard(innerCardId);
    await updateInnerCard(innerCardId, { meaning: "增加經驗" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/inner-cards/" + innerCardId,
      { headers: {} },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/inner-cards/" + innerCardId,
      {
        method: "PATCH",
        body: JSON.stringify({ meaning: "增加經驗" }),
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("creates through the route parent with a typed JSON body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(card), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await createInnerCard(outerCardId, createPayload);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/outer-cards/" + outerCardId + "/inner-cards",
      {
        method: "POST",
        body: JSON.stringify(createPayload),
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("parses FastAPI inner-card validation errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [
            {
              loc: ["body", "expression"],
              msg: "must not be blank",
              type: "value_error",
            },
          ],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    );

    let error: unknown;
    try {
      await createInnerCard(outerCardId, createPayload);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422 });
    expect(getApiErrorMessage(error)).toBe("expression: must not be blank");
  });

  it("handles an empty delete response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await expect(deleteInnerCard(innerCardId)).resolves.toBeUndefined();
  });
});
