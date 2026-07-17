import { listAllInnerCards, type InnerCard } from "./innerCards";
import { fetchCompleteOuterReviewDeck } from "./outerReview";
import type { OuterCard } from "./outerCards";

export { innerReviewKeys } from "./innerReviewKeys";

export const INNER_REVIEW_PAGE_SIZE = 200;

export interface DeckScopedInnerReviewSource {
  cards: InnerCard[];
  parents: OuterCard[];
}

export async function fetchCompleteInnerReviewDeck(): Promise<InnerCard[]> {
  const deck: InnerCard[] = [];
  const seenIds = new Set<string>();
  let offset = 0;

  while (true) {
    const page = await listAllInnerCards({
      search: "",
      offset,
      limit: INNER_REVIEW_PAGE_SIZE,
    });

    for (const card of page.items) {
      if (seenIds.has(card.id)) {
        throw new Error(
          "The inner-card API returned a duplicate card while loading the review deck.",
        );
      }
      seenIds.add(card.id);
      deck.push(card);
    }

    if (deck.length >= page.total) {
      return deck;
    }
    if (page.items.length === 0) {
      throw new Error(
        "The inner-card API stopped before the complete review deck was loaded.",
      );
    }
    offset += page.items.length;
  }
}

export async function fetchCompleteDeckScopedInnerReviewDeck(
  deckId: string,
): Promise<DeckScopedInnerReviewSource> {
  const [parents, allInnerCards] = await Promise.all([
    fetchCompleteOuterReviewDeck(deckId),
    fetchCompleteInnerReviewDeck(),
  ]);
  const parentIds = new Set(parents.map((parent) => parent.id));

  return {
    parents,
    cards: allInnerCards.filter((card) => parentIds.has(card.outer_card_id)),
  };
}
