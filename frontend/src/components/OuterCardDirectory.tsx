import { Link } from "react-router-dom";

import type { OuterCard } from "../lib/outerCards";

interface OuterCardDirectoryProps {
  deckId: string;
  deckName: string;
  cards: OuterCard[];
  selectedCardId?: string;
  searchInput: string;
  appliedSearch: string;
  isLoading: boolean;
  errorMessage?: string;
  total: number;
  offset: number;
  onSearchChange: (value: string) => void;
  onSelect: () => void;
  onAdd: () => void;
  onRetry: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function OuterCardDirectory({
  deckId,
  deckName,
  cards,
  selectedCardId,
  searchInput,
  appliedSearch,
  isLoading,
  errorMessage,
  total,
  offset,
  onSearchChange,
  onSelect,
  onAdd,
  onRetry,
  onPreviousPage,
  onNextPage,
}: OuterCardDirectoryProps) {
  const firstItem = total === 0 ? 0 : offset + 1;
  const lastItem = Math.min(offset + cards.length, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + cards.length < total;

  return (
    <aside
      aria-label="Outer card directory"
      className="flex min-h-[32rem] flex-col border-b border-slate-200 bg-white lg:min-h-[48rem] lg:border-r lg:border-b-0"
    >
      <header className="border-b border-slate-200 px-5 py-6 sm:px-7">
        <p className="text-xs font-bold tracking-[0.22em] text-cyan-700 uppercase">
          Cards in deck
        </p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Outer cards
            </h2>
            <p className="mt-1 text-sm break-words text-slate-500">
              {deckName}
            </p>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:outline-none"
          >
            Add card
          </button>
        </div>
        <label
          htmlFor="outer-card-search"
          className="mt-6 block text-sm font-semibold text-slate-700"
        >
          Search outer cards
        </label>
        <input
          id="outer-card-search"
          type="search"
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Term, reading, or meaning"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {isLoading ? (
          <p role="status" className="px-3 py-10 text-center text-slate-500">
            Loading outer cards…
          </p>
        ) : errorMessage ? (
          <div
            role="alert"
            className="m-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 font-semibold underline underline-offset-4"
            >
              Retry loading cards
            </button>
          </div>
        ) : cards.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="font-semibold text-slate-800">
              {appliedSearch ? "No matching cards" : "No outer cards yet"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {appliedSearch
                ? "Try a different term, reading, or meaning."
                : "Add your first vocabulary word to begin."}
            </p>
          </div>
        ) : (
          <ul aria-label="Outer cards" className="space-y-2">
            {cards.map((card) => {
              const isSelected = card.id === selectedCardId;
              return (
                <li key={card.id}>
                  <Link
                    to={"/decks/" + deckId + "/cards/" + card.id}
                    onClick={onSelect}
                    aria-current={isSelected ? "page" : undefined}
                    className={
                      "block rounded-2xl border px-4 py-4 transition focus:ring-2 focus:ring-cyan-600 focus:outline-none " +
                      (isSelected
                        ? "border-cyan-600 bg-cyan-50 shadow-sm"
                        : "border-transparent hover:border-slate-200 hover:bg-slate-50")
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-950">
                          {card.term}
                        </p>
                        {card.reading ? (
                          <p className="mt-0.5 text-sm text-slate-500">
                            {card.reading}
                          </p>
                        ) : null}
                      </div>
                      {card.jlpt_level ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          {card.jlpt_level}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {card.meaning}
                    </p>
                    {isSelected ? (
                      <span className="mt-3 inline-flex text-xs font-bold tracking-wide text-cyan-800 uppercase">
                        Selected
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
        <footer className="border-t border-slate-200 px-5 py-4">
          <p className="text-center text-xs text-slate-500">
            Showing {firstItem}–{lastItem} of {total}
          </p>
          {(hasPrevious || hasNext) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!hasPrevious}
                onClick={onPreviousPage}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={onNextPage}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </footer>
      ) : null}
    </aside>
  );
}
