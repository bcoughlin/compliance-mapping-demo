"use client";

import { useState, useCallback } from "react";
import type { Trace, IncidentReportDraft } from "@/lib/types";
import { IncidentReportPanel } from "@/app/components/IncidentReportPanel";

export type ArtifactView = "incident_report" | "audit_record";

interface ArtifactPanelProps {
  trace: Trace;
  view: ArtifactView;
  onIncidentReport: (traceId: string, report: IncidentReportDraft) => void;
}

export function ArtifactPanel({ trace, view, onIncidentReport }: ArtifactPanelProps) {
  const [rcaStatus, setRcaStatus] = useState<"idle" | "generating" | "error">("idle");
  const [rcaError, setRcaError] = useState<string | null>(null);

  const generateRca = useCallback(async () => {
    setRcaStatus("generating");
    setRcaError(null);
    try {
      const res = await fetch("/api/incident-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trace),
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw) as { type: string; report?: IncidentReportDraft; message?: string };
            if (evt.type === "rca_completed" && evt.report) {
              onIncidentReport(trace.trace_id, evt.report);
              setRcaStatus("idle");
              return;
            }
            if (evt.type === "rca_error") {
              throw new Error(evt.message ?? "RCA generation failed");
            }
          } catch (parseErr) {
            // partial line — ignore
          }
        }
      }
      throw new Error("Stream ended without rca_completed");
    } catch (err) {
      setRcaError(err instanceof Error ? err.message : String(err));
      setRcaStatus("error");
    }
  }, [trace, onIncidentReport]);

  return (
    <div className="h-full overflow-auto bg-stone-50/40">
      <div className="p-4 space-y-4">
        {view === "incident_report" && (
          <>
            {trace.incident_report ? (
              <IncidentReportPanel report={trace.incident_report} />
            ) : trace.severity === "red" ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <p className="text-sm text-stone-500">
                  No incident report yet for this trace.
                </p>
                {rcaStatus === "error" && rcaError && (
                  <p className="text-xs text-red-600 max-w-sm text-center">{rcaError}</p>
                )}
                <button
                  type="button"
                  onClick={generateRca}
                  disabled={rcaStatus === "generating"}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {rcaStatus === "generating" ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating RCA…
                    </>
                  ) : (
                    "Generate RCA"
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-stone-400">
                  Incident reports are only generated for RED traces.
                </p>
              </div>
            )}
          </>
        )}

        {view === "audit_record" && (
          <>
            <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
              <div className="px-4 py-2 border-b border-stone-200 flex items-baseline justify-between">
                <p className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">
                  v7 audit record · compliance_record
                </p>
                <code className="text-[10px] font-mono text-stone-500">
                  {trace.compliance_record.trace_id}
                </code>
              </div>
              <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-stone-800 px-4 py-3">
                {JSON.stringify(trace.compliance_record, null, 2)}
              </pre>
            </div>
            <p className="text-[11px] text-stone-500 italic px-1">
              This is the source-of-truth artifact a regulator or
              internal auditor would consume. Every visual element on
              this page — the diagram, the line annotations, the
              rationale, the incident report — is a render of this same
              record (and, for red traces, the incident report attached
              to it).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
