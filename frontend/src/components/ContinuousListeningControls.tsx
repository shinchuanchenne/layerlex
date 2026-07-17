import type {
  ContinuousListeningPhase,
  ListeningItem,
} from "../lib/useContinuousListening";

interface ContinuousListeningControlsProps {
  phase: ContinuousListeningPhase;
  item?: ListeningItem;
  currentPosition: number;
  total: number;
  canStart: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetry: () => void;
  errorMessage?: string;
  accent?: "cyan" | "violet";
}

const STATUS_LABELS: Record<ContinuousListeningPhase, string> = {
  idle: "Ready for continuous listening.",
  "playing-chinese": "Speaking Chinese…",
  "between-languages": "Preparing Japanese…",
  "playing-japanese": "Speaking Japanese…",
  "between-cards": "Preparing the next card…",
  paused: "Continuous listening paused. Resume restarts this card in Chinese.",
  completed: "Continuous listening complete.",
  stopped: "Continuous listening stopped.",
  error: "Continuous listening failed.",
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

export function ContinuousListeningControls({
  phase,
  item,
  currentPosition,
  total,
  canStart,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetry,
  errorMessage,
  accent = "cyan",
}: ContinuousListeningControlsProps) {
  const styles = ACCENT_STYLES[accent];
  const isPlaying =
    phase === "playing-chinese" ||
    phase === "between-languages" ||
    phase === "playing-japanese" ||
    phase === "between-cards";
  const canStop = isPlaying || phase === "paused";

  return (
    <section
      aria-label="Continuous listening"
      className={`mt-4 rounded-2xl border ${styles.border} bg-white px-4 py-4 shadow-sm sm:px-5`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className={`text-sm font-semibold ${styles.label}`}>
            Continuous listening
          </p>
          <output
            aria-label="Continuous listening progress"
            className="mt-1 block text-sm font-medium text-slate-600"
          >
            Listening {currentPosition} / {total}
            {item ? ` · ${item.label}` : ""}
          </output>
        </div>

        {phase === "paused" ? (
          <button
            type="button"
            onClick={onResume}
            className={`inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:ring-2 ${styles.focus} focus:ring-offset-2 focus:outline-none`}
          >
            Resume continuous listening
          </button>
        ) : phase === "error" ? (
          <button
            type="button"
            onClick={onRetry}
            className={`inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:ring-2 ${styles.focus} focus:ring-offset-2 focus:outline-none`}
          >
            Retry current card
          </button>
        ) : !isPlaying ? (
          <button
            type="button"
            disabled={!canStart}
            onClick={onStart}
            className={`inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:ring-2 ${styles.focus} focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Start continuous listening
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className={`inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:ring-2 ${styles.focus} focus:ring-offset-2 focus:outline-none`}
          >
            Pause continuous listening
          </button>
        )}

        <button
          type="button"
          disabled={!canStop}
          onClick={onStop}
          className={`inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:ring-2 ${styles.focus} focus:outline-none disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Stop continuous listening
        </button>
      </div>

      {phase === "error" ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {errorMessage ?? STATUS_LABELS.error}
        </p>
      ) : (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm text-slate-600"
        >
          {STATUS_LABELS[phase]}
        </p>
      )}
    </section>
  );
}
