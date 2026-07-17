export const innerReviewKeys = {
  all: ["inner-review"] as const,
  orderedDeck: () => [...innerReviewKeys.all, "ordered-deck"] as const,
  deck: (deckId: string) => [...innerReviewKeys.all, "deck", deckId] as const,
  deckOrderedDeck: (deckId: string) =>
    [...innerReviewKeys.deck(deckId), "ordered-deck"] as const,
};
