export const BILINGUAL_SPEECH_PAUSE_MS = 650;

export const CHINESE_SPEECH_LANGUAGE = "zh-TW";
export const JAPANESE_SPEECH_LANGUAGE = "ja-JP";

export type SpeechPlaybackPhase =
  | "idle"
  | "speaking-chinese"
  | "pause"
  | "speaking-japanese"
  | "completed"
  | "stopped"
  | "error"
  | "unsupported";

export interface SpeechPlaybackState {
  phase: SpeechPlaybackPhase;
  errorMessage?: string;
}

export interface BilingualSpeechRequest {
  chineseText: string;
  japaneseText: string;
}

export interface SpeechPlaybackController {
  play(request: BilingualSpeechRequest): Promise<void>;
  stop(): void;
  destroy(): void;
  isSupported(): boolean;
}

interface SpeechRuntime {
  speechSynthesis?: SpeechSynthesis;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
  setTimer: (callback: () => void, delay: number) => number;
  clearTimer: (timerId: number) => void;
}

interface SpeechPlaybackControllerOptions {
  onStateChange: (state: SpeechPlaybackState) => void;
  pauseMs?: number;
  runtime?: SpeechRuntime;
}

interface ActiveSession {
  id: number;
  timerId?: number;
  resolve: () => void;
  reject: (error: SpeechPlaybackError) => void;
}

type ActiveControllerStop = () => void;

let stopActiveLayerLexController: ActiveControllerStop | undefined;

export class SpeechPlaybackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeechPlaybackError";
  }
}

function createBrowserRuntime(): SpeechRuntime {
  const speechSynthesis =
    typeof window === "undefined" ? undefined : window.speechSynthesis;
  const UtteranceConstructor =
    typeof SpeechSynthesisUtterance === "undefined"
      ? undefined
      : SpeechSynthesisUtterance;

  return {
    speechSynthesis,
    createUtterance: UtteranceConstructor
      ? (text) => new UtteranceConstructor(text)
      : undefined,
    setTimer: (callback, delay) => window.setTimeout(callback, delay),
    clearTimer: (timerId) => window.clearTimeout(timerId),
  };
}

export function isBilingualSpeechSupported() {
  if (typeof window === "undefined") return false;

  return (
    window.speechSynthesis !== undefined &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

function normalizeLanguage(language: string) {
  return language.toLowerCase();
}

export function selectPreferredVoice(
  voices: SpeechSynthesisVoice[],
  language: string,
) {
  const normalizedLanguage = normalizeLanguage(language);
  const exactMatch = voices.find(
    (voice) => normalizeLanguage(voice.lang) === normalizedLanguage,
  );
  if (exactMatch) return exactMatch;

  const languageFamily = normalizedLanguage.split("-")[0];
  return voices.find((voice) =>
    normalizeLanguage(voice.lang).startsWith(languageFamily),
  );
}

function describeSpeechError(language: "Chinese" | "Japanese", error?: string) {
  const suffix = error ? ` (${error})` : "";
  return `${language} speech playback failed${suffix}.`;
}

export function createBilingualSpeechController({
  onStateChange,
  pauseMs = BILINGUAL_SPEECH_PAUSE_MS,
  runtime = createBrowserRuntime(),
}: SpeechPlaybackControllerOptions): SpeechPlaybackController {
  const synthesis = runtime.speechSynthesis;
  const supported = Boolean(synthesis && runtime.createUtterance);
  let voices: SpeechSynthesisVoice[] = [];
  let sessionSequence = 0;
  let activeSession: ActiveSession | undefined;
  let destroyed = false;

  function refreshVoices() {
    if (!synthesis) return;

    try {
      voices = synthesis.getVoices();
    } catch {
      voices = [];
    }
  }

  function handleVoicesChanged() {
    refreshVoices();
  }

  if (supported && synthesis) {
    refreshVoices();
    synthesis.addEventListener?.("voiceschanged", handleVoicesChanged);
  }

  function isCurrentSession(sessionId: number) {
    return (
      !destroyed &&
      activeSession !== undefined &&
      activeSession.id === sessionId
    );
  }

  function clearActiveTimer() {
    if (activeSession?.timerId !== undefined) {
      runtime.clearTimer(activeSession.timerId);
      activeSession.timerId = undefined;
    }
  }

  function cancelCurrentSession(announceStopped: boolean) {
    const session = activeSession;
    activeSession = undefined;
    sessionSequence += 1;

    if (session?.timerId !== undefined) {
      runtime.clearTimer(session.timerId);
    }

    if (synthesis && session) {
      synthesis.cancel();
    }

    session?.resolve();

    if (stopActiveLayerLexController === stopFromAnotherController) {
      stopActiveLayerLexController = undefined;
    }

    if (announceStopped && !destroyed) {
      onStateChange({ phase: "stopped" });
    }
  }

  function stopFromAnotherController() {
    cancelCurrentSession(true);
  }

  function completeSession(sessionId: number) {
    if (!isCurrentSession(sessionId)) return;

    const session = activeSession;
    activeSession = undefined;
    session?.resolve();
    if (stopActiveLayerLexController === stopFromAnotherController) {
      stopActiveLayerLexController = undefined;
    }
    onStateChange({ phase: "completed" });
  }

  function failSession(
    sessionId: number,
    language: "Chinese" | "Japanese",
    error?: string,
  ) {
    if (!isCurrentSession(sessionId)) return;

    const message = describeSpeechError(language, error);
    const session = activeSession;
    clearActiveTimer();
    activeSession = undefined;
    synthesis?.cancel();
    session?.reject(new SpeechPlaybackError(message));
    if (stopActiveLayerLexController === stopFromAnotherController) {
      stopActiveLayerLexController = undefined;
    }
    onStateChange({ phase: "error", errorMessage: message });
  }

  function configureUtterance(
    utterance: SpeechSynthesisUtterance,
    language: string,
  ) {
    utterance.lang = language;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const preferredVoice = selectPreferredVoice(voices, language);
    if (preferredVoice) utterance.voice = preferredVoice;
  }

  function speakJapanese(sessionId: number, japaneseText: string) {
    if (
      !isCurrentSession(sessionId) ||
      !synthesis ||
      !runtime.createUtterance
    ) {
      return;
    }

    try {
      const utterance = runtime.createUtterance(japaneseText);
      configureUtterance(utterance, JAPANESE_SPEECH_LANGUAGE);
      utterance.onend = () => completeSession(sessionId);
      utterance.onerror = (event) =>
        failSession(sessionId, "Japanese", event.error);

      onStateChange({ phase: "speaking-japanese" });
      synthesis.speak(utterance);
    } catch {
      failSession(sessionId, "Japanese");
    }
  }

  function play(request: BilingualSpeechRequest) {
    if (!supported || !synthesis || !runtime.createUtterance) {
      onStateChange({ phase: "unsupported" });
      return Promise.resolve();
    }

    if (
      stopActiveLayerLexController &&
      stopActiveLayerLexController !== stopFromAnotherController
    ) {
      stopActiveLayerLexController();
    }
    cancelCurrentSession(false);

    const sessionId = ++sessionSequence;
    const playbackPromise = new Promise<void>((resolve, reject) => {
      activeSession = { id: sessionId, resolve, reject };
    });
    stopActiveLayerLexController = stopFromAnotherController;

    try {
      const utterance = runtime.createUtterance(request.chineseText);
      configureUtterance(utterance, CHINESE_SPEECH_LANGUAGE);
      utterance.onend = () => {
        if (!isCurrentSession(sessionId)) return;

        onStateChange({ phase: "pause" });
        const timerId = runtime.setTimer(() => {
          if (isCurrentSession(sessionId)) {
            if (activeSession) activeSession.timerId = undefined;
            speakJapanese(sessionId, request.japaneseText);
          }
        }, pauseMs);
        if (activeSession) activeSession.timerId = timerId;
      };
      utterance.onerror = (event) =>
        failSession(sessionId, "Chinese", event.error);

      onStateChange({ phase: "speaking-chinese" });
      synthesis.speak(utterance);
    } catch {
      failSession(sessionId, "Chinese");
    }
    return playbackPromise;
  }

  function stop() {
    if (!activeSession) return;
    cancelCurrentSession(true);
  }

  function destroy() {
    if (destroyed) return;
    cancelCurrentSession(false);
    destroyed = true;
    synthesis?.removeEventListener?.("voiceschanged", handleVoicesChanged);
  }

  return {
    play,
    stop,
    destroy,
    isSupported: () => supported,
  };
}
