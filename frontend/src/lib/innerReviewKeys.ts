export const innerReviewKeys = {
  all: ["inner-review"] as const,
  orderedDeck: () => [...innerReviewKeys.all, "ordered-deck"] as const,
};
