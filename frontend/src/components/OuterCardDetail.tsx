import type { OuterCard } from "../lib/outerCards";

interface OuterCardDetailProps {
  card?: OuterCard;
  isLoading: boolean;
  errorMessage?: string;
  isNotFound: boolean;
  deleteError?: string;
  isDeleting: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function displayValue(value: string | number | null): string {
  return value === null || value === "" ? "Not provided" : String(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function OuterCardDetail({
  card,
  isLoading,
  errorMessage,
  isNotFound,
  deleteError,
  isDeleting,
  onRetry,
  onEdit,
  onDelete,
}: OuterCardDetailProps) {
  if (isLoading) {
    return (
      <div role="status" className="m-auto text-slate-500">
        Loading selected card…
      </div>
    );
  }

  if (errorMessage) {
    return (
      <section
        role="alert"
        className="m-auto max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"
      >
        <h2 className="text-2xl font-semibold text-slate-950">
          {isNotFound ? "Card not found" : "Unable to load card"}
        </h2>
        <p className="mt-3 text-slate-600">{errorMessage}</p>
        {!isNotFound ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 rounded-full bg-slate-950 px-5 py-2.5 font-semibold text-white"
          >
            Retry card details
          </button>
        ) : null}
      </section>
    );
  }

  if (!card) {
    return (
      <section className="m-auto max-w-md px-6 text-center">
        <p className="text-sm font-bold tracking-[0.18em] text-cyan-700 uppercase">
          Outer cards
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">
          Select a vocabulary word
        </h2>
        <p className="mt-4 leading-7 text-slate-600">
          Choose a card from the directory, or add a new card to start building
          your vocabulary collection.
        </p>
      </section>
    );
  }

  const details = [
    ["Reading", displayValue(card.reading)],
    ["Part of speech", displayValue(card.part_of_speech)],
    ["Meaning", card.meaning],
    ["JLPT level", displayValue(card.jlpt_level)],
    ["Notes", displayValue(card.notes)],
    ["Sort order", card.sort_order],
  ] as const;

  return (
    <article className="m-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <header className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] text-cyan-700 uppercase">
            Outer flashcard
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            {card.term}
          </h2>
          {card.reading ? (
            <p className="mt-3 text-lg text-slate-500">{card.reading}</p>
          ) : null}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 focus:ring-2 focus:ring-cyan-600 focus:outline-none"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-full bg-rose-700 px-5 py-2.5 font-semibold text-white hover:bg-rose-600 focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 focus:outline-none disabled:cursor-wait disabled:opacity-60"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      {deleteError ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {deleteError}
        </p>
      ) : null}

      <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className={label === "Notes" ? "sm:col-span-2" : ""}>
            <dt className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              {label}
            </dt>
            <dd className="mt-2 text-base leading-7 whitespace-pre-wrap text-slate-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="mt-10 grid gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-700">Created</dt>
          <dd className="mt-1">
            <time dateTime={card.created_at}>
              {formatDate(card.created_at)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Last updated</dt>
          <dd className="mt-1">
            <time dateTime={card.updated_at}>
              {formatDate(card.updated_at)}
            </time>
          </dd>
        </div>
      </dl>
    </article>
  );
}
