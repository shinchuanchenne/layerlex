import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, getApiErrorMessage } from "../lib/api";
import {
  createInnerCard,
  deleteInnerCard,
  innerCardKeys,
  listInnerCards,
  retrieveInnerCard,
  updateInnerCard,
  type InnerCard,
  type InnerCardCreateInput,
  type InnerCardListResponse,
  type InnerCardUpdateInput,
} from "../lib/innerCards";
import { innerReviewKeys } from "../lib/innerReviewKeys";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { outerReviewKeys } from "../lib/outerReviewKeys";
import { InnerCardDetail } from "./InnerCardDetail";
import { InnerCardDirectory } from "./InnerCardDirectory";
import { InnerCardForm } from "./InnerCardForm";

const INNER_PAGE_SIZE = 10;

interface InnerCardsManagerProps {
  deckId: string;
  outerCardId: string;
  selectedInnerCardId?: string;
}

type InnerFormState =
  { mode: "create" } | { mode: "edit"; innerCardId: string } | null;

export function InnerCardsManager({
  deckId,
  outerCardId,
  selectedInnerCardId,
}: InnerCardsManagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300).trim();
  const [offset, setOffset] = useState(0);
  const [formState, setFormState] = useState<InnerFormState>(null);

  const listParams = useMemo(
    () => ({ search: debouncedSearch, offset, limit: INNER_PAGE_SIZE }),
    [debouncedSearch, offset],
  );
  const listQuery = useQuery({
    queryKey: innerCardKeys.list(outerCardId, listParams),
    queryFn: () => listInnerCards(outerCardId, listParams),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: innerCardKeys.detail(selectedInnerCardId ?? ""),
    queryFn: () => retrieveInnerCard(selectedInnerCardId ?? ""),
    enabled: Boolean(selectedInnerCardId),
    retry: false,
  });

  const visibleCards = (listQuery.data?.items ?? []).filter(
    (card) => card.outer_card_id === outerCardId,
  );
  const parentMismatch =
    detailQuery.data !== undefined &&
    detailQuery.data.outer_card_id !== outerCardId;
  const editingSelectedCard =
    formState?.mode === "edit" &&
    formState.innerCardId === selectedInnerCardId &&
    !parentMismatch;

  function updateLoadedLists(updatedCard: InnerCard) {
    queryClient.setQueriesData<InnerCardListResponse>(
      { queryKey: innerCardKeys.parentLists(outerCardId) },
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((card) =>
                card.id === updatedCard.id ? updatedCard : card,
              ),
            }
          : current,
    );
  }

  const createMutation = useMutation({
    mutationFn: (payload: InnerCardCreateInput) =>
      createInnerCard(outerCardId, payload),
    onSuccess: (createdCard) => {
      queryClient.setQueryData(
        innerCardKeys.detail(createdCard.id),
        createdCard,
      );
      void queryClient.invalidateQueries({
        queryKey: innerCardKeys.parentLists(outerCardId),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.innerContent(outerCardId),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.orderedDeck(),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.deckOrderedDeck(deckId),
      });
      setFormState(null);
      navigate(
        "/decks/" +
          deckId +
          "/cards/" +
          outerCardId +
          "/inner/" +
          createdCard.id,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      innerCardId,
      payload,
    }: {
      innerCardId: string;
      payload: InnerCardUpdateInput;
    }) => updateInnerCard(innerCardId, payload),
    onSuccess: (updatedCard) => {
      queryClient.setQueryData(
        innerCardKeys.detail(updatedCard.id),
        updatedCard,
      );
      updateLoadedLists(updatedCard);
      void queryClient.invalidateQueries({
        queryKey: innerCardKeys.parentLists(outerCardId),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.innerContent(updatedCard.outer_card_id),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.orderedDeck(),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.deckOrderedDeck(deckId),
      });
      setFormState(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (innerCardId: string) => deleteInnerCard(innerCardId),
    onSuccess: (_, deletedInnerCardId) => {
      queryClient.removeQueries({
        queryKey: innerCardKeys.detail(deletedInnerCardId),
      });
      queryClient.setQueriesData<InnerCardListResponse>(
        { queryKey: innerCardKeys.parentLists(outerCardId) },
        (current) => {
          if (!current) return current;
          const items = current.items.filter(
            (card) => card.id !== deletedInnerCardId,
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
        queryKey: innerCardKeys.parentLists(outerCardId),
      });
      void queryClient.invalidateQueries({
        queryKey: outerReviewKeys.innerContent(outerCardId),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.orderedDeck(),
      });
      void queryClient.invalidateQueries({
        queryKey: innerReviewKeys.deckOrderedDeck(deckId),
      });
      setFormState(null);
      navigate("/decks/" + deckId + "/cards/" + outerCardId);
    },
  });

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setOffset(0);
  }

  function handleFormSubmit(
    payload: InnerCardCreateInput | InnerCardUpdateInput,
  ) {
    if (formState?.mode === "create") {
      createMutation.mutate(payload as InnerCardCreateInput);
      return;
    }
    if (editingSelectedCard && selectedInnerCardId) {
      updateMutation.mutate({
        innerCardId: selectedInnerCardId,
        payload: payload as InnerCardUpdateInput,
      });
    }
  }

  function handleDelete() {
    const card = detailQuery.data;
    if (!card || parentMismatch || deleteMutation.isPending) return;
    const confirmed = window.confirm(
      'Delete inner card "' +
        card.expression +
        '"? Its outer card and sibling inner cards will remain. This action cannot be undone.',
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
    formState?.mode === "create" ? createMutation : updateMutation;

  return (
    <section
      aria-labelledby="inner-cards-heading"
      className="mt-10 border-t border-slate-200 pt-8"
    >
      <div className="mb-5">
        <p className="text-xs font-bold tracking-[0.18em] text-cyan-700 uppercase">
          Natural usage
        </p>
        <h2
          id="inner-cards-heading"
          className="mt-1 text-2xl font-semibold text-slate-950"
        >
          Inner-card management
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Manage collocations, phrases, usage patterns, and example sentences
          for this outer card.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(17rem,0.85fr)_minmax(0,1.5fr)]">
        <InnerCardDirectory
          deckId={deckId}
          outerCardId={outerCardId}
          cards={visibleCards}
          selectedInnerCardId={selectedInnerCardId}
          searchInput={searchInput}
          appliedSearch={debouncedSearch}
          isLoading={listQuery.isPending}
          errorMessage={listError}
          total={listQuery.data?.total ?? 0}
          offset={offset}
          onSearchChange={handleSearchChange}
          onSelect={() => setFormState(null)}
          onAdd={() => {
            createMutation.reset();
            setFormState({ mode: "create" });
          }}
          onRetry={() => void listQuery.refetch()}
          onPreviousPage={() =>
            setOffset((current) => Math.max(0, current - INNER_PAGE_SIZE))
          }
          onNextPage={() => setOffset((current) => current + INNER_PAGE_SIZE)}
        />

        {formState?.mode === "create" || editingSelectedCard ? (
          <InnerCardForm
            key={
              formState.mode === "create"
                ? "create-inner-" + outerCardId
                : "edit-inner-" + (selectedInnerCardId ?? "")
            }
            mode={formState.mode}
            card={editingSelectedCard ? detailQuery.data : undefined}
            isPending={activeMutation.isPending}
            serverError={
              activeMutation.isError
                ? getApiErrorMessage(activeMutation.error)
                : undefined
            }
            onCancel={() => setFormState(null)}
            onSubmit={handleFormSubmit}
          />
        ) : (
          <InnerCardDetail
            card={parentMismatch ? undefined : detailQuery.data}
            isLoading={Boolean(selectedInnerCardId) && detailQuery.isPending}
            errorMessage={detailError}
            isNotFound={detailNotFound}
            parentMismatch={parentMismatch}
            deleteError={
              deleteMutation.isError
                ? getApiErrorMessage(deleteMutation.error)
                : undefined
            }
            isDeleting={deleteMutation.isPending}
            onRetry={() => void detailQuery.refetch()}
            onEdit={() => {
              if (!selectedInnerCardId) return;
              updateMutation.reset();
              setFormState({
                mode: "edit",
                innerCardId: selectedInnerCardId,
              });
            }}
            onDelete={handleDelete}
          />
        )}
      </div>
    </section>
  );
}
