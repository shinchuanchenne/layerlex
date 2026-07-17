import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { DeckDirectory } from "../components/DeckDirectory";
import { DeckForm } from "../components/DeckForm";
import { InnerCardsManager } from "../components/InnerCardsManager";
import { OuterCardDetail } from "../components/OuterCardDetail";
import { OuterCardDirectory } from "../components/OuterCardDirectory";
import { OuterCardForm } from "../components/OuterCardForm";
import { ApiError, getApiErrorMessage } from "../lib/api";
import {
  createDeck,
  deckKeys,
  deleteDeck,
  listAllDecks,
  listDecks,
  retrieveDeck,
  updateDeck,
  type Deck,
  type DeckCreateInput,
  type DeckListResponse,
  type DeckUpdateInput,
} from "../lib/decks";
import { innerCardKeys, type InnerCard } from "../lib/innerCards";
import { innerReviewKeys } from "../lib/innerReviewKeys";
import {
  createOuterCard,
  deleteOuterCard,
  listOuterCards,
  outerCardKeys,
  retrieveOuterCard,
  updateOuterCard,
  type OuterCard,
  type OuterCardCreateInput,
  type OuterCardListResponse,
  type OuterCardUpdateInput,
} from "../lib/outerCards";
import { outerReviewKeys } from "../lib/outerReviewKeys";
import { useDebouncedValue } from "../lib/useDebouncedValue";

const DECK_PAGE_SIZE = 10;
const CARD_PAGE_SIZE = 10;

function updateLoadedDeckLists(
  queryClient: ReturnType<typeof useQueryClient>,
  updatedDeck: Deck,
) {
  queryClient.setQueriesData<DeckListResponse>(
    { queryKey: deckKeys.lists() },
    (current) =>
      current
        ? {
            ...current,
            items: current.items.map((deck) =>
              deck.id === updatedDeck.id ? updatedDeck : deck,
            ),
          }
        : current,
  );
  queryClient.setQueryData<Deck[]>(deckKeys.completeList(), (current) =>
    current?.map((deck) => (deck.id === updatedDeck.id ? updatedDeck : deck)),
  );
}

function removeDeckFromLoadedLists(
  queryClient: ReturnType<typeof useQueryClient>,
  deletedDeckId: string,
) {
  queryClient.setQueriesData<DeckListResponse>(
    { queryKey: deckKeys.lists() },
    (current) => {
      if (!current) return current;
      const items = current.items.filter((deck) => deck.id !== deletedDeckId);
      return {
        ...current,
        items,
        total:
          items.length === current.items.length
            ? current.total
            : Math.max(0, current.total - 1),
      };
    },
  );
  queryClient.setQueryData<Deck[]>(deckKeys.completeList(), (current) =>
    current?.filter((deck) => deck.id !== deletedDeckId),
  );
}

export function OuterCardsPage() {
  const { deckId, outerCardId, innerCardId } = useParams<{
    deckId: string;
    outerCardId: string;
    innerCardId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deckOffset, setDeckOffset] = useState(0);
  const [deckFormMode, setDeckFormMode] = useState<"create" | "edit" | null>(
    null,
  );

  const deckListParams = useMemo(
    () => ({ offset: deckOffset, limit: DECK_PAGE_SIZE }),
    [deckOffset],
  );
  const deckListQuery = useQuery({
    queryKey: deckKeys.list(deckListParams),
    queryFn: () => listDecks(deckListParams),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const deckDetailQuery = useQuery({
    queryKey: deckKeys.detail(deckId ?? ""),
    queryFn: () => retrieveDeck(deckId ?? ""),
    enabled: Boolean(deckId),
    retry: false,
  });
  const completeDeckListQuery = useQuery({
    queryKey: deckKeys.completeList(),
    queryFn: listAllDecks,
    enabled: Boolean(deckId),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (payload: DeckCreateInput) => createDeck(payload),
    onSuccess: (createdDeck) => {
      queryClient.setQueryData(deckKeys.detail(createdDeck.id), createdDeck);
      void queryClient.invalidateQueries({ queryKey: deckKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: deckKeys.completeList(),
      });
      setDeckFormMode(null);
      navigate("/decks/" + createdDeck.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      selectedDeckId,
      payload,
    }: {
      selectedDeckId: string;
      payload: DeckUpdateInput;
    }) => updateDeck(selectedDeckId, payload),
    onSuccess: (updatedDeck) => {
      queryClient.setQueryData(deckKeys.detail(updatedDeck.id), updatedDeck);
      updateLoadedDeckLists(queryClient, updatedDeck);
      void queryClient.invalidateQueries({ queryKey: deckKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: deckKeys.completeList(),
      });
      setDeckFormMode(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (selectedDeckId: string) => deleteDeck(selectedDeckId),
    onSuccess: (_, deletedDeckId) => {
      queryClient.removeQueries({ queryKey: deckKeys.detail(deletedDeckId) });
      removeDeckFromLoadedLists(queryClient, deletedDeckId);
      queryClient.removeQueries({
        queryKey: outerCardKeys.deckLists(deletedDeckId),
      });
      queryClient.removeQueries({
        queryKey: outerReviewKeys.deck(deletedDeckId),
      });
      queryClient.removeQueries({
        queryKey: innerReviewKeys.deck(deletedDeckId),
      });
      void queryClient.invalidateQueries({ queryKey: deckKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: deckKeys.completeList(),
      });
      setDeckFormMode(null);
      navigate("/decks");
    },
  });

  function handleDeckSubmit(payload: DeckCreateInput | DeckUpdateInput) {
    if (deckFormMode === "create") {
      createMutation.mutate(payload as DeckCreateInput);
      return;
    }
    if (deckId) {
      updateMutation.mutate({
        selectedDeckId: deckId,
        payload: payload as DeckUpdateInput,
      });
    }
  }

  function handleDeckDelete() {
    const deck = deckDetailQuery.data;
    if (!deck || deleteMutation.isPending) return;
    const confirmed = window.confirm(
      `Delete deck "${deck.name}"? Only empty decks can be deleted. Cards are never deleted automatically.`,
    );
    if (confirmed) deleteMutation.mutate(deck.id);
  }

  const deckListError = deckListQuery.isError
    ? getApiErrorMessage(deckListQuery.error)
    : undefined;
  const deckDetailError = deckDetailQuery.isError
    ? getApiErrorMessage(deckDetailQuery.error)
    : undefined;
  const deckNotFound =
    deckDetailQuery.error instanceof ApiError &&
    deckDetailQuery.error.status === 404;
  const deleteError =
    deleteMutation.error instanceof ApiError &&
    deleteMutation.error.status === 409
      ? "This deck still contains outer cards. Move or delete every card before deleting the deck."
      : deleteMutation.isError
        ? getApiErrorMessage(deleteMutation.error)
        : undefined;
  const activeDeckMutation =
    deckFormMode === "create" ? createMutation : updateMutation;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 xl:grid xl:grid-cols-[20rem_minmax(0,1fr)]">
      <DeckDirectory
        decks={deckListQuery.data?.items ?? []}
        selectedDeckId={deckId}
        isLoading={deckListQuery.isPending}
        errorMessage={deckListError}
        total={deckListQuery.data?.total ?? 0}
        offset={deckOffset}
        onSelect={() => {
          setDeckFormMode(null);
          deleteMutation.reset();
        }}
        onAdd={() => {
          createMutation.reset();
          setDeckFormMode("create");
        }}
        onRetry={() => void deckListQuery.refetch()}
        onPreviousPage={() =>
          setDeckOffset((current) => Math.max(0, current - DECK_PAGE_SIZE))
        }
        onNextPage={() => setDeckOffset((current) => current + DECK_PAGE_SIZE)}
      />

      <section
        aria-label="Deck management workspace"
        className="flex min-h-[42rem] min-w-0 p-4 sm:p-7 xl:min-h-screen"
      >
        {deckFormMode ? (
          <DeckForm
            key={
              deckFormMode === "create"
                ? "create-deck"
                : "edit-deck-" + (deckDetailQuery.data?.id ?? "")
            }
            mode={deckFormMode}
            deck={deckFormMode === "edit" ? deckDetailQuery.data : undefined}
            isPending={activeDeckMutation.isPending}
            serverError={
              activeDeckMutation.isError
                ? getApiErrorMessage(activeDeckMutation.error)
                : undefined
            }
            onCancel={() => setDeckFormMode(null)}
            onSubmit={handleDeckSubmit}
          />
        ) : !deckId ? (
          <section className="m-auto max-w-md text-center">
            <p className="text-sm font-bold tracking-[0.18em] text-cyan-700 uppercase">
              Deck management
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Select or create a deck
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Each outer card belongs to one deck. Inner cards follow their
              outer card automatically.
            </p>
          </section>
        ) : deckDetailQuery.isPending ? (
          <p role="status" className="m-auto text-slate-500">
            Loading selected deck…
          </p>
        ) : deckDetailError ? (
          <section
            role="alert"
            className="m-auto max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"
          >
            <h2 className="text-2xl font-semibold">
              {deckNotFound ? "Deck not found" : "Unable to load deck"}
            </h2>
            <p className="mt-3 text-slate-600">{deckDetailError}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {!deckNotFound ? (
                <button
                  type="button"
                  onClick={() => void deckDetailQuery.refetch()}
                  className="rounded-full bg-slate-950 px-5 py-2.5 font-semibold text-white"
                >
                  Retry deck details
                </button>
              ) : null}
              <Link
                to="/decks"
                className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-slate-700"
              >
                Return to deck directory
              </Link>
            </div>
          </section>
        ) : deckDetailQuery.data ? (
          <DeckOuterCardsWorkspace
            key={deckDetailQuery.data.id}
            deck={deckDetailQuery.data}
            availableDecks={completeDeckListQuery.data ?? []}
            decksLoading={completeDeckListQuery.isPending}
            decksError={
              completeDeckListQuery.isError
                ? getApiErrorMessage(completeDeckListQuery.error)
                : undefined
            }
            onRetryDecks={() => void completeDeckListQuery.refetch()}
            outerCardId={outerCardId}
            innerCardId={innerCardId}
            deckDeleteError={deleteError}
            isDeletingDeck={deleteMutation.isPending}
            onEditDeck={() => {
              updateMutation.reset();
              setDeckFormMode("edit");
            }}
            onDeleteDeck={handleDeckDelete}
          />
        ) : null}
      </section>
    </main>
  );
}

interface DeckOuterCardsWorkspaceProps {
  deck: Deck;
  availableDecks: Deck[];
  decksLoading: boolean;
  decksError?: string;
  onRetryDecks: () => void;
  outerCardId?: string;
  innerCardId?: string;
  deckDeleteError?: string;
  isDeletingDeck: boolean;
  onEditDeck: () => void;
  onDeleteDeck: () => void;
}

function DeckOuterCardsWorkspace({
  deck,
  availableDecks,
  decksLoading,
  decksError,
  onRetryDecks,
  outerCardId,
  innerCardId,
  deckDeleteError,
  isDeletingDeck,
  onEditDeck,
  onDeleteDeck,
}: DeckOuterCardsWorkspaceProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300).trim();
  const [offset, setOffset] = useState(0);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);

  const listParams = useMemo(
    () => ({
      search: debouncedSearch,
      offset,
      limit: CARD_PAGE_SIZE,
      deck_id: deck.id,
    }),
    [debouncedSearch, deck.id, offset],
  );
  const listQuery = useQuery({
    queryKey: outerCardKeys.list(listParams),
    queryFn: () => listOuterCards(listParams),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: outerCardKeys.detail(outerCardId ?? ""),
    queryFn: () => retrieveOuterCard(outerCardId ?? ""),
    enabled: Boolean(outerCardId),
    retry: false,
  });

  const deckMismatch =
    detailQuery.data !== undefined && detailQuery.data.deck_id !== deck.id;

  function updateLoadedOuterLists(
    updatedCard: OuterCard,
    sourceDeckId: string,
  ) {
    const moved = updatedCard.deck_id !== sourceDeckId;
    const queries = queryClient
      .getQueryCache()
      .findAll({ queryKey: outerCardKeys.lists() });

    for (const query of queries) {
      const current = query.state.data as OuterCardListResponse | undefined;
      if (!current) continue;
      const scope = query.queryKey[2];
      if (moved && scope === sourceDeckId) {
        const items = current.items.filter(
          (card) => card.id !== updatedCard.id,
        );
        queryClient.setQueryData(query.queryKey, {
          ...current,
          items,
          total:
            items.length === current.items.length
              ? current.total
              : Math.max(0, current.total - 1),
        });
      } else if (scope === "all" || scope === updatedCard.deck_id || !moved) {
        queryClient.setQueryData(query.queryKey, {
          ...current,
          items: current.items.map((card) =>
            card.id === updatedCard.id ? updatedCard : card,
          ),
        });
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: OuterCardCreateInput) => createOuterCard(payload),
    onSuccess: (createdCard) => {
      queryClient.setQueryData(
        outerCardKeys.detail(createdCard.id),
        createdCard,
      );
      void queryClient.invalidateQueries({
        queryKey: outerCardKeys.deckLists(deck.id),
      });
      void queryClient.invalidateQueries({
        queryKey: outerCardKeys.globalLists(),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.orderedDeck(),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.deckOrderedDeck(deck.id),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.deckOrderedDeck(deck.id),
      });
      setFormMode(null);
      navigate(`/decks/${deck.id}/cards/${createdCard.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      cardId,
      sourceDeckId,
      payload,
    }: {
      cardId: string;
      sourceDeckId: string;
      payload: OuterCardUpdateInput;
    }) =>
      updateOuterCard(cardId, payload).then((card) => ({
        card,
        sourceDeckId,
      })),
    onSuccess: ({ card: updatedCard, sourceDeckId }) => {
      queryClient.setQueryData(
        outerCardKeys.detail(updatedCard.id),
        updatedCard,
      );
      updateLoadedOuterLists(updatedCard, sourceDeckId);
      void queryClient.invalidateQueries({
        queryKey: outerCardKeys.deckLists(sourceDeckId),
      });
      void queryClient.invalidateQueries({
        queryKey: outerCardKeys.deckLists(updatedCard.deck_id),
      });
      void queryClient.invalidateQueries({
        queryKey: outerCardKeys.globalLists(),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.orderedDeck(),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.deckOrderedDeck(sourceDeckId),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.deckOrderedDeck(updatedCard.deck_id),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.deckOrderedDeck(sourceDeckId),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.deckOrderedDeck(updatedCard.deck_id),
      });
      setFormMode(null);
      if (updatedCard.deck_id !== sourceDeckId) {
        const innerRoute = innerCardId ? `/inner/${innerCardId}` : "";
        navigate(
          `/decks/${updatedCard.deck_id}/cards/${updatedCard.id}${innerRoute}`,
        );
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (cardId: string) => deleteOuterCard(cardId),
    onSuccess: (_, deletedCardId) => {
      queryClient.removeQueries({
        queryKey: outerCardKeys.detail(deletedCardId),
      });
      queryClient.setQueriesData<OuterCardListResponse>(
        { queryKey: outerCardKeys.deckLists(deck.id) },
        (current) => {
          if (!current) return current;
          const items = current.items.filter(
            (card) => card.id !== deletedCardId,
          );
          return {
            ...current,
            items,
            total:
              items.length === current.items.length
                ? current.total
                : Math.max(0, current.total - 1),
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: outerCardKeys.deckLists(deck.id),
      });
      void queryClient.invalidateQueries({
        queryKey: outerCardKeys.globalLists(),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.orderedDeck(),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.deckOrderedDeck(deck.id),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.deckOrderedDeck(deck.id),
      });
      queryClient.removeQueries({
        queryKey: innerCardKeys.parentLists(deletedCardId),
      });
      queryClient.removeQueries({
        queryKey: innerCardKeys.details(),
        predicate: (query) =>
          (query.state.data as InnerCard | undefined)?.outer_card_id ===
          deletedCardId,
      });
      queryClient.removeQueries({
        queryKey: outerReviewKeys.innerContent(deletedCardId),
      });
      queryClient.removeQueries({
        queryKey: innerReviewKeys.orderedDeck(),
      });
      navigate("/decks/" + deck.id);
    },
  });

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setOffset(0);
  }

  function handleFormSubmit(
    payload: OuterCardCreateInput | OuterCardUpdateInput,
  ) {
    if (formMode === "create") {
      createMutation.mutate(payload as OuterCardCreateInput);
    } else if (outerCardId && detailQuery.data && !deckMismatch) {
      updateMutation.mutate({
        cardId: outerCardId,
        sourceDeckId: detailQuery.data.deck_id,
        payload: payload as OuterCardUpdateInput,
      });
    }
  }

  function handleDelete() {
    const card = detailQuery.data;
    if (!card || deckMismatch || deleteMutation.isPending) return;
    const confirmed = window.confirm(
      `Delete "${card.term}"? This also permanently deletes all of its inner cards. This action cannot be undone.`,
    );
    if (confirmed) deleteMutation.mutate(card.id);
  }

  const listError = listQuery.isError
    ? getApiErrorMessage(listQuery.error)
    : undefined;
  const detailError = detailQuery.isError
    ? getApiErrorMessage(detailQuery.error)
    : undefined;
  const detailNotFound =
    detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
  const activeMutation =
    formMode === "create" ? createMutation : updateMutation;

  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-5 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.18em] text-cyan-700 uppercase">
            Selected deck
          </p>
          <h2 className="mt-2 text-3xl font-semibold break-words">
            {deck.name}
          </h2>
          {deck.description ? (
            <p className="mt-2 max-w-3xl leading-6 break-words text-slate-600">
              {deck.description}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              No deck description provided.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Deck order {deck.sort_order}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={"/review/decks/" + deck.id + "/outer"}
            className="rounded-full bg-cyan-800 px-4 py-2 font-semibold text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 focus:outline-none"
          >
            Review outer cards
          </Link>
          <Link
            to={"/review/decks/" + deck.id + "/inner"}
            className="rounded-full bg-violet-800 px-4 py-2 font-semibold text-white hover:bg-violet-700 focus:ring-2 focus:ring-violet-600 focus:ring-offset-2 focus:outline-none"
          >
            Review inner cards
          </Link>
          <button
            type="button"
            onClick={onEditDeck}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus:ring-2 focus:ring-cyan-600 focus:outline-none"
          >
            Edit deck
          </button>
          <button
            type="button"
            onClick={onDeleteDeck}
            disabled={isDeletingDeck}
            className="rounded-full bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-600 focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {isDeletingDeck ? "Deleting deck…" : "Delete deck"}
          </button>
        </div>
      </header>

      {deckDeleteError ? (
        <p
          role="alert"
          className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {deckDeleteError}
        </p>
      ) : null}

      <div className="min-w-0 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        <OuterCardDirectory
          deckId={deck.id}
          deckName={deck.name}
          cards={listQuery.data?.items ?? []}
          selectedCardId={outerCardId}
          searchInput={searchInput}
          appliedSearch={debouncedSearch}
          isLoading={listQuery.isPending}
          errorMessage={listError}
          total={listQuery.data?.total ?? 0}
          offset={offset}
          onSearchChange={handleSearchChange}
          onSelect={() => setFormMode(null)}
          onAdd={() => {
            createMutation.reset();
            setFormMode("create");
          }}
          onRetry={() => void listQuery.refetch()}
          onPreviousPage={() =>
            setOffset((current) => Math.max(0, current - CARD_PAGE_SIZE))
          }
          onNextPage={() => setOffset((current) => current + CARD_PAGE_SIZE)}
        />

        <section
          aria-label="Outer card workspace"
          className="flex min-h-[38rem] min-w-0 bg-slate-100 p-5 sm:p-8"
        >
          {formMode ? (
            <OuterCardForm
              key={
                formMode === "create"
                  ? "create-" + deck.id
                  : "edit-" + (detailQuery.data?.id ?? "")
              }
              mode={formMode}
              card={formMode === "edit" ? detailQuery.data : undefined}
              decks={availableDecks.length > 0 ? availableDecks : [deck]}
              selectedDeckId={deck.id}
              decksLoading={decksLoading}
              decksError={decksError}
              onRetryDecks={onRetryDecks}
              isPending={activeMutation.isPending}
              serverError={
                activeMutation.isError
                  ? getApiErrorMessage(activeMutation.error)
                  : undefined
              }
              onCancel={() => setFormMode(null)}
              onSubmit={handleFormSubmit}
            />
          ) : deckMismatch ? (
            <section
              role="alert"
              className="m-auto max-w-lg rounded-3xl border border-amber-300 bg-white p-8 text-center shadow-sm"
            >
              <h2 className="text-2xl font-semibold">
                Card belongs to another deck
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                This route does not match the card&apos;s current deck, so it
                has not been displayed here.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to={"/decks/" + deck.id}
                  className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-slate-700"
                >
                  Return to selected deck
                </Link>
                {detailQuery.data ? (
                  <Link
                    to={
                      "/decks/" +
                      detailQuery.data.deck_id +
                      "/cards/" +
                      detailQuery.data.id
                    }
                    className="rounded-full bg-slate-950 px-5 py-2.5 font-semibold text-white"
                  >
                    Open card in its deck
                  </Link>
                ) : null}
              </div>
            </section>
          ) : (
            <OuterCardDetail
              card={detailQuery.data}
              isLoading={Boolean(outerCardId) && detailQuery.isPending}
              errorMessage={detailError}
              isNotFound={detailNotFound}
              deleteError={
                deleteMutation.isError
                  ? getApiErrorMessage(deleteMutation.error)
                  : undefined
              }
              isDeleting={deleteMutation.isPending}
              onRetry={() => void detailQuery.refetch()}
              onEdit={() => {
                updateMutation.reset();
                setFormMode("edit");
              }}
              onDelete={handleDelete}
            >
              {outerCardId && detailQuery.data ? (
                <InnerCardsManager
                  key={outerCardId}
                  deckId={deck.id}
                  outerCardId={outerCardId}
                  selectedInnerCardId={innerCardId}
                />
              ) : null}
            </OuterCardDetail>
          )}
        </section>
      </div>
    </div>
  );
}
