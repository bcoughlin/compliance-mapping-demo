"use client";

interface HeaderProps {
  // Map flow
  mapStatus: "idle" | "running" | "completed" | "errored";
  mapBuilt: boolean;
  onBuildMap: () => void;
  onOpenMapModal: () => void;

  // Trace flow
  traceStatus: "idle" | "running" | "completed" | "errored";
  hasTraceHistory: boolean;
  onRunTrace: () => void;
  onOpenRunModal: () => void;

  // Common
  onShowTour: () => void;
  totalFindings?: number;
  totalTraces?: number;
}

export function Header({
  mapStatus,
  mapBuilt,
  onBuildMap,
  onOpenMapModal,
  traceStatus,
  hasTraceHistory,
  onRunTrace,
  onOpenRunModal,
  onShowTour,
  totalFindings,
  totalTraces,
}: HeaderProps) {
  const isMapRunning = mapStatus === "running";
  const isTraceRunning = traceStatus === "running";
  const isTraceDone = traceStatus === "completed";
  const isTraceErrored = traceStatus === "errored";

  return (
    <header className="sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-200">
      <div className="px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-base font-semibold text-stone-900 tracking-tight">
            Compliance Mapping Demo
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            I built this to show what a compliance mapping agent actually does — not theoretically, actually.
            Two steps: <strong>build the map</strong>, then <strong>run the trace</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isTraceDone && (
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

          {/* Step 1 — Build Map */}
          {!mapBuilt ? (
            <button
              type="button"
              onClick={onBuildMap}
              disabled={isMapRunning}
              className={`text-sm font-medium px-4 py-1.5 rounded-md transition-colors flex items-center gap-2
                ${
                  isMapRunning
                    ? "bg-amber-100 text-amber-900 border border-amber-300 cursor-not-allowed"
                    : "bg-stone-900 text-white hover:bg-stone-700"
                }`}
            >
              {isMapRunning && <span className="pulse-dot" aria-hidden />}
              {isMapRunning ? "Building map..." : "1. Build map"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenMapModal}
              className="text-sm font-medium px-4 py-1.5 rounded-md border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors"
              title="View the map artifact"
            >
              View map
            </button>
          )}

          {/* Step 2 — Run Trace */}
          {hasTraceHistory ? (
            <button
              type="button"
              onClick={onOpenRunModal}
              className={`text-sm font-medium px-4 py-1.5 rounded-md border transition-colors flex items-center gap-2
                ${
                  isTraceRunning
                    ? "border-amber-400 text-amber-800 bg-amber-50"
                    : isTraceErrored
                      ? "border-red-300 text-red-700 hover:bg-red-50"
                      : "border-stone-300 text-stone-700 hover:bg-stone-100"
                }`}
            >
              {isTraceRunning && <span className="pulse-dot" aria-hidden />}
              {isTraceRunning ? "Trace in progress" : "Current trace"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onRunTrace}
              disabled={!mapBuilt || isTraceRunning}
              className={`text-sm font-medium px-4 py-1.5 rounded-md transition-colors
                ${
                  mapBuilt && !isTraceRunning
                    ? "bg-stone-900 text-white hover:bg-stone-700"
                    : "bg-stone-200 text-stone-500 cursor-not-allowed"
                }`}
              title={mapBuilt ? "Run the trace using the map" : "Build the map first"}
            >
              2. Run trace
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

