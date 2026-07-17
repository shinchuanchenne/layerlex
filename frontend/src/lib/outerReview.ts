import { listInnerCards, type InnerCard } from "./innerCards";
import { listOuterCards, type OuterCard } from "./outerCards";

export { outerReviewKeys } from "./outerReviewKeys";

export const OUTER_REVIEW_PAGE_SIZE = 200;
export const OUTER_REVIEW_INNER_PAGE_SIZE = 200;

export async function fetchCompleteOuterReviewDeck(
  deckId?: string,
): Promise<OuterCard[]> {
  const deck: OuterCard[] = [];
  const seenIds = new Set<string>();
  let offset = 0;

  while (true) {
    const page = await listOuterCards({
      search: "",
      offset,
      limit: OUTER_REVIEW_PAGE_SIZE,
      deck_id: deckId,
    });
    for (const card of page.items) {
      if (deckId && card.deck_id !== deckId) {
        throw new Error(
          "The outer-card API returned a card from another deck while loading deck-scoped review.",
        );
      }
      if (seenIds.has(card.id)) {
        throw new Error(
          "The outer-card API returned a duplicate card while loading the review deck.",
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
        "The outer-card API stopped before the complete review deck was loaded.",
      );
    }
    offset += page.items.length;
  }
}

export async function fetchCompleteOuterReviewInnerContent(
  outerCardId: string,
): Promise<InnerCard[]> {
  const innerCards: InnerCard[] = [];
  let offset = 0;

  while (true) {
    const page = await listInnerCards(outerCardId, {
      search: "",
      offset,
      limit: OUTER_REVIEW_INNER_PAGE_SIZE,
    });
    innerCards.push(...page.items);

    if (innerCards.length >= page.total) {
      return innerCards;
    }
    if (page.items.length === 0) {
      throw new Error(
        "The inner-card API stopped before the complete inner content was loaded.",
      );
    }
    offset += page.items.length;
  }
}
