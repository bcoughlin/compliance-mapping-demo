"use client";

import { useEffect, useRef, useState } from "react";
import type { PhaseState } from "@/app/hooks/useRunStream";

interface ActivityStreamProps {
  phases: PhaseState[];
  status: "idle" | "running" | "completed" | "errored";
  errorMessage?: string;
}

const PHASE_LABEL_IDLE: Record<string, string> = {
  semgrep: "Semgrep taint analysis",
  callgraph: "AST call graph",
  narrate: "Claude narration",
};

const PHASE_LABEL_ACTIVE: Record<string, string> = {
  semgrep: "Semgrep taint analysis",
  callgraph: "AST call graph",
  narrate: "Live Claude Narration",
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
  const isClaudeStreaming = isActive && phase.phase === "narrate";
  const label = isActive
    ? PHASE_LABEL_ACTIVE[phase.phase] ?? phase.phase
    : PHASE_LABEL_IDLE[phase.phase] ?? phase.phase;

  // Color theme for the active state — green when Claude is streaming,
  // amber for the deterministic phases.
  const dotClass = isClaudeStreaming ? "pulse-dot-green" : "pulse-dot";
  const activeBgClass = isClaudeStreaming ? "phase-active-green" : "phase-active";
  const progressClass = isClaudeStreaming
    ? "phase-progress-bar-green"
    : "phase-progress-bar";
  const cursorClass = isClaudeStreaming ? "live-cursor-green" : "live-cursor";

  const activeBorder = isClaudeStreaming
    ? "border-emerald-400 shadow-sm shadow-emerald-200/50"
    : "border-amber-400 shadow-sm shadow-amber-200/40";

  const activeText = isClaudeStreaming ? "text-emerald-900" : "text-amber-900";
  const activeMeta = isClaudeStreaming
    ? "text-emerald-800 status-dots"
    : "text-amber-800 status-dots";
  const activeChevron = isClaudeStreaming ? "text-emerald-600" : "text-amber-600";

  return (
    <div
      className={`relative border rounded-md bg-white overflow-hidden transition-colors ${
        isActive ? activeBorder : "border-stone-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-stone-50/50 transition-colors text-left ${
          isActive ? activeBgClass : ""
        }`}
      >
        <span className="inline-flex items-center justify-center w-5">
          {isActive ? (
            <span className={dotClass} aria-label="running" />
          ) : (
            <span className="text-emerald-600 text-sm font-mono">✓</span>
          )}
        </span>
        <span
          className={`text-sm flex-1 text-left ${
            isActive ? `font-semibold ${activeText}` : "font-medium text-stone-800"
          }`}
        >
          {label}
        </span>
        <span
          className={`text-xs font-mono ${
            isActive ? activeMeta : "text-stone-500"
          }`}
        >
          {isActive ? phase.message : phase.summary}
        </span>
        <span
          className={`text-xs transition-transform ${
            expanded ? "rotate-90" : ""
          } ${isActive ? activeChevron : "text-stone-400"}`}
        >
          ▸
        </span>
      </button>

      {isActive && <span className={progressClass} aria-hidden />}

      {expanded && (
        <div
          className={`px-4 pb-3 pt-1 border-t ${
            isClaudeStreaming ? "border-emerald-100" : "border-stone-100"
          }`}
        >
          {phase.liveText && (
            <div
              ref={liveRef}
              className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto py-1"
            >
              {phase.liveText}
              {isActive && <span className={cursorClass} aria-hidden />}
            </div>
          )}
          {!phase.liveText && phase.detail && (
            <pre className="font-mono text-xs text-stone-600 whitespace-pre-wrap">
              {phase.detail}
            </pre>
          )}
          {!phase.liveText && !phase.detail && isActive && (
            <p
              className={`text-xs italic flex items-center gap-2 ${
                isClaudeStreaming ? "text-emerald-800" : "text-amber-800"
              }`}
            >
              <span>{phase.message}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
