import { useMemo, useState, type FormEvent } from "react";

import type {
  OuterCard,
  OuterCardCreateInput,
  OuterCardUpdateInput,
} from "../lib/outerCards";

interface OuterCardFormProps {
  mode: "create" | "edit";
  card?: OuterCard;
  isPending: boolean;
  serverError?: string;
  onCancel: () => void;
  onSubmit: (payload: OuterCardCreateInput | OuterCardUpdateInput) => void;
}

interface FormState {
  term: string;
  reading: string;
  partOfSpeech: string;
  meaning: string;
  jlptLevel: string;
  notes: string;
  sortOrder: string;
}

function createInitialState(card?: OuterCard): FormState {
  return {
    term: card?.term ?? "",
    reading: card?.reading ?? "",
    partOfSpeech: card?.part_of_speech ?? "",
    meaning: card?.meaning ?? "",
    jlptLevel: card?.jlpt_level ?? "",
    notes: card?.notes ?? "",
    sortOrder: String(card?.sort_order ?? 0),
  };
}

function optionalValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function normaliseState(state: FormState): OuterCardCreateInput {
  return {
    term: state.term.trim(),
    reading: optionalValue(state.reading),
    part_of_speech: optionalValue(state.partOfSpeech),
    meaning: state.meaning.trim(),
    jlpt_level: optionalValue(state.jlptLevel),
    notes: optionalValue(state.notes),
    sort_order: Number(state.sortOrder),
  };
}

function hasCardChanges(
  payload: OuterCardCreateInput,
  card: OuterCard,
): boolean {
  return (
    payload.term !== card.term ||
    payload.reading !== card.reading ||
    payload.part_of_speech !== card.part_of_speech ||
    payload.meaning !== card.meaning ||
    payload.jlpt_level !== card.jlpt_level ||
    payload.notes !== card.notes ||
    payload.sort_order !== card.sort_order
  );
}

function changedFields(
  payload: OuterCardCreateInput,
  card: OuterCard,
): OuterCardUpdateInput {
  const updates: OuterCardUpdateInput = {};
  if (payload.term !== card.term) updates.term = payload.term;
  if (payload.reading !== card.reading) updates.reading = payload.reading;
  if (payload.part_of_speech !== card.part_of_speech) {
    updates.part_of_speech = payload.part_of_speech;
  }
  if (payload.meaning !== card.meaning) updates.meaning = payload.meaning;
  if (payload.jlpt_level !== card.jlpt_level) {
    updates.jlpt_level = payload.jlpt_level;
  }
  if (payload.notes !== card.notes) updates.notes = payload.notes;
  if (payload.sort_order !== card.sort_order) {
    updates.sort_order = payload.sort_order;
  }
  return updates;
}

export function OuterCardForm({
  mode,
  card,
  isPending,
  serverError,
  onCancel,
  onSubmit,
}: OuterCardFormProps) {
  const [state, setState] = useState<FormState>(() => createInitialState(card));
  const [clientError, setClientError] = useState<string>();
  const normalised = useMemo(() => normaliseState(state), [state]);
  const isNoOp =
    mode === "edit" && card ? !hasCardChanges(normalised, card) : false;

  function setField(field: keyof FormState, value: string) {
    setState((current) => ({ ...current, [field]: value }));
    setClientError(undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalised.term || !normalised.meaning) {
      setClientError("Term and meaning are required.");
      return;
    }
    if (!Number.isInteger(normalised.sort_order)) {
      setClientError("Sort order must be a whole number.");
      return;
    }
    if (mode === "edit" && card) {
      const updates = changedFields(normalised, card);
      if (Object.keys(updates).length === 0) return;
      onSubmit(updates);
      return;
    }
    onSubmit(normalised);
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

  return (
    <section className="m-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-bold tracking-[0.2em] text-cyan-700 uppercase">
        {mode === "create" ? "New outer card" : "Update outer card"}
      </p>
      <h2 className="mt-3 text-3xl font-semibold text-slate-950">
        {mode === "create"
          ? "Add vocabulary"
          : "Edit " + (card?.term ?? "card")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Required fields are marked below. Optional blank values are saved as
        empty.
      </p>

      <form className="mt-8 grid gap-6 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block text-sm font-semibold text-slate-700">
          Term <span className="text-rose-700">(required)</span>
          <input
            name="term"
            value={state.term}
            onChange={(event) => setField("term", event.target.value)}
            className={inputClass}
            autoFocus
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Reading
          <input
            name="reading"
            value={state.reading}
            onChange={(event) => setField("reading", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Part of speech
          <input
            name="part_of_speech"
            value={state.partOfSpeech}
            onChange={(event) => setField("partOfSpeech", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          JLPT level
          <input
            name="jlpt_level"
            value={state.jlptLevel}
            onChange={(event) => setField("jlptLevel", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
          Meaning <span className="text-rose-700">(required)</span>
          <textarea
            name="meaning"
            value={state.meaning}
            onChange={(event) => setField("meaning", event.target.value)}
            rows={3}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
          Notes
          <textarea
            name="notes"
            value={state.notes}
            onChange={(event) => setField("notes", event.target.value)}
            rows={4}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Sort order
          <input
            name="sort_order"
            type="number"
            step="1"
            value={state.sortOrder}
            onChange={(event) => setField("sortOrder", event.target.value)}
            className={inputClass}
          />
        </label>

        {clientError || serverError ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:col-span-2"
          >
            {clientError ?? serverError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6 sm:col-span-2">
          <button
            type="submit"
            disabled={isPending || isNoOp}
            className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800 focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Saving…"
              : mode === "create"
                ? "Create card"
                : isNoOp
                  ? "No changes to save"
                  : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
