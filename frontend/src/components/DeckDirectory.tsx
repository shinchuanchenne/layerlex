import { Link } from "react-router-dom";

import type { Deck } from "../lib/decks";

interface DeckDirectoryProps {
  decks: Deck[];
  selectedDeckId?: string;
  isLoading: boolean;
  errorMessage?: string;
  total: number;
  offset: number;
  onSelect: () => void;
  onAdd: () => void;
  onRetry: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function DeckDirectory({
  decks,
  selectedDeckId,
  isLoading,
  errorMessage,
  total,
  offset,
  onSelect,
  onAdd,
  onRetry,
  onPreviousPage,
  onNextPage,
}: DeckDirectoryProps) {
  const firstItem = total === 0 ? 0 : offset + 1;
  const lastItem = Math.min(offset + decks.length, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + decks.length < total;

  return (
    <aside
      aria-label="Deck directory"
      className="flex min-h-[28rem] flex-col border-b border-slate-800 bg-slate-950 text-slate-100 xl:min-h-screen xl:border-r xl:border-b-0"
    >
      <header className="border-b border-slate-800 px-5 py-6">
        <p className="text-xs font-bold tracking-[0.22em] text-cyan-300 uppercase">
          Vocabulary decks
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">LayerLex</h1>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950 focus:outline-none"
          >
            Add deck
          </button>
        </div>
        <nav aria-label="Review modes" className="mt-5 flex flex-wrap gap-4">
          <Link
            to="/review/outer"
            className="text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline focus:ring-2 focus:ring-cyan-300 focus:outline-none"
          >
            Outer review
          </Link>
          <Link
            to="/review/inner"
            className="text-sm font-semibold text-violet-200 underline-offset-4 hover:underline focus:ring-2 focus:ring-violet-300 focus:outline-none"
          >
            Inner review
          </Link>
        </nav>
      </header>

      <div className="max-h-[30rem] flex-1 overflow-y-auto p-3 xl:max-h-none">
        {isLoading ? (
          <p role="status" className="px-4 py-10 text-center text-slate-400">
            Loading decks…
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
              Retry loading decks
            </button>
          </div>
        ) : decks.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-semibold">No decks yet</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Create a deck before adding vocabulary cards.
            </p>
          </div>
        ) : (
          <ul aria-label="Decks" className="space-y-2">
            {decks.map((deck) => {
              const isSelected = deck.id === selectedDeckId;
              return (
                <li key={deck.id}>
                  <Link
                    to={"/decks/" + deck.id}
                    onClick={onSelect}
                    aria-current={isSelected ? "page" : undefined}
                    className={
                      "block rounded-xl border p-4 transition focus:ring-2 focus:ring-cyan-300 focus:outline-none " +
                      (isSelected
                        ? "border-cyan-300 bg-cyan-950"
                        : "border-transparent hover:border-slate-700 hover:bg-slate-900")
                    }
                  >
                    <p className="font-semibold break-words text-white">
                      {deck.name}
                    </p>
                    {deck.description ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-300">
                        {deck.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400">
                      Order {deck.sort_order}
                    </p>
                    {isSelected ? (
                      <span className="mt-2 inline-flex text-xs font-bold tracking-wide text-cyan-200 uppercase">
                        Selected deck
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!isLoading && !errorMessage && total > 0 ? (
        <footer className="border-t border-slate-800 p-4">
          <p className="text-center text-xs text-slate-400">
            Showing {firstItem}–{lastItem} of {total}
          </p>
          {(hasPrevious || hasNext) && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!hasPrevious}
                onClick={onPreviousPage}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous decks
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={onNextPage}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next decks
              </button>
            </div>
          )}
        </footer>
      ) : null}
    </aside>
  );
}
