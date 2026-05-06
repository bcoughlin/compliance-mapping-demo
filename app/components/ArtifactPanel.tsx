"use client";

import type { Trace } from "@/lib/types";

interface ArtifactPanelProps {
  trace: Trace;
}

export function ArtifactPanel({ trace }: ArtifactPanelProps) {
  return (
    <div className="h-full overflow-auto bg-stone-50/50 p-4">
      <div className="bg-white border border-stone-200 rounded-md p-4 font-mono text-[12px] leading-relaxed">
        <pre className="whitespace-pre-wrap break-words">
          {JSON.stringify(trace.compliance_record, null, 2)}
        </pre>
      </div>

      {trace.incident_report && (
        <div className="mt-4 bg-red-50/40 border border-red-200 rounded-md p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-semibold text-red-900">
              Draft incident report
            </h4>
            <code className="text-[11px] font-mono text-red-700">
              {trace.incident_report.rca_id}
            </code>
          </div>
          <div className="font-mono text-[12px] leading-relaxed">
            <pre className="whitespace-pre-wrap break-words text-stone-800">
              {JSON.stringify(trace.incident_report, null, 2)}
            </pre>
          </div>
          <p className="mt-3 text-[11px] text-red-700 italic">
            Generated at the moment of catch. Status:{" "}
            <strong>{trace.incident_report.status}</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
