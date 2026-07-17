import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BILINGUAL_SPEECH_PAUSE_MS,
  createBilingualSpeechController,
  type SpeechPlaybackState,
} from "./bilingualSpeech";
import {
  CONTINUOUS_LISTENING_INTER_CARD_PAUSE_MS,
  type ListeningItem,
  useContinuousListening,
} from "./useContinuousListening";
import { installFakeSpeechSynthesis } from "../test/fakeSpeechSynthesis";

const items: ListeningItem[] = [
  {
    id: "one",
    label: "経験",
    chineseText: "經驗",
    japaneseText: "経験",
  },
  {
    id: "two",
    label: "予定",
    chineseText: "預定",
    japaneseText: "予定",
  },
  {
    id: "three",
    label: "確認",
    chineseText: "確認",
    japaneseText: "確認",
  },
];

let restoreSpeech: (() => void) | undefined;

afterEach(() => {
  restoreSpeech?.();
  restoreSpeech = undefined;
  vi.useRealTimers();
});

function installSpeech() {
  const installed = installFakeSpeechSynthesis();
  restoreSpeech = installed.restore;
  return installed.synthesis;
}

async function finishCurrentBilingualSequence(
  synthesis: ReturnType<typeof installSpeech>,
) {
  act(() => synthesis.finishCurrent());
  await act(() => vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS));
  act(() => synthesis.finishCurrent());
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useContinuousListening sequencing", () => {
  it("starts from the routed index, navigates after the named pause, and finishes without wrapping", async () => {
    vi.useFakeTimers();
    const synthesis = installSpeech();
    const navigateToIndex = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentIndex }) =>
        useContinuousListening({
          items,
          currentIndex,
          roundIdentity: "global:ordered",
          navigateToIndex,
        }),
      { initialProps: { currentIndex: 1 } },
    );

    act(() => result.current.start());
    expect(synthesis.spokenUtterances[0].text).toBe("預定");
    expect(result.current.state.phase).toBe("playing-chinese");

    await finishCurrentBilingualSequence(synthesis);
    expect(result.current.state.phase).toBe("between-cards");
    await act(() =>
      vi.advanceTimersByTimeAsync(CONTINUOUS_LISTENING_INTER_CARD_PAUSE_MS),
    );
    expect(navigateToIndex).toHaveBeenCalledWith(2);

    rerender({ currentIndex: 2 });
    expect(synthesis.spokenUtterances.at(-1)?.text).toBe("確認");
    await finishCurrentBilingualSequence(synthesis);

    expect(result.current.state.phase).toBe("completed");
    expect(result.current.state.activeIndex).toBe(2);
    expect(navigateToIndex).toHaveBeenCalledTimes(1);
  });

  it("plays a one-card queue once and keeps an empty queue idle", async () => {
    vi.useFakeTimers();
    const synthesis = installSpeech();
    const navigateToIndex = vi.fn();
    const oneCard = renderHook(() =>
      useContinuousListening({
        items: items.slice(0, 1),
        currentIndex: 0,
        roundIdentity: "one",
        navigateToIndex,
      }),
    );

    act(() => oneCard.result.current.start());
    await finishCurrentBilingualSequence(synthesis);
    expect(oneCard.result.current.state.phase).toBe("completed");
    expect(navigateToIndex).not.toHaveBeenCalled();
    oneCard.unmount();

    const empty = renderHook(() =>
      useContinuousListening({
        items: [],
        currentIndex: -1,
        roundIdentity: "empty",
        navigateToIndex,
      }),
    );
    expect(empty.result.current.canStart).toBe(false);
    act(() => empty.result.current.start());
    expect(synthesis.spokenUtterances).toHaveLength(2);
  });

  it("does not duplicate speech while an orchestrator-owned route update settles", async () => {
    vi.useFakeTimers();
    const synthesis = installSpeech();
    const navigateToIndex = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentIndex }) =>
        useContinuousListening({
          items,
          currentIndex,
          roundIdentity: "shuffle-42",
          navigateToIndex,
        }),
      { initialProps: { currentIndex: 0 } },
    );

    act(() => result.current.start());
    await finishCurrentBilingualSequence(synthesis);
    await act(() =>
      vi.advanceTimersByTimeAsync(CONTINUOUS_LISTENING_INTER_CARD_PAUSE_MS),
    );
    rerender({ currentIndex: 1 });
    rerender({ currentIndex: 1 });

    expect(
      synthesis.spokenUtterances.filter(
        (utterance) => utterance.text === "預定",
      ),
    ).toHaveLength(1);
  });
});

describe("useContinuousListening pause, stop, and errors", () => {
  it.each([
    ["Chinese speech", "chinese"],
    ["the language pause", "language-pause"],
    ["Japanese speech", "japanese"],
    ["the inter-card pause", "inter-card"],
  ])(
    "pauses during %s and resumes the same card from Chinese",
    async (_, phase) => {
      vi.useFakeTimers();
      const synthesis = installSpeech();
      const navigateToIndex = vi.fn();
      const { result } = renderHook(() =>
        useContinuousListening({
          items,
          currentIndex: 0,
          roundIdentity: "global:ordered",
          navigateToIndex,
        }),
      );

      act(() => result.current.start());
      if (phase !== "chinese") {
        act(() => synthesis.finishCurrent());
      }
      if (phase === "japanese" || phase === "inter-card") {
        await act(() => vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS));
      }
      if (phase === "inter-card") {
        act(() => synthesis.finishCurrent());
        await act(async () => {
          await Promise.resolve();
        });
      }

      act(() => result.current.pause());
      expect(result.current.state.phase).toBe("paused");
      await act(() =>
        vi.advanceTimersByTimeAsync(
          BILINGUAL_SPEECH_PAUSE_MS + CONTINUOUS_LISTENING_INTER_CARD_PAUSE_MS,
        ),
      );
      expect(navigateToIndex).not.toHaveBeenCalled();

      act(() => result.current.resume());
      expect(synthesis.spokenUtterances.at(-1)?.text).toBe("經驗");
      expect(result.current.state.activeIndex).toBe(0);
    },
  );

  it("stops timers and speech, and an unexpected route or round change also stops the session", async () => {
    vi.useFakeTimers();
    const synthesis = installSpeech();
    const navigateToIndex = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentIndex, roundIdentity }) =>
        useContinuousListening({
          items,
          currentIndex,
          roundIdentity,
          navigateToIndex,
        }),
      {
        initialProps: {
          currentIndex: 0,
          roundIdentity: "global:ordered",
        },
      },
    );

    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current.state.phase).toBe("stopped");
    expect(synthesis.cancel).toHaveBeenCalled();

    act(() => result.current.start());
    rerender({ currentIndex: 1, roundIdentity: "global:ordered" });
    expect(result.current.state.phase).toBe("stopped");

    act(() => result.current.start());
    rerender({ currentIndex: 1, roundIdentity: "global:shuffle-10" });
    expect(result.current.state.phase).toBe("stopped");
  });

  it("stops safely when the active source card disappears", () => {
    const synthesis = installSpeech();
    const { result, rerender } = renderHook(
      ({ activeItems, currentIndex }) =>
        useContinuousListening({
          items: activeItems,
          currentIndex,
          roundIdentity: "global:ordered",
          navigateToIndex: vi.fn(),
        }),
      { initialProps: { activeItems: items, currentIndex: 1 } },
    );

    act(() => result.current.start());
    rerender({ activeItems: [items[0], items[2]], currentIndex: -1 });

    expect(result.current.state.phase).toBe("stopped");
    expect(synthesis.cancel).toHaveBeenCalled();
  });

  it("stops on a speech error and retries the routed card", () => {
    const synthesis = installSpeech();
    const { result } = renderHook(() =>
      useContinuousListening({
        items,
        currentIndex: 1,
        roundIdentity: "global:ordered",
        navigateToIndex: vi.fn(),
      }),
    );

    act(() => result.current.start());
    act(() => synthesis.failCurrent("voice-unavailable"));
    expect(result.current.state).toMatchObject({
      phase: "error",
      activeIndex: 1,
      errorMessage: "Chinese speech playback failed (voice-unavailable).",
    });

    act(() => result.current.retry());
    expect(synthesis.spokenUtterances.at(-1)?.text).toBe("預定");
  });

  it("cancels active work on unmount and remains safe when speech is unsupported", () => {
    const synthesis = installSpeech();
    const active = renderHook(() =>
      useContinuousListening({
        items,
        currentIndex: 0,
        roundIdentity: "global:ordered",
        navigateToIndex: vi.fn(),
      }),
    );
    act(() => active.result.current.start());
    active.unmount();
    expect(synthesis.cancel).toHaveBeenCalled();

    restoreSpeech?.();
    restoreSpeech = undefined;
    const unsupported = renderHook(() =>
      useContinuousListening({
        items,
        currentIndex: 0,
        roundIdentity: "global:ordered",
        navigateToIndex: vi.fn(),
      }),
    );
    expect(unsupported.result.current.state.phase).toBe("unsupported");
    expect(unsupported.result.current.canStart).toBe(false);
  });
});

describe("single and continuous speech ownership", () => {
  it("starting another LayerLex controller stops continuous listening", async () => {
    const synthesis = installSpeech();
    const { result } = renderHook(() =>
      useContinuousListening({
        items,
        currentIndex: 0,
        roundIdentity: "global:ordered",
        navigateToIndex: vi.fn(),
      }),
    );
    const singleStates: SpeechPlaybackState[] = [];
    const singleController = createBilingualSpeechController({
      onStateChange: (state) => singleStates.push(state),
    });

    act(() => result.current.start());
    await act(async () => {
      void singleController.play({
        chineseText: "單張",
        japaneseText: "一枚",
      });
      await Promise.resolve();
    });

    expect(result.current.state.phase).toBe("stopped");
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(singleStates.at(-1)?.phase).toBe("speaking-chinese");
    singleController.destroy();
  });

  it("retains continuous ownership during the inter-card pause", async () => {
    vi.useFakeTimers();
    const synthesis = installSpeech();
    const { result } = renderHook(() =>
      useContinuousListening({
        items,
        currentIndex: 0,
        roundIdentity: "global:ordered",
        navigateToIndex: vi.fn(),
      }),
    );

    act(() => result.current.start());
    await finishCurrentBilingualSequence(synthesis);
    expect(result.current.state.phase).toBe("between-cards");

    const singleController = createBilingualSpeechController({
      onStateChange: vi.fn(),
    });
    await act(async () => {
      void singleController.play({
        chineseText: "單張",
        japaneseText: "一枚",
      });
      await Promise.resolve();
    });

    expect(result.current.state.phase).toBe("stopped");
    await act(() =>
      vi.advanceTimersByTimeAsync(CONTINUOUS_LISTENING_INTER_CARD_PAUSE_MS),
    );
    expect(synthesis.spokenUtterances.at(-1)?.text).toBe("單張");
    singleController.destroy();
  });

  it("starting continuous listening stops active single-card playback", async () => {
    installSpeech();
    const singleStates: SpeechPlaybackState[] = [];
    const singleController = createBilingualSpeechController({
      onStateChange: (state) => singleStates.push(state),
    });
    void singleController.play({
      chineseText: "單張",
      japaneseText: "一枚",
    });

    const { result } = renderHook(() =>
      useContinuousListening({
        items,
        currentIndex: 0,
        roundIdentity: "global:ordered",
        navigateToIndex: vi.fn(),
      }),
    );
    act(() => result.current.start());
    await act(async () => {
      await Promise.resolve();
    });

    expect(singleStates.at(-1)?.phase).toBe("stopped");
    expect(result.current.state.phase).toBe("playing-chinese");
    singleController.destroy();
  });
});
