import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { ApiError } from "../lib/api";
import {
  listInnerCards,
  retrieveInnerCard,
  type InnerCard,
} from "../lib/innerCards";
import {
  listOuterCards,
  type OuterCard,
  type OuterCardListResponse,
} from "../lib/outerCards";
import {
  fetchCompleteOuterReviewDeck,
  fetchCompleteOuterReviewInnerContent,
} from "../lib/outerReview";
import { OUTER_REVIEW_AUTO_INNER_CONTENT_KEY } from "../lib/outerReviewPreferences";

vi.mock("../lib/outerReview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/outerReview")>();
  return {
    ...actual,
    fetchCompleteOuterReviewDeck: vi.fn(),
    fetchCompleteOuterReviewInnerContent: vi.fn(),
  };
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

const firstCard: OuterCard = {
  id: "11111111-1111-4111-8111-111111111111",
  term: "経験",
  reading: "けいけん",
  part_of_speech: "名詞",
  meaning: "經驗",
  jlpt_level: "N3",
  notes: "A useful word",
  sort_order: 1,
  created_at: "2026-07-14T01:00:00Z",
  updated_at: "2026-07-14T02:00:00Z",
};

const secondCard: OuterCard = {
  ...firstCard,
  id: "22222222-2222-4222-8222-222222222222",
  term: "予定",
  reading: null,
  part_of_speech: null,
  meaning: "預定",
  jlpt_level: null,
  notes: null,
  sort_order: 2,
};

const thirdCard: OuterCard = {
  ...firstCard,
  id: "33333333-3333-4333-8333-333333333333",
  term: "確認",
  reading: "かくにん",
  meaning: "確認",
  sort_order: 3,
};

const deck = [firstCard, secondCard, thirdCard];

const fullInnerCard: InnerCard = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  outer_card_id: firstCard.id,
  expression: "経験を積む",
  reading: "けいけんをつむ",
  meaning: "累積經驗",
  usage_note: "Common collocation",
  notes: "Often used for work experience.",
  sort_order: 1,
  created_at: "2026-07-14T01:00:00Z",
  updated_at: "2026-07-14T01:00:00Z",
};

const minimalInnerCard: InnerCard = {
  ...fullInnerCard,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expression: "経験がある",
  reading: null,
  meaning: "有經驗",
  usage_note: null,
  notes: null,
  sort_order: 2,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderApp(route = "/review/outer") {
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
  window.localStorage.clear();
  vi.mocked(fetchCompleteOuterReviewDeck).mockResolvedValue(deck);
  vi.mocked(fetchCompleteOuterReviewInnerContent).mockResolvedValue([
    fullInnerCard,
  ]);
  vi.mocked(listOuterCards).mockResolvedValue({
    items: [],
    total: 0,
    offset: 0,
    limit: 10,
  } satisfies OuterCardListResponse);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("outer review deck states and routing", () => {
  it("shows loading and empty-deck states", async () => {
    const pendingDeck = deferred<OuterCard[]>();
    vi.mocked(fetchCompleteOuterReviewDeck).mockReturnValue(
      pendingDeck.promise,
    );
    renderApp();

    expect(
      screen.getByText("Preparing the complete ordered review deck…"),
    ).toHaveAttribute("role", "status");

    pendingDeck.resolve([]);
    expect(await screen.findByText("Empty deck")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to card management" }),
    ).toHaveAttribute("href", "/cards");
  });

  it("shows an API error and retries the complete deck", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCompleteOuterReviewDeck)
      .mockRejectedValueOnce(new ApiError(503, "Review service unavailable"))
      .mockResolvedValueOnce(deck);
    renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Review service unavailable",
    );
    await user.click(
      screen.getByRole("button", { name: "Retry outer review deck" }),
    );

    expect(await screen.findByLabelText("Review progress")).toHaveTextContent(
      "1 / 3",
    );
    expect(fetchCompleteOuterReviewDeck).toHaveBeenCalledTimes(2);
  });

  it("redirects the route without an ID to the first ordered card", async () => {
    renderApp();

    expect(await screen.findByLabelText("Review progress")).toHaveTextContent(
      "1 / 3",
    );
    expect(screen.getByRole("link", { name: /経験/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("restores a direct selection and reports its true progress", async () => {
    renderApp("/review/outer/" + secondCard.id);

    expect(await screen.findByLabelText("Review progress")).toHaveTextContent(
      "2 / 3",
    );
    expect(screen.getByRole("link", { name: /予定/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("handles an unknown card and returns to the first available card", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/missing-card");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Review card not found",
    );
    await user.click(
      screen.getByRole("button", { name: "Return to first review card" }),
    );
    expect(await screen.findByLabelText("Review progress")).toHaveTextContent(
      "1 / 3",
    );
  });

  it("uses directory links as URL-backed selection", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);

    await user.click(await screen.findByRole("link", { name: /確認/ }));

    expect(screen.getByLabelText("Review progress")).toHaveTextContent("3 / 3");
    expect(screen.getByRole("link", { name: /確認/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("outer review presentation and navigation", () => {
  it("starts on the front and supports both card and explicit-button flipping", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");
    const workspace = screen.getByLabelText("Outer review workspace");

    expect(within(workspace).getByText(firstCard.term)).toBeInTheDocument();
    expect(
      within(workspace).queryByText(firstCard.meaning),
    ).not.toBeInTheDocument();

    await user.click(
      within(workspace).getByRole("button", { name: /Flashcard front/ }),
    );
    expect(within(workspace).getByText(firstCard.meaning)).toBeInTheDocument();

    await user.click(
      within(workspace).getByRole("button", { name: "Show front" }),
    );
    expect(
      within(workspace).queryByText(firstCard.meaning),
    ).not.toBeInTheDocument();

    await user.click(
      within(workspace).getByRole("button", { name: "Show answer" }),
    );
    expect(within(workspace).getByText(firstCard.meaning)).toBeInTheDocument();
  });

  it("resets flip mode to the front when navigation changes the card", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");
    const workspace = screen.getByLabelText("Outer review workspace");

    await user.click(
      within(workspace).getByRole("button", { name: "Show answer" }),
    );
    await user.click(
      within(workspace).getByRole("button", { name: "Next card" }),
    );

    expect(within(workspace).getByText(secondCard.term)).toBeInTheDocument();
    expect(
      within(workspace).queryByText(secondCard.meaning),
    ).not.toBeInTheDocument();
    expect(
      within(workspace).getByRole("button", { name: "Show answer" }),
    ).toBeInTheDocument();
  });

  it("keeps simultaneous mode across cards and returns to a fresh front", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");
    const workspace = screen.getByLabelText("Outer review workspace");

    await user.click(
      within(workspace).getByRole("button", { name: "Show both" }),
    );
    expect(within(workspace).getByText(firstCard.meaning)).toBeInTheDocument();
    await user.click(
      within(workspace).getByRole("button", { name: "Next card" }),
    );
    expect(within(workspace).getByText(secondCard.meaning)).toBeInTheDocument();
    expect(within(workspace).queryByText("Reading")).not.toBeInTheDocument();
    expect(
      within(workspace).queryByText("Part of speech"),
    ).not.toBeInTheDocument();
    expect(within(workspace).queryByText("JLPT level")).not.toBeInTheDocument();
    expect(within(workspace).queryByText("Notes")).not.toBeInTheDocument();

    await user.click(
      within(workspace).getByRole("button", { name: "Flip mode" }),
    );
    expect(
      within(workspace).queryByText(secondCard.meaning),
    ).not.toBeInTheDocument();
    expect(
      within(workspace).getByRole("button", { name: "Show answer" }),
    ).toBeInTheDocument();
  });

  it("uses ordered boundaries without wrapping", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");
    const workspace = screen.getByLabelText("Outer review workspace");
    const previous = within(workspace).getByRole("button", {
      name: "Previous card",
    });
    const next = within(workspace).getByRole("button", { name: "Next card" });

    expect(previous).toBeDisabled();
    await user.click(next);
    expect(
      within(workspace).getByLabelText("Review progress"),
    ).toHaveTextContent("2 / 3");
    await user.click(next);
    expect(
      within(workspace).getByLabelText("Review progress"),
    ).toHaveTextContent("3 / 3");
    expect(next).toBeDisabled();
  });

  it("does not request or present inner content before manual expansion", async () => {
    renderApp("/review/outer/" + firstCard.id);

    await screen.findByLabelText("Review progress");
    expect(fetchCompleteOuterReviewInnerContent).not.toHaveBeenCalled();
    expect(listInnerCards).not.toHaveBeenCalled();
    expect(retrieveInnerCard).not.toHaveBeenCalled();
    expect(screen.queryByText("Inner-card management")).not.toBeInTheDocument();
  });

  it("preserves the existing management route", async () => {
    renderApp("/cards");

    expect(await screen.findByText("No outer cards yet")).toBeInTheDocument();
    await waitFor(() => expect(listOuterCards).toHaveBeenCalled());
  });
});

describe("manual outer-review inner content", () => {
  it("lazy loads, presents all fields, hides, and reuses fresh cached content", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");

    const toggle = screen.getByRole("button", { name: "Show inner content" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(fetchCompleteOuterReviewInnerContent).not.toHaveBeenCalled();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      await screen.findByText(fullInnerCard.expression),
    ).toBeInTheDocument();
    expect(screen.getByText(fullInnerCard.reading!)).toBeInTheDocument();
    expect(screen.getByText(fullInnerCard.meaning)).toBeInTheDocument();
    expect(screen.getByText(/Common collocation/)).toBeInTheDocument();
    expect(
      screen.getByText(/Often used for work experience/),
    ).toBeInTheDocument();
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenCalledWith(
      firstCard.id,
    );

    await user.click(
      screen.getByRole("button", { name: "Hide inner content" }),
    );
    expect(
      screen.queryByText(fullInnerCard.expression),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Show inner content" }),
    );
    expect(screen.getByText(fullInnerCard.expression)).toBeInTheDocument();
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenCalledTimes(1);
  });

  it("renders missing optional fields cleanly", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCompleteOuterReviewInnerContent).mockResolvedValue([
      minimalInnerCard,
    ]);
    renderApp("/review/outer/" + firstCard.id);

    await user.click(
      await screen.findByRole("button", { name: "Show inner content" }),
    );
    const panel = await screen.findByLabelText("Inner content for 経験");

    expect(
      within(panel).getByText(minimalInnerCard.expression),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(minimalInnerCard.meaning),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/Reading:/)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/Usage note:/)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/Notes:/)).not.toBeInTheDocument();
  });

  it("shows an empty state with a parent-scoped management link", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCompleteOuterReviewInnerContent).mockResolvedValue([]);
    renderApp("/review/outer/" + firstCard.id);

    await user.click(
      await screen.findByRole("button", { name: "Show inner content" }),
    );

    expect(
      await screen.findByText("This word does not have any inner content yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add or manage inner cards" }),
    ).toHaveAttribute("href", "/cards/" + firstCard.id);
  });

  it("collapses for next, previous, and directory card changes", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");

    await user.click(
      screen.getByRole("button", { name: "Show inner content" }),
    );
    await screen.findByText(fullInnerCard.expression);
    await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByLabelText("Review progress")).toHaveTextContent("2 / 3");
    expect(
      screen.getByRole("button", { name: "Show inner content" }),
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(
      screen.getByRole("button", { name: "Show inner content" }),
    );
    await user.click(screen.getByRole("button", { name: "Previous card" }));
    expect(screen.getByLabelText("Review progress")).toHaveTextContent("1 / 3");
    expect(
      screen.getByRole("button", { name: "Show inner content" }),
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("link", { name: /確認/ }));
    expect(screen.getByLabelText("Review progress")).toHaveTextContent("3 / 3");
    expect(
      screen.getByRole("button", { name: "Show inner content" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenNthCalledWith(
      1,
      firstCard.id,
    );
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenNthCalledWith(
      2,
      secondCard.id,
    );
    expect(fetchCompleteOuterReviewInnerContent).not.toHaveBeenCalledWith(
      thirdCard.id,
    );
  });

  it("keeps the panel expanded while changing display mode on one card", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");

    await user.click(
      screen.getByRole("button", { name: "Show inner content" }),
    );
    await screen.findByText(fullInnerCard.expression);
    await user.click(screen.getByRole("button", { name: "Show both" }));
    expect(screen.getByText(fullInnerCard.expression)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide inner content" }),
    ).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Flip mode" }));
    expect(screen.getByText(fullInnerCard.expression)).toBeInTheDocument();
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenCalledTimes(1);
  });

  it("keeps inner loading and errors local and retries only inner content", async () => {
    const user = userEvent.setup();
    const pendingInnerContent = deferred<InnerCard[]>();
    vi.mocked(fetchCompleteOuterReviewInnerContent).mockReturnValueOnce(
      pendingInnerContent.promise,
    );
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");

    await user.click(
      screen.getByRole("button", { name: "Show inner content" }),
    );
    expect(screen.getByText("Loading inner content…")).toHaveAttribute(
      "role",
      "status",
    );
    expect(
      screen.getByRole("heading", { name: firstCard.term }),
    ).toBeInTheDocument();
    pendingInnerContent.resolve([fullInnerCard]);
    expect(
      await screen.findByText(fullInnerCard.expression),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Hide inner content" }),
    );
    vi.mocked(fetchCompleteOuterReviewInnerContent)
      .mockRejectedValueOnce(new ApiError(503, "Inner content unavailable"))
      .mockResolvedValueOnce([fullInnerCard]);
    // A fresh card-scoped query is used so the cached first-card result stays intact.
    await user.click(screen.getByRole("button", { name: "Next card" }));
    await user.click(
      screen.getByRole("button", { name: "Show inner content" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inner content unavailable",
    );
    expect(screen.getByLabelText("Review progress")).toHaveTextContent("2 / 3");
    await user.click(
      screen.getByRole("button", { name: "Retry inner content" }),
    );
    expect(
      await screen.findByText(fullInnerCard.expression),
    ).toBeInTheDocument();
    expect(fetchCompleteOuterReviewDeck).toHaveBeenCalledTimes(1);
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenCalledTimes(3);
  });
});

describe("persistent automatic inner-content display", () => {
  function getAutomaticSwitch() {
    return screen.getByRole("switch", {
      name: /Automatically show inner content/,
    });
  }

  it("defaults off with an accessible status and does not load inner content", async () => {
    renderApp("/review/outer/" + firstCard.id);

    await screen.findByLabelText("Review progress");
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Automatic display: Off")).toBeInTheDocument();
    expect(fetchCompleteOuterReviewInnerContent).not.toHaveBeenCalled();
  });

  it("enables, persists, expands immediately, then disables and collapses", async () => {
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");

    await user.click(getAutomaticSwitch());
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Automatic display: On")).toBeInTheDocument();
    expect(
      window.localStorage.getItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY),
    ).toBe("true");
    expect(
      await screen.findByRole("button", { name: "Hide inner content" }),
    ).toBeInTheDocument();
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenCalledWith(
      firstCard.id,
    );

    await user.click(getAutomaticSwitch());
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "false");
    expect(
      window.localStorage.getItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY),
    ).toBe("false");
    expect(
      await screen.findByRole("button", { name: "Show inner content" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("restores the enabled preference after a review-page reload", async () => {
    const user = userEvent.setup();
    const firstView = renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");
    await user.click(getAutomaticSwitch());
    await screen.findByRole("button", { name: "Hide inner content" });
    firstView.unmount();

    renderApp("/review/outer/" + firstCard.id);

    expect(await screen.findByLabelText("Review progress")).toHaveTextContent(
      "1 / 3",
    );
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "true");
    expect(
      await screen.findByRole("button", { name: "Hide inner content" }),
    ).toBeInTheDocument();
  });

  it("starts a direct URL and every navigated card expanded when enabled", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY, "true");
    renderApp("/review/outer/" + secondCard.id);

    expect(await screen.findByLabelText("Review progress")).toHaveTextContent(
      "2 / 3",
    );
    expect(
      await screen.findByRole("button", { name: "Hide inner content" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenCalledWith(
      secondCard.id,
    );

    await user.click(screen.getByRole("button", { name: "Previous card" }));
    expect(screen.getByLabelText("Review progress")).toHaveTextContent("1 / 3");
    expect(
      await screen.findByRole("button", { name: "Hide inner content" }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Next card" }));
    await user.click(screen.getByRole("link", { name: /確認/ }));
    expect(screen.getByLabelText("Review progress")).toHaveTextContent("3 / 3");
    expect(
      await screen.findByRole("button", { name: "Hide inner content" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenCalledWith(
      firstCard.id,
    );
    expect(fetchCompleteOuterReviewInnerContent).toHaveBeenCalledWith(
      thirdCard.id,
    );
  });

  it("allows a manual hide while enabled and expands the next card again", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY, "true");
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");

    await user.click(
      await screen.findByRole("button", { name: "Hide inner content" }),
    );
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "true");
    expect(
      window.localStorage.getItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY),
    ).toBe("true");
    await user.click(screen.getByRole("button", { name: "Show both" }));
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(
      await screen.findByRole("button", { name: "Hide inner content" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("keeps manual expansion independent while automatic display is off", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY, "false");
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");

    await user.click(
      screen.getByRole("button", { name: "Show inner content" }),
    );

    expect(
      await screen.findByText(fullInnerCard.expression),
    ).toBeInTheDocument();
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "false");
    expect(
      window.localStorage.getItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY),
    ).toBe("false");
  });

  it("survives localStorage read and write failures", async () => {
    const readFailure = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("Storage blocked");
      });
    const firstView = renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");
    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "false");
    firstView.unmount();
    readFailure.mockRestore();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage quota exceeded");
    });
    const user = userEvent.setup();
    renderApp("/review/outer/" + firstCard.id);
    await screen.findByLabelText("Review progress");
    await user.click(getAutomaticSwitch());

    expect(getAutomaticSwitch()).toHaveAttribute("aria-checked", "true");
    expect(
      await screen.findByRole("button", { name: "Hide inner content" }),
    ).toBeInTheDocument();
  });
});
