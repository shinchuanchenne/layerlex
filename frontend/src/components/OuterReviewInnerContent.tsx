import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../lib/api";
import { fetchCompleteOuterReviewInnerContent } from "../lib/outerReview";
import { outerReviewKeys } from "../lib/outerReviewKeys";

interface OuterReviewInnerContentProps {
  deckId: string;
  outerCardId: string;
  outerCardTerm: string;
  automaticallyShow: boolean;
}

export function OuterReviewInnerContent({
  deckId,
  outerCardId,
  outerCardTerm,
  automaticallyShow,
}: OuterReviewInnerContentProps) {
  const [isExpanded, setIsExpanded] = useState(automaticallyShow);
  const previousAutomaticPreference = useRef(automaticallyShow);
  const panelId = "outer-review-inner-content-" + outerCardId;
  const innerContentQuery = useQuery({
    queryKey: outerReviewKeys.innerContent(outerCardId),
    queryFn: () => fetchCompleteOuterReviewInnerContent(outerCardId),
    enabled: isExpanded,
    retry: false,
    staleTime: 30_000,
  });
  const errorMessage = innerContentQuery.isError
    ? getApiErrorMessage(innerContentQuery.error)
    : undefined;
  const innerCards = innerContentQuery.data ?? [];

  useEffect(() => {
    if (previousAutomaticPreference.current === automaticallyShow) return;
    previousAutomaticPreference.current = automaticallyShow;
    setIsExpanded(automaticallyShow);
  }, [automaticallyShow]);

  return (
    <section className="mt-7">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => setIsExpanded((current) => !current)}
        className="w-full rounded-2xl border border-cyan-300 bg-cyan-50 px-5 py-4 text-left font-semibold text-cyan-950 hover:bg-cyan-100 focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:outline-none"
      >
        <span className="flex items-center justify-between gap-4">
          <span>
            {isExpanded ? "Hide inner content" : "Show inner content"}
          </span>
          <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
        </span>
      </button>

      {isExpanded ? (
        <section
          id={panelId}
          aria-label={"Inner content for " + outerCardTerm}
          className="mt-4 rounded-[2rem] border border-cyan-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 uppercase">
                Usage layer
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Inner content for {outerCardTerm}
              </h2>
            </div>
            <Link
              to={"/decks/" + deckId + "/cards/" + outerCardId}
              className="text-sm font-semibold text-cyan-800 underline-offset-4 hover:underline focus:ring-2 focus:ring-cyan-600 focus:outline-none"
            >
              Manage inner cards
            </Link>
          </header>

          {innerContentQuery.isPending ? (
            <p role="status" className="py-10 text-center text-slate-500">
              Loading inner content…
            </p>
          ) : errorMessage ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900"
            >
              <p className="font-semibold">Could not load inner content</p>
              <p className="mt-2 text-sm leading-6">{errorMessage}</p>
              <button
                type="button"
                onClick={() => void innerContentQuery.refetch()}
                className="mt-4 rounded-full bg-red-900 px-4 py-2 text-sm font-semibold text-white focus:ring-2 focus:ring-red-700 focus:ring-offset-2 focus:outline-none"
              >
                Retry inner content
              </button>
            </div>
          ) : innerCards.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-semibold text-slate-800">
                This word does not have any inner content yet.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Use card management to add collocations, phrases, patterns, or
                examples.
              </p>
              <Link
                to={"/decks/" + deckId + "/cards/" + outerCardId}
                className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:outline-none"
              >
                Add or manage inner cards
              </Link>
            </div>
          ) : (
            <ol className="mt-6 grid gap-4">
              {innerCards.map((innerCard, index) => (
                <li key={innerCard.id}>
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                      Usage {index + 1}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                      {innerCard.expression}
                    </h3>
                    {innerCard.reading ? (
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="font-semibold">Reading:</span>{" "}
                        {innerCard.reading}
                      </p>
                    ) : null}
                    <p className="mt-4 text-lg leading-7 text-slate-900">
                      <span className="font-semibold">Meaning:</span>{" "}
                      {innerCard.meaning}
                    </p>
                    {innerCard.usage_note ? (
                      <p className="mt-3 leading-7 text-slate-700">
                        <span className="font-semibold">Usage note:</span>{" "}
                        {innerCard.usage_note}
                      </p>
                    ) : null}
                    {innerCard.notes ? (
                      <p className="mt-3 leading-7 whitespace-pre-wrap text-slate-700">
                        <span className="font-semibold">Notes:</span>{" "}
                        {innerCard.notes}
                      </p>
                    ) : null}
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </section>
  );
}
