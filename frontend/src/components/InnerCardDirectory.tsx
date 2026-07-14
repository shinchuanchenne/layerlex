import { Link } from "react-router-dom";

import type { InnerCard } from "../lib/innerCards";

interface InnerCardDirectoryProps {
  outerCardId: string;
  cards: InnerCard[];
  selectedInnerCardId?: string;
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

export function InnerCardDirectory({
  outerCardId,
  cards,
  selectedInnerCardId,
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
}: InnerCardDirectoryProps) {
  const firstItem = total === 0 ? 0 : offset + 1;
  const lastItem = Math.min(offset + cards.length, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + cards.length < total;

  return (
    <section
      aria-label="Inner card directory"
      className="rounded-2xl border border-slate-200 bg-slate-50"
    >
      <header className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-slate-950">Inner cards</h3>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 focus:ring-2 focus:ring-cyan-700 focus:ring-offset-2 focus:outline-none"
          >
            Add inner card
          </button>
        </div>
        <label
          htmlFor="inner-card-search"
          className="mt-4 block text-sm font-semibold text-slate-700"
        >
          Search inner cards
        </label>
        <input
          id="inner-card-search"
          type="search"
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Expression, reading, meaning, or usage"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </header>

      <div className="min-h-64 p-3">
        {isLoading ? (
          <p role="status" className="px-3 py-10 text-center text-slate-500">
            Loading inner cards…
          </p>
        ) : errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 font-semibold underline underline-offset-4"
            >
              Retry loading inner cards
            </button>
          </div>
        ) : cards.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="font-semibold text-slate-800">
              {appliedSearch ? "No matching inner cards" : "No inner cards yet"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {appliedSearch
                ? "Try another expression, reading, meaning, or usage note."
                : "Add a phrase, collocation, pattern, or example sentence."}
            </p>
          </div>
        ) : (
          <ul aria-label="Inner cards" className="space-y-2">
            {cards.map((card) => {
              const isSelected = card.id === selectedInnerCardId;
              return (
                <li key={card.id}>
                  <Link
                    to={"/cards/" + outerCardId + "/inner/" + card.id}
                    onClick={onSelect}
                    aria-current={isSelected ? "page" : undefined}
                    className={
                      "block rounded-xl border p-3 transition focus:ring-2 focus:ring-cyan-600 focus:outline-none " +
                      (isSelected
                        ? "border-cyan-600 bg-cyan-50"
                        : "border-transparent bg-white hover:border-slate-200")
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {card.expression}
                        </p>
                        {card.reading ? (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {card.reading}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        Order {card.sort_order}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">
                      {card.meaning}
                    </p>
                    {isSelected ? (
                      <span className="mt-2 inline-flex text-xs font-bold tracking-wide text-cyan-800 uppercase">
                        Selected inner card
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
        <footer className="border-t border-slate-200 p-3">
          <p className="text-center text-xs text-slate-500">
            Showing {firstItem}–{lastItem} of {total}
          </p>
          {(hasPrevious || hasNext) && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!hasPrevious}
                onClick={onPreviousPage}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous inner page
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={onNextPage}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next inner page
              </button>
            </div>
          )}
        </footer>
      ) : null}
    </section>
  );
}
