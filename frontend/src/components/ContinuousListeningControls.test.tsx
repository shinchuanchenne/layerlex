import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContinuousListeningControls } from "./ContinuousListeningControls";

const item = {
  id: "one",
  label: "経験",
  chineseText: "經驗",
  japaneseText: "経験",
};

function renderControls(
  phase:
    | "idle"
    | "playing-chinese"
    | "between-languages"
    | "playing-japanese"
    | "between-cards"
    | "paused"
    | "completed"
    | "stopped"
    | "error"
    | "unsupported" = "idle",
) {
  const actions = {
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    onRetry: vi.fn(),
  };
  render(
    <ContinuousListeningControls
      phase={phase}
      item={item}
      currentPosition={3}
      total={20}
      canStart={phase !== "unsupported"}
      errorMessage={
        phase === "error" ? "Japanese speech playback failed." : undefined
      }
      {...actions}
    />,
  );
  return actions;
}

describe("ContinuousListeningControls", () => {
  it("exposes labelled progress and appropriate start, pause, resume, and stop actions", () => {
    const startActions = renderControls();
    expect(
      screen.getByLabelText("Continuous listening progress"),
    ).toHaveTextContent("Listening 3 / 20 · 経験");
    fireEvent.click(
      screen.getByRole("button", { name: "Start continuous listening" }),
    );
    expect(startActions.onStart).toHaveBeenCalled();
  });

  it("shows phase status, paused resume semantics, and 44px touch controls", () => {
    const actions = renderControls("paused");
    expect(
      screen.getByText(
        "Continuous listening paused. Resume restarts this card in Chinese.",
      ),
    ).toHaveTextContent("Resume restarts this card in Chinese");
    const resume = screen.getByRole("button", {
      name: "Resume continuous listening",
    });
    expect(resume).toHaveClass("min-h-11");
    fireEvent.click(resume);
    fireEvent.click(
      screen.getByRole("button", { name: "Stop continuous listening" }),
    );
    expect(actions.onResume).toHaveBeenCalled();
    expect(actions.onStop).toHaveBeenCalled();
  });

  it("surfaces errors with Retry and keeps unsupported start disabled", () => {
    const errorActions = renderControls("error");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Japanese speech playback failed",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry current card" }));
    expect(errorActions.onRetry).toHaveBeenCalled();

    renderControls("unsupported");
    expect(
      screen.getByRole("button", { name: "Start continuous listening" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Speech playback is unavailable in this browser."),
    ).toBeInTheDocument();
  });
});
