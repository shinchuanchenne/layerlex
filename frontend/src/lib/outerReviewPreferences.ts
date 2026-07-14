import { useCallback, useState } from "react";

export const OUTER_REVIEW_AUTO_INNER_CONTENT_KEY =
  "layerlex.outerReview.autoShowInnerContent.v1";

export function readAutoShowInnerContentPreference(): boolean {
  try {
    return (
      window.localStorage.getItem(OUTER_REVIEW_AUTO_INNER_CONTENT_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
}

export function writeAutoShowInnerContentPreference(value: boolean): void {
  try {
    window.localStorage.setItem(
      OUTER_REVIEW_AUTO_INNER_CONTENT_KEY,
      value ? "true" : "false",
    );
  } catch {
    // Browser privacy settings or storage quotas must not break review mode.
  }
}

export function useAutoShowInnerContentPreference() {
  const [isEnabled, setIsEnabled] = useState(
    readAutoShowInnerContentPreference,
  );

  const setPreference = useCallback((value: boolean) => {
    setIsEnabled(value);
    writeAutoShowInnerContentPreference(value);
  }, []);

  return [isEnabled, setPreference] as const;
}
