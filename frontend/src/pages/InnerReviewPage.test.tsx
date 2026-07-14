import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { ApiError } from "../lib/api";
import type { InnerCard } from "../lib/innerCards";
import { fetchCompleteInnerReviewDeck } from "../lib/innerReview";
import {
  listOuterCards,
  retrieveOuterCard,
  type OuterCard,
} from "../lib/outerCards";
import { fetchCompleteOuterReviewDeck } from "../lib/outerReview";

vi.mock("../lib/innerReview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/innerReview")>();
  return { ...actual, fetchCompleteInnerReviewDeck: vi.fn() };
});

vi.mock("../lib/outerReview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/outerReview")>();
  return { ...actual, fetchCompleteOuterReviewDeck: vi.fn() };
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

function renderApp(route = "/review/inner") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(fetchCompleteInnerReviewDeck).mockResolvedValue(innerDeck);
  vi.mocked(fetchCompleteOuterReviewDeck).mockResolvedValue(outerDeck);
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
