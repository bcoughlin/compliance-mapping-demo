"use client";

import type { Trace } from "@/lib/types";
import { IncidentReportPanel } from "@/app/components/IncidentReportPanel";

export type ArtifactView = "incident_report" | "audit_record";

interface ArtifactPanelProps {
  trace: Trace;
  view: ArtifactView;
}

export function ArtifactPanel({ trace, view }: ArtifactPanelProps) {
  return (
    <div className="h-full overflow-auto bg-stone-50/40">
      <div className="p-4 space-y-4">
        {view === "incident_report" && trace.incident_report && (
          <IncidentReportPanel report={trace.incident_report} />
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
