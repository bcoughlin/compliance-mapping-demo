"use client";

import { useEffect } from "react";
import { ActivityStream } from "@/app/components/ActivityStream";
import { Markdown } from "@/app/components/Markdown";
import type { MapState } from "@/app/hooks/useMapStream";
import type { ThemeSummary } from "@/lib/types";

interface MapModalProps {
  open: boolean;
  state: MapState;
  onClose: () => void;
  onRebuild: () => void;
}

export function MapModal({ open, state, onClose, onRebuild }: MapModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isRunning = state.status === "running";
  const isDone = state.status === "completed";
  const hasThemes = state.themes.length > 0;

  let statusLine: string;
  if (isRunning) statusLine = "Building the map.";
  else if (isDone)
    statusLine = `Map ready — ${state.themes.length} theme${state.themes.length === 1 ? "" : "s"} in scope.`;
  else if (state.status === "errored")
    statusLine = "Map build failed.";
  else statusLine = "No map yet.";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4 py-6">
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden grid"
        style={{ gridTemplateRows: "auto 1fr auto" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {isRunning && <span className="pulse-dot flex-shrink-0" aria-hidden />}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-stone-900">
                Step 1 — Build map
              </h2>
              <p
                className={`text-xs mt-0.5 truncate ${
                  isRunning ? "text-amber-800" : "text-stone-500"
                }`}
              >
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
            phases={state.phases}
            status={state.status}
            errorMessage={state.errorMessage}
          />
          {hasThemes && (
            <div className="px-6 py-4 space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">
                Map result · {state.themes.length} theme
                {state.themes.length === 1 ? "" : "s"} in regulatory scope
              </p>
              {state.themes.map((t) => (
                <ThemeCard key={t.theme_id} theme={t} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRebuild}
            disabled={isRunning}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors
              ${
                isRunning
                  ? "text-stone-400 cursor-not-allowed"
                  : "text-red-700 hover:text-red-900 hover:bg-red-50"
              }`}
          >
            ↻ Rebuild map (clears trace)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-4 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-700"
          >
            {isRunning ? "Hide (build continues)" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ theme }: { theme: ThemeSummary }) {
  const hasSummary = theme.plain_english_summary.length > 0;

  return (
    <div className="bg-white border border-stone-200 rounded-md p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <code className="text-xs font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
          {theme.theme_id}
        </code>
        <span className="text-[11px] text-stone-500 font-mono">
          v{theme.theme_version} · registry/{theme.filename}
        </span>
      </div>

      {theme.plain_english_headline && (
        <h3 className="text-sm font-semibold text-stone-900 mb-2">
          {theme.plain_english_headline}
        </h3>
      )}

      {hasSummary && (
        <Markdown
          text={theme.plain_english_summary}
          className="text-sm text-stone-700 leading-relaxed mb-3"
        />
      )}

      <div className="grid grid-cols-2 gap-3 text-xs mt-3 pt-3 border-t border-stone-100">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-1">
            Regulations covered
          </p>
          <ul className="space-y-1 text-stone-700">
            {theme.regulations.map((r, i) => (
              <li key={i}>
                <strong className="font-mono text-[11px]">{r.framework}</strong>
                {r.requirements.length > 0 && (
                  <span className="text-stone-500">
                    {" "}
                    · {r.requirements.length} requirement
                    {r.requirements.length === 1 ? "" : "s"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-1">
            Required controls / evidence
          </p>
          <p className="text-stone-700">
            {theme.control_count} control
            {theme.control_count === 1 ? "" : "s"} ·{" "}
            {theme.evidence_items.length} evidence item
            {theme.evidence_items.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="col-span-2">
          <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-1">
            Triggers
          </p>
          <Markdown
            text={theme.trigger_summary}
            className="text-[12px] text-stone-700"
          />
        </div>

        {theme.sanitizers.length > 0 && (
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-1">
              Sanitizers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {theme.sanitizers.map((s) => (
                <code
                  key={s}
                  className="font-mono text-[11px] px-1.5 py-px rounded bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                >
                  {s}
                </code>
              ))}
            </div>
          </div>
        )}

        {theme.sinks.length > 0 && (
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-1">
              Sinks
            </p>
            <div className="flex flex-wrap gap-1.5">
              {theme.sinks.map((s) => (
                <code
                  key={s}
                  className="font-mono text-[11px] px-1.5 py-px rounded bg-red-50 text-red-800 ring-1 ring-red-200"
                >
                  {s}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
