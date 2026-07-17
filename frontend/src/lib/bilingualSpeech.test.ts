import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BILINGUAL_SPEECH_PAUSE_MS,
  CHINESE_SPEECH_LANGUAGE,
  createBilingualSpeechController,
  isBilingualSpeechSupported,
  JAPANESE_SPEECH_LANGUAGE,
  selectPreferredVoice,
  SpeechPlaybackError,
  type SpeechPlaybackState,
} from "./bilingualSpeech";
import {
  createFakeVoice,
  installFakeSpeechSynthesis,
} from "../test/fakeSpeechSynthesis";

afterEach(() => {
  vi.useRealTimers();
});

function createControllerHarness(voices: SpeechSynthesisVoice[] = []) {
  const installed = installFakeSpeechSynthesis(voices);
  const states: SpeechPlaybackState[] = [];
  const controller = createBilingualSpeechController({
    onStateChange: (state) => states.push(state),
  });

  return {
    ...installed,
    controller,
    states,
    destroy() {
      controller.destroy();
      installed.restore();
    },
  };
}

describe("bilingual speech support and voice selection", () => {
  it("detects supported and unsupported browser environments safely", () => {
    const installed = installFakeSpeechSynthesis();
    expect(isBilingualSpeechSupported()).toBe(true);
    installed.restore();
    expect(isBilingualSpeechSupported()).toBe(false);
  });

  it("prefers an exact language match before a language-family fallback", () => {
    const zhCn = createFakeVoice({ name: "Mandarin", lang: "zh-CN" });
    const zhTw = createFakeVoice({ name: "Taiwan", lang: "zh-TW" });
    const ja = createFakeVoice({ name: "Japanese", lang: "ja" });

    expect(selectPreferredVoice([zhCn, zhTw], CHINESE_SPEECH_LANGUAGE)).toBe(
      zhTw,
    );
    expect(selectPreferredVoice([ja], JAPANESE_SPEECH_LANGUAGE)).toBe(ja);
    expect(
      selectPreferredVoice([zhTw], JAPANESE_SPEECH_LANGUAGE),
    ).toBeUndefined();
  });

  it("refreshes asynchronously available voices and removes the listener", async () => {
    vi.useFakeTimers();
    const jaVoice = createFakeVoice({ name: "Japanese", lang: "ja-JP" });
    const harness = createControllerHarness();
    expect(harness.synthesis.addEventListener).toHaveBeenCalledWith(
      "voiceschanged",
      expect.any(Function),
    );

    harness.synthesis.voices = [jaVoice];
    harness.synthesis.emitVoicesChanged();
    const playback = harness.controller.play({
      chineseText: "經驗",
      japaneseText: "経験",
    });
    harness.synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS);

    expect(harness.synthesis.spokenUtterances[1].voice).toBe(jaVoice);
    harness.synthesis.finishCurrent();
    await playback;
    harness.destroy();
    expect(harness.synthesis.removeEventListener).toHaveBeenCalledWith(
      "voiceschanged",
      expect.any(Function),
    );
  });
});

describe("bilingual speech sequencing and cancellation", () => {
  it("speaks Chinese then Japanese after the named pause with conservative settings", async () => {
    vi.useFakeTimers();
    const zhVoice = createFakeVoice({ name: "Taiwan", lang: "zh-TW" });
    const jaVoice = createFakeVoice({ name: "Japanese", lang: "ja-JP" });
    const harness = createControllerHarness([zhVoice, jaVoice]);

    const playback = harness.controller.play({
      chineseText: "累積經驗",
      japaneseText: "経験を積む",
    });

    expect(harness.synthesis.spokenUtterances).toHaveLength(1);
    expect(harness.synthesis.spokenUtterances[0]).toMatchObject({
      text: "累積經驗",
      lang: "zh-TW",
      voice: zhVoice,
      rate: 1,
      pitch: 1,
      volume: 1,
    });
    expect(harness.states.at(-1)?.phase).toBe("speaking-chinese");

    harness.synthesis.finishCurrent();
    expect(harness.states.at(-1)?.phase).toBe("pause");
    await vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS - 1);
    expect(harness.synthesis.spokenUtterances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(harness.synthesis.spokenUtterances[1]).toMatchObject({
      text: "経験を積む",
      lang: "ja-JP",
      voice: jaVoice,
      rate: 1,
      pitch: 1,
      volume: 1,
    });
    expect(harness.states.at(-1)?.phase).toBe("speaking-japanese");

    harness.synthesis.finishCurrent();
    await playback;
    expect(harness.states.at(-1)?.phase).toBe("completed");
    harness.destroy();
  });

  it("retains utterance languages when no matching voice is available", async () => {
    vi.useFakeTimers();
    const harness = createControllerHarness([
      createFakeVoice({ name: "English", lang: "en-US", default: true }),
    ]);
    const playback = harness.controller.play({
      chineseText: "經驗",
      japaneseText: "経験",
    });

    expect(harness.synthesis.spokenUtterances[0]).toMatchObject({
      lang: "zh-TW",
      voice: null,
    });
    harness.synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS);
    expect(harness.synthesis.spokenUtterances[1]).toMatchObject({
      lang: "ja-JP",
      voice: null,
    });
    harness.synthesis.finishCurrent();
    await playback;
    harness.destroy();
  });

  it("stops speech and a pending pause timer", async () => {
    vi.useFakeTimers();
    const harness = createControllerHarness();
    const playback = harness.controller.play({
      chineseText: "經驗",
      japaneseText: "経験",
    });
    harness.synthesis.finishCurrent();

    harness.controller.stop();
    await vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS);
    await playback;

    expect(harness.synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(harness.synthesis.spokenUtterances).toHaveLength(1);
    expect(harness.states.at(-1)?.phase).toBe("stopped");
    harness.destroy();
  });

  it("restarting cancels the previous session and ignores stale completion", async () => {
    vi.useFakeTimers();
    const harness = createControllerHarness();
    const firstPlayback = harness.controller.play({
      chineseText: "第一",
      japaneseText: "一",
    });
    const staleChinese = harness.synthesis.spokenUtterances[0];

    const secondPlayback = harness.controller.play({
      chineseText: "第二",
      japaneseText: "二",
    });
    expect(harness.synthesis.cancel).toHaveBeenCalledTimes(1);
    staleChinese.onend?.(new Event("end") as SpeechSynthesisEvent);
    await vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS);
    expect(harness.synthesis.spokenUtterances).toHaveLength(2);

    harness.synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS);
    expect(harness.synthesis.spokenUtterances[2].text).toBe("二");
    harness.synthesis.finishCurrent();
    await Promise.all([firstPlayback, secondPlayback]);
    harness.destroy();
  });

  it("allows only one LayerLex controller to play at a time", async () => {
    const installed = installFakeSpeechSynthesis();
    const firstStates: SpeechPlaybackState[] = [];
    const secondStates: SpeechPlaybackState[] = [];
    const firstController = createBilingualSpeechController({
      onStateChange: (state) => firstStates.push(state),
    });
    const secondController = createBilingualSpeechController({
      onStateChange: (state) => secondStates.push(state),
    });

    const firstPlayback = firstController.play({
      chineseText: "第一",
      japaneseText: "一",
    });
    const secondPlayback = secondController.play({
      chineseText: "第二",
      japaneseText: "二",
    });

    await firstPlayback;
    expect(installed.synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(firstStates.at(-1)?.phase).toBe("stopped");
    expect(secondStates.at(-1)?.phase).toBe("speaking-chinese");

    secondController.stop();
    await secondPlayback;
    firstController.destroy();
    secondController.destroy();
    installed.restore();
  });

  it("normalizes Chinese and Japanese failures without continuing after Chinese", async () => {
    vi.useFakeTimers();
    const harness = createControllerHarness();
    const chinesePlayback = harness.controller.play({
      chineseText: "經驗",
      japaneseText: "経験",
    });
    harness.synthesis.failCurrent("voice-unavailable");

    await expect(chinesePlayback).rejects.toEqual(
      new SpeechPlaybackError(
        "Chinese speech playback failed (voice-unavailable).",
      ),
    );
    await vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS);
    expect(harness.synthesis.spokenUtterances).toHaveLength(1);
    expect(harness.states.at(-1)).toMatchObject({
      phase: "error",
      errorMessage: "Chinese speech playback failed (voice-unavailable).",
    });

    const japanesePlayback = harness.controller.play({
      chineseText: "經驗",
      japaneseText: "経験",
    });
    harness.synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(BILINGUAL_SPEECH_PAUSE_MS);
    harness.synthesis.failCurrent("synthesis-failed");
    await expect(japanesePlayback).rejects.toEqual(
      new SpeechPlaybackError(
        "Japanese speech playback failed (synthesis-failed).",
      ),
    );
    harness.destroy();
  });

  it("reports unsupported playback without throwing", async () => {
    const states: SpeechPlaybackState[] = [];
    const controller = createBilingualSpeechController({
      onStateChange: (state) => states.push(state),
      runtime: {
        clearTimer: vi.fn(),
        setTimer: vi.fn(() => 1),
      },
    });

    expect(controller.isSupported()).toBe(false);
    await expect(
      controller.play({ chineseText: "經驗", japaneseText: "経験" }),
    ).resolves.toBeUndefined();
    expect(states.at(-1)?.phase).toBe("unsupported");
    controller.destroy();
  });
});
