import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { ApiError } from "../lib/api";
import {
  createDeck,
  deleteDeck,
  listAllDecks,
  listDecks,
  retrieveDeck,
  updateDeck,
  type Deck,
} from "../lib/decks";
import {
  createInnerCard,
  deleteInnerCard,
  innerCardKeys,
  listInnerCards,
  retrieveInnerCard,
  updateInnerCard,
  type InnerCard,
  type InnerCardListResponse,
} from "../lib/innerCards";
import { innerReviewKeys } from "../lib/innerReviewKeys";
import {
  createOuterCard,
  deleteOuterCard,
  listOuterCards,
  retrieveOuterCard,
  updateOuterCard,
  type OuterCard,
} from "../lib/outerCards";
import { outerReviewKeys } from "../lib/outerReviewKeys";

vi.mock("../lib/outerCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/outerCards")>();
  return {
    ...actual,
    listOuterCards: vi.fn(),
    retrieveOuterCard: vi.fn(),
    createOuterCard: vi.fn(),
    updateOuterCard: vi.fn(),
    deleteOuterCard: vi.fn(),
  };
});

vi.mock("../lib/decks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/decks")>();
  return {
    ...actual,
    listDecks: vi.fn(),
    listAllDecks: vi.fn(),
    retrieveDeck: vi.fn(),
    createDeck: vi.fn(),
    updateDeck: vi.fn(),
    deleteDeck: vi.fn(),
  };
});

vi.mock("../lib/innerCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/innerCards")>();
  return {
    ...actual,
    listInnerCards: vi.fn(),
    retrieveInnerCard: vi.fn(),
    createInnerCard: vi.fn(),
    updateInnerCard: vi.fn(),
    deleteInnerCard: vi.fn(),
  };
});

const firstDeck: Deck = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Lesson 13",
  description: null,
  sort_order: 13,
  created_at: "2026-07-14T00:00:00Z",
  updated_at: "2026-07-14T00:00:00Z",
};

const firstOuter: OuterCard = {
  id: "11111111-1111-4111-8111-111111111111",
  deck_id: firstDeck.id,
  term: "経験",
  reading: "けいけん",
  part_of_speech: "名詞",
  meaning: "經驗",
  jlpt_level: "N3",
  notes: null,
  sort_order: 0,
  created_at: "2026-07-14T01:00:00Z",
  updated_at: "2026-07-14T01:00:00Z",
};

const secondOuter: OuterCard = {
  ...firstOuter,
  id: "22222222-2222-4222-8222-222222222222",
  term: "予定",
  reading: "よてい",
  meaning: "預定",
};

const firstInner: InnerCard = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  outer_card_id: firstOuter.id,
  expression: "経験を積む",
  reading: "けいけんをつむ",
  meaning: "累積經驗",
  usage_note: "仕事の文脈でよく使う",
  notes: "Useful collocation",
  sort_order: 1,
  created_at: "2026-07-14T03:00:00Z",
  updated_at: "2026-07-14T03:00:00Z",
};

const siblingInner: InnerCard = {
  ...firstInner,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expression: "経験がある",
  reading: null,
  meaning: "有經驗",
  usage_note: null,
  notes: null,
  sort_order: 2,
};

const foreignInner: InnerCard = {
  ...firstInner,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  outer_card_id: secondOuter.id,
  expression: "予定を立てる",
  meaning: "制定計畫",
};

function innerList(
  items: InnerCard[] = [firstInner, siblingInner],
  total = items.length,
  offset = 0,
): InnerCardListResponse {
  return { items, total, offset, limit: 10 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderManagement(
  route = "/decks/" + firstDeck.id + "/cards/" + firstOuter.id,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

beforeEach(() => {
  vi.mocked(listDecks).mockResolvedValue({
    items: [firstDeck],
    total: 1,
    offset: 0,
    limit: 10,
  });
  vi.mocked(listAllDecks).mockResolvedValue([firstDeck]);
  vi.mocked(retrieveDeck).mockResolvedValue(firstDeck);
  vi.mocked(createDeck).mockResolvedValue(firstDeck);
  vi.mocked(updateDeck).mockResolvedValue(firstDeck);
  vi.mocked(deleteDeck).mockResolvedValue();
  vi.mocked(listOuterCards).mockResolvedValue({
    items: [firstOuter, secondOuter],
    total: 2,
    offset: 0,
    limit: 10,
  });
  vi.mocked(retrieveOuterCard).mockImplementation(async (outerCardId) =>
    outerCardId === secondOuter.id ? secondOuter : firstOuter,
  );
  vi.mocked(createOuterCard).mockResolvedValue(firstOuter);
  vi.mocked(updateOuterCard).mockResolvedValue(firstOuter);
  vi.mocked(deleteOuterCard).mockResolvedValue();
  vi.mocked(listInnerCards).mockImplementation(async (outerCardId) =>
    outerCardId === firstOuter.id ? innerList() : innerList([]),
  );
  vi.mocked(retrieveInnerCard).mockImplementation(async (innerCardId) =>
    innerCardId === siblingInner.id ? siblingInner : firstInner,
  );
  vi.mocked(createInnerCard).mockResolvedValue(firstInner);
  vi.mocked(updateInnerCard).mockResolvedValue(firstInner);
  vi.mocked(deleteInnerCard).mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("inner-card directory and parent scope", () => {
  it("does not request inner cards without an outer selection", async () => {
    renderManagement("/decks/" + firstDeck.id);
    await screen.findByRole("heading", {
      name: "Select a vocabulary word",
    });

    expect(listInnerCards).not.toHaveBeenCalled();
    expect(retrieveInnerCard).not.toHaveBeenCalled();
  });

  it("shows loading and empty states", async () => {
    const pending = deferred<InnerCardListResponse>();
    vi.mocked(listInnerCards).mockReturnValueOnce(pending.promise);
    renderManagement();

    expect(await screen.findByText("Loading inner cards…")).toBeInTheDocument();
    pending.resolve(innerList([]));
    expect(await screen.findByText("No inner cards yet")).toBeInTheDocument();
  });

  it("renders only cards that match the selected outer card", async () => {
    vi.mocked(listInnerCards).mockResolvedValue(
      innerList([firstInner, foreignInner], 2),
    );
    renderManagement();

    expect(
      await screen.findByRole("link", { name: /経験を積む/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /予定を立てる/ }),
    ).not.toBeInTheDocument();
  });

  it("marks the nested-route inner card as selected", async () => {
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );

    const selected = await screen.findByRole("link", {
      name: /経験を積む/,
    });
    expect(selected).toHaveAttribute("aria-current", "page");
    expect(selected).toHaveTextContent("Selected inner card");
  });

  it("debounces backend search and displays empty search results", async () => {
    const user = userEvent.setup();
    vi.mocked(listInnerCards).mockImplementation(
      async (_outerCardId, params) =>
        params.search ? innerList([]) : innerList(),
    );
    renderManagement();
    await screen.findByRole("link", { name: /経験を積む/ });

    await user.type(screen.getByLabelText("Search inner cards"), "missing");

    await waitFor(() =>
      expect(listInnerCards).toHaveBeenLastCalledWith(firstOuter.id, {
        search: "missing",
        offset: 0,
        limit: 10,
      }),
    );
    expect(
      await screen.findByText("No matching inner cards"),
    ).toBeInTheDocument();
  });

  it("uses backend pagination parameters", async () => {
    const user = userEvent.setup();
    const tenCards = Array.from({ length: 10 }, (_, index) => ({
      ...firstInner,
      id: "00000000-0000-4000-8000-" + String(index).padStart(12, "0"),
      expression: "inner-" + index,
    }));
    vi.mocked(listInnerCards).mockImplementation(
      async (_outerCardId, params) =>
        params.offset === 0
          ? innerList(tenCards, 11)
          : innerList([siblingInner], 11, 10),
    );
    renderManagement();

    await screen.findByText("Showing 1–10 of 11");
    await user.click(screen.getByRole("button", { name: "Next inner page" }));

    await waitFor(() =>
      expect(listInnerCards).toHaveBeenLastCalledWith(firstOuter.id, {
        search: "",
        offset: 10,
        limit: 10,
      }),
    );
    expect(await screen.findByText("Showing 11–11 of 11")).toBeInTheDocument();
  });

  it("shows a list error and retries", async () => {
    const user = userEvent.setup();
    vi.mocked(listInnerCards)
      .mockRejectedValueOnce(new ApiError(500, "Inner list unavailable"))
      .mockResolvedValueOnce(innerList());
    renderManagement();

    expect(
      await screen.findByText("Inner list unavailable"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Retry loading inner cards" }),
    );

    expect(
      await screen.findByRole("link", { name: /経験を積む/ }),
    ).toBeInTheDocument();
    expect(listInnerCards).toHaveBeenCalledTimes(2);
  });

  it("resets inner search and pagination when the outer card changes", async () => {
    const user = userEvent.setup();
    vi.mocked(listInnerCards).mockResolvedValue(innerList([firstInner], 11));
    renderManagement();
    await screen.findByRole("link", { name: /経験を積む/ });
    await user.type(screen.getByLabelText("Search inner cards"), "経験");
    await waitFor(() =>
      expect(listInnerCards).toHaveBeenLastCalledWith(
        firstOuter.id,
        expect.objectContaining({ search: "経験", offset: 0 }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Next inner page" }));
    await waitFor(() =>
      expect(listInnerCards).toHaveBeenLastCalledWith(
        firstOuter.id,
        expect.objectContaining({ search: "経験", offset: 10 }),
      ),
    );

    await user.click(screen.getByRole("link", { name: /予定/ }));

    await waitFor(() =>
      expect(listInnerCards).toHaveBeenLastCalledWith(secondOuter.id, {
        search: "",
        offset: 0,
        limit: 10,
      }),
    );
    expect(screen.getByLabelText("Search inner cards")).toHaveValue("");
    expect(
      screen.getByRole("heading", { name: "Select an inner card" }),
    ).toBeInTheDocument();
  });
});

describe("inner-card nested routing and retrieval", () => {
  it("restores a direct nested selection and renders all fields", async () => {
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );

    expect(
      await screen.findByRole("heading", { name: firstInner.expression }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(firstInner.reading ?? "").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(firstInner.usage_note ?? "")).toBeInTheDocument();
    expect(screen.getByText(firstInner.notes ?? "")).toBeInTheDocument();
    expect(retrieveInnerCard).toHaveBeenCalledWith(firstInner.id);
  });

  it.each([
    [new ApiError(404, "Inner card not found"), "Inner card not found"],
    [new ApiError(422, "Invalid inner card ID"), "Unable to load inner card"],
  ])("shows a clear missing or invalid route state", async (error, heading) => {
    vi.mocked(retrieveInnerCard).mockRejectedValue(error);
    renderManagement(
      "/decks/" + firstDeck.id + "/cards/" + firstOuter.id + "/inner/invalid",
    );

    expect(
      await screen.findByRole("heading", { name: heading }),
    ).toBeInTheDocument();
  });

  it("refuses to display an inner card under the wrong outer parent", async () => {
    vi.mocked(retrieveInnerCard).mockResolvedValue(foreignInner);
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        foreignInner.id,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Inner card belongs to another outer card",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: foreignInner.expression }),
    ).not.toBeInTheDocument();
  });

  it("clears inner selection when another outer card is selected", async () => {
    const user = userEvent.setup();
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    await screen.findByRole("heading", { name: firstInner.expression });

    await user.click(screen.getByRole("link", { name: /予定/ }));

    expect(
      await screen.findByRole("heading", { name: "Select an inner card" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: firstInner.expression }),
    ).not.toBeInTheDocument();
  });
});

describe("inner-card create and edit", () => {
  it("opens create and validates required fields", async () => {
    const user = userEvent.setup();
    renderManagement();
    await screen.findByText("Inner-card management");

    await user.click(screen.getByRole("button", { name: "Add inner card" }));
    expect(
      screen.getByRole("heading", { name: "Add usage content" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/outer card id/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create inner card" }));

    expect(
      screen.getByText("Expression and meaning are required."),
    ).toBeInTheDocument();
    expect(createInnerCard).not.toHaveBeenCalled();
  });

  it("creates under the route parent, normalises blanks, and navigates", async () => {
    const user = userEvent.setup();
    const created = {
      ...firstInner,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      expression: "予定を確認する",
      reading: null,
      meaning: "確認行程",
      usage_note: null,
      notes: null,
      sort_order: 0,
    };
    vi.mocked(createInnerCard).mockResolvedValue(created);
    renderManagement();
    await screen.findByText("Inner-card management");
    await user.click(screen.getByRole("button", { name: "Add inner card" }));
    await user.type(screen.getByLabelText(/Expression/), " 予定を確認する ");
    await user.type(screen.getByLabelText(/Meaning/), " 確認行程 ");
    await user.type(screen.getByLabelText("Reading"), "   ");
    await user.type(screen.getByLabelText("Usage note"), "   ");
    await user.click(screen.getByRole("button", { name: "Create inner card" }));

    await waitFor(() =>
      expect(createInnerCard).toHaveBeenCalledWith(firstOuter.id, {
        expression: "予定を確認する",
        reading: null,
        meaning: "確認行程",
        usage_note: null,
        notes: null,
        sort_order: 0,
      }),
    );
    expect(
      await screen.findByRole("heading", {
        name: created.expression,
      }),
    ).toBeInTheDocument();
  });

  it("shows create API errors and prevents duplicate submission", async () => {
    const user = userEvent.setup();
    const pending = deferred<InnerCard>();
    vi.mocked(createInnerCard).mockReturnValueOnce(pending.promise);
    renderManagement();
    await screen.findByText("Inner-card management");
    await user.click(screen.getByRole("button", { name: "Add inner card" }));
    await user.type(screen.getByLabelText(/Expression/), "例");
    await user.type(screen.getByLabelText(/Meaning/), "example");
    await user.click(screen.getByRole("button", { name: "Create inner card" }));

    const saving = screen.getByRole("button", {
      name: "Saving inner card…",
    });
    expect(saving).toBeDisabled();
    await user.click(saving);
    expect(createInnerCard).toHaveBeenCalledTimes(1);
    pending.resolve(firstInner);
  });

  it("displays FastAPI errors from create", async () => {
    const user = userEvent.setup();
    vi.mocked(createInnerCard).mockRejectedValue(
      new ApiError(422, "Invalid", [
        { loc: ["body", "expression"], msg: "must not be blank" },
      ]),
    );
    renderManagement();
    await screen.findByText("Inner-card management");
    await user.click(screen.getByRole("button", { name: "Add inner card" }));
    await user.type(screen.getByLabelText(/Expression/), "例");
    await user.type(screen.getByLabelText(/Meaning/), "example");
    await user.click(screen.getByRole("button", { name: "Create inner card" }));

    expect(
      await screen.findByText("expression: must not be blank"),
    ).toBeInTheDocument();
  });

  it("prepopulates edit and disables a no-op", async () => {
    const user = userEvent.setup();
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    await screen.findByRole("heading", { name: firstInner.expression });
    await user.click(screen.getByRole("button", { name: "Edit inner card" }));

    expect(screen.getByLabelText(/Expression/)).toHaveValue(
      firstInner.expression,
    );
    expect(screen.getByLabelText("Usage note")).toHaveValue(
      firstInner.usage_note,
    );
    expect(
      screen.getByRole("button", { name: "No inner changes to save" }),
    ).toBeDisabled();
    expect(screen.queryByLabelText(/outer card id/i)).not.toBeInTheDocument();
  });

  it("sends only changed fields and updates detail and directory", async () => {
    const user = userEvent.setup();
    const updated = {
      ...firstInner,
      meaning: "增加經驗",
      usage_note: "正式場合也可使用",
    };
    vi.mocked(updateInnerCard).mockResolvedValue(updated);
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    await screen.findByRole("heading", { name: firstInner.expression });
    await user.click(screen.getByRole("button", { name: "Edit inner card" }));
    const meaning = screen.getByLabelText(/Meaning/);
    await user.clear(meaning);
    await user.type(meaning, " 增加經驗 ");
    const usage = screen.getByLabelText("Usage note");
    await user.clear(usage);
    await user.type(usage, " 正式場合也可使用 ");
    await user.click(
      screen.getByRole("button", { name: "Save inner changes" }),
    );

    await waitFor(() =>
      expect(updateInnerCard).toHaveBeenCalledWith(firstInner.id, {
        meaning: "增加經驗",
        usage_note: "正式場合也可使用",
      }),
    );
    expect(await screen.findByText("正式場合也可使用")).toBeInTheDocument();
    expect(screen.getAllByText("增加經驗").length).toBeGreaterThan(0);
  });

  it("displays FastAPI errors from edit", async () => {
    const user = userEvent.setup();
    vi.mocked(updateInnerCard).mockRejectedValue(
      new ApiError(422, "Invalid", [
        { loc: ["body", "meaning"], msg: "must not be blank" },
      ]),
    );
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    await screen.findByRole("heading", { name: firstInner.expression });
    await user.click(screen.getByRole("button", { name: "Edit inner card" }));
    await user.type(screen.getByLabelText("Notes"), " changed");
    await user.click(
      screen.getByRole("button", { name: "Save inner changes" }),
    );

    expect(
      await screen.findByText("meaning: must not be blank"),
    ).toBeInTheDocument();
  });
});

describe("inner-card deletion and outer regression", () => {
  it("requires confirmation and supports cancellation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    await screen.findByRole("heading", { name: firstInner.expression });

    await user.click(screen.getByRole("button", { name: "Delete inner card" }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining(firstInner.expression),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("sibling inner cards will remain"),
    );
    expect(deleteInnerCard).not.toHaveBeenCalled();
  });

  it("deletes once, preserves parent and sibling, and clears selection", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteInnerCard).mockReturnValueOnce(pending.promise);
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    await screen.findByRole("heading", { name: firstInner.expression });

    await user.click(screen.getByRole("button", { name: "Delete inner card" }));
    const deleting = screen.getByRole("button", {
      name: "Deleting inner card…",
    });
    expect(deleting).toBeDisabled();
    await user.click(deleting);
    expect(deleteInnerCard).toHaveBeenCalledTimes(1);
    vi.mocked(listInnerCards).mockResolvedValue(innerList([siblingInner]));
    pending.resolve();

    expect(
      await screen.findByRole("heading", { name: "Select an inner card" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: firstOuter.term }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /経験がある/ }),
    ).toBeInTheDocument();
  });

  it("retains the inner selection when deletion fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteInnerCard).mockRejectedValue(
      new ApiError(500, "Inner delete failed"),
    );
    renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    await screen.findByRole("heading", { name: firstInner.expression });

    await user.click(screen.getByRole("button", { name: "Delete inner card" }));

    expect(await screen.findByText("Inner delete failed")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: firstInner.expression }),
    ).toBeInTheDocument();
  });

  it("clears parent-scoped inner caches when the outer card is deleted", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { queryClient } = renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    await screen.findByRole("heading", { name: firstInner.expression });
    expect(
      queryClient.getQueriesData({
        queryKey: innerCardKeys.parentLists(firstOuter.id),
      }).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await screen.findByRole("heading", {
      name: "Select a vocabulary word",
    });
    expect(
      queryClient.getQueriesData({
        queryKey: innerCardKeys.parentLists(firstOuter.id),
      }),
    ).toHaveLength(0);
    expect(
      queryClient.getQueryData(innerCardKeys.detail(firstInner.id)),
    ).toBeUndefined();
    expect(deleteOuterCard).toHaveBeenCalledWith(firstOuter.id);
  });
});

describe("outer-review inner-content cache coherence", () => {
  function seedReviewCaches(queryClient: QueryClient) {
    queryClient.setQueryData(outerReviewKeys.innerContent(firstOuter.id), [
      firstInner,
    ]);
    queryClient.setQueryData(outerReviewKeys.innerContent(secondOuter.id), [
      foreignInner,
    ]);
    queryClient.setQueryData(innerReviewKeys.orderedDeck(), [
      firstInner,
      foreignInner,
    ]);
  }

  function expectOnlyFirstParentInvalidated(queryClient: QueryClient) {
    expect(
      queryClient.getQueryState(outerReviewKeys.innerContent(firstOuter.id))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(outerReviewKeys.innerContent(secondOuter.id))
        ?.isInvalidated,
    ).toBe(false);
    expect(
      queryClient.getQueryState(innerReviewKeys.orderedDeck())?.isInvalidated,
    ).toBe(true);
  }

  it("invalidates only the created inner card's parent review content", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderManagement();
    seedReviewCaches(queryClient);
    await screen.findByText("Inner-card management");

    await user.click(screen.getByRole("button", { name: "Add inner card" }));
    await user.type(screen.getByLabelText(/Expression/), "新しい表現");
    await user.type(screen.getByLabelText(/Meaning/), "new expression");
    await user.click(screen.getByRole("button", { name: "Create inner card" }));

    await waitFor(() => expect(createInnerCard).toHaveBeenCalled());
    expectOnlyFirstParentInvalidated(queryClient);
  });

  it("invalidates the updated card's returned parent review content", async () => {
    const user = userEvent.setup();
    const updated = { ...firstInner, notes: "Updated note" };
    vi.mocked(updateInnerCard).mockResolvedValue(updated);
    const { queryClient } = renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    seedReviewCaches(queryClient);
    await screen.findByRole("heading", { name: firstInner.expression });

    await user.click(screen.getByRole("button", { name: "Edit inner card" }));
    const notes = screen.getByLabelText("Notes");
    await user.clear(notes);
    await user.type(notes, updated.notes);
    await user.click(
      screen.getByRole("button", { name: "Save inner changes" }),
    );

    await waitFor(() => expect(updateInnerCard).toHaveBeenCalled());
    expectOnlyFirstParentInvalidated(queryClient);
  });

  it("invalidates only the deleted inner card's parent review content", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { queryClient } = renderManagement(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstOuter.id +
        "/inner/" +
        firstInner.id,
    );
    seedReviewCaches(queryClient);
    await screen.findByRole("heading", { name: firstInner.expression });

    await user.click(screen.getByRole("button", { name: "Delete inner card" }));

    await waitFor(() => expect(deleteInnerCard).toHaveBeenCalled());
    expectOnlyFirstParentInvalidated(queryClient);
  });

  it("removes only the deleted outer card's review content", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { queryClient } = renderManagement(
      "/decks/" + firstDeck.id + "/cards/" + firstOuter.id,
    );
    seedReviewCaches(queryClient);
    await screen.findByRole("heading", { name: firstOuter.term });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteOuterCard).toHaveBeenCalled());
    expect(
      queryClient.getQueryData(outerReviewKeys.innerContent(firstOuter.id)),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(outerReviewKeys.innerContent(secondOuter.id)),
    ).toEqual([foreignInner]);
    expect(
      queryClient.getQueryData(innerReviewKeys.orderedDeck()),
    ).toBeUndefined();
  });
});
