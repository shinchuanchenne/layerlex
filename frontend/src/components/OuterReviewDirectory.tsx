import { Link } from "react-router-dom";

import type { OuterCard } from "../lib/outerCards";

interface OuterReviewDirectoryProps {
  cards: OuterCard[];
  currentCardId?: string;
  isShuffled: boolean;
  roundQuery: string;
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
}

export function OuterReviewDirectory({
  cards,
  currentCardId,
  isShuffled,
  roundQuery,
  isLoading,
  errorMessage,
  onRetry,
}: OuterReviewDirectoryProps) {
  return (
    <aside
      aria-label="Outer review directory"
      className="flex min-h-80 flex-col border-b border-slate-800 bg-slate-950 text-slate-100 lg:min-h-screen lg:border-r lg:border-b-0"
    >
      <header className="border-b border-slate-800 px-5 py-6 sm:px-7">
        <p className="text-xs font-bold tracking-[0.22em] text-cyan-300 uppercase">
          {isShuffled ? "Shuffled outer review" : "Ordered outer review"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">LayerLex</h1>
        <nav
          aria-label="Outer review links"
          className="mt-5 flex flex-wrap gap-4"
        >
          <Link
            to="/decks"
            className="text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline focus:ring-2 focus:ring-cyan-300 focus:outline-none"
          >
            Card management
          </Link>
          <Link
            to="/review/inner"
            className="text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline focus:ring-2 focus:ring-cyan-300 focus:outline-none"
          >
            Inner review
          </Link>
        </nav>
      </header>

      <div className="max-h-[28rem] flex-1 overflow-y-auto p-3 lg:max-h-none">
        {isLoading ? (
          <p role="status" className="px-4 py-10 text-center text-slate-400">
            Loading complete outer deck…
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
              Retry outer review deck
            </button>
          </div>
        ) : cards.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-semibold">No outer cards to review</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Add an outer card in management before starting a review.
            </p>
          </div>
        ) : (
          <ol
            aria-label={
              isShuffled
                ? "Shuffled outer review deck"
                : "Ordered outer review deck"
            }
            className="space-y-2"
          >
            {cards.map((card, index) => {
              const isCurrent = card.id === currentCardId;
              return (
                <li key={card.id}>
                  <Link
                    to={"/review/outer/" + card.id + roundQuery}
                    aria-current={isCurrent ? "page" : undefined}
                    className={
                      "block rounded-xl border p-3 transition focus:ring-2 focus:ring-cyan-300 focus:outline-none " +
                      (isCurrent
                        ? "border-cyan-300 bg-cyan-950"
                        : "border-transparent hover:border-slate-700 hover:bg-slate-900")
                    }
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xs font-bold text-slate-500">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{card.term}</p>
                        {card.reading ? (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {card.reading}
                          </p>
                        ) : null}
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-300">
                          {card.meaning}
                        </p>
                        {isCurrent ? (
                          <span className="mt-2 inline-flex text-xs font-bold tracking-wide text-cyan-200 uppercase">
                            Current review card
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
