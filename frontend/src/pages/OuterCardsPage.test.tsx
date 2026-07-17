import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
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
import { retrieveInnerCard, type InnerCard } from "../lib/innerCards";
import { innerReviewKeys } from "../lib/innerReviewKeys";
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

const firstDeck: Deck = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Lesson 13",
  description: "Chapter vocabulary",
  sort_order: 13,
  created_at: "2026-07-14T00:00:00Z",
  updated_at: "2026-07-14T00:00:00Z",
};

const secondDeck: Deck = {
  ...firstDeck,
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "Lesson 14",
  description: "Next chapter",
  sort_order: 14,
};

const firstCard: OuterCard = {
  id: "11111111-1111-4111-8111-111111111111",
  deck_id: firstDeck.id,
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

const innerCard: InnerCard = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  outer_card_id: firstCard.id,
  expression: "経験を積む",
  reading: "けいけんをつむ",
  meaning: "累積經驗",
  usage_note: null,
  notes: null,
  sort_order: 0,
  created_at: "2026-07-14T03:00:00Z",
  updated_at: "2026-07-14T03:00:00Z",
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

function RouteProbe() {
  const location = useLocation();
  return (
    <output aria-label="Current route">
      {location.pathname + location.search}
    </output>
  );
}

function renderApp(route = "/decks/" + firstDeck.id) {
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
        <RouteProbe />
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
  vi.mocked(listOuterCards).mockResolvedValue(listResponse());
  vi.mocked(retrieveOuterCard).mockImplementation(async (cardId) =>
    cardId === secondCard.id ? secondCard : firstCard,
  );
  vi.mocked(createOuterCard).mockResolvedValue(firstCard);
  vi.mocked(updateOuterCard).mockResolvedValue(firstCard);
  vi.mocked(deleteOuterCard).mockResolvedValue();
  vi.mocked(retrieveInnerCard).mockResolvedValue(innerCard);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("deck management", () => {
  it("shows ordered, selected deck entries and handles empty, loading, error, and retry states", async () => {
    const pending = deferred<Awaited<ReturnType<typeof listDecks>>>();
    vi.mocked(listDecks).mockReturnValueOnce(pending.promise);
    const loadingView = renderApp("/decks");
    expect(screen.getByText("Loading decks…")).toHaveAttribute(
      "role",
      "status",
    );
    pending.resolve({ items: [], total: 0, offset: 0, limit: 10 });
    expect(await screen.findByText("No decks yet")).toBeInTheDocument();
    loadingView.unmount();

    vi.mocked(listDecks)
      .mockRejectedValueOnce(new ApiError(503, "Deck list unavailable"))
      .mockResolvedValueOnce({
        items: [secondDeck, firstDeck],
        total: 2,
        offset: 0,
        limit: 10,
      });
    vi.mocked(retrieveDeck).mockResolvedValue(firstDeck);
    const user = userEvent.setup();
    renderApp("/decks/" + firstDeck.id);
    expect(
      await screen.findByText("Deck list unavailable"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Retry loading decks" }),
    );

    const directory = await screen.findByRole("list", { name: "Decks" });
    const deckLinks = within(directory).getAllByRole("link");
    expect(deckLinks[0]).toHaveTextContent(secondDeck.name);
    expect(deckLinks[1]).toHaveTextContent(firstDeck.name);
    expect(deckLinks[1]).toHaveAttribute("aria-current", "page");
    expect(deckLinks[1]).toHaveTextContent("Selected deck");
  });

  it("creates a normalised deck and restores it through the URL", async () => {
    const user = userEvent.setup();
    const createdDeck = {
      ...secondDeck,
      name: "Lesson 15",
      description: null,
      sort_order: 15,
    };
    vi.mocked(createDeck).mockResolvedValue(createdDeck);
    vi.mocked(retrieveDeck).mockImplementation(async (deckId) =>
      deckId === createdDeck.id ? createdDeck : firstDeck,
    );
    renderApp("/decks");

    await user.click(screen.getByRole("button", { name: "Add deck" }));
    await user.click(screen.getByRole("button", { name: "Create deck" }));
    expect(screen.getByText("Deck name is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Deck name/), "  Lesson 15  ");
    await user.type(screen.getByLabelText("Description"), "   ");
    const sortOrder = screen.getByLabelText("Sort order");
    await user.clear(sortOrder);
    await user.type(sortOrder, "15");
    await user.click(screen.getByRole("button", { name: "Create deck" }));

    await waitFor(() =>
      expect(createDeck).toHaveBeenCalledWith({
        name: "Lesson 15",
        description: null,
        sort_order: 15,
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/decks/" + createdDeck.id,
      ),
    );
    expect(
      await screen.findByRole("heading", { name: createdDeck.name }),
    ).toBeInTheDocument();
  });

  it("prefills deck editing, disables no-op save, and sends only changes", async () => {
    const user = userEvent.setup();
    const updatedDeck = { ...firstDeck, description: null };
    vi.mocked(updateDeck).mockResolvedValue(updatedDeck);
    renderApp();
    await screen.findByRole("heading", { name: firstDeck.name });

    await user.click(screen.getByRole("button", { name: "Edit deck" }));
    expect(screen.getByLabelText(/Deck name/)).toHaveValue(firstDeck.name);
    expect(
      screen.getByRole("button", { name: "No changes to save" }),
    ).toBeDisabled();
    await user.clear(screen.getByLabelText("Description"));
    await user.click(screen.getByRole("button", { name: "Save deck changes" }));

    await waitFor(() =>
      expect(updateDeck).toHaveBeenCalledWith(firstDeck.id, {
        description: null,
      }),
    );
  });

  it("explains non-empty deck conflicts and preserves the selected deck", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteDeck).mockRejectedValue(
      new ApiError(409, "Deck contains outer cards"),
    );
    const { queryClient } = renderApp();
    queryClient.setQueryData(outerReviewKeys.deckOrderedDeck(firstDeck.id), [
      firstCard,
    ]);
    queryClient.setQueryData(innerReviewKeys.deckOrderedDeck(firstDeck.id), [
      innerCard,
    ]);
    await screen.findByRole("heading", { name: firstDeck.name });

    await user.click(screen.getByRole("button", { name: "Delete deck" }));

    expect(
      await screen.findByText(/still contains outer cards/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/decks/" + firstDeck.id,
    );
    expect(
      queryClient.getQueryData(outerReviewKeys.deckOrderedDeck(firstDeck.id)),
    ).toEqual([firstCard]);
    expect(
      queryClient.getQueryData(innerReviewKeys.deckOrderedDeck(firstDeck.id)),
    ).toEqual([innerCard]);
  });

  it("deletes an empty deck after confirmation and clears selection", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { queryClient } = renderApp();
    queryClient.setQueryData(outerReviewKeys.deckOrderedDeck(firstDeck.id), [
      firstCard,
    ]);
    queryClient.setQueryData(innerReviewKeys.deckOrderedDeck(firstDeck.id), [
      innerCard,
    ]);
    queryClient.setQueryData(outerReviewKeys.deckOrderedDeck(secondDeck.id), [
      secondCard,
    ]);
    await screen.findByRole("heading", { name: firstDeck.name });

    await user.click(screen.getByRole("button", { name: "Delete deck" }));

    await waitFor(() => expect(deleteDeck).toHaveBeenCalledWith(firstDeck.id));
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/decks");
    expect(
      await screen.findByRole("heading", { name: "Select or create a deck" }),
    ).toBeInTheDocument();
    expect(
      queryClient.getQueryData(outerReviewKeys.deckOrderedDeck(firstDeck.id)),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(innerReviewKeys.deckOrderedDeck(firstDeck.id)),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(outerReviewKeys.deckOrderedDeck(secondDeck.id)),
    ).toEqual([secondCard]);
  });

  it("does not display a card under a mismatched deck route", async () => {
    const foreignCard = { ...firstCard, deck_id: secondDeck.id };
    vi.mocked(retrieveOuterCard).mockResolvedValue(foreignCard);
    renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);

    expect(
      await screen.findByRole("heading", {
        name: "Card belongs to another deck",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open card in its deck" }),
    ).toHaveAttribute(
      "href",
      "/decks/" + secondDeck.id + "/cards/" + firstCard.id,
    );
    expect(
      screen.queryByRole("heading", { name: firstCard.term }),
    ).not.toBeInTheDocument();
  });

  it("moves a card to another deck while preserving its inner-card route", async () => {
    const user = userEvent.setup();
    const movedCard = { ...firstCard, deck_id: secondDeck.id };
    vi.mocked(listAllDecks).mockResolvedValue([firstDeck, secondDeck]);
    vi.mocked(retrieveDeck).mockImplementation(async (deckId) =>
      deckId === secondDeck.id ? secondDeck : firstDeck,
    );
    vi.mocked(updateOuterCard).mockResolvedValue(movedCard);
    vi.mocked(listOuterCards).mockImplementation(async (params) => ({
      items: params.deck_id === secondDeck.id ? [movedCard] : [firstCard],
      total: 1,
      offset: 0,
      limit: 10,
    }));
    const { queryClient } = renderApp(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstCard.id +
        "/inner/" +
        innerCard.id,
    );
    queryClient.setQueryData(outerReviewKeys.deckOrderedDeck(firstDeck.id), [
      firstCard,
    ]);
    queryClient.setQueryData(
      outerReviewKeys.deckOrderedDeck(secondDeck.id),
      [],
    );
    queryClient.setQueryData(innerReviewKeys.deckOrderedDeck(firstDeck.id), [
      innerCard,
    ]);
    queryClient.setQueryData(
      innerReviewKeys.deckOrderedDeck(secondDeck.id),
      [],
    );
    await screen.findByRole("heading", { name: firstCard.term });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Deck/ }),
      secondDeck.id,
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateOuterCard).toHaveBeenCalledWith(firstCard.id, {
        deck_id: secondDeck.id,
      }),
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/decks/" +
        secondDeck.id +
        "/cards/" +
        firstCard.id +
        "/inner/" +
        innerCard.id,
    );
    expect(
      queryClient.getQueryState(outerReviewKeys.deckOrderedDeck(firstDeck.id))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(outerReviewKeys.deckOrderedDeck(secondDeck.id))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(innerReviewKeys.deckOrderedDeck(firstDeck.id))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(innerReviewKeys.deckOrderedDeck(secondDeck.id))
        ?.isInvalidated,
    ).toBe(true);
  });

  it("switching decks clears card, inner, search, and pagination selection", async () => {
    const user = userEvent.setup();
    vi.mocked(listDecks).mockResolvedValue({
      items: [firstDeck, secondDeck],
      total: 2,
      offset: 0,
      limit: 10,
    });
    vi.mocked(listAllDecks).mockResolvedValue([firstDeck, secondDeck]);
    vi.mocked(retrieveDeck).mockImplementation(async (deckId) =>
      deckId === secondDeck.id ? secondDeck : firstDeck,
    );
    vi.mocked(listOuterCards).mockImplementation(async (params) => ({
      items: params.deck_id === firstDeck.id ? [firstCard] : [],
      total: params.deck_id === firstDeck.id ? 1 : 0,
      offset: params.offset,
      limit: 10,
    }));
    renderApp(
      "/decks/" +
        firstDeck.id +
        "/cards/" +
        firstCard.id +
        "/inner/" +
        innerCard.id,
    );
    await screen.findByRole("heading", { name: firstCard.term });
    await user.type(screen.getByLabelText("Search outer cards"), "経験");
    await waitFor(() =>
      expect(listOuterCards).toHaveBeenLastCalledWith({
        search: "経験",
        offset: 0,
        limit: 10,
        deck_id: firstDeck.id,
      }),
    );

    await user.click(
      screen.getByRole("link", { name: new RegExp(secondDeck.name) }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/decks/" + secondDeck.id,
      ),
    );
    expect(await screen.findByLabelText("Search outer cards")).toHaveValue("");
    expect(listOuterCards).toHaveBeenLastCalledWith({
      search: "",
      offset: 0,
      limit: 10,
      deck_id: secondDeck.id,
    });
  });
});

describe("outer-card directory", () => {
  it("shows loading and empty database states", async () => {
    const pendingList = deferred<OuterCardListResponse>();
    vi.mocked(listOuterCards).mockReturnValue(pendingList.promise);
    const view = renderApp();

    expect(await screen.findByText("Loading outer cards…")).toBeInTheDocument();

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
        deck_id: firstDeck.id,
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
        deck_id: firstDeck.id,
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
        deck_id: firstDeck.id,
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

    renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);
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
    const view = renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);
    expect(
      await screen.findByText("Loading selected card…"),
    ).toBeInTheDocument();
    view.unmount();

    vi.mocked(retrieveOuterCard).mockRejectedValueOnce(
      new ApiError(404, "Outer card not found"),
    );
    renderApp("/decks/" + firstDeck.id + "/cards/missing-card");
    expect(
      await screen.findByRole("heading", { name: "Card not found" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Outer card not found")).toBeInTheDocument();
  });

  it("prepopulates edit and disables a no-op submission", async () => {
    const user = userEvent.setup();
    renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);
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
    renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);
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
    renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);
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
    renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);
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
    renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);
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
    renderApp("/decks/" + firstDeck.id + "/cards/" + firstCard.id);
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
    queryClient.setQueryData(outerReviewKeys.deckOrderedDeck(firstDeck.id), [
      firstCard,
      secondCard,
    ]);
    queryClient.setQueryData(innerReviewKeys.deckOrderedDeck(firstDeck.id), [
      innerCard,
    ]);
    queryClient.setQueryData(
      outerReviewKeys.deckOrderedDeck(secondDeck.id),
      [],
    );
    queryClient.setQueryData(
      innerReviewKeys.deckOrderedDeck(secondDeck.id),
      [],
    );
  }

  function expectReviewDeckInvalidated(queryClient: QueryClient) {
    expect(
      queryClient.getQueryState(outerReviewKeys.orderedDeck())?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(outerReviewKeys.deckOrderedDeck(firstDeck.id))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(innerReviewKeys.deckOrderedDeck(firstDeck.id))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(outerReviewKeys.deckOrderedDeck(secondDeck.id))
        ?.isInvalidated,
    ).toBe(false);
    expect(
      queryClient.getQueryState(innerReviewKeys.deckOrderedDeck(secondDeck.id))
        ?.isInvalidated,
    ).toBe(false);
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
    const { queryClient } = renderApp(
      "/decks/" + firstDeck.id + "/cards/" + firstCard.id,
    );
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
    const { queryClient } = renderApp(
      "/decks/" + firstDeck.id + "/cards/" + firstCard.id,
    );
    seedReviewDeck(queryClient);
    await screen.findByRole("heading", { name: firstCard.term });
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteOuterCard).toHaveBeenCalled());
    expectReviewDeckInvalidated(queryClient);
  });
});
