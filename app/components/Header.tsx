"use client";

interface HeaderProps {
  status: "idle" | "running" | "completed" | "errored";
  onRun: () => void;
  onShowTour: () => void;
  totalFindings?: number;
  totalTraces?: number;
}

export function Header({
  status,
  onRun,
  onShowTour,
  totalFindings,
  totalTraces,
}: HeaderProps) {
  const isRunning = status === "running";
  const isDone = status === "completed";

  return (
    <header className="sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-200">
      <div className="px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-base font-semibold text-stone-900 tracking-tight">
            Compliance Mapping Demo
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            I built this to show what a compliance mapping agent
            actually does — not theoretically, actually. Click run.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDone && (
            <div className="text-xs text-stone-600 hidden sm:flex items-center gap-3">
              <span>
                <strong className="font-semibold text-stone-900">{totalFindings ?? 0}</strong> findings
              </span>
              <span className="text-stone-300">·</span>
              <span>
                <strong className="font-semibold text-stone-900">{totalTraces ?? 0}</strong> traces
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onShowTour}
            className="text-xs text-stone-600 hover:text-stone-900 underline-offset-4 hover:underline transition-colors"
          >
            How this works
          </button>

          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className={`text-sm font-medium px-4 py-1.5 rounded-md transition-colors
              ${
                isRunning
                  ? "bg-stone-200 text-stone-500 cursor-not-allowed"
                  : "bg-stone-900 text-white hover:bg-stone-700"
              }`}
          >
            {isRunning ? "Running…" : isDone ? "Run again" : "Run mapping"}
          </button>
        </div>
      </div>
    </header>
  );
}

