import { requestApi } from "./api";

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DeckCreateInput {
  name: string;
  description: string | null;
  sort_order: number;
}

export type DeckUpdateInput = Partial<DeckCreateInput>;

export interface DeckListParams {
  offset: number;
  limit: number;
}

export interface DeckListResponse {
  items: Deck[];
  total: number;
  offset: number;
  limit: number;
}

export const deckKeys = {
  all: ["decks"] as const,
  lists: () => [...deckKeys.all, "list"] as const,
  list: (params: DeckListParams) => [...deckKeys.lists(), params] as const,
  completeList: () => [...deckKeys.all, "complete-list"] as const,
  details: () => [...deckKeys.all, "detail"] as const,
  detail: (deckId: string) => [...deckKeys.details(), deckId] as const,
};

export function listDecks(params: DeckListParams): Promise<DeckListResponse> {
  const searchParams = new URLSearchParams({
    offset: String(params.offset),
    limit: String(params.limit),
  });
  return requestApi<DeckListResponse>(
    "/api/v1/decks?" + searchParams.toString(),
  );
}

export async function listAllDecks(): Promise<Deck[]> {
  const decks: Deck[] = [];
  let offset = 0;

  while (true) {
    const page = await listDecks({ offset, limit: 200 });
    decks.push(...page.items);
    if (decks.length >= page.total) return decks;
    if (page.items.length === 0) {
      throw new Error(
        "The deck API stopped before the complete deck list was loaded.",
      );
    }
    offset += page.items.length;
  }
}

export function retrieveDeck(deckId: string): Promise<Deck> {
  return requestApi<Deck>("/api/v1/decks/" + deckId);
}

export function createDeck(payload: DeckCreateInput): Promise<Deck> {
  return requestApi<Deck>("/api/v1/decks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDeck(
  deckId: string,
  payload: DeckUpdateInput,
): Promise<Deck> {
  return requestApi<Deck>("/api/v1/decks/" + deckId, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteDeck(deckId: string): Promise<void> {
  return requestApi<void>("/api/v1/decks/" + deckId, {
    method: "DELETE",
  });
}
