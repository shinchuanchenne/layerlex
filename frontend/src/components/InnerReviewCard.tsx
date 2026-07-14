import { useState } from "react";

import type { InnerCard } from "../lib/innerCards";
import type { OuterCard } from "../lib/outerCards";
import { useReviewKeyboardShortcuts } from "../lib/useReviewKeyboardShortcuts";

export type InnerReviewDisplayMode = "flip" | "simultaneous";

interface InnerReviewCardProps {
  card: InnerCard;
  parent?: OuterCard;
  mode: InnerReviewDisplayMode;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

function ParentContext({ parent }: { parent?: OuterCard }) {
  if (!parent) {
    return <p className="text-sm text-amber-700">Parent card unavailable</p>;
  }

  return (
    <p className="text-sm text-slate-500">
      Outer card:{" "}
      <span className="font-semibold text-slate-700">{parent.term}</span>
      {parent.reading ? <span> · {parent.reading}</span> : null}
    </p>
  );
}

function AnswerFields({
  card,
  parent,
}: {
  card: InnerCard;
  parent?: OuterCard;
}) {
  return (
    <div className="space-y-6 text-left">
      <dl className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold tracking-wider text-violet-700 uppercase">
            Meaning
          </dt>
          <dd className="mt-2 text-2xl leading-9 font-semibold text-slate-950">
            {card.meaning}
          </dd>
        </div>
        {card.usage_note ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold tracking-wider text-violet-700 uppercase">
              Usage note
            </dt>
            <dd className="mt-2 leading-7 whitespace-pre-wrap text-slate-800">
              {card.usage_note}
            </dd>
          </div>
        ) : null}
        {card.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold tracking-wider text-violet-700 uppercase">
              Notes
            </dt>
            <dd className="mt-2 leading-7 whitespace-pre-wrap text-slate-800">
              {card.notes}
            </dd>
          </div>
        ) : null}
      </dl>
      <ParentContext parent={parent} />
    </div>
  );
}

function FrontFields({
  card,
  parent,
}: {
  card: InnerCard;
  parent?: OuterCard;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center text-center">
      <h2 className="text-4xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-6xl">
        {card.expression}
      </h2>
      {card.reading ? (
        <p className="mt-4 text-lg text-slate-600">{card.reading}</p>
      ) : null}
      <div className="mt-7">
        <ParentContext parent={parent} />
      </div>
    </div>
  );
}

export function InnerReviewCard({
  card,
  parent,
  mode,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}: InnerReviewCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const toggleCard = () => setIsFlipped((current) => !current);

  useReviewKeyboardShortcuts({
    canGoPrevious,
    canGoNext,
    canFlip: mode === "flip",
    onPrevious,
    onNext,
    onFlip: toggleCard,
  });

  if (mode === "simultaneous") {
    return (
      <article className="min-h-[26rem] rounded-[2rem] border border-violet-200 bg-white p-7 shadow-xl shadow-violet-950/10 sm:p-10">
        <p className="text-xs font-bold tracking-[0.2em] text-violet-700 uppercase">
          Front and answer
        </p>
        <div className="border-b border-slate-200 pb-7">
          <FrontFields card={card} parent={parent} />
        </div>
        <div className="mt-8">
          <AnswerFields card={card} parent={parent} />
        </div>
      </article>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleCard}
        aria-label={
          isFlipped
            ? "Inner flashcard back. Click to show front."
            : "Inner flashcard front. Click to reveal answer."
        }
        className="block min-h-[26rem] w-full rounded-[2rem] border border-violet-200 bg-white p-7 text-left shadow-xl shadow-violet-950/10 transition hover:-translate-y-0.5 hover:shadow-2xl focus:ring-4 focus:ring-violet-300 focus:outline-none sm:p-10"
      >
        <p className="text-xs font-bold tracking-[0.2em] text-violet-700 uppercase">
          {isFlipped ? "Back · Answer" : "Front · Usage prompt"}
        </p>
        {isFlipped ? (
          <div className="mt-8">
            <AnswerFields card={card} parent={parent} />
          </div>
        ) : (
          <>
            <FrontFields card={card} parent={parent} />
            <p className="text-center text-sm font-medium text-slate-500">
              Click the card to reveal
            </p>
          </>
        )}
      </button>
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={toggleCard}
          className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800 focus:ring-2 focus:ring-violet-600 focus:ring-offset-2 focus:outline-none"
        >
          {isFlipped ? "Show front" : "Show answer"}
        </button>
      </div>
    </div>
  );
}
