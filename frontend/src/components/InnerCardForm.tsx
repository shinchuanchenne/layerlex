import { useMemo, useState, type FormEvent } from "react";

import type {
  InnerCard,
  InnerCardCreateInput,
  InnerCardUpdateInput,
} from "../lib/innerCards";

interface InnerCardFormProps {
  mode: "create" | "edit";
  card?: InnerCard;
  isPending: boolean;
  serverError?: string;
  onCancel: () => void;
  onSubmit: (payload: InnerCardCreateInput | InnerCardUpdateInput) => void;
}

interface FormState {
  expression: string;
  reading: string;
  meaning: string;
  usageNote: string;
  notes: string;
  sortOrder: string;
}

function initialState(card?: InnerCard): FormState {
  return {
    expression: card?.expression ?? "",
    reading: card?.reading ?? "",
    meaning: card?.meaning ?? "",
    usageNote: card?.usage_note ?? "",
    notes: card?.notes ?? "",
    sortOrder: String(card?.sort_order ?? 0),
  };
}

function optionalValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function normaliseState(state: FormState): InnerCardCreateInput {
  return {
    expression: state.expression.trim(),
    reading: optionalValue(state.reading),
    meaning: state.meaning.trim(),
    usage_note: optionalValue(state.usageNote),
    notes: optionalValue(state.notes),
    sort_order: Number(state.sortOrder),
  };
}

function changedFields(
  payload: InnerCardCreateInput,
  card: InnerCard,
): InnerCardUpdateInput {
  const updates: InnerCardUpdateInput = {};
  if (payload.expression !== card.expression) {
    updates.expression = payload.expression;
  }
  if (payload.reading !== card.reading) updates.reading = payload.reading;
  if (payload.meaning !== card.meaning) updates.meaning = payload.meaning;
  if (payload.usage_note !== card.usage_note) {
    updates.usage_note = payload.usage_note;
  }
  if (payload.notes !== card.notes) updates.notes = payload.notes;
  if (payload.sort_order !== card.sort_order) {
    updates.sort_order = payload.sort_order;
  }
  return updates;
}

export function InnerCardForm({
  mode,
  card,
  isPending,
  serverError,
  onCancel,
  onSubmit,
}: InnerCardFormProps) {
  const [state, setState] = useState<FormState>(() => initialState(card));
  const [clientError, setClientError] = useState<string>();
  const normalised = useMemo(() => normaliseState(state), [state]);
  const updates =
    mode === "edit" && card ? changedFields(normalised, card) : undefined;
  const isNoOp = updates ? Object.keys(updates).length === 0 : false;

  function setField(field: keyof FormState, value: string) {
    setState((current) => ({ ...current, [field]: value }));
    setClientError(undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalised.expression || !normalised.meaning) {
      setClientError("Expression and meaning are required.");
      return;
    }
    if (!Number.isInteger(normalised.sort_order)) {
      setClientError("Sort order must be a whole number.");
      return;
    }
    if (mode === "edit" && updates) {
      if (Object.keys(updates).length === 0) return;
      onSubmit(updates);
      return;
    }
    onSubmit(normalised);
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <p className="text-xs font-bold tracking-[0.18em] text-cyan-700 uppercase">
        {mode === "create" ? "New inner card" : "Update inner card"}
      </p>
      <h3 className="mt-2 text-2xl font-semibold text-slate-950">
        {mode === "create"
          ? "Add usage content"
          : "Edit " + (card?.expression ?? "inner card")}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        The parent outer card comes from the current URL and cannot be changed.
      </p>

      <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
          Expression <span className="text-rose-700">(required)</span>
          <textarea
            name="expression"
            rows={2}
            value={state.expression}
            onChange={(event) => setField("expression", event.target.value)}
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
        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
          Meaning <span className="text-rose-700">(required)</span>
          <textarea
            name="meaning"
            rows={3}
            value={state.meaning}
            onChange={(event) => setField("meaning", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
          Usage note
          <textarea
            name="usage_note"
            rows={3}
            value={state.usageNote}
            onChange={(event) => setField("usageNote", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={3}
            value={state.notes}
            onChange={(event) => setField("notes", event.target.value)}
            className={inputClass}
          />
        </label>

        {clientError || serverError ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2"
          >
            {clientError ?? serverError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5 sm:col-span-2">
          <button
            type="submit"
            disabled={isPending || isNoOp}
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Saving inner card…"
              : mode === "create"
                ? "Create inner card"
                : isNoOp
                  ? "No inner changes to save"
                  : "Save inner changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel inner form
          </button>
        </div>
      </form>
    </section>
  );
}
