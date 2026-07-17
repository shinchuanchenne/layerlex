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
  InnerReviewCard,
  type InnerReviewDisplayMode,
} from "../components/InnerReviewCard";
import { InnerReviewDirectory } from "../components/InnerReviewDirectory";
import { ReviewKeyboardHelp } from "../components/ReviewKeyboardHelp";
import { getApiErrorMessage } from "../lib/api";
import { deckKeys, retrieveDeck } from "../lib/decks";
import {
  fetchCompleteDeckScopedInnerReviewDeck,
  fetchCompleteInnerReviewDeck,
} from "../lib/innerReview";
import { innerReviewKeys } from "../lib/innerReviewKeys";
import {
  innerCardKeys,
  retrieveInnerCard,
  type InnerCard,
} from "../lib/innerCards";
import { fetchCompleteOuterReviewDeck } from "../lib/outerReview";
import { outerReviewKeys } from "../lib/outerReviewKeys";
import { outerCardKeys, retrieveOuterCard } from "../lib/outerCards";
import {
  deterministicShuffle,
  generateShuffleSeed,
  parseShuffleSeed,
} from "../lib/reviewShuffle";

const EMPTY_INNER_REVIEW_DECK: InnerCard[] = [];

function getReviewBasePath(deckId?: string) {
  return deckId ? `/review/decks/${deckId}/inner` : "/review/inner";
}

function buildReviewUrl(
  innerCardId: string,
  shuffleSeed?: number,
  deckId?: string,
) {
  const path = getReviewBasePath(deckId) + "/" + innerCardId;
  return shuffleSeed === undefined
    ? path
    : path + "?mode=shuffle&seed=" + shuffleSeed;
}

export function InnerReviewPage() {
  const { deckId, innerCardId } = useParams<{
    deckId: string;
    innerCardId: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [displayMode, setDisplayMode] =
    useState<InnerReviewDisplayMode>("flip");
  const deckDetailQuery = useQuery({
    queryKey: deckKeys.detail(deckId ?? ""),
    queryFn: () => retrieveDeck(deckId ?? ""),
    enabled: Boolean(deckId),
    retry: false,
  });
  const scopedSourceQuery = useQuery({
    queryKey: innerReviewKeys.deckOrderedDeck(deckId ?? ""),
    queryFn: () => fetchCompleteDeckScopedInnerReviewDeck(deckId ?? ""),
    enabled: Boolean(deckId) && deckDetailQuery.isSuccess,
    retry: false,
    staleTime: 0,
  });
  const globalDeckQuery = useQuery({
    queryKey: innerReviewKeys.orderedDeck(),
    queryFn: fetchCompleteInnerReviewDeck,
    enabled: !deckId,
    retry: false,
    staleTime: 0,
  });
  const globalParentDeckQuery = useQuery({
    queryKey: outerReviewKeys.orderedDeck(),
    queryFn: () => fetchCompleteOuterReviewDeck(),
    enabled: !deckId,
    retry: false,
    staleTime: 0,
  });

  const orderedDeck = deckId
    ? (scopedSourceQuery.data?.cards ?? EMPTY_INNER_REVIEW_DECK)
    : (globalDeckQuery.data ?? EMPTY_INNER_REVIEW_DECK);
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
  const parentsById = useMemo(
    () =>
      new Map(
        (deckId
          ? (scopedSourceQuery.data?.parents ?? [])
          : (globalParentDeckQuery.data ?? [])
        ).map((parent) => [parent.id, parent]),
      ),
    [deckId, globalParentDeckQuery.data, scopedSourceQuery.data?.parents],
  );
  const currentIndex = innerCardId
    ? deck.findIndex((card) => card.id === innerCardId)
    : -1;
  const currentCard = currentIndex >= 0 ? deck[currentIndex] : undefined;
  const currentParent = currentCard
    ? parentsById.get(currentCard.outer_card_id)
    : undefined;
  const sourceError = deckId
    ? scopedSourceQuery.isError
      ? getApiErrorMessage(scopedSourceQuery.error)
      : undefined
    : globalDeckQuery.isError
      ? getApiErrorMessage(globalDeckQuery.error)
      : undefined;
  const deckDetailError = deckDetailQuery.isError
    ? getApiErrorMessage(deckDetailQuery.error)
    : undefined;
  const parentDeckError = globalParentDeckQuery.isError
    ? getApiErrorMessage(globalParentDeckQuery.error)
    : undefined;
  const reviewIsPending = deckId
    ? deckDetailQuery.isPending ||
      (deckDetailQuery.isSuccess && scopedSourceQuery.isPending)
    : globalDeckQuery.isPending;
  const reviewError = deckDetailError ?? sourceError;
  const reviewReady = !reviewIsPending && !reviewError;
  const reviewBasePath = getReviewBasePath(deckId);
  const managementPath = deckId ? "/decks/" + deckId : "/decks";
  const outerReviewPath = deckId
    ? `/review/decks/${deckId}/outer`
    : "/review/outer";
  const recoveryInnerQuery = useQuery({
    queryKey: innerCardKeys.detail(innerCardId ?? ""),
    queryFn: () => retrieveInnerCard(innerCardId ?? ""),
    enabled: Boolean(deckId && innerCardId) && reviewReady && currentIndex < 0,
    retry: false,
  });
  const recoveryParentQuery = useQuery({
    queryKey: outerCardKeys.detail(
      recoveryInnerQuery.data?.outer_card_id ?? "",
    ),
    queryFn: () =>
      retrieveOuterCard(recoveryInnerQuery.data?.outer_card_id ?? ""),
    enabled: Boolean(deckId && recoveryInnerQuery.data),
    retry: false,
  });

  if (reviewReady) {
    if (hasInvalidRoundParameters) {
      return (
        <Navigate
          to={
            innerCardId
              ? buildReviewUrl(innerCardId, undefined, deckId)
              : reviewBasePath
          }
          replace
        />
      );
    }
    if (deck.length > 0 && !innerCardId) {
      return (
        <Navigate
          to={buildReviewUrl(deck[0].id, activeShuffleSeed, deckId)}
          replace
        />
      );
    }
  }

  function goToIndex(index: number) {
    const card = deck[index];
    if (card) {
      navigate(buildReviewUrl(card.id, activeShuffleSeed, deckId));
    }
  }

  function selectOrderedMode() {
    if (currentCard) {
      navigate(buildReviewUrl(currentCard.id, undefined, deckId));
    }
  }

  function startShuffledRound(forceNewRound: boolean) {
    if (isShuffled && !forceNewRound) return;

    let nextSeed = generateShuffleSeed();
    if (nextSeed === activeShuffleSeed) nextSeed = (nextSeed + 1) >>> 0;
    const shuffledDeck = deterministicShuffle(orderedDeck, nextSeed);
    const firstCard = shuffledDeck[0];
    if (firstCard) {
      navigate(buildReviewUrl(firstCard.id, nextSeed, deckId));
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
      <InnerReviewDirectory
        cards={deck}
        currentCardId={innerCardId}
        parentsById={parentsById}
        reviewBasePath={reviewBasePath}
        managementPath={managementPath}
        outerReviewPath={outerReviewPath}
        deckName={deckDetailQuery.data?.name}
        isShuffled={isShuffled}
        roundQuery={roundQuery}
        isLoading={reviewIsPending}
        errorMessage={reviewError}
        onRetry={() => {
          if (deckDetailQuery.isError) {
            void deckDetailQuery.refetch();
          } else if (deckId) {
            void scopedSourceQuery.refetch();
          } else {
            void globalDeckQuery.refetch();
          }
        }}
      />

      <section
        aria-label="Inner review workspace"
        className="flex min-h-[42rem] p-5 sm:p-8 lg:min-h-screen lg:p-12"
      >
        {reviewIsPending ? (
          <p role="status" className="m-auto text-slate-500">
            {deckId && deckDetailQuery.isPending
              ? "Loading selected deck…"
              : "Preparing the complete ordered inner review deck…"}
          </p>
        ) : reviewError ? (
          <section className="m-auto max-w-lg text-center">
            <h2 className="text-3xl font-semibold">
              {deckDetailQuery.isError
                ? "Selected deck unavailable"
                : "Inner review unavailable"}
            </h2>
            <p className="mt-3 leading-7 text-slate-600">{reviewError}</p>
            <Link
              to="/decks"
              className="mt-6 inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700"
            >
              Return to deck management
            </Link>
          </section>
        ) : deck.length === 0 ? (
          <section className="m-auto max-w-md text-center">
            <p className="text-sm font-bold tracking-[0.18em] text-violet-700 uppercase">
              Empty inner deck
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Add inner content before reviewing
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              {deckId
                ? "This deck has no inner content to review yet."
                : "The inner review deck will appear after an inner card is added to an outer card."}
            </p>
            <Link
              to={managementPath}
              className="mt-7 inline-flex rounded-full bg-slate-950 px-5 py-3 font-semibold text-white"
            >
              Go to card management
            </Link>
          </section>
        ) : !currentCard &&
          deckId &&
          (recoveryInnerQuery.isPending ||
            (recoveryInnerQuery.data && recoveryParentQuery.isPending)) ? (
          <p role="status" className="m-auto text-slate-500">
            Checking the requested inner card…
          </p>
        ) : !currentCard ? (
          <section
            role="alert"
            className="m-auto max-w-lg rounded-3xl border border-amber-300 bg-white p-8 text-center shadow-sm"
          >
            <h2 className="text-3xl font-semibold">
              {deckId &&
              recoveryParentQuery.data &&
              recoveryParentQuery.data.deck_id !== deckId
                ? "Inner card belongs to another deck"
                : "Inner review card not found"}
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              This inner card is not part of the selected deck and has not been
              displayed here.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to={reviewBasePath}
                className="rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700"
              >
                Return to selected deck review
              </Link>
              {deckId &&
              recoveryInnerQuery.data &&
              recoveryParentQuery.data &&
              recoveryParentQuery.data.deck_id !== deckId ? (
                <Link
                  to={buildReviewUrl(
                    recoveryInnerQuery.data.id,
                    undefined,
                    recoveryParentQuery.data.deck_id,
                  )}
                  className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white"
                >
                  Open inner card in its actual deck
                </Link>
              ) : deck.length > 0 ? (
                <button
                  type="button"
                  onClick={() => goToIndex(0)}
                  className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white"
                >
                  Return to first inner review card
                </button>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="m-auto w-full max-w-5xl">
            <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold tracking-[0.18em] text-violet-700 uppercase">
                  {isShuffled
                    ? "Shuffled inner review"
                    : "Ordered inner review"}
                </p>
                {deckDetailQuery.data ? (
                  <p className="mt-2 max-w-xl text-sm font-semibold break-words text-violet-900">
                    Deck: {deckDetailQuery.data.name}
                  </p>
                ) : null}
                <output
                  aria-label="Inner review progress"
                  className="mt-2 block text-3xl font-semibold text-slate-950"
                >
                  {currentIndex + 1} / {deck.length}
                </output>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  role="group"
                  aria-label="Inner review order mode"
                  className="inline-flex rounded-full border border-slate-300 bg-white p-1"
                >
                  <button
                    type="button"
                    aria-pressed={!isShuffled}
                    onClick={selectOrderedMode}
                    className={
                      "min-h-11 rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-violet-600 focus:outline-none " +
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
                      "min-h-11 rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-violet-600 focus:outline-none " +
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
                  className="min-h-11 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-violet-600 focus:outline-none"
                >
                  New shuffled round
                </button>
                <div
                  role="group"
                  aria-label="Inner review display mode"
                  className="inline-flex rounded-full border border-slate-300 bg-white p-1"
                >
                  <button
                    type="button"
                    aria-pressed={displayMode === "flip"}
                    onClick={() => setDisplayMode("flip")}
                    className={
                      "min-h-11 rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-violet-600 focus:outline-none " +
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
                      "min-h-11 rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-violet-600 focus:outline-none " +
                      (displayMode === "simultaneous"
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Show both
                  </button>
                </div>
                <Link
                  to={
                    currentParent
                      ? "/decks/" +
                        currentParent.deck_id +
                        "/cards/" +
                        currentCard.outer_card_id +
                        "/inner/" +
                        currentCard.id
                      : "/decks"
                  }
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-800 underline-offset-4 hover:underline focus:ring-2 focus:ring-violet-600 focus:outline-none"
                >
                  Manage current inner card
                </Link>
              </div>
            </header>

            {!deckId && globalParentDeckQuery.isPending ? (
              <p
                role="status"
                className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
              >
                Loading outer-card context… Inner review remains available.
              </p>
            ) : parentDeckError ? (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                <p>Parent context unavailable. Inner review can continue.</p>
                <button
                  type="button"
                  onClick={() => void globalParentDeckQuery.refetch()}
                  className="font-semibold underline underline-offset-4"
                >
                  Retry parent context
                </button>
              </div>
            ) : null}

            <InnerReviewCard
              key={currentCard.id + ":" + displayMode}
              card={currentCard}
              parent={currentParent}
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

            <nav
              aria-label={
                isShuffled
                  ? "Shuffled inner review navigation"
                  : "Ordered inner review navigation"
              }
              className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3"
            >
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => goToIndex(currentIndex - 1)}
                className="justify-self-start rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 focus:ring-2 focus:ring-violet-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous inner card
              </button>
              <span className="text-sm font-medium text-slate-500">
                {isShuffled ? "Shuffled round" : "Ordered deck"}
              </span>
              <button
                type="button"
                disabled={currentIndex === deck.length - 1}
                onClick={() => goToIndex(currentIndex + 1)}
                className="justify-self-end rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 focus:ring-2 focus:ring-violet-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next inner card
              </button>
            </nav>
          </div>
        )}
      </section>
    </main>
  );
}
