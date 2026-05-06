"use client";

import { useState } from "react";
import type { Trace } from "@/lib/types";
import { IncidentReportPanel } from "@/app/components/IncidentReportPanel";

interface ArtifactPanelProps {
  trace: Trace;
}

export function ArtifactPanel({ trace }: ArtifactPanelProps) {
  // The incident report is the headline artifact for red traces, so we
  // open on it by default. The audit-record JSON is one click away.
  const initialView: "report" | "record" = trace.incident_report
    ? "report"
    : "record";
  const [view, setView] = useState<"report" | "record">(initialView);

  const hasReport = !!trace.incident_report;

  return (
    <div className="h-full overflow-auto bg-stone-50/40">
      {hasReport && (
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-stone-200 px-4 py-2 flex gap-1">
          <ToggleTab
            active={view === "report"}
            onClick={() => setView("report")}
          >
            Incident report
          </ToggleTab>
          <ToggleTab
            active={view === "record"}
            onClick={() => setView("record")}
          >
            Audit record (JSON)
          </ToggleTab>
        </div>
      )}

      <div className="p-4 space-y-4">
        {view === "report" && trace.incident_report && (
          <IncidentReportPanel report={trace.incident_report} />
        )}

        {view === "record" && (
          <>
            <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
              <div className="px-4 py-2 border-b border-stone-200 flex items-baseline justify-between">
                <p className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">
                  v7 audit record · `compliance_record`
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

function ToggleTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors
        ${
          active
            ? "bg-stone-900 text-white"
            : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
        }`}
    >
      {children}
    </button>
  );
}
