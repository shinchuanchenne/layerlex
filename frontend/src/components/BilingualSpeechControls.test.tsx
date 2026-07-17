import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BILINGUAL_SPEECH_PAUSE_MS } from "../lib/bilingualSpeech";
import { installFakeSpeechSynthesis } from "../test/fakeSpeechSynthesis";
import { BilingualSpeechControls } from "./BilingualSpeechControls";

let restoreSpeech: (() => void) | undefined;

afterEach(() => {
  restoreSpeech?.();
  restoreSpeech = undefined;
  vi.useRealTimers();
});

describe("BilingualSpeechControls", () => {
  it("shows accessible ready, playing, pause, Japanese, completed, and stopped states", async () => {
    vi.useFakeTimers();
    const installed = installFakeSpeechSynthesis();
    restoreSpeech = installed.restore;
    render(
      <BilingualSpeechControls
        chineseText="經驗"
        japaneseText="経験"
        itemLabel="経験"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Ready to play");
    const playButton = screen.getByRole("button", {
      name: "Play Chinese then Japanese for 経験",
    });
    fireEvent.click(playButton);
    expect(screen.getByRole("status")).toHaveTextContent("Speaking Chinese");

    act(() => installed.synthesis.finishCurrent());
    expect(screen.getByRole("status")).toHaveTextContent("Preparing Japanese");
    await act(() => vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS));
    expect(screen.getByRole("status")).toHaveTextContent("Speaking Japanese");

    act(() => installed.synthesis.finishCurrent());
    expect(screen.getByRole("status")).toHaveTextContent("Playback complete");

    fireEvent.click(playButton);
    fireEvent.click(
      screen.getByRole("button", { name: "Stop audio for 経験" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Playback stopped");
  });

  it("restarts active playback and surfaces normalized errors", async () => {
    const installed = installFakeSpeechSynthesis();
    restoreSpeech = installed.restore;
    render(
      <BilingualSpeechControls
        chineseText="經驗"
        japaneseText="経験"
        itemLabel="経験"
      />,
    );
    const playButton = screen.getByRole("button", {
      name: "Play Chinese then Japanese for 経験",
    });

    fireEvent.click(playButton);
    expect(playButton).toHaveTextContent("Restart playback");
    fireEvent.click(playButton);
    expect(installed.synthesis.cancel).toHaveBeenCalledTimes(1);

    act(() => installed.synthesis.failCurrent("voice-unavailable"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chinese speech playback failed",
    );
  });

  it("keeps the review control usable when browser speech is unsupported", () => {
    render(
      <BilingualSpeechControls
        chineseText="經驗"
        japaneseText="経験"
        itemLabel="経験"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Play Chinese then Japanese for 経験",
      }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Speech playback is unavailable in this browser",
    );
  });
});
