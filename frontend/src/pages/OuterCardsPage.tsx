import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { OuterCardDetail } from "../components/OuterCardDetail";
import { OuterCardDirectory } from "../components/OuterCardDirectory";
import { OuterCardForm } from "../components/OuterCardForm";
import { InnerCardsManager } from "../components/InnerCardsManager";
import { ApiError, getApiErrorMessage } from "../lib/api";
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
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { outerReviewKeys } from "../lib/outerReviewKeys";

const PAGE_SIZE = 10;

export function OuterCardsPage() {
  const { outerCardId, innerCardId } = useParams<{
    outerCardId: string;
    innerCardId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300).trim();
  const [offset, setOffset] = useState(0);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);

  const listParams = useMemo(
    () => ({ search: debouncedSearch, offset, limit: PAGE_SIZE }),
    [debouncedSearch, offset],
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

  function updateLists(updatedCard: OuterCard) {
    queryClient.setQueriesData<OuterCardListResponse>(
      { queryKey: outerCardKeys.lists() },
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
    mutationFn: (payload: OuterCardCreateInput) => createOuterCard(payload),
    onSuccess: (createdCard) => {
      queryClient.setQueryData(
        outerCardKeys.detail(createdCard.id),
        createdCard,
      );
      void queryClient.invalidateQueries({ queryKey: outerCardKeys.lists() });
      setFormMode(null);
      navigate("/cards/" + createdCard.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      cardId,
      payload,
    }: {
      cardId: string;
      payload: OuterCardUpdateInput;
    }) => updateOuterCard(cardId, payload),
    onSuccess: (updatedCard) => {
      queryClient.setQueryData(
        outerCardKeys.detail(updatedCard.id),
        updatedCard,
      );
      updateLists(updatedCard);
      void queryClient.invalidateQueries({ queryKey: outerCardKeys.lists() });
      setFormMode(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (cardId: string) => deleteOuterCard(cardId),
    onSuccess: (_, deletedCardId) => {
      queryClient.removeQueries({
        queryKey: outerCardKeys.detail(deletedCardId),
      });
      queryClient.setQueriesData<OuterCardListResponse>(
        { queryKey: outerCardKeys.lists() },
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
      void queryClient.invalidateQueries({ queryKey: outerCardKeys.lists() });
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
      navigate("/cards");
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
    } else if (outerCardId) {
      updateMutation.mutate({
        cardId: outerCardId,
        payload: payload as OuterCardUpdateInput,
      });
    }
  }

  function handleDelete() {
    const card = detailQuery.data;
    if (!card || deleteMutation.isPending) return;
    const confirmed = window.confirm(
      'Delete "' +
        card.term +
        '"? This also permanently deletes all of its inner cards. This action cannot be undone.',
    );
    if (confirmed) {
      deleteMutation.mutate(card.id);
    }
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
    <main className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[24rem_minmax(0,1fr)]">
      <OuterCardDirectory
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
          setOffset((current) => Math.max(0, current - PAGE_SIZE))
        }
        onNextPage={() => setOffset((current) => current + PAGE_SIZE)}
      />

      <section
        aria-label="Outer card workspace"
        className="flex min-h-[38rem] p-5 sm:p-8 lg:min-h-screen lg:p-12"
      >
        {formMode ? (
          <OuterCardForm
            key={
              formMode === "create"
                ? "create"
                : "edit-" + (detailQuery.data?.id ?? "")
            }
            mode={formMode}
            card={formMode === "edit" ? detailQuery.data : undefined}
            isPending={activeMutation.isPending}
            serverError={
              activeMutation.isError
                ? getApiErrorMessage(activeMutation.error)
                : undefined
            }
            onCancel={() => setFormMode(null)}
            onSubmit={handleFormSubmit}
          />
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
                outerCardId={outerCardId}
                selectedInnerCardId={innerCardId}
              />
            ) : null}
          </OuterCardDetail>
        )}
      </section>
    </main>
  );
}
