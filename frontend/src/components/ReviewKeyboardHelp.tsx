interface ReviewKeyboardHelpProps {
  canGoPrevious: boolean;
  canGoNext: boolean;
  canFlip: boolean;
}

export function ReviewKeyboardHelp({
  canGoPrevious,
  canGoNext,
  canFlip,
}: ReviewKeyboardHelpProps) {
  return (
    <aside
      aria-label="Keyboard shortcuts"
      className="mt-5 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600"
    >
      <p className="font-semibold text-slate-800">Keyboard shortcuts</p>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        <li className={canGoPrevious ? undefined : "text-slate-400"}>
          <kbd className="font-mono font-semibold">←</kbd> Previous
          {canGoPrevious ? null : " (unavailable)"}
        </li>
        <li className={canGoNext ? undefined : "text-slate-400"}>
          <kbd className="font-mono font-semibold">→</kbd> Next
          {canGoNext ? null : " (unavailable)"}
        </li>
        <li className={canFlip ? undefined : "text-slate-400"}>
          <kbd className="font-mono font-semibold">Space</kbd> Flip mode only
          {canFlip ? null : " (unavailable in Show both)"}
        </li>
      </ul>
    </aside>
  );
}
