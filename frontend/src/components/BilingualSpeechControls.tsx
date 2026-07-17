import { useMemo } from "react";

import type { SpeechPlaybackPhase } from "../lib/bilingualSpeech";
import { useBilingualSpeechPlayback } from "../lib/useBilingualSpeechPlayback";

interface BilingualSpeechControlsProps {
  chineseText: string;
  japaneseText: string;
  itemLabel: string;
  accent?: "cyan" | "violet";
}

const STATUS_LABELS: Record<SpeechPlaybackPhase, string> = {
  idle: "Ready to play Chinese, then Japanese.",
  "speaking-chinese": "Speaking Chinese…",
  pause: "Preparing Japanese…",
  "speaking-japanese": "Speaking Japanese…",
  completed: "Playback complete.",
  stopped: "Playback stopped.",
  error: "Playback failed.",
  unsupported: "Speech playback is unavailable in this browser.",
};

const ACCENT_STYLES = {
  cyan: {
    border: "border-cyan-200",
    label: "text-cyan-800",
    focus: "focus:ring-cyan-600",
  },
  violet: {
    border: "border-violet-200",
    label: "text-violet-800",
    focus: "focus:ring-violet-600",
  },
};

export function BilingualSpeechControls({
  chineseText,
  japaneseText,
  itemLabel,
  accent = "cyan",
}: BilingualSpeechControlsProps) {
  const request = useMemo(
    () => ({ chineseText, japaneseText }),
    [chineseText, japaneseText],
  );
  const { state, isPlaying, play, stop } = useBilingualSpeechPlayback(request);
  const styles = ACCENT_STYLES[accent];
  const unsupported = state.phase === "unsupported";

  return (
    <section
      aria-label={`Speech playback for ${itemLabel}`}
      className={`mt-6 rounded-2xl border ${styles.border} bg-white px-4 py-4 shadow-sm sm:px-5`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className={`mr-auto text-sm font-semibold ${styles.label}`}>
          Chinese → Japanese speech
        </p>
        <button
          type="button"
          aria-label={`Play Chinese then Japanese for ${itemLabel}`}
          disabled={unsupported}
          onClick={play}
          className={`inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:ring-2 ${styles.focus} focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isPlaying ? "Restart playback" : "Play Chinese then Japanese"}
        </button>
        <button
          type="button"
          aria-label={`Stop audio for ${itemLabel}`}
          disabled={!isPlaying}
          onClick={stop}
          className={`inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:ring-2 ${styles.focus} focus:outline-none disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Stop audio
        </button>
      </div>

      {state.phase === "error" ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.errorMessage ?? STATUS_LABELS.error}
        </p>
      ) : (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm text-slate-600"
        >
          {STATUS_LABELS[state.phase]}
        </p>
      )}
    </section>
  );
}
