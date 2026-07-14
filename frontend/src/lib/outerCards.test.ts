import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, getApiErrorMessage } from "./api";
import {
  createOuterCard,
  deleteOuterCard,
  listOuterCards,
  type OuterCard,
  type OuterCardCreateInput,
} from "./outerCards";

const card: OuterCard = {
  id: "11111111-1111-4111-8111-111111111111",
  term: "経験",
  reading: null,
  part_of_speech: null,
  meaning: "經驗",
  jlpt_level: null,
  notes: null,
  sort_order: 0,
  created_at: "2026-07-14T01:00:00Z",
  updated_at: "2026-07-14T01:00:00Z",
};

const createPayload: OuterCardCreateInput = {
  term: "経験",
  reading: null,
  part_of_speech: null,
  meaning: "經驗",
  jlpt_level: null,
  notes: null,
  sort_order: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("outer-card API client", () => {
  it("uses the relative proxy path and backend list parameters", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [card], total: 1, offset: 10, limit: 20 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await listOuterCards({ search: "経験", offset: 10, limit: 20 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/outer-cards?offset=10&limit=20&search=%E7%B5%8C%E9%A8%93",
      { headers: {} },
    );
  });

  it("sends typed JSON create requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(card), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await createOuterCard(createPayload);

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/outer-cards", {
      method: "POST",
      body: JSON.stringify(createPayload),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("parses FastAPI validation issues into a useful error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [
            {
              loc: ["body", "term"],
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
      await createOuterCard(createPayload);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422 });
    expect(getApiErrorMessage(error)).toBe("term: must not be blank");
  });

  it("handles empty 204 responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await expect(deleteOuterCard(card.id)).resolves.toBeUndefined();
  });
});
