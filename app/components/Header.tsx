"use client";

interface HeaderProps {
  status: "idle" | "running" | "completed" | "errored";
  hasRunHistory: boolean;
  onRun: () => void;
  onOpenRunModal: () => void;
  onShowTour: () => void;
  totalFindings?: number;
  totalTraces?: number;
}

export function Header({
  status,
  hasRunHistory,
  onRun,
  onOpenRunModal,
  onShowTour,
  totalFindings,
  totalTraces,
}: HeaderProps) {
  const isRunning = status === "running";
  const isDone = status === "completed";
  const isErrored = status === "errored";

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

          {hasRunHistory ? (
            <button
              type="button"
              onClick={onOpenRunModal}
              className={`text-sm font-medium px-4 py-1.5 rounded-md border transition-colors flex items-center gap-2
                ${
                  isRunning
                    ? "border-amber-400 text-amber-800 bg-amber-50"
                    : isErrored
                      ? "border-red-300 text-red-700 hover:bg-red-50"
                      : "border-stone-300 text-stone-700 hover:bg-stone-100"
                }`}
            >
              {isRunning && <span className="pulse-dot" aria-hidden />}
              {isRunning ? "Run in progress" : "Current run"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onRun}
              className="text-sm font-medium px-4 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-700"
            >
              Run mapping
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

