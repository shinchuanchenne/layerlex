import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  OuterReviewCard,
  type OuterReviewDisplayMode,
} from "../components/OuterReviewCard";
import { OuterReviewDirectory } from "../components/OuterReviewDirectory";
import { OuterReviewInnerContent } from "../components/OuterReviewInnerContent";
import { ReviewKeyboardHelp } from "../components/ReviewKeyboardHelp";
import { getApiErrorMessage } from "../lib/api";
import { fetchCompleteOuterReviewDeck } from "../lib/outerReview";
import { outerReviewKeys } from "../lib/outerReviewKeys";
import { useAutoShowInnerContentPreference } from "../lib/outerReviewPreferences";
import type { OuterCard } from "../lib/outerCards";
import {
  deterministicShuffle,
  generateShuffleSeed,
  parseShuffleSeed,
} from "../lib/reviewShuffle";

const EMPTY_OUTER_REVIEW_DECK: OuterCard[] = [];

function buildReviewUrl(outerCardId: string, shuffleSeed?: number) {
  const path = "/review/outer/" + outerCardId;
  return shuffleSeed === undefined
    ? path
    : path + "?mode=shuffle&seed=" + shuffleSeed;
}

export function OuterReviewPage() {
  const { outerCardId } = useParams<{ outerCardId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [displayMode, setDisplayMode] =
    useState<OuterReviewDisplayMode>("flip");
  const [automaticallyShowInnerContent, setAutomaticallyShowInnerContent] =
    useAutoShowInnerContentPreference();
  const deckQuery = useQuery({
    queryKey: outerReviewKeys.orderedDeck(),
    queryFn: fetchCompleteOuterReviewDeck,
    retry: false,
    staleTime: 0,
  });

  const orderedDeck = deckQuery.data ?? EMPTY_OUTER_REVIEW_DECK;
  const modeParam = searchParams.get("mode");
  const seedParam = searchParams.get("seed");
  const shuffleSeed = parseShuffleSeed(seedParam);
  const isShuffled = modeParam === "shuffle" && shuffleSeed !== null;
  const activeShuffleSeed = isShuffled ? (shuffleSeed ?? undefined) : undefined;
  const hasInvalidRoundParameters =
    (modeParam !== null && modeParam !== "shuffle") ||
    (modeParam === "shuffle" && shuffleSeed === null) ||
    (modeParam === null && seedParam !== null);
  const deck = useMemo(
    () =>
      isShuffled
        ? deterministicShuffle(orderedDeck, activeShuffleSeed ?? 0)
        : orderedDeck,
    [activeShuffleSeed, isShuffled, orderedDeck],
  );
  const roundQuery = isShuffled
    ? "?mode=shuffle&seed=" + activeShuffleSeed
    : "";
  const currentIndex = outerCardId
    ? deck.findIndex((card) => card.id === outerCardId)
    : -1;
  const currentCard = currentIndex >= 0 ? deck[currentIndex] : undefined;
  const deckError = deckQuery.isError
    ? getApiErrorMessage(deckQuery.error)
    : undefined;

  if (!deckQuery.isPending && !deckError && deck.length > 0) {
    if (hasInvalidRoundParameters) {
      return (
        <Navigate
          to={buildReviewUrl(outerCardId ?? orderedDeck[0].id)}
          replace
        />
      );
    }
    if (!outerCardId) {
      return (
        <Navigate to={buildReviewUrl(deck[0].id, activeShuffleSeed)} replace />
      );
    }
  }

  function goToIndex(index: number) {
    const card = deck[index];
    if (card) {
      navigate(buildReviewUrl(card.id, activeShuffleSeed));
    }
  }

  function selectOrderedMode() {
    if (currentCard) navigate(buildReviewUrl(currentCard.id));
  }

  function startShuffledRound(forceNewRound: boolean) {
    if (isShuffled && !forceNewRound) return;

    let nextSeed = generateShuffleSeed();
    if (nextSeed === activeShuffleSeed) nextSeed = (nextSeed + 1) >>> 0;
    const shuffledDeck = deterministicShuffle(orderedDeck, nextSeed);
    const firstCard = shuffledDeck[0];
    if (firstCard) navigate(buildReviewUrl(firstCard.id, nextSeed));
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
      <OuterReviewDirectory
        cards={deck}
        currentCardId={outerCardId}
        isShuffled={isShuffled}
        roundQuery={roundQuery}
        isLoading={deckQuery.isPending}
        errorMessage={deckError}
        onRetry={() => void deckQuery.refetch()}
      />

      <section
        aria-label="Outer review workspace"
        className="flex min-h-[42rem] p-5 sm:p-8 lg:min-h-screen lg:p-12"
      >
        {deckQuery.isPending ? (
          <p role="status" className="m-auto text-slate-500">
            Preparing the complete ordered review deck…
          </p>
        ) : deckError ? (
          <section className="m-auto max-w-lg text-center">
            <h2 className="text-3xl font-semibold">Review unavailable</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Retry from the review directory when the API is available.
            </p>
          </section>
        ) : deck.length === 0 ? (
          <section className="m-auto max-w-md text-center">
            <p className="text-sm font-bold tracking-[0.18em] text-cyan-700 uppercase">
              Empty deck
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Add a card before reviewing
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              The ordered outer review deck will appear after an outer card is
              created.
            </p>
            <Link
              to="/cards"
              className="mt-7 inline-flex rounded-full bg-slate-950 px-5 py-3 font-semibold text-white"
            >
              Go to card management
            </Link>
          </section>
        ) : !currentCard ? (
          <section
            role="alert"
            className="m-auto max-w-lg rounded-3xl border border-amber-300 bg-white p-8 text-center shadow-sm"
          >
            <h2 className="text-3xl font-semibold">Review card not found</h2>
            <p className="mt-3 leading-7 text-slate-600">
              This card is not part of the current ordered review deck.
            </p>
            <button
              type="button"
              onClick={() => goToIndex(0)}
              className="mt-7 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white"
            >
              Return to first review card
            </button>
          </section>
        ) : (
          <div className="m-auto w-full max-w-5xl">
            <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold tracking-[0.18em] text-cyan-700 uppercase">
                  {isShuffled
                    ? "Shuffled outer review"
                    : "Ordered outer review"}
                </p>
                <output
                  aria-label="Review progress"
                  className="mt-2 block text-3xl font-semibold text-slate-950"
                >
                  {currentIndex + 1} / {deck.length}
                </output>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  role="group"
                  aria-label="Review order mode"
                  className="inline-flex rounded-full border border-slate-300 bg-white p-1"
                >
                  <button
                    type="button"
                    aria-pressed={!isShuffled}
                    onClick={selectOrderedMode}
                    className={
                      "rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-cyan-600 focus:outline-none " +
                      (!isShuffled
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Ordered
                  </button>
                  <button
                    type="button"
                    aria-pressed={isShuffled}
                    onClick={() => startShuffledRound(false)}
                    className={
                      "rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-cyan-600 focus:outline-none " +
                      (isShuffled
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Shuffle
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => startShuffledRound(true)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-cyan-600 focus:outline-none"
                >
                  New shuffled round
                </button>
                <div
                  role="group"
                  aria-label="Review display mode"
                  className="inline-flex rounded-full border border-slate-300 bg-white p-1"
                >
                  <button
                    type="button"
                    aria-pressed={displayMode === "flip"}
                    onClick={() => setDisplayMode("flip")}
                    className={
                      "rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-cyan-600 focus:outline-none " +
                      (displayMode === "flip"
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Flip mode
                  </button>
                  <button
                    type="button"
                    aria-pressed={displayMode === "simultaneous"}
                    onClick={() => setDisplayMode("simultaneous")}
                    className={
                      "rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-cyan-600 focus:outline-none " +
                      (displayMode === "simultaneous"
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Show both
                  </button>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={automaticallyShowInnerContent}
                  onClick={() =>
                    setAutomaticallyShowInnerContent(
                      !automaticallyShowInnerContent,
                    )
                  }
                  className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-left focus:ring-2 focus:ring-cyan-600 focus:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={
                      "relative h-6 w-11 rounded-full transition " +
                      (automaticallyShowInnerContent
                        ? "bg-cyan-700"
                        : "bg-slate-300")
                    }
                  >
                    <span
                      className={
                        "absolute top-1 h-4 w-4 rounded-full bg-white transition " +
                        (automaticallyShowInnerContent ? "left-6" : "left-1")
                      }
                    />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      Automatically show inner content
                    </span>
                    <span
                      aria-live="polite"
                      className="block text-xs text-slate-500"
                    >
                      Automatic display:{" "}
                      {automaticallyShowInnerContent ? "On" : "Off"}
                    </span>
                  </span>
                </button>
                <Link
                  to={"/cards/" + currentCard.id}
                  className="text-sm font-semibold text-cyan-800 underline-offset-4 hover:underline focus:ring-2 focus:ring-cyan-600 focus:outline-none"
                >
                  Edit current card
                </Link>
              </div>
            </header>

            <OuterReviewCard
              key={currentCard.id + ":" + displayMode}
              card={currentCard}
              mode={displayMode}
              canGoPrevious={currentIndex > 0}
              canGoNext={currentIndex < deck.length - 1}
              onPrevious={() => goToIndex(currentIndex - 1)}
              onNext={() => goToIndex(currentIndex + 1)}
            />

            <ReviewKeyboardHelp
              canGoPrevious={currentIndex > 0}
              canGoNext={currentIndex < deck.length - 1}
              canFlip={displayMode === "flip"}
            />

            <OuterReviewInnerContent
              key={currentCard.id}
              outerCardId={currentCard.id}
              outerCardTerm={currentCard.term}
              automaticallyShow={automaticallyShowInnerContent}
            />

            <nav
              aria-label={
                isShuffled
                  ? "Shuffled review navigation"
                  : "Ordered review navigation"
              }
              className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3"
            >
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => goToIndex(currentIndex - 1)}
                className="justify-self-start rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 focus:ring-2 focus:ring-cyan-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous card
              </button>
              <span className="text-sm font-medium text-slate-500">
                {isShuffled ? "Shuffled round" : "Ordered deck"}
              </span>
              <button
                type="button"
                disabled={currentIndex === deck.length - 1}
                onClick={() => goToIndex(currentIndex + 1)}
                className="justify-self-end rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 focus:ring-2 focus:ring-cyan-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next card
              </button>
            </nav>
          </div>
        )}
      </section>
    </main>
  );
}
