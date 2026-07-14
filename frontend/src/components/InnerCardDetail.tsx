import type { InnerCard } from "../lib/innerCards";

interface InnerCardDetailProps {
  card?: InnerCard;
  isLoading: boolean;
  errorMessage?: string;
  isNotFound: boolean;
  parentMismatch: boolean;
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

export function InnerCardDetail({
  card,
  isLoading,
  errorMessage,
  isNotFound,
  parentMismatch,
  deleteError,
  isDeleting,
  onRetry,
  onEdit,
  onDelete,
}: InnerCardDetailProps) {
  if (isLoading) {
    return (
      <div role="status" className="m-auto py-16 text-slate-500">
        Loading selected inner card…
      </div>
    );
  }

  if (parentMismatch) {
    return (
      <section
        role="alert"
        className="m-auto rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center"
      >
        <h3 className="text-xl font-semibold text-slate-950">
          Inner card belongs to another outer card
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This inner card cannot be displayed under the outer card in the URL.
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section
        role="alert"
        className="m-auto rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"
      >
        <h3 className="text-xl font-semibold text-slate-950">
          {isNotFound ? "Inner card not found" : "Unable to load inner card"}
        </h3>
        <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
        {!isNotFound ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Retry inner card details
          </button>
        ) : null}
      </section>
    );
  }

  if (!card) {
    return (
      <section className="m-auto max-w-sm py-14 text-center">
        <p className="text-sm font-bold tracking-wider text-cyan-700 uppercase">
          Usage layer
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-950">
          Select an inner card
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Choose a phrase or example from the directory, or add a new one.
        </p>
      </section>
    );
  }

  const details = [
    ["Reading", displayValue(card.reading)],
    ["Meaning", card.meaning],
    ["Usage note", displayValue(card.usage_note)],
    ["Notes", displayValue(card.notes)],
    ["Sort order", card.sort_order],
  ] as const;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-cyan-700 uppercase">
            Inner flashcard
          </p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {card.expression}
          </h3>
          {card.reading ? (
            <p className="mt-2 text-slate-500">{card.reading}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Edit inner card
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:cursor-wait disabled:opacity-60"
          >
            {isDeleting ? "Deleting inner card…" : "Delete inner card"}
          </button>
        </div>
      </header>

      {deleteError ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {deleteError}
        </p>
      ) : null}

      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div
            key={label}
            className={
              label === "Usage note" || label === "Notes" ? "sm:col-span-2" : ""
            }
          >
            <dt className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              {label}
            </dt>
            <dd className="mt-1.5 text-sm leading-6 whitespace-pre-wrap text-slate-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="mt-7 grid gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:grid-cols-2">
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
