import { requestApi } from "./api";

export interface InnerCard {
  id: string;
  outer_card_id: string;
  expression: string;
  reading: string | null;
  meaning: string;
  usage_note: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InnerCardCreateInput {
  expression: string;
  reading: string | null;
  meaning: string;
  usage_note: string | null;
  notes: string | null;
  sort_order: number;
}

export type InnerCardUpdateInput = Partial<InnerCardCreateInput>;

export interface InnerCardListParams {
  search: string;
  offset: number;
  limit: number;
}

export interface InnerCardListResponse {
  items: InnerCard[];
  total: number;
  offset: number;
  limit: number;
}

export const innerCardKeys = {
  all: ["inner-cards"] as const,
  lists: () => [...innerCardKeys.all, "list"] as const,
  parentLists: (outerCardId: string) =>
    [...innerCardKeys.lists(), outerCardId] as const,
  list: (outerCardId: string, params: InnerCardListParams) =>
    [...innerCardKeys.parentLists(outerCardId), params] as const,
  details: () => [...innerCardKeys.all, "detail"] as const,
  detail: (innerCardId: string) =>
    [...innerCardKeys.details(), innerCardId] as const,
};

export function listInnerCards(
  outerCardId: string,
  params: InnerCardListParams,
): Promise<InnerCardListResponse> {
  const searchParams = new URLSearchParams({
    offset: String(params.offset),
    limit: String(params.limit),
  });
  if (params.search) {
    searchParams.set("search", params.search);
  }
  return requestApi<InnerCardListResponse>(
    "/api/v1/outer-cards/" +
      outerCardId +
      "/inner-cards?" +
      searchParams.toString(),
  );
}

export function listAllInnerCards(
  params: InnerCardListParams,
): Promise<InnerCardListResponse> {
  const searchParams = new URLSearchParams({
    offset: String(params.offset),
    limit: String(params.limit),
  });
  if (params.search) {
    searchParams.set("search", params.search);
  }
  return requestApi<InnerCardListResponse>(
    "/api/v1/inner-cards?" + searchParams.toString(),
  );
}

export function retrieveInnerCard(innerCardId: string): Promise<InnerCard> {
  return requestApi<InnerCard>("/api/v1/inner-cards/" + innerCardId);
}

export function createInnerCard(
  outerCardId: string,
  payload: InnerCardCreateInput,
): Promise<InnerCard> {
  return requestApi<InnerCard>(
    "/api/v1/outer-cards/" + outerCardId + "/inner-cards",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateInnerCard(
  innerCardId: string,
  payload: InnerCardUpdateInput,
): Promise<InnerCard> {
  return requestApi<InnerCard>("/api/v1/inner-cards/" + innerCardId, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteInnerCard(innerCardId: string): Promise<void> {
  return requestApi<void>("/api/v1/inner-cards/" + innerCardId, {
    method: "DELETE",
  });
}
