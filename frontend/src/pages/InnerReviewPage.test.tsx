import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { ApiError } from "../lib/api";
import type { InnerCard } from "../lib/innerCards";
import { fetchCompleteInnerReviewDeck } from "../lib/innerReview";
import { innerReviewKeys } from "../lib/innerReviewKeys";
import {
  listOuterCards,
  retrieveOuterCard,
  type OuterCard,
} from "../lib/outerCards";
import { fetchCompleteOuterReviewDeck } from "../lib/outerReview";
import {
  deterministicShuffle,
  generateShuffleSeed,
} from "../lib/reviewShuffle";

vi.mock("../lib/innerReview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/innerReview")>();
  return { ...actual, fetchCompleteInnerReviewDeck: vi.fn() };
});

vi.mock("../lib/outerReview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/outerReview")>();
  return { ...actual, fetchCompleteOuterReviewDeck: vi.fn() };
});

vi.mock("../lib/reviewShuffle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/reviewShuffle")>();
  return { ...actual, generateShuffleSeed: vi.fn() };
});

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

const firstOuter: OuterCard = {
  id: "11111111-1111-4111-8111-111111111111",
  term: "経験",
  reading: "けいけん",
  part_of_speech: "名詞",
  meaning: "經驗",
  jlpt_level: "N3",
  notes: null,
  sort_order: 1,
  created_at: "2026-07-14T01:00:00Z",
  updated_at: "2026-07-14T01:00:00Z",
};

const secondOuter: OuterCard = {
  ...firstOuter,
  id: "22222222-2222-4222-8222-222222222222",
  term: "予定",
  reading: null,
  meaning: "預定",
  sort_order: 2,
};

const firstInner: InnerCard = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  outer_card_id: firstOuter.id,
  expression: "経験を積む",
  reading: "けいけんをつむ",
  meaning: "累積經驗",
  usage_note: "Common collocation",
  notes: "Often used for work experience.",
  sort_order: 1,
  created_at: "2026-07-14T01:00:00Z",
  updated_at: "2026-07-14T01:00:00Z",
};

const secondInner: InnerCard = {
  ...firstInner,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  outer_card_id: secondOuter.id,
  expression: "予定を立てる",
  reading: null,
  meaning: "制定計畫",
  usage_note: null,
  notes: null,
  sort_order: 2,
};

const missingParentInner: InnerCard = {
  ...firstInner,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  outer_card_id: "33333333-3333-4333-8333-333333333333",
  expression: "親なし",
  meaning: "missing parent",
  sort_order: 3,
};

const innerDeck = [firstInner, secondInner, missingParentInner];
const outerDeck = [firstOuter, secondOuter];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="Current route">
      {location.pathname + location.search}
    </output>
  );
}

function renderApp(route = "/review/inner") {
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
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

beforeEach(() => {
  vi.mocked(fetchCompleteInnerReviewDeck).mockResolvedValue(innerDeck);
  vi.mocked(fetchCompleteOuterReviewDeck).mockResolvedValue(outerDeck);
  vi.mocked(generateShuffleSeed).mockReturnValue(20260714);
  vi.mocked(listOuterCards).mockResolvedValue({
    items: outerDeck,
    total: outerDeck.length,
    offset: 0,
    limit: 10,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("inner review deck states and routing", () => {
  it("shows loading and empty-deck states", async () => {
    const pending = deferred<InnerCard[]>();
    vi.mocked(fetchCompleteInnerReviewDeck).mockReturnValue(pending.promise);
    renderApp();

    expect(
      screen.getByText("Preparing the complete ordered inner review deck…"),
    ).toHaveAttribute("role", "status");

    pending.resolve([]);
    expect(await screen.findByText("Empty inner deck")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to card management" }),
    ).toHaveAttribute("href", "/cards");
  });

  it("shows a deck error and retries only the ordered inner deck", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCompleteInnerReviewDeck)
      .mockRejectedValueOnce(new ApiError(503, "Inner deck unavailable"))
      .mockResolvedValueOnce(innerDeck);
    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inner deck unavailable",
    );
    await user.click(
      screen.getByRole("button", { name: "Retry inner review deck" }),
    );

    expect(
      await screen.findByLabelText("Inner review progress"),
    ).toHaveTextContent("1 / 3");
    expect(fetchCompleteInnerReviewDeck).toHaveBeenCalledTimes(2);
  });

  it("redirects the route without an ID to the first ordered card", async () => {
    renderApp();

    expect(
      await screen.findByLabelText("Inner review progress"),
    ).toHaveTextContent("1 / 3");
    expect(screen.getByRole("link", { name: /経験を積む/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("restores a direct selection and true progress", async () => {
    renderApp("/review/inner/" + secondInner.id);

    expect(
      await screen.findByLabelText("Inner review progress"),
    ).toHaveTextContent("2 / 3");
    expect(screen.getByRole("link", { name: /予定を立てる/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows unknown-card recovery before returning to the first card", async () => {
    const user = userEvent.setup();
    renderApp("/review/inner/not-in-deck");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inner review card not found",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Return to first inner review card",
      }),
    );
    expect(
      await screen.findByLabelText("Inner review progress"),
    ).toHaveTextContent("1 / 3");
  });

  it("uses directory links as URL-backed selection", async () => {
    const user = userEvent.setup();
    renderApp("/review/inner/" + firstInner.id);

    await user.click(await screen.findByRole("link", { name: /親なし/ }));

    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "3 / 3",
    );
    expect(screen.getByRole("link", { name: /親なし/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("inner review presentation and navigation", () => {
  it("starts on the front and supports card and explicit-button flipping", async () => {
    const user = userEvent.setup();
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");

    expect(within(workspace).getByText(firstInner.expression)).toBeVisible();
    expect(within(workspace).queryByText(firstInner.meaning)).toBeNull();
    await user.click(
      within(workspace).getByRole("button", {
        name: "Inner flashcard front. Click to reveal answer.",
      }),
    );
    expect(within(workspace).getByText(firstInner.meaning)).toBeVisible();
    await user.click(
      within(workspace).getByRole("button", { name: "Show front" }),
    );
    expect(within(workspace).queryByText(firstInner.meaning)).toBeNull();
    await user.click(
      within(workspace).getByRole("button", { name: "Show answer" }),
    );
    expect(
      within(workspace).getByText(firstInner.usage_note ?? ""),
    ).toBeVisible();
    expect(within(workspace).getByText(firstInner.notes ?? "")).toBeVisible();
  });

  it("resets flip state on card changes", async () => {
    const user = userEvent.setup();
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");
    await user.click(
      within(workspace).getByRole("button", { name: "Show answer" }),
    );
    expect(within(workspace).getByText(firstInner.meaning)).toBeVisible();

    await user.click(
      within(workspace).getByRole("button", { name: "Next inner card" }),
    );

    expect(within(workspace).getByText(secondInner.expression)).toBeVisible();
    expect(within(workspace).queryByText(secondInner.meaning)).toBeNull();
  });

  it("keeps Show both across cards and returns to a front-only Flip mode", async () => {
    const user = userEvent.setup();
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");
    await user.click(
      within(workspace).getByRole("button", { name: "Show both" }),
    );
    expect(within(workspace).getByText(firstInner.meaning)).toBeVisible();

    await user.click(
      within(workspace).getByRole("button", { name: "Next inner card" }),
    );
    expect(within(workspace).getByText(secondInner.meaning)).toBeVisible();
    expect(
      within(workspace).getByRole("button", { name: "Show both" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      within(workspace).getByRole("button", { name: "Flip mode" }),
    );
    expect(within(workspace).getByText(secondInner.expression)).toBeVisible();
    expect(within(workspace).queryByText(secondInner.meaning)).toBeNull();
  });

  it("uses ordered boundaries without wrapping", async () => {
    const user = userEvent.setup();
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");
    expect(
      within(workspace).getByRole("button", { name: "Previous inner card" }),
    ).toBeDisabled();

    await user.click(
      within(workspace).getByRole("button", { name: "Next inner card" }),
    );
    await user.click(
      within(workspace).getByRole("button", { name: "Next inner card" }),
    );

    expect(
      within(workspace).getByLabelText("Inner review progress"),
    ).toHaveTextContent("3 / 3");
    expect(
      within(workspace).getByRole("button", { name: "Next inner card" }),
    ).toBeDisabled();
  });
});

describe("inner review parent context and regressions", () => {
  it("shows parent term and optional reading without N+1 requests", async () => {
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");

    expect(
      within(workspace).getByText(
        (_content, element) =>
          element?.tagName === "P" &&
          element.textContent === "Outer card: 経験 · けいけん",
      ),
    ).toBeVisible();
    expect(fetchCompleteOuterReviewDeck).toHaveBeenCalledTimes(1);
    expect(retrieveOuterCard).not.toHaveBeenCalled();
  });

  it("uses a safe fallback when the parent is missing", async () => {
    renderApp("/review/inner/" + missingParentInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");

    expect(
      within(workspace).getByText("Parent card unavailable"),
    ).toBeVisible();
    expect(
      within(workspace).getByText(missingParentInner.expression),
    ).toBeVisible();
  });

  it("keeps inner review usable when parent-context loading fails", async () => {
    vi.mocked(fetchCompleteOuterReviewDeck).mockRejectedValue(
      new ApiError(503, "Outer context failed"),
    );
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");

    expect(within(workspace).getByRole("alert")).toHaveTextContent(
      "Parent context unavailable",
    );
    expect(within(workspace).getByText(firstInner.expression)).toBeVisible();
    expect(
      within(workspace).getByText("Parent card unavailable"),
    ).toBeVisible();
  });

  it("preserves management and outer-review entry points without later-stage controls", async () => {
    renderApp("/cards");
    expect(
      await screen.findByRole("heading", { name: "Select a vocabulary word" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start inner review" }),
    ).toHaveAttribute("href", "/review/inner");
    expect(screen.queryByRole("button", { name: /shuffle/i })).toBeNull();

    expect(listOuterCards).toHaveBeenCalledTimes(1);
  });
});

describe("inner review ordered and shuffled rounds", () => {
  function expectShuffledDirectoryOrder(expectedDeck: InnerCard[]) {
    const directory = screen.getByLabelText("Shuffled inner review deck");
    const links = within(directory).getAllByRole("link");
    expect(links).toHaveLength(expectedDeck.length);
    expectedDeck.forEach((card, index) => {
      expect(links[index]).toHaveTextContent(card.expression);
    });
  }

  it("keeps ordered mode as the default", async () => {
    renderApp("/review/inner/" + secondInner.id);

    expect(
      await screen.findByLabelText("Inner review progress"),
    ).toHaveTextContent("2 / 3");
    expect(screen.getByRole("button", { name: "Ordered" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Shuffle" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + secondInner.id,
    );
  });

  it("starts a seeded round containing the complete inner deck once", async () => {
    const user = userEvent.setup();
    const seed = 20260714;
    const expectedQueue = deterministicShuffle(innerDeck, seed);
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");

    await user.click(screen.getByRole("button", { name: "Shuffle" }));

    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + expectedQueue[0].id + "?mode=shuffle&seed=" + seed,
    );
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "1 / 3",
    );
    expect(screen.getByText("Shuffled round")).toBeInTheDocument();
    expectShuffledDirectoryOrder(expectedQueue);
    expect(new Set(expectedQueue.map((card) => card.id)).size).toBe(
      innerDeck.length,
    );
    expect(fetchCompleteInnerReviewDeck).toHaveBeenCalledTimes(1);
  });

  it("restores the same shuffled queue and progress after remount", async () => {
    const seed = 13579;
    const expectedQueue = deterministicShuffle(innerDeck, seed);
    const route =
      "/review/inner/" + expectedQueue[1].id + "?mode=shuffle&seed=" + seed;
    const firstView = renderApp(route);

    expect(
      await screen.findByLabelText("Inner review progress"),
    ).toHaveTextContent("2 / 3");
    expectShuffledDirectoryOrder(expectedQueue);
    firstView.unmount();

    renderApp(route);
    expect(
      await screen.findByLabelText("Inner review progress"),
    ).toHaveTextContent("2 / 3");
    expectShuffledDirectoryOrder(expectedQueue);
    expect(generateShuffleSeed).not.toHaveBeenCalled();
  });

  it("preserves mode and seed through navigation and directory selection", async () => {
    const user = userEvent.setup();
    const seed = 24680;
    const expectedQueue = deterministicShuffle(innerDeck, seed);
    renderApp(
      "/review/inner/" + expectedQueue[0].id + "?mode=shuffle&seed=" + seed,
    );
    await screen.findByLabelText("Inner review progress");

    await user.click(screen.getByRole("button", { name: "Next inner card" }));
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "2 / 3",
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + expectedQueue[1].id + "?mode=shuffle&seed=" + seed,
    );

    await user.click(
      screen.getByRole("link", {
        name: new RegExp(expectedQueue[2].expression),
      }),
    );
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "3 / 3",
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "?mode=shuffle&seed=" + seed,
    );
    await user.click(
      screen.getByRole("button", { name: "Previous inner card" }),
    );
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "2 / 3",
    );
  });

  it("does not reshuffle for presentation or parent-context retry", async () => {
    const user = userEvent.setup();
    const seed = 86420;
    const expectedQueue = deterministicShuffle(innerDeck, seed);
    const route =
      "/review/inner/" + expectedQueue[0].id + "?mode=shuffle&seed=" + seed;
    vi.mocked(fetchCompleteOuterReviewDeck)
      .mockRejectedValueOnce(new ApiError(503, "Outer context failed"))
      .mockResolvedValueOnce(outerDeck);
    renderApp(route);
    await screen.findByLabelText("Inner review progress");

    await user.click(screen.getByRole("button", { name: "Show answer" }));
    await user.click(screen.getByRole("button", { name: "Show both" }));
    await user.click(
      await screen.findByRole("button", { name: "Retry parent context" }),
    );
    await waitFor(() =>
      expect(fetchCompleteOuterReviewDeck).toHaveBeenCalledTimes(2),
    );

    expect(screen.getByLabelText("Current route")).toHaveTextContent(route);
    expectShuffledDirectoryOrder(expectedQueue);
    expect(generateShuffleSeed).not.toHaveBeenCalled();
    expect(fetchCompleteInnerReviewDeck).toHaveBeenCalledTimes(1);
  });

  it("keeps the current round, starts a new one only on request, and preserves the card when ordering", async () => {
    const user = userEvent.setup();
    const oldSeed = 100;
    const newSeed = 200;
    const oldQueue = deterministicShuffle(innerDeck, oldSeed);
    const newQueue = deterministicShuffle(innerDeck, newSeed);
    const originalRoute =
      "/review/inner/" + oldQueue[1].id + "?mode=shuffle&seed=" + oldSeed;
    vi.mocked(generateShuffleSeed).mockReturnValue(newSeed);
    renderApp(originalRoute);
    await screen.findByLabelText("Inner review progress");

    await user.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      originalRoute,
    );
    expect(generateShuffleSeed).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "New shuffled round" }),
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + newQueue[0].id + "?mode=shuffle&seed=" + newSeed,
    );
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "1 / 3",
    );

    const currentCard = newQueue[0];
    await user.click(screen.getByRole("button", { name: "Ordered" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + currentCard.id,
    );
    expect(screen.getByLabelText("Current route")).not.toHaveTextContent(
      "mode=shuffle",
    );
  });

  it.each(["?mode=shuffle&seed=invalid", "?mode=random&seed=5", "?seed=5"])(
    "canonically falls back to ordered mode for %s",
    async (query) => {
      renderApp("/review/inner/" + secondInner.id + query);

      expect(
        await screen.findByLabelText("Inner review progress"),
      ).toHaveTextContent("2 / 3");
      expect(screen.getByRole("button", { name: "Ordered" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/review/inner/" + secondInner.id,
      );
      expect(screen.getByLabelText("Current route")).not.toHaveTextContent("?");
    },
  );

  it("canonicalizes invalid parameters even when the deck is empty", async () => {
    vi.mocked(fetchCompleteInnerReviewDeck).mockResolvedValue([]);
    renderApp("/review/inner?mode=shuffle&seed=invalid");

    expect(await screen.findByText("Empty inner deck")).toBeInTheDocument();
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner",
    );
    expect(screen.getByLabelText("Current route")).not.toHaveTextContent("?");
  });

  it("recovers an unknown card to the active queue's first card", async () => {
    const user = userEvent.setup();
    const seed = 555;
    const queue = deterministicShuffle(innerDeck, seed);
    renderApp("/review/inner/missing?mode=shuffle&seed=" + seed);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inner review card not found",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Return to first inner review card",
      }),
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + queue[0].id + "?mode=shuffle&seed=" + seed,
    );
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "1 / 3",
    );
  });

  it("keeps a valid shuffled empty deck usable", async () => {
    vi.mocked(fetchCompleteInnerReviewDeck).mockResolvedValue([]);
    renderApp("/review/inner?mode=shuffle&seed=42");

    expect(await screen.findByText("Empty inner deck")).toBeInTheDocument();
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner?mode=shuffle&seed=42",
    );
  });

  it("handles a one-card shuffled deck and new round safely", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCompleteInnerReviewDeck).mockResolvedValue([firstInner]);
    vi.mocked(generateShuffleSeed).mockReturnValue(777);
    renderApp("/review/inner/" + firstInner.id + "?mode=shuffle&seed=666");

    expect(
      await screen.findByLabelText("Inner review progress"),
    ).toHaveTextContent("1 / 1");
    expect(
      screen.getByRole("button", { name: "Previous inner card" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next inner card" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "New shuffled round" }),
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + firstInner.id + "?mode=shuffle&seed=777",
    );
  });

  it("re-derives from source changes and does not retain a deleted card", async () => {
    const seed = 888;
    const { queryClient } = renderApp(
      "/review/inner/" + firstInner.id + "?mode=shuffle&seed=" + seed,
    );
    await screen.findByLabelText("Inner review progress");

    const latestSource = [firstInner, missingParentInner];
    queryClient.setQueryData(innerReviewKeys.orderedDeck(), latestSource);
    const expectedQueue = deterministicShuffle(latestSource, seed);
    const expectedProgress =
      expectedQueue.findIndex((card) => card.id === firstInner.id) + 1;

    await waitFor(() =>
      expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
        expectedProgress + " / 2",
      ),
    );
    expect(
      within(screen.getByLabelText("Shuffled inner review deck")).queryByText(
        secondInner.expression,
      ),
    ).not.toBeInTheDocument();
    expectShuffledDirectoryOrder(expectedQueue);

    queryClient.setQueryData(innerReviewKeys.orderedDeck(), [
      missingParentInner,
    ]);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inner review card not found",
    );
  });
});

describe("inner review keyboard shortcuts", () => {
  it("shows boundary-aware keyboard help", async () => {
    const user = userEvent.setup();
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const help = screen.getByLabelText("Keyboard shortcuts");
    const helpItems = within(help).getAllByRole("listitem");

    expect(helpItems[0]).toHaveTextContent("← Previous (unavailable)");
    expect(helpItems[1]).toHaveTextContent("→ Next");
    expect(helpItems[2]).toHaveTextContent("Space Flip mode only");

    await user.click(screen.getByRole("button", { name: "Show both" }));
    expect(helpItems[2]).toHaveTextContent(
      "Space Flip mode only (unavailable in Show both)",
    );
  });

  it("navigates the ordered queue with non-wrapping arrows and clean URLs", async () => {
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");

    expect(fireEvent.keyDown(document, { key: "ArrowLeft" })).toBe(true);
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "1 / 3",
    );

    expect(fireEvent.keyDown(document, { key: "ArrowRight" })).toBe(false);
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "2 / 3",
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + secondInner.id,
    );

    expect(fireEvent.keyDown(document, { key: "ArrowLeft" })).toBe(false);
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "1 / 3",
    );

    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "3 / 3",
    );
    expect(fireEvent.keyDown(document, { key: "ArrowRight" })).toBe(true);
  });

  it("follows and preserves a fixed shuffled queue with arrow navigation", async () => {
    const seed = 7070;
    const queue = deterministicShuffle(innerDeck, seed);
    renderApp("/review/inner/" + queue[0].id + "?mode=shuffle&seed=" + seed);
    await screen.findByLabelText("Inner review progress");
    const directory = screen.getByLabelText("Shuffled inner review deck");
    const initialOrder = within(directory)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(fireEvent.keyDown(document, { key: "ArrowRight" })).toBe(false);

    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "2 / 3",
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/review/inner/" + queue[1].id + "?mode=shuffle&seed=" + seed,
    );
    expect(
      within(directory)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(initialOrder);
    expect(generateShuffleSeed).not.toHaveBeenCalled();
    expect(fetchCompleteInnerReviewDeck).toHaveBeenCalledTimes(1);
  });

  it("keeps card click, explicit controls, and global Space on one flip state", async () => {
    const user = userEvent.setup();
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");

    expect(fireEvent.keyDown(document, { key: " " })).toBe(false);
    expect(within(workspace).getByText(firstInner.meaning)).toBeVisible();
    expect(fireEvent.keyDown(document, { key: "Spacebar" })).toBe(false);
    expect(within(workspace).queryByText(firstInner.meaning)).toBeNull();

    await user.click(
      within(workspace).getByRole("button", { name: "Show answer" }),
    );
    expect(within(workspace).getByText(firstInner.meaning)).toBeVisible();
    fireEvent.keyDown(document, { key: " " });
    expect(within(workspace).queryByText(firstInner.meaning)).toBeNull();

    const flashcard = within(workspace).getByRole("button", {
      name: "Inner flashcard front. Click to reveal answer.",
    });
    flashcard.focus();
    await user.keyboard(" ");
    expect(within(workspace).getByText(firstInner.meaning)).toBeVisible();
  });

  it("ignores Space in Show both without changing display mode or URL", async () => {
    const user = userEvent.setup();
    const route = "/review/inner/" + firstInner.id + "?mode=shuffle&seed=321";
    renderApp(route);
    await screen.findByLabelText("Inner review progress");
    await user.click(screen.getByRole("button", { name: "Show both" }));

    expect(fireEvent.keyDown(document, { key: " " })).toBe(true);

    expect(screen.getByRole("button", { name: "Show both" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(route);
    expect(generateShuffleSeed).not.toHaveBeenCalled();
  });

  it("keeps shortcuts usable when parent context fails or is missing", async () => {
    vi.mocked(fetchCompleteOuterReviewDeck).mockRejectedValue(
      new ApiError(503, "Outer context failed"),
    );
    renderApp("/review/inner/" + firstInner.id);
    await screen.findByLabelText("Inner review progress");
    const workspace = screen.getByLabelText("Inner review workspace");
    expect(within(workspace).getByRole("alert")).toHaveTextContent(
      "Parent context unavailable",
    );

    fireEvent.keyDown(document, { key: " " });
    expect(within(workspace).getByText(firstInner.meaning)).toBeVisible();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "2 / 3",
    );

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByLabelText("Inner review progress")).toHaveTextContent(
      "3 / 3",
    );
    expect(
      within(workspace).getByText("Parent card unavailable"),
    ).toBeVisible();
    fireEvent.keyDown(document, { key: " " });
    expect(
      within(workspace).getByText(missingParentInner.meaning),
    ).toBeVisible();
  });

  it("does not install effective shortcuts outside a usable review card", async () => {
    const pending = deferred<InnerCard[]>();
    vi.mocked(fetchCompleteInnerReviewDeck).mockReturnValueOnce(
      pending.promise,
    );
    const loadingView = renderApp("/review/inner/" + firstInner.id);
    expect(
      await screen.findByText(
        "Preparing the complete ordered inner review deck…",
      ),
    ).toHaveAttribute("role", "status");
    expect(fireEvent.keyDown(document, { key: "ArrowRight" })).toBe(true);
    loadingView.unmount();

    vi.mocked(fetchCompleteInnerReviewDeck).mockResolvedValueOnce([]);
    const emptyView = renderApp("/review/inner");
    expect(await screen.findByText("Empty inner deck")).toBeInTheDocument();
    expect(fireEvent.keyDown(document, { key: " " })).toBe(true);
    emptyView.unmount();

    vi.mocked(fetchCompleteInnerReviewDeck).mockResolvedValueOnce(innerDeck);
    renderApp("/review/inner/missing");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inner review card not found",
    );
    expect(fireEvent.keyDown(document, { key: "ArrowRight" })).toBe(true);
  });
});
