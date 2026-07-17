import { vi } from "vitest";

export interface FakeVoiceOptions {
  name: string;
  lang: string;
  default?: boolean;
}

export function createFakeVoice({
  name,
  lang,
  default: isDefault = false,
}: FakeVoiceOptions) {
  return {
    default: isDefault,
    lang,
    localService: true,
    name,
    voiceURI: name,
  } satisfies SpeechSynthesisVoice;
}

export class FakeSpeechSynthesisUtterance {
  lang = "";
  pitch = 1;
  rate = 1;
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  volume = 1;
  onboundary: SpeechSynthesisUtterance["onboundary"] = null;
  onend: SpeechSynthesisUtterance["onend"] = null;
  onerror: SpeechSynthesisUtterance["onerror"] = null;
  onmark: SpeechSynthesisUtterance["onmark"] = null;
  onpause: SpeechSynthesisUtterance["onpause"] = null;
  onresume: SpeechSynthesisUtterance["onresume"] = null;
  onstart: SpeechSynthesisUtterance["onstart"] = null;

  constructor(text = "") {
    this.text = text;
  }
}

export class FakeSpeechSynthesis {
  readonly cancel = vi.fn(() => {
    this.currentUtterance = undefined;
  });
  readonly getVoices = vi.fn(() => this.voices);
  readonly pause = vi.fn();
  readonly resume = vi.fn();
  readonly speak = vi.fn((utterance: SpeechSynthesisUtterance) => {
    this.spokenUtterances.push(utterance);
    this.currentUtterance = utterance;
    utterance.onstart?.(new Event("start") as SpeechSynthesisEvent);
  });
  readonly addEventListener = vi.fn(
    (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "voiceschanged") this.voiceListeners.add(listener);
    },
  );
  readonly removeEventListener = vi.fn(
    (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "voiceschanged") this.voiceListeners.delete(listener);
    },
  );
  readonly dispatchEvent = vi.fn(() => true);
  readonly spokenUtterances: SpeechSynthesisUtterance[] = [];
  readonly voiceListeners = new Set<EventListenerOrEventListenerObject>();
  currentUtterance?: SpeechSynthesisUtterance;
  voices: SpeechSynthesisVoice[];
  onvoiceschanged: ((this: SpeechSynthesis, ev: Event) => unknown) | null =
    null;

  constructor(voices: SpeechSynthesisVoice[] = []) {
    this.voices = voices;
  }

  get paused() {
    return false;
  }

  get pending() {
    return this.currentUtterance !== undefined;
  }

  get speaking() {
    return this.currentUtterance !== undefined;
  }

  finishCurrent() {
    const utterance = this.currentUtterance;
    this.currentUtterance = undefined;
    utterance?.onend?.(new Event("end") as SpeechSynthesisEvent);
  }

  failCurrent(error = "synthesis-failed") {
    const utterance = this.currentUtterance;
    this.currentUtterance = undefined;
    utterance?.onerror?.({ error } as SpeechSynthesisErrorEvent);
  }

  emitVoicesChanged() {
    const event = new Event("voiceschanged");
    for (const listener of this.voiceListeners) {
      if (typeof listener === "function") {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    }
  }
}

export function installFakeSpeechSynthesis(
  voices: SpeechSynthesisVoice[] = [],
) {
  const originalSynthesisDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "speechSynthesis",
  );
  const originalUtteranceDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "SpeechSynthesisUtterance",
  );
  const synthesis = new FakeSpeechSynthesis(voices);

  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: synthesis,
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeSpeechSynthesisUtterance,
  });

  return {
    synthesis,
    restore() {
      if (originalSynthesisDescriptor) {
        Object.defineProperty(
          window,
          "speechSynthesis",
          originalSynthesisDescriptor,
        );
      } else {
        Reflect.deleteProperty(window, "speechSynthesis");
      }

      if (originalUtteranceDescriptor) {
        Object.defineProperty(
          globalThis,
          "SpeechSynthesisUtterance",
          originalUtteranceDescriptor,
        );
      } else {
        Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
      }
    },
  };
}
