"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  const [rcaStream, setRcaStream] = useState("");
  const streamRef = useRef<HTMLPreElement>(null);

  // Autoscroll the streaming pre to bottom as tokens arrive.
  useEffect(() => {
    if (rcaStatus === "generating" && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [rcaStream, rcaStatus]);

  const generateRca = useCallback(async () => {
    setRcaStatus("generating");
    setRcaError(null);
    setRcaStream("");
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
            const evt = JSON.parse(raw) as { type: string; text?: string; report?: IncidentReportDraft; message?: string };
            if (evt.type === "rca_token" && evt.text) {
              setRcaStream((prev) => prev + evt.text);
            } else if (evt.type === "rca_completed" && evt.report) {
              onIncidentReport(trace.trace_id, evt.report);
              setRcaStatus("idle");
              setRcaStream("");
              return;
            } else if (evt.type === "rca_error") {
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
              <div className="flex flex-col items-center py-10 gap-4">
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
                  className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600 disabled:opacity-100 disabled:cursor-wait flex items-center gap-2 shadow-sm"
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
                {rcaStatus === "generating" && (
                  <div className="w-full max-w-3xl bg-stone-900 rounded-md overflow-hidden border border-stone-800">
                    <div className="px-3 py-1.5 border-b border-stone-800 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
                        submit_incident_report · streaming
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono">
                        {rcaStream.length} chars
                      </span>
                    </div>
                    <pre
                      ref={streamRef}
                      className="font-mono text-[11px] leading-relaxed text-stone-100 px-3 py-2 max-h-80 overflow-auto whitespace-pre-wrap break-words"
                    >
                      {rcaStream}
                      <span className="inline-block w-1.5 h-3 bg-emerald-400 ml-0.5 align-middle animate-pulse" />
                    </pre>
                  </div>
                )}
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
