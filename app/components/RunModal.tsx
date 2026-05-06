"use client";

import { useEffect } from "react";
import { ActivityStream } from "@/app/components/ActivityStream";
import type { PhaseState } from "@/app/hooks/useRunStream";

interface RunModalProps {
  open: boolean;
  onClose: () => void;
  onRunAgain: () => void;
  status: "idle" | "running" | "completed" | "errored";
  phases: PhaseState[];
  errorMessage?: string;
  totalFindings?: number;
  totalTraces: number;
}

export function RunModal({
  open,
  onClose,
  onRunAgain,
  status,
  phases,
  errorMessage,
  totalFindings,
  totalTraces,
}: RunModalProps) {
  // Close on Escape (if not actively running — escape during a run is fine,
  // the SSE keeps flowing and traces continue to populate the left pane).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isRunning = status === "running";
  const isDone = status === "completed";
  const isErrored = status === "errored";

  let statusLine: string;
  if (isRunning) statusLine = "Agent is running.";
  else if (isDone) statusLine = `Run complete — ${totalFindings ?? 0} finding${totalFindings === 1 ? "" : "s"}, ${totalTraces} trace${totalTraces === 1 ? "" : "s"}.`;
  else if (isErrored) statusLine = "Run failed. See message below.";
  else statusLine = "No run yet.";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4 py-6">
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-3xl h-[70vh] overflow-hidden grid"
        style={{ gridTemplateRows: "auto 1fr auto" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {isRunning && <span className="pulse-dot flex-shrink-0" aria-hidden />}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-stone-900">
                Agent run
              </h2>
              <p className={`text-xs mt-0.5 truncate ${isRunning ? "text-amber-800" : "text-stone-500"}`}>
                {statusLine}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-sm px-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto bg-stone-50 min-h-0">
          <ActivityStream
            phases={phases}
            status={status}
            errorMessage={errorMessage}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-white rounded-b-lg flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRunAgain}
            disabled={isRunning}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors
              ${
                isRunning
                  ? "text-stone-400 cursor-not-allowed"
                  : "text-red-700 hover:text-red-900 hover:bg-red-50"
              }`}
          >
            ↻ Run again (clears traces)
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-4 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-700"
          >
            {isRunning ? "Hide (run continues)" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
