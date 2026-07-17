import { requestApi } from "./api";

export interface OuterCard {
  id: string;
  deck_id: string;
  term: string;
  reading: string | null;
  part_of_speech: string | null;
  meaning: string;
  jlpt_level: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OuterCardCreateInput {
  deck_id: string;
  term: string;
  reading: string | null;
  part_of_speech: string | null;
  meaning: string;
  jlpt_level: string | null;
  notes: string | null;
  sort_order: number;
}

export type OuterCardUpdateInput = Partial<OuterCardCreateInput>;

export interface OuterCardListParams {
  search: string;
  offset: number;
  limit: number;
  deck_id?: string;
}

export interface OuterCardListResponse {
  items: OuterCard[];
  total: number;
  offset: number;
  limit: number;
}

export const outerCardKeys = {
  all: ["outer-cards"] as const,
  lists: () => [...outerCardKeys.all, "list"] as const,
  listScope: (deckId?: string) =>
    [...outerCardKeys.lists(), deckId ?? "all"] as const,
  deckLists: (deckId: string) => outerCardKeys.listScope(deckId),
  globalLists: () => outerCardKeys.listScope(),
  list: (params: OuterCardListParams) =>
    [
      ...outerCardKeys.listScope(params.deck_id),
      {
        search: params.search,
        offset: params.offset,
        limit: params.limit,
      },
    ] as const,
  details: () => [...outerCardKeys.all, "detail"] as const,
  detail: (outerCardId: string) =>
    [...outerCardKeys.details(), outerCardId] as const,
};

export function listOuterCards(
  params: OuterCardListParams,
): Promise<OuterCardListResponse> {
  const searchParams = new URLSearchParams({
    offset: String(params.offset),
    limit: String(params.limit),
  });
  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (params.deck_id) {
    searchParams.set("deck_id", params.deck_id);
  }
  return requestApi<OuterCardListResponse>(
    "/api/v1/outer-cards?" + searchParams.toString(),
  );
}

export function retrieveOuterCard(outerCardId: string): Promise<OuterCard> {
  return requestApi<OuterCard>("/api/v1/outer-cards/" + outerCardId);
}

export function createOuterCard(
  payload: OuterCardCreateInput,
): Promise<OuterCard> {
  return requestApi<OuterCard>("/api/v1/outer-cards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOuterCard(
  outerCardId: string,
  payload: OuterCardUpdateInput,
): Promise<OuterCard> {
  return requestApi<OuterCard>("/api/v1/outer-cards/" + outerCardId, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteOuterCard(outerCardId: string): Promise<void> {
  return requestApi<void>("/api/v1/outer-cards/" + outerCardId, {
    method: "DELETE",
  });
}
