import { Link } from "react-router-dom";

import type { InnerCard } from "../lib/innerCards";
import type { OuterCard } from "../lib/outerCards";

interface InnerReviewDirectoryProps {
  cards: InnerCard[];
  currentCardId?: string;
  parentsById: ReadonlyMap<string, OuterCard>;
  reviewBasePath?: string;
  managementPath?: string;
  outerReviewPath?: string;
  deckName?: string;
  isShuffled: boolean;
  roundQuery: string;
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
}

export function InnerReviewDirectory({
  cards,
  currentCardId,
  parentsById,
  reviewBasePath = "/review/inner",
  managementPath = "/decks",
  outerReviewPath = "/review/outer",
  deckName,
  isShuffled,
  roundQuery,
  isLoading,
  errorMessage,
  onRetry,
}: InnerReviewDirectoryProps) {
  return (
    <aside
      aria-label="Inner review directory"
      className="flex min-h-80 flex-col border-b border-slate-800 bg-slate-950 text-slate-100 lg:min-h-screen lg:border-r lg:border-b-0"
    >
      <header className="border-b border-slate-800 px-5 py-6 sm:px-7">
        <p className="text-xs font-bold tracking-[0.22em] text-violet-300 uppercase">
          Inner review
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">LayerLex</h1>
        <p className="mt-2 text-sm font-semibold break-words text-slate-300">
          {deckName ? `Review this deck: ${deckName}` : "Global review"}
        </p>
        <nav
          aria-label="Inner review links"
          className="mt-5 flex flex-wrap gap-4"
        >
          <Link
            to={managementPath}
            className="text-sm font-semibold text-violet-200 underline-offset-4 hover:underline focus:ring-2 focus:ring-violet-300 focus:outline-none"
          >
            Card management
          </Link>
          <Link
            to={outerReviewPath}
            className="text-sm font-semibold text-violet-200 underline-offset-4 hover:underline focus:ring-2 focus:ring-violet-300 focus:outline-none"
          >
            {deckName ? "Outer review for this deck" : "Outer review"}
          </Link>
        </nav>
      </header>

      <div className="max-h-[28rem] flex-1 overflow-y-auto p-3 lg:max-h-none">
        {isLoading ? (
          <p role="status" className="px-4 py-10 text-center text-slate-400">
            Loading complete inner deck…
          </p>
        ) : errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-800 bg-rose-950/50 p-4 text-sm text-rose-100"
          >
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 font-semibold underline underline-offset-4"
            >
              Retry inner review deck
            </button>
          </div>
        ) : cards.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-semibold">No inner cards to review</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Add usage content in card management before starting an inner
              review.
            </p>
          </div>
        ) : (
          <ol
            aria-label={
              isShuffled
                ? "Shuffled inner review deck"
                : "Ordered inner review deck"
            }
            className="space-y-2"
          >
            {cards.map((card, index) => {
              const isCurrent = card.id === currentCardId;
              const parent = parentsById.get(card.outer_card_id);
              return (
                <li key={card.id}>
                  <Link
                    to={reviewBasePath + "/" + card.id + roundQuery}
                    aria-current={isCurrent ? "page" : undefined}
                    className={
                      "block rounded-xl border p-3 transition focus:ring-2 focus:ring-violet-300 focus:outline-none " +
                      (isCurrent
                        ? "border-violet-300 bg-violet-950"
                        : "border-transparent hover:border-slate-700 hover:bg-slate-900")
                    }
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xs font-bold text-slate-500">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-white">
                          {card.expression}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-slate-300">
                          {parent?.term ?? "Parent card unavailable"}
                        </p>
                        {isCurrent ? (
                          <span className="mt-2 inline-flex text-xs font-bold tracking-wide text-violet-200 uppercase">
                            Current inner review card
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
