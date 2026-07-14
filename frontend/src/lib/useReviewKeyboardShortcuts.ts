import { useEffect, useRef } from "react";

interface ReviewKeyboardShortcutOptions {
  canGoPrevious: boolean;
  canGoNext: boolean;
  canFlip: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFlip: () => void;
}

const EDITABLE_SELECTOR =
  'input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"]';
const SPACE_INTERACTIVE_SELECTOR =
  'button, a[href], input, textarea, select, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"]';

function isInsideContentEditable(target: Element) {
  const editableAncestor = target.closest("[contenteditable]");
  return (
    editableAncestor !== null &&
    editableAncestor.getAttribute("contenteditable") !== "false"
  );
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    (target.closest(EDITABLE_SELECTOR) !== null ||
      isInsideContentEditable(target))
  );
}

function isInteractiveSpaceTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    (target.closest(SPACE_INTERACTIVE_SELECTOR) !== null ||
      isInsideContentEditable(target))
  );
}

export function useReviewKeyboardShortcuts(
  options: ReviewKeyboardShortcutOptions,
) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const current = optionsRef.current;

      if (event.key === "ArrowLeft" && current.canGoPrevious) {
        event.preventDefault();
        current.onPrevious();
        return;
      }

      if (event.key === "ArrowRight" && current.canGoNext) {
        event.preventDefault();
        current.onNext();
        return;
      }

      if (
        (event.key === " " || event.key === "Spacebar") &&
        current.canFlip &&
        !isInteractiveSpaceTarget(event.target)
      ) {
        event.preventDefault();
        current.onFlip();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
