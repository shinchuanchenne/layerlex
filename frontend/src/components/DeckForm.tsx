import { useMemo, useState, type FormEvent } from "react";

import type { Deck, DeckCreateInput, DeckUpdateInput } from "../lib/decks";

interface DeckFormProps {
  mode: "create" | "edit";
  deck?: Deck;
  isPending: boolean;
  serverError?: string;
  onCancel: () => void;
  onSubmit: (payload: DeckCreateInput | DeckUpdateInput) => void;
}

interface FormState {
  name: string;
  description: string;
  sortOrder: string;
}

function initialState(deck?: Deck): FormState {
  return {
    name: deck?.name ?? "",
    description: deck?.description ?? "",
    sortOrder: String(deck?.sort_order ?? 0),
  };
}

function normalise(state: FormState): DeckCreateInput {
  return {
    name: state.name.trim(),
    description: state.description.trim() || null,
    sort_order: Number(state.sortOrder),
  };
}

function changedFields(payload: DeckCreateInput, deck: Deck): DeckUpdateInput {
  const updates: DeckUpdateInput = {};
  if (payload.name !== deck.name) updates.name = payload.name;
  if (payload.description !== deck.description) {
    updates.description = payload.description;
  }
  if (payload.sort_order !== deck.sort_order) {
    updates.sort_order = payload.sort_order;
  }
  return updates;
}

export function DeckForm({
  mode,
  deck,
  isPending,
  serverError,
  onCancel,
  onSubmit,
}: DeckFormProps) {
  const [state, setState] = useState<FormState>(() => initialState(deck));
  const [clientError, setClientError] = useState<string>();
  const payload = useMemo(() => normalise(state), [state]);
  const updates = deck ? changedFields(payload, deck) : undefined;
  const isNoOp =
    mode === "edit" && updates !== undefined
      ? Object.keys(updates).length === 0
      : false;

  function setField(field: keyof FormState, value: string) {
    setState((current) => ({ ...current, [field]: value }));
    setClientError(undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload.name) {
      setClientError("Deck name is required.");
      return;
    }
    if (!Number.isInteger(payload.sort_order)) {
      setClientError("Sort order must be a whole number.");
      return;
    }
    if (mode === "edit" && updates) {
      if (Object.keys(updates).length > 0) onSubmit(updates);
      return;
    }
    onSubmit(payload);
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

  return (
    <section className="m-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-bold tracking-[0.2em] text-cyan-700 uppercase">
        {mode === "create" ? "New deck" : "Update deck"}
      </p>
      <h2 className="mt-3 text-3xl font-semibold text-slate-950">
        {mode === "create" ? "Create a vocabulary deck" : `Edit ${deck?.name}`}
      </h2>
      <p className="mt-3 leading-7 text-slate-600">
        Use decks for lessons, topics, or any collection you want to manage
        together.
      </p>

      <form className="mt-8 grid gap-6" onSubmit={handleSubmit}>
        <label className="block text-sm font-semibold text-slate-700">
          Deck name <span className="text-rose-700">(required)</span>
          <input
            name="name"
            value={state.name}
            onChange={(event) => setField("name", event.target.value)}
            className={inputClass}
            autoFocus
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Description
          <textarea
            name="description"
            value={state.description}
            onChange={(event) => setField("description", event.target.value)}
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
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            {clientError ?? serverError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
          <button
            type="submit"
            disabled={isPending || isNoOp}
            className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800 focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Saving…"
              : mode === "create"
                ? "Create deck"
                : isNoOp
                  ? "No changes to save"
                  : "Save deck changes"}
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
