import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { ApiError } from "../lib/api";
import {
  createOuterCard,
  deleteOuterCard,
  listOuterCards,
  retrieveOuterCard,
  updateOuterCard,
  type OuterCard,
  type OuterCardListResponse,
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

vi.mock("../lib/innerCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/innerCards")>();
  return {
    ...actual,
    listInnerCards: vi.fn(async () => ({
      items: [],
      total: 0,
      offset: 0,
      limit: 10,
    })),
    retrieveInnerCard: vi.fn(),
    createInnerCard: vi.fn(),
    updateInnerCard: vi.fn(),
    deleteInnerCard: vi.fn(),
  };
});

const firstCard: OuterCard = {
  id: "11111111-1111-4111-8111-111111111111",
  term: "経験",
  reading: "けいけん",
  part_of_speech: "名詞",
  meaning: "經驗",
  jlpt_level: "N3",
  notes: "A useful word",
  sort_order: 4,
  created_at: "2026-07-14T01:00:00Z",
  updated_at: "2026-07-14T02:00:00Z",
};

const secondCard: OuterCard = {
  ...firstCard,
  id: "22222222-2222-4222-8222-222222222222",
  term: "予定",
  reading: "よてい",
  meaning: "預定",
  jlpt_level: null,
  notes: null,
  sort_order: 5,
};

function listResponse(
  items: OuterCard[] = [firstCard, secondCard],
  total = items.length,
  offset = 0,
): OuterCardListResponse {
  return { items, total, offset, limit: 10 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderApp(route = "/cards") {
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
  vi.mocked(listOuterCards).mockResolvedValue(listResponse());
  vi.mocked(retrieveOuterCard).mockImplementation(async (cardId) =>
    cardId === secondCard.id ? secondCard : firstCard,
  );
  vi.mocked(createOuterCard).mockResolvedValue(firstCard);
  vi.mocked(updateOuterCard).mockResolvedValue(firstCard);
  vi.mocked(deleteOuterCard).mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("outer-card directory", () => {
  it("shows loading and empty database states", async () => {
    const pendingList = deferred<OuterCardListResponse>();
    vi.mocked(listOuterCards).mockReturnValue(pendingList.promise);
    const view = renderApp();

    expect(screen.getByText("Loading outer cards…")).toBeInTheDocument();

    pendingList.resolve(listResponse([]));
    expect(await screen.findByText("No outer cards yet")).toBeInTheDocument();
    view.unmount();
  });

  it("renders cards and preserves selection in the route", async () => {
    const user = userEvent.setup();
    renderApp();

    const cardLink = await screen.findByRole("link", { name: /経験/ });
    await user.click(cardLink);

    expect(retrieveOuterCard).toHaveBeenCalledWith(firstCard.id);
    expect(
      await screen.findByRole("heading", { name: firstCard.term }),
    ).toBeInTheDocument();
    expect(cardLink).toHaveAttribute("aria-current", "page");
  });

  it("debounces server search and shows an empty search result", async () => {
    const user = userEvent.setup();
    vi.mocked(listOuterCards).mockImplementation(async (params) =>
      params.search ? listResponse([]) : listResponse(),
    );
    renderApp();
    await screen.findByRole("link", { name: /経験/ });

    await user.type(screen.getByLabelText("Search outer cards"), "missing");

    await waitFor(() =>
      expect(listOuterCards).toHaveBeenLastCalledWith({
        search: "missing",
        offset: 0,
        limit: 10,
      }),
    );
    expect(await screen.findByText("No matching cards")).toBeInTheDocument();
  });

  it("uses backend pagination parameters", async () => {
    const user = userEvent.setup();
    const cards = Array.from({ length: 10 }, (_, index) => ({
      ...firstCard,
      id: "00000000-0000-4000-8000-" + String(index).padStart(12, "0"),
      term: "card-" + index,
    }));
    vi.mocked(listOuterCards).mockImplementation(async (params) =>
      params.offset === 0
        ? listResponse(cards, 11)
        : listResponse([secondCard], 11, 10),
    );
    renderApp();

    await screen.findByText("Showing 1–10 of 11");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(listOuterCards).toHaveBeenLastCalledWith({
        search: "",
        offset: 10,
        limit: 10,
      }),
    );
    expect(await screen.findByText("Showing 11–11 of 11")).toBeInTheDocument();
  });

  it("shows an API error and retries", async () => {
    const user = userEvent.setup();
    vi.mocked(listOuterCards)
      .mockRejectedValueOnce(new ApiError(500, "List unavailable"))
      .mockResolvedValueOnce(listResponse());
    renderApp();

    expect(await screen.findByText("List unavailable")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Retry loading cards" }),
    );

    expect(
      await screen.findByRole("link", { name: /経験/ }),
    ).toBeInTheDocument();
    expect(listOuterCards).toHaveBeenCalledTimes(2);
  });
});

describe("outer-card create form", () => {
  it("opens the form and validates required fields", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("link", { name: /経験/ });

    await user.click(screen.getByRole("button", { name: "Add card" }));
    expect(
      screen.getByRole("heading", { name: "Add vocabulary" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create card" }));

    expect(
      screen.getByText("Term and meaning are required."),
    ).toBeInTheDocument();
    expect(createOuterCard).not.toHaveBeenCalled();
  });

  it("normalises optional blanks, creates, and navigates to the new card", async () => {
    const user = userEvent.setup();
    const created = {
      ...firstCard,
      id: "33333333-3333-4333-8333-333333333333",
      term: "確認",
      reading: null,
      meaning: "確認",
      part_of_speech: null,
      jlpt_level: null,
      notes: null,
      sort_order: 0,
    };
    vi.mocked(createOuterCard).mockResolvedValue(created);
    renderApp();
    await screen.findByRole("link", { name: /経験/ });
    await user.click(screen.getByRole("button", { name: "Add card" }));

    await user.type(screen.getByLabelText(/Term/), "  確認  ");
    await user.type(screen.getByLabelText(/Meaning/), "  確認  ");
    await user.type(screen.getByLabelText("Reading"), "   ");
    await user.type(screen.getByLabelText("Notes"), "   ");
    await user.click(screen.getByRole("button", { name: "Create card" }));

    await waitFor(() =>
      expect(createOuterCard).toHaveBeenCalledWith({
        term: "確認",
        reading: null,
        part_of_speech: null,
        meaning: "確認",
        jlpt_level: null,
        notes: null,
        sort_order: 0,
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "確認" }),
    ).toBeInTheDocument();
  });

  it("prevents duplicate submission while creation is pending", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred<OuterCard>();
    vi.mocked(createOuterCard).mockReturnValue(pendingCreate.promise);
    renderApp();
    await screen.findByRole("link", { name: /経験/ });
    await user.click(screen.getByRole("button", { name: "Add card" }));
    await user.type(screen.getByLabelText(/Term/), "確認");
    await user.type(screen.getByLabelText(/Meaning/), "確認");

    await user.click(screen.getByRole("button", { name: "Create card" }));
    const savingButton = screen.getByRole("button", { name: "Saving…" });
    expect(savingButton).toBeDisabled();
    await user.click(savingButton);
    expect(createOuterCard).toHaveBeenCalledTimes(1);

    pendingCreate.resolve(firstCard);
  });

  it("displays FastAPI validation errors", async () => {
    const user = userEvent.setup();
    vi.mocked(createOuterCard).mockRejectedValue(
      new ApiError(422, "Invalid", [
        { loc: ["body", "term"], msg: "must not be blank" },
      ]),
    );
    renderApp();
    await screen.findByRole("link", { name: /経験/ });
    await user.click(screen.getByRole("button", { name: "Add card" }));
    await user.type(screen.getByLabelText(/Term/), "確認");
    await user.type(screen.getByLabelText(/Meaning/), "確認");
    await user.click(screen.getByRole("button", { name: "Create card" }));

    expect(
      await screen.findByText("term: must not be blank"),
    ).toBeInTheDocument();
  });
});

describe("outer-card retrieve and edit", () => {
  it("supports no selection and direct detail navigation with all fields", async () => {
    const noSelection = renderApp();
    expect(
      await screen.findByRole("heading", { name: "Select a vocabulary word" }),
    ).toBeInTheDocument();
    noSelection.unmount();

    renderApp("/cards/" + firstCard.id);
    expect(
      await screen.findByRole("heading", { name: firstCard.term }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(firstCard.reading ?? "")).not.toHaveLength(0);
    expect(
      screen.getByText(firstCard.part_of_speech ?? ""),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(firstCard.jlpt_level ?? "").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(firstCard.notes ?? "")).toBeInTheDocument();
    expect(
      document.querySelector('time[datetime="' + firstCard.created_at + '"]'),
    ).toBeInTheDocument();
    expect(retrieveOuterCard).toHaveBeenCalledWith(firstCard.id);
  });

  it("shows selected-card loading and 404 states", async () => {
    const pendingDetail = deferred<OuterCard>();
    vi.mocked(retrieveOuterCard).mockReturnValueOnce(pendingDetail.promise);
    const view = renderApp("/cards/" + firstCard.id);
    expect(screen.getByText("Loading selected card…")).toBeInTheDocument();
    view.unmount();

    vi.mocked(retrieveOuterCard).mockRejectedValueOnce(
      new ApiError(404, "Outer card not found"),
    );
    renderApp("/cards/missing-card");
    expect(
      await screen.findByRole("heading", { name: "Card not found" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Outer card not found")).toBeInTheDocument();
  });

  it("prepopulates edit and disables a no-op submission", async () => {
    const user = userEvent.setup();
    renderApp("/cards/" + firstCard.id);
    await screen.findByRole("heading", { name: firstCard.term });
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText(/Term/)).toHaveValue(firstCard.term);
    expect(screen.getByLabelText("Reading")).toHaveValue(firstCard.reading);
    expect(screen.getByLabelText(/Meaning/)).toHaveValue(firstCard.meaning);
    expect(
      screen.getByRole("button", { name: "No changes to save" }),
    ).toBeDisabled();
  });

  it("updates only changed fields and refreshes detail and directory", async () => {
    const user = userEvent.setup();
    const updated = { ...firstCard, meaning: "實際經驗" };
    vi.mocked(updateOuterCard).mockResolvedValue(updated);
    renderApp("/cards/" + firstCard.id);
    await screen.findByRole("heading", { name: firstCard.term });
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const meaning = screen.getByLabelText(/Meaning/);
    await user.clear(meaning);
    await user.type(meaning, "  實際經驗  ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateOuterCard).toHaveBeenCalledWith(firstCard.id, {
        meaning: "實際經驗",
      }),
    );
    expect(await screen.findByText("實際經驗")).toBeInTheDocument();
  });

  it("shows edit validation errors", async () => {
    const user = userEvent.setup();
    vi.mocked(updateOuterCard).mockRejectedValue(
      new ApiError(422, "Invalid", [
        { loc: ["body", "meaning"], msg: "must not be blank" },
      ]),
    );
    renderApp("/cards/" + firstCard.id);
    await screen.findByRole("heading", { name: firstCard.term });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Notes"), " changed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("meaning: must not be blank"),
    ).toBeInTheDocument();
  });
});

describe("outer-card deletion", () => {
  it("requires confirmation and supports cancellation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderApp("/cards/" + firstCard.id);
    await screen.findByRole("heading", { name: firstCard.term });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining(firstCard.term),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("inner cards"),
    );
    expect(deleteOuterCard).not.toHaveBeenCalled();
  });

  it("deletes once and navigates back to no selection", async () => {
    const user = userEvent.setup();
    const pendingDelete = deferred<void>();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteOuterCard).mockReturnValue(pendingDelete.promise);
    renderApp("/cards/" + firstCard.id);
    await screen.findByRole("heading", { name: firstCard.term });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const deletingButton = screen.getByRole("button", { name: "Deleting…" });
    expect(deletingButton).toBeDisabled();
    await user.click(deletingButton);
    expect(deleteOuterCard).toHaveBeenCalledTimes(1);
    pendingDelete.resolve();

    expect(
      await screen.findByRole("heading", { name: "Select a vocabulary word" }),
    ).toBeInTheDocument();
  });

  it("keeps the selected card visible when deletion fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteOuterCard).mockRejectedValue(
      new ApiError(500, "Delete failed"),
    );
    renderApp("/cards/" + firstCard.id);
    await screen.findByRole("heading", { name: firstCard.term });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: firstCard.term }),
    ).toBeInTheDocument();
  });
});

describe("outer-review source-deck cache coherence", () => {
  function seedReviewDeck(queryClient: QueryClient) {
    queryClient.setQueryData(outerReviewKeys.orderedDeck(), [
      firstCard,
      secondCard,
    ]);
  }

  function expectReviewDeckInvalidated(queryClient: QueryClient) {
    expect(
      queryClient.getQueryState(outerReviewKeys.orderedDeck())?.isInvalidated,
    ).toBe(true);
  }

  it("invalidates the ordered source deck after create", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderApp();
    seedReviewDeck(queryClient);
    await screen.findByRole("link", { name: /経験/ });
    await user.click(screen.getByRole("button", { name: "Add card" }));
    await user.type(screen.getByLabelText(/Term/), "確認");
    await user.type(screen.getByLabelText(/Meaning/), "確認");
    await user.click(screen.getByRole("button", { name: "Create card" }));

    await waitFor(() => expect(createOuterCard).toHaveBeenCalled());
    expectReviewDeckInvalidated(queryClient);
  });

  it("invalidates the ordered source deck after update", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderApp("/cards/" + firstCard.id);
    seedReviewDeck(queryClient);
    await screen.findByRole("heading", { name: firstCard.term });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const meaning = screen.getByLabelText(/Meaning/);
    await user.clear(meaning);
    await user.type(meaning, "更新後的意思");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateOuterCard).toHaveBeenCalled());
    expectReviewDeckInvalidated(queryClient);
  });

  it("invalidates the ordered source deck after delete", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { queryClient } = renderApp("/cards/" + firstCard.id);
    seedReviewDeck(queryClient);
    await screen.findByRole("heading", { name: firstCard.term });
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteOuterCard).toHaveBeenCalled());
    expectReviewDeckInvalidated(queryClient);
  });
});
