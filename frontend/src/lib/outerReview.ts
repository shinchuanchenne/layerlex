import { listInnerCards, type InnerCard } from "./innerCards";
import { listOuterCards, type OuterCard } from "./outerCards";

export const OUTER_REVIEW_PAGE_SIZE = 200;
export const OUTER_REVIEW_INNER_PAGE_SIZE = 200;

export const outerReviewKeys = {
  all: ["outer-review"] as const,
  orderedDeck: () => [...outerReviewKeys.all, "ordered-deck"] as const,
  innerContent: (outerCardId: string) =>
    [...outerReviewKeys.all, "inner-content", outerCardId] as const,
};

export async function fetchCompleteOuterReviewDeck(): Promise<OuterCard[]> {
  const deck: OuterCard[] = [];
  let offset = 0;

  while (true) {
    const page = await listOuterCards({
      search: "",
      offset,
      limit: OUTER_REVIEW_PAGE_SIZE,
    });
    deck.push(...page.items);

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
