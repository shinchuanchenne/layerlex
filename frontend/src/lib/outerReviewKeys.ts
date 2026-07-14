export const outerReviewKeys = {
  all: ["outer-review"] as const,
  orderedDeck: () => [...outerReviewKeys.all, "ordered-deck"] as const,
  innerContent: (outerCardId: string) =>
    [...outerReviewKeys.all, "inner-content", outerCardId] as const,
};
