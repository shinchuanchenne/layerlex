import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import {
  InnerReviewCard,
  type InnerReviewDisplayMode,
} from "../components/InnerReviewCard";
import { InnerReviewDirectory } from "../components/InnerReviewDirectory";
import { getApiErrorMessage } from "../lib/api";
import { fetchCompleteInnerReviewDeck } from "../lib/innerReview";
import { innerReviewKeys } from "../lib/innerReviewKeys";
import { fetchCompleteOuterReviewDeck } from "../lib/outerReview";
import { outerReviewKeys } from "../lib/outerReviewKeys";

export function InnerReviewPage() {
  const { innerCardId } = useParams<{ innerCardId: string }>();
  const navigate = useNavigate();
  const [displayMode, setDisplayMode] =
    useState<InnerReviewDisplayMode>("flip");
  const deckQuery = useQuery({
    queryKey: innerReviewKeys.orderedDeck(),
    queryFn: fetchCompleteInnerReviewDeck,
    retry: false,
    staleTime: 0,
  });
  const parentDeckQuery = useQuery({
    queryKey: outerReviewKeys.orderedDeck(),
    queryFn: fetchCompleteOuterReviewDeck,
    retry: false,
    staleTime: 0,
  });

  const deck = deckQuery.data ?? [];
  const parentsById = useMemo(
    () =>
      new Map(
        (parentDeckQuery.data ?? []).map((parent) => [parent.id, parent]),
      ),
    [parentDeckQuery.data],
  );
  const currentIndex = innerCardId
    ? deck.findIndex((card) => card.id === innerCardId)
    : -1;
  const currentCard = currentIndex >= 0 ? deck[currentIndex] : undefined;
  const currentParent = currentCard
    ? parentsById.get(currentCard.outer_card_id)
    : undefined;
  const deckError = deckQuery.isError
    ? getApiErrorMessage(deckQuery.error)
    : undefined;
  const parentDeckError = parentDeckQuery.isError
    ? getApiErrorMessage(parentDeckQuery.error)
    : undefined;

  if (!deckQuery.isPending && !deckError && deck.length > 0 && !innerCardId) {
    return <Navigate to={"/review/inner/" + deck[0].id} replace />;
  }

  function goToIndex(index: number) {
    const card = deck[index];
    if (card) navigate("/review/inner/" + card.id);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
      <InnerReviewDirectory
        cards={deck}
        currentCardId={innerCardId}
        parentsById={parentsById}
        isLoading={deckQuery.isPending}
        errorMessage={deckError}
        onRetry={() => void deckQuery.refetch()}
      />

      <section
        aria-label="Inner review workspace"
        className="flex min-h-[42rem] p-5 sm:p-8 lg:min-h-screen lg:p-12"
      >
        {deckQuery.isPending ? (
          <p role="status" className="m-auto text-slate-500">
            Preparing the complete ordered inner review deck…
          </p>
        ) : deckError ? (
          <section className="m-auto max-w-lg text-center">
            <h2 className="text-3xl font-semibold">Inner review unavailable</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Retry from the inner review directory when the API is available.
            </p>
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
              The ordered inner review deck will appear after an inner card is
              added to an outer card.
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
            <h2 className="text-3xl font-semibold">
              Inner review card not found
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              This card is not part of the current ordered inner review deck.
            </p>
            <button
              type="button"
              onClick={() => goToIndex(0)}
              className="mt-7 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white"
            >
              Return to first inner review card
            </button>
          </section>
        ) : (
          <div className="m-auto w-full max-w-5xl">
            <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold tracking-[0.18em] text-violet-700 uppercase">
                  Ordered inner review
                </p>
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
                  aria-label="Inner review display mode"
                  className="inline-flex rounded-full border border-slate-300 bg-white p-1"
                >
                  <button
                    type="button"
                    aria-pressed={displayMode === "flip"}
                    onClick={() => setDisplayMode("flip")}
                    className={
                      "rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-violet-600 focus:outline-none " +
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
                      "rounded-full px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-violet-600 focus:outline-none " +
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
                    "/cards/" +
                    currentCard.outer_card_id +
                    "/inner/" +
                    currentCard.id
                  }
                  className="text-sm font-semibold text-violet-800 underline-offset-4 hover:underline focus:ring-2 focus:ring-violet-600 focus:outline-none"
                >
                  Manage current inner card
                </Link>
              </div>
            </header>

            {parentDeckQuery.isPending ? (
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
                  onClick={() => void parentDeckQuery.refetch()}
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
            />

            <nav
              aria-label="Ordered inner review navigation"
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
                Ordered deck
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
