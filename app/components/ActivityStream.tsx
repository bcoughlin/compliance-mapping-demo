"use client";

import { useEffect, useRef, useState } from "react";
import type { PhaseState } from "@/app/hooks/useRunStream";

interface ActivityStreamProps {
  phases: PhaseState[];
  status: "idle" | "running" | "completed" | "errored";
  errorMessage?: string;
}

const PHASE_LABEL: Record<string, string> = {
  semgrep: "Semgrep taint analysis",
  callgraph: "AST call graph",
  narrate: "Claude narration",
};

export function ActivityStream({
  phases,
  status,
  errorMessage,
}: ActivityStreamProps) {
  if (status === "idle") {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-stone-500">
          Click <strong className="text-stone-900">Run mapping</strong> to start the agent.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 space-y-1.5">
      {phases.map((p, i) => (
        <PhaseRow key={`${p.phase}-${i}`} phase={p} />
      ))}
      {status === "errored" && errorMessage && (
        <div className="mt-3 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-900">
          <strong>Run failed.</strong> {errorMessage}
        </div>
      )}
    </div>
  );
}

function PhaseRow({ phase }: { phase: PhaseState }) {
  const [expanded, setExpanded] = useState(true);
  const liveRef = useRef<HTMLDivElement>(null);

  // Once a phase completes, collapse it automatically.
  useEffect(() => {
    if (phase.status === "completed") {
      setExpanded(false);
    }
  }, [phase.status]);

  // Auto-scroll the live narration as tokens arrive.
  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [phase.liveText]);

  const isActive = phase.status === "active";
  const label = PHASE_LABEL[phase.phase] ?? phase.phase;

  return (
    <div className="border border-stone-200 rounded-md bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-stone-50 transition-colors"
      >
        <span
          className={`inline-block w-4 text-center text-xs font-mono ${
            isActive ? "text-amber-600" : "text-emerald-600"
          }`}
        >
          {isActive ? (
            <span className="inline-block animate-pulse">▸</span>
          ) : (
            "✓"
          )}
        </span>
        <span className="text-sm font-medium text-stone-800 flex-1 text-left">
          {label}
        </span>
        <span className="text-xs text-stone-500 font-mono">
          {isActive ? phase.message : phase.summary}
        </span>
        <span
          className={`text-xs text-stone-400 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        >
          ▸
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-stone-100">
          {phase.liveText && (
            <div
              ref={liveRef}
              className="font-mono text-xs text-stone-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto"
            >
              {phase.liveText}
              {isActive && (
                <span className="inline-block w-1.5 h-3 bg-stone-700 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
          {!phase.liveText && phase.detail && (
            <pre className="font-mono text-xs text-stone-600 whitespace-pre-wrap">
              {phase.detail}
            </pre>
          )}
          {!phase.liveText && !phase.detail && isActive && (
            <p className="text-xs text-stone-500 italic">{phase.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
