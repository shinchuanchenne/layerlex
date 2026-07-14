import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useReviewKeyboardShortcuts } from "./useReviewKeyboardShortcuts";

interface HarnessProps {
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  canFlip?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFlip: () => void;
}

function Harness({
  canGoPrevious = true,
  canGoNext = true,
  canFlip = true,
  onPrevious,
  onNext,
  onFlip,
}: HarnessProps) {
  useReviewKeyboardShortcuts({
    canGoPrevious,
    canGoNext,
    canFlip,
    onPrevious,
    onNext,
    onFlip,
  });

  return (
    <div>
      <input aria-label="Input" />
      <textarea aria-label="Textarea" />
      <select aria-label="Select">
        <option>One</option>
      </select>
      <div aria-label="Editable" contentEditable />
      <div aria-label="Textbox role" role="textbox" />
      <button type="button">Button</button>
      <a href="/cards">Link</a>
      <div aria-label="Switch" role="switch" tabIndex={0} />
    </div>
  );
}

function dispatchKey(
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function setup(overrides: Partial<HarnessProps> = {}) {
  const callbacks = {
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onFlip: vi.fn(),
  };
  const props = { ...callbacks, ...overrides };
  const view = render(<Harness {...props} />);
  return { ...view, ...callbacks, props };
}

describe("useReviewKeyboardShortcuts", () => {
  it("handles available arrow and Space shortcuts and prevents their defaults", () => {
    const { onPrevious, onNext, onFlip } = setup();

    const previousEvent = dispatchKey(document, "ArrowLeft");
    const nextEvent = dispatchKey(document, "ArrowRight");
    const flipEvent = dispatchKey(document, " ");
    const legacyFlipEvent = dispatchKey(document, "Spacebar");

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onFlip).toHaveBeenCalledTimes(2);
    expect(previousEvent.defaultPrevented).toBe(true);
    expect(nextEvent.defaultPrevented).toBe(true);
    expect(flipEvent.defaultPrevented).toBe(true);
    expect(legacyFlipEvent.defaultPrevented).toBe(true);
  });

  it("ignores unavailable boundary and display actions without preventing defaults", () => {
    const { onPrevious, onNext, onFlip } = setup({
      canGoPrevious: false,
      canGoNext: false,
      canFlip: false,
    });

    const previousEvent = dispatchKey(document, "ArrowLeft");
    const nextEvent = dispatchKey(document, "ArrowRight");
    const flipEvent = dispatchKey(document, " ");

    expect(onPrevious).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onFlip).not.toHaveBeenCalled();
    expect(previousEvent.defaultPrevented).toBe(false);
    expect(nextEvent.defaultPrevented).toBe(false);
    expect(flipEvent.defaultPrevented).toBe(false);
  });

  it.each(["Input", "Textarea", "Select", "Editable", "Textbox role"])(
    "ignores shortcuts from the editable target %s",
    (label) => {
      const { getByLabelText, onPrevious, onNext, onFlip } = setup();
      const target = getByLabelText(label);

      const previousEvent = dispatchKey(target, "ArrowLeft");
      const nextEvent = dispatchKey(target, "ArrowRight");
      const flipEvent = dispatchKey(target, " ");

      expect(onPrevious).not.toHaveBeenCalled();
      expect(onNext).not.toHaveBeenCalled();
      expect(onFlip).not.toHaveBeenCalled();
      expect(previousEvent.defaultPrevented).toBe(false);
      expect(nextEvent.defaultPrevented).toBe(false);
      expect(flipEvent.defaultPrevented).toBe(false);
    },
  );

  it.each(["Button", "Link", "Switch"])(
    "preserves native Space handling on the interactive target %s",
    (name) => {
      const { getByRole, onFlip } = setup();
      const role = name.toLowerCase();
      const target = getByRole(role, name === "Switch" ? undefined : { name });

      const event = dispatchKey(target, " ");

      expect(onFlip).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it("allows arrows on ordinary buttons while keeping editable guards", () => {
    const { getByRole, onNext } = setup();

    const event = dispatchKey(
      getByRole("button", { name: "Button" }),
      "ArrowRight",
    );

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
  ])("ignores modifier combinations", (modifier) => {
    const { onNext } = setup();

    const event = dispatchKey(document, "ArrowRight", modifier);

    expect(onNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores an event that was already prevented", () => {
    const { onNext } = setup();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();

    document.dispatchEvent(event);

    expect(onNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("uses current callbacks after rerenders without duplicate effective handlers", () => {
    const firstNext = vi.fn();
    const secondNext = vi.fn();
    const { rerender } = setup({ onNext: firstNext });

    rerender(
      <Harness onPrevious={vi.fn()} onNext={secondNext} onFlip={vi.fn()} />,
    );
    rerender(
      <Harness onPrevious={vi.fn()} onNext={secondNext} onFlip={vi.fn()} />,
    );
    dispatchKey(document, "ArrowRight");

    expect(firstNext).not.toHaveBeenCalled();
    expect(secondNext).toHaveBeenCalledTimes(1);
  });

  it("removes its listener on unmount", () => {
    const { unmount, onNext } = setup();
    unmount();

    const event = dispatchKey(document, "ArrowRight");

    expect(onNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
