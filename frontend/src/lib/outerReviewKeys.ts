export const outerReviewKeys = {
  all: ["outer-review"] as const,
  orderedDeck: () => [...outerReviewKeys.all, "ordered-deck"] as const,
  deck: (deckId: string) => [...outerReviewKeys.all, "deck", deckId] as const,
  deckOrderedDeck: (deckId: string) =>
    [...outerReviewKeys.deck(deckId), "ordered-deck"] as const,
  innerContent: (outerCardId: string) =>
    [...outerReviewKeys.all, "inner-content", outerCardId] as const,
};
