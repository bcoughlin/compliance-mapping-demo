"use client";

import { Markdown } from "@/app/components/Markdown";
import type { IncidentReportDraft } from "@/lib/types";

interface IncidentReportPanelProps {
  report: IncidentReportDraft;
}

const SEVERITY_BADGE: Record<string, { label: string; className: string }> = {
  S1: { label: "S1 — critical", className: "bg-red-200 text-red-900 ring-red-300" },
  S2: { label: "S2 — high", className: "bg-red-100 text-red-800 ring-red-200" },
  S3: { label: "S3 — medium", className: "bg-amber-100 text-amber-800 ring-amber-200" },
  S4: { label: "S4 — low", className: "bg-stone-100 text-stone-700 ring-stone-200" },
};

const OAD_BADGE: Record<string, string> = {
  yes: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  partial: "bg-amber-100 text-amber-800 ring-amber-200",
  no: "bg-red-100 text-red-800 ring-red-200",
};

export function IncidentReportPanel({ report }: IncidentReportPanelProps) {
  const sev = SEVERITY_BADGE[report.severity] ?? SEVERITY_BADGE.S2;

  return (
    <article className="bg-white border border-stone-200 rounded-md overflow-hidden">
      {/* Document header — looks like an incident report cover */}
      <header className="bg-gradient-to-b from-red-50 to-white px-6 py-5 border-b border-stone-200">
        <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
            <span>Root Cause Analysis</span>
            <span className="text-stone-300">·</span>
            <span>Draft</span>
          </div>
          <code className="text-xs font-mono text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
            {report.rca_id}
          </code>
        </div>

        <h2 className="text-xl font-semibold text-stone-900 leading-snug mb-3">
          {report.title}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-block px-2 py-0.5 rounded ring-1 text-[11px] font-mono font-semibold ${sev.className}`}
          >
            {sev.label}
          </span>
          <span className="text-[11px] text-stone-500 font-mono">
            {report.date}
          </span>
          <span className="text-stone-300">·</span>
          <span className="text-[11px] text-stone-700 italic">
            {report.status}
          </span>
        </div>
      </header>

      <div className="px-6 py-5 space-y-6">
        {/* Summary */}
        <Section title="1. Summary">
          <Markdown
            text={report.summary}
            className="text-sm text-stone-800 leading-relaxed"
          />
        </Section>

        {/* Timeline */}
        {report.timeline.length > 0 && (
          <Section title="2. Timeline">
            <ol className="relative border-l-2 border-stone-200 pl-5 ml-1 space-y-3">
              {report.timeline.map((entry, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[26px] top-1.5 w-3 h-3 rounded-full bg-stone-400 ring-2 ring-white" />
                  <p className="text-[11px] font-mono text-stone-500 leading-tight">
                    {entry.at}
                  </p>
                  <p className="text-sm text-stone-800 leading-relaxed">
                    {entry.event}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Five Whys */}
        {report.five_whys.length > 0 && (
          <Section title="3. Five-Whys Analysis">
            <ol className="space-y-3">
              {report.five_whys.map((row, i) => (
                <li
                  key={i}
                  className="bg-stone-50 border border-stone-200 rounded-md px-4 py-3"
                >
                  <p className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold mb-1">
                    Why #{i + 1}
                  </p>
                  <p className="text-sm font-medium text-stone-900 mb-1">
                    {row.question}
                  </p>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {row.answer}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Control Mapping */}
        {report.control_mapping.length > 0 && (
          <Section title="4. Control Mapping">
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-stone-500">
                    <th className="font-semibold text-left py-2 px-2 border-b border-stone-200">
                      Framework
                    </th>
                    <th className="font-semibold text-left py-2 px-2 border-b border-stone-200">
                      Control
                    </th>
                    <th className="font-semibold text-left py-2 px-2 border-b border-stone-200">
                      Operated as designed
                    </th>
                    <th className="font-semibold text-left py-2 px-2 border-b border-stone-200">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.control_mapping.map((row, i) => (
                    <tr key={i} className="border-b border-stone-100 last:border-b-0">
                      <td className="py-2 px-2 align-top">
                        <code className="font-mono text-[11px] text-stone-700">
                          {row.framework}
                        </code>
                      </td>
                      <td className="py-2 px-2 align-top text-stone-800">
                        {row.control}
                      </td>
                      <td className="py-2 px-2 align-top">
                        <span
                          className={`inline-block px-1.5 py-px rounded ring-1 text-[10px] font-mono font-semibold uppercase ${
                            OAD_BADGE[row.operated_as_designed] ??
                            "bg-stone-100 text-stone-700 ring-stone-200"
                          }`}
                        >
                          {row.operated_as_designed}
                        </span>
                      </td>
                      <td className="py-2 px-2 align-top text-stone-700 leading-relaxed">
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Proposed Remediation */}
        {report.proposed_remediation.length > 0 && (
          <Section title="5. Proposed Remediation">
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-stone-800 leading-relaxed">
              {report.proposed_remediation.map((step, i) => (
                <li key={i}>
                  <Markdown text={step} />
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <footer className="bg-stone-50 px-6 py-3 border-t border-stone-200 text-[11px] text-stone-600 italic">
        This draft was generated by the Compliance Mapping Agent at the
        moment of catch. Production usage: a named human (ERM lead,
        Internal Audit) reviews and either ratifies, edits, or escalates
        before the document becomes authoritative. The status field
        above reflects that draft state.
      </footer>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-stone-900 mb-3 pb-1 border-b border-stone-100">
        {title}
      </h3>
      {children}
    </section>
  );
}
