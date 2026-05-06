"use client";

import type { Trace, Severity } from "@/lib/types";

interface TraceListProps {
  traces: Trace[];
  selectedId: string | null;
  onSelect: (traceId: string) => void;
}

const SEVERITY_BADGE: Record<Severity, { bg: string; ring: string; label: string; emoji: string }> = {
  green: {
    bg: "bg-emerald-100",
    ring: "ring-emerald-500/40",
    label: "OK",
    emoji: "🟢",
  },
  yellow: {
    bg: "bg-amber-100",
    ring: "ring-amber-500/40",
    label: "REVIEW",
    emoji: "🟡",
  },
  red: {
    bg: "bg-red-100",
    ring: "ring-red-500/40",
    label: "BLOCK",
    emoji: "🔴",
  },
};

export function TraceList({ traces, selectedId, onSelect }: TraceListProps) {
  if (traces.length === 0) {
    return (
      <div className="px-4 py-6 text-xs text-stone-500">
        Traces appear here as the agent identifies them.
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-100">
      {traces.map((trace) => {
        const sev = SEVERITY_BADGE[trace.severity];
        const isSelected = trace.trace_id === selectedId;
        return (
          <button
            key={trace.trace_id}
            type="button"
            onClick={() => onSelect(trace.trace_id)}
            className={`w-full px-4 py-3 text-left flex flex-col gap-1.5 hover:bg-stone-50 transition-colors
              ${isSelected ? "bg-stone-100 ring-1 ring-inset ring-stone-300" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{sev.emoji}</span>
              <span className="text-sm font-medium text-stone-900 truncate">
                {trace.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-stone-500">
              <span
                className={`px-1.5 py-0.5 rounded ${sev.bg} text-stone-700 font-mono`}
              >
                {sev.label}
              </span>
              <span>·</span>
              <span>
                {trace.files.length} file{trace.files.length === 1 ? "" : "s"}
              </span>
              {trace.incident_report && (
                <>
                  <span>·</span>
                  <span className="text-red-700">RCA draft</span>
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
