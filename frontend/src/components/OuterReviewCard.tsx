import { useState } from "react";

import type { OuterCard } from "../lib/outerCards";

export type OuterReviewDisplayMode = "flip" | "simultaneous";

interface OuterReviewCardProps {
  card: OuterCard;
  mode: OuterReviewDisplayMode;
}

function AnswerFields({ card }: { card: OuterCard }) {
  return (
    <dl className="grid gap-5 text-left sm:grid-cols-2">
      {card.reading ? (
        <div>
          <dt className="text-xs font-bold tracking-wider text-cyan-700 uppercase">
            Reading
          </dt>
          <dd className="mt-1 text-lg text-slate-900">{card.reading}</dd>
        </div>
      ) : null}
      {card.part_of_speech ? (
        <div>
          <dt className="text-xs font-bold tracking-wider text-cyan-700 uppercase">
            Part of speech
          </dt>
          <dd className="mt-1 text-lg text-slate-900">{card.part_of_speech}</dd>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <dt className="text-xs font-bold tracking-wider text-cyan-700 uppercase">
          Meaning
        </dt>
        <dd className="mt-2 text-2xl leading-9 font-semibold text-slate-950">
          {card.meaning}
        </dd>
      </div>
      {card.jlpt_level ? (
        <div>
          <dt className="text-xs font-bold tracking-wider text-cyan-700 uppercase">
            JLPT level
          </dt>
          <dd className="mt-1 text-lg text-slate-900">{card.jlpt_level}</dd>
        </div>
      ) : null}
      {card.notes ? (
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold tracking-wider text-cyan-700 uppercase">
            Notes
          </dt>
          <dd className="mt-2 leading-7 whitespace-pre-wrap text-slate-800">
            {card.notes}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function OuterReviewCard({ card, mode }: OuterReviewCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  if (mode === "simultaneous") {
    return (
      <article className="min-h-[26rem] rounded-[2rem] border border-cyan-200 bg-white p-7 shadow-xl shadow-cyan-950/10 sm:p-10">
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 uppercase">
          Front and answer
        </p>
        <h2 className="mt-5 border-b border-slate-200 pb-7 text-center text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          {card.term}
        </h2>
        <div className="mt-8">
          <AnswerFields card={card} />
        </div>
      </article>
    );
  }

  const toggleCard = () => setIsFlipped((current) => !current);

  return (
    <div>
      <button
        type="button"
        onClick={toggleCard}
        aria-label={
          isFlipped
            ? "Flashcard back. Click to show front."
            : "Flashcard front. Click to reveal answer."
        }
        className="block min-h-[26rem] w-full rounded-[2rem] border border-cyan-200 bg-white p-7 text-left shadow-xl shadow-cyan-950/10 transition hover:-translate-y-0.5 hover:shadow-2xl focus:ring-4 focus:ring-cyan-300 focus:outline-none sm:p-10"
      >
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 uppercase">
          {isFlipped ? "Back · Answer" : "Front · Prompt"}
        </p>
        {isFlipped ? (
          <div className="mt-8">
            <AnswerFields card={card} />
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <h2 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-7xl">
              {card.term}
            </h2>
            <p className="mt-8 text-sm font-medium text-slate-500">
              Click the card to reveal
            </p>
          </div>
        )}
      </button>
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={toggleCard}
          className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800 focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:outline-none"
        >
          {isFlipped ? "Show front" : "Show answer"}
        </button>
      </div>
    </div>
  );
}
