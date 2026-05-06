"use client";

import { useState } from "react";

interface IntroTourProps {
  open: boolean;
  onClose: () => void;
}

const COMPLIANCE_STEPS = [
  {
    title: "Instructions",
    body: (
      <>
        <p className="mb-3">
          This is a working demo of a Compliance Mapping Agent. Two steps,
          two buttons in the top-right corner:
        </p>
        <ol className="list-decimal pl-5 space-y-2 mb-3">
          <li>
            <strong>Build map.</strong> The agent reads the regulatory
            theme registry (3 themes — PCI cardholder data, GLBA personal
            financial data, PCI cryptographic keys) and writes a
            plain-English summary per theme. Result: the{" "}
            <strong>map artifact</strong>, viewable any time via{" "}
            <em>View map</em>.
          </li>
          <li>
            <strong>Run trace.</strong> Enabled once the map is built.
            The agent applies the map to a small Python payment service
            and produces three <strong>trace artifacts</strong> —
            green / yellow / red — each citing the exact theme record
            and regulatory requirement that anchors it. Red traces also
            generate a draft incident report.
          </li>
        </ol>
        <p className="mb-3">
          Each trace has a <strong>Diagram</strong> view (data flow as a
          Mermaid chart, click any node to see the code) and an{" "}
          <strong>Artifact</strong> view (the audit-ready JSON record an
          examiner would consume). The tabs are above the diagram pane.
        </p>
        <p className="text-stone-600 text-sm">
          The next pages walk through the regulatory thinking that
          produced the registry. If you want the engineering view
          instead, click the <em>Technical</em> tab above.
        </p>
      </>
    ),
  },
  {
    title: "1. The regulation gets published",
    body: (
      <>
        <p className="mb-3">
          PCI-DSS, GLBA, SOC 2, the EU AI Act — they all start as plain
          English text from a body that doesn&apos;t care about your
          codebase. Example, <em>PCI-DSS v4.0 Req. 3.4.1</em>:
        </p>
        <blockquote className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm italic text-stone-700 mb-3">
          &ldquo;PAN is rendered unreadable anywhere it is stored.&rdquo;
        </blockquote>
        <p>
          The job is to make this machine-checkable without a human
          translator standing in between.
        </p>
      </>
    ),
  },
  {
    title: "2. The Mapping Agent drafts a theme",
    body: (
      <>
        <p className="mb-3">
          The Mapping Agent reads the regulation and proposes a
          structured theme — what data is in scope, what controls are
          required, what evidence must exist, what code patterns trigger
          the theme:
        </p>
        <pre className="bg-stone-900 text-stone-100 text-xs rounded p-3 overflow-x-auto mb-3">{`theme_id: CARDHOLDER_DATA
regulations:
  - framework: pci_dss_v4_0
    requirements:
      - id: "3.4.1"
        text: "PAN is rendered unreadable..."
required_controls:
  - control_id: PAN_001
    description: "PAN must pass through tokenization
      before any persistence or logging."
required_evidence:
  - tokenization_call_present
  - audit_log_carries_token_only
sanitizers: [tokenization.tokenize]
sinks: [audit_logger.log_event, logging.*]`}</pre>
        <p>
          This is the agent doing the work humans currently do in
          spreadsheets — translating prose into structured intent.
        </p>
      </>
    ),
  },
  {
    title: "3. The governance forum ratifies",
    body: (
      <>
        <p className="mb-3">
          A theme draft is not authoritative until a cross-functional
          forum signs off — Compliance, Legal, Security, Engineering.
          The signers, the version, and the ratification date stamp
          into the theme so every downstream artifact can prove which
          version of the rule was being applied:
        </p>
        <pre className="bg-stone-100 text-stone-800 text-xs rounded p-3 mb-3 border border-stone-200">{`ratified_by: governance_forum
ratified_at: 2026-01-15
theme_version: 2026.1.0
signers:
  - Compliance: Jane R.
  - Legal: Marcus T.
  - Security: Priya S.
  - Engineering: Brad C.`}</pre>
        <p>
          Humans still own the call. The agent proposes, the forum
          disposes.
        </p>
      </>
    ),
  },
  {
    title: "4. The registry becomes queryable",
    body: (
      <>
        <p className="mb-3">
          Once ratified, the theme is queryable by every other agent in
          the program — the Mapping Agent uses it to evaluate code, the
          Review Agent uses it at merge gates, audit dashboards roll it
          up for the CCO.
        </p>
        <p className="text-stone-600 text-sm">
          Note for this demo: themes are pre-loaded as input fixtures.
          Theme synthesis (steps 1–3 above) is its own demo.
        </p>
      </>
    ),
  },
];

const TECHNICAL_STEPS = [
  {
    title: "1. The deterministic substrate",
    body: (
      <>
        <p className="mb-3">
          When you click run, the server spawns two deterministic tools
          before any LLM gets involved:
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-3">
          <li>
            <strong>Semgrep</strong> — runs taint-mode rules derived
            from each theme&apos;s <code>triggers</code> /
            <code> sanitizers</code> / <code>sinks</code>. Output is a
            JSON list of rule_id + file + line + matched code +
            theme/control metadata.
          </li>
          <li>
            <strong>Python AST pass</strong> — walks every <code>.py</code>{" "}
            file and emits a coarse call graph of cross-module function
            calls. Provides the structural skeleton for the trace
            diagrams.
          </li>
        </ul>
        <p>
          Both run server-side as subprocesses. No LLM has seen the code
          yet.
        </p>
      </>
    ),
  },
  {
    title: "2. The agent does the reasoning",
    body: (
      <>
        <p className="mb-3">
          Claude Opus 4.7 receives the registry, the codebase contents,
          the Semgrep findings, and the call graph. It produces three
          trace artifacts via a <code>submit_trace</code> tool, narrating
          its reasoning in plain text between calls.
        </p>
        <p className="mb-3">
          The model does NOT decide regulatory scope. The registry is
          authoritative. The model&apos;s job is to evaluate whether the
          findings tell a green / yellow / red story for each flow,
          ground each judgment in a specific theme record, and produce
          audit-ready output.
        </p>
        <p className="text-stone-600 text-sm">
          Conversation runs as a multi-turn loop — model submits a
          trace, server replies with a tool_result, model submits the
          next, until all three are in.
        </p>
      </>
    ),
  },
  {
    title: "3. Streaming over Server-Sent Events",
    body: (
      <>
        <p className="mb-3">
          The <code>/api/run</code> route streams progress as SSE. Each
          phase emits <code>phase_started</code> /{" "}
          <code>phase_completed</code> events. Claude&apos;s text tokens
          stream as <code>narration_token</code> events; tool calls
          materialize as <code>trace_drafted</code> events the moment
          they parse.
        </p>
        <p className="mb-3">
          The UI you&apos;re looking at is just a thin client over that
          stream — phase rows that collapse on completion, traces that
          accumulate in the left drawer, and the live narration you can
          watch arrive token by token.
        </p>
        <p>
          The codebase under analysis is real Python (it parses, it
          imports, Semgrep traces it genuinely). The external
          integrations — Stripe, KMS, the DB — are stubbed because the
          demo doesn&apos;t need to charge a card to prove the analysis
          works.
        </p>
      </>
    ),
  },
  {
    title: "4. Two endpoints, two artifacts",
    body: (
      <>
        <p className="mb-3">
          The backend exposes two SSE routes you can watch live:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mb-3 text-sm">
          <li>
            <code>/api/run-map</code> — reads the YAML registry, has
            Claude write a plain-English summary per theme, emits{" "}
            <code>theme_summarized</code> events.
          </li>
          <li>
            <code>/api/run</code> — runs Semgrep + the AST pass + the
            multi-turn Claude loop, emits <code>trace_drafted</code>{" "}
            events with the full v7-shaped <code>compliance_record</code>{" "}
            (and a draft <code>incident_report</code> for red traces).
          </li>
        </ul>
        <p className="mb-3">
          Both produce structured JSON artifacts you can inspect in the
          Artifact tab of each trace. That JSON is the same source of
          truth a compliance auditor would consume — the visual
          diagrams and the natural-language rationale are renders of it.
        </p>
      </>
    ),
  },
  {
    title: "5. Source",
    body: (
      <>
        <p className="mb-3">
          Public repo:{" "}
          <a
            href="https://github.com/bcoughlin/compliance-mapping-demo"
            target="_blank"
            rel="noreferrer"
            className="underline text-stone-900"
          >
            bcoughlin/compliance-mapping-demo
          </a>
          . Read the code, copy the rules, fork the registry. Every
          deterministic claim in this demo can be reproduced from your
          own checkout.
        </p>
        <p className="text-stone-600 text-sm">
          The plan that drove the build is in <code>vibeplan/</code>.
          The reference written submission is in the repo root.
        </p>
      </>
    ),
  },
];

export function IntroTour({ open, onClose }: IntroTourProps) {
  // Linear flow: compliance 1..4 → technical 1..4 → done.
  // Tabs are navigation shortcuts, not separate flows.
  const [step, setStep] = useState(0);

  if (!open) return null;

  const totalSteps = COMPLIANCE_STEPS.length + TECHNICAL_STEPS.length;
  const inCompliance = step < COMPLIANCE_STEPS.length;
  const sectionStep = inCompliance ? step : step - COMPLIANCE_STEPS.length;
  const currentSteps = inCompliance ? COMPLIANCE_STEPS : TECHNICAL_STEPS;
  const current = currentSteps[sectionStep];
  const isLast = step === totalSteps - 1;
  const isFirstOfTechnical = step === COMPLIANCE_STEPS.length;

  function dismiss() {
    setStep(0);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4">
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full h-[70vh] overflow-hidden grid"
        style={{ gridTemplateRows: "auto 1fr auto" }}
      >
        {/* Tabs */}
        <div className="flex border-b border-stone-200">
          <TabButton
            active={inCompliance}
            onClick={() => setStep(0)}
          >
            How this works (compliance)
          </TabButton>
          <TabButton
            active={!inCompliance}
            onClick={() => setStep(COMPLIANCE_STEPS.length)}
          >
            How this works (technical)
          </TabButton>
          <button
            type="button"
            onClick={dismiss}
            className="ml-auto px-4 text-stone-400 hover:text-stone-700 text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-6 min-h-0">
          {isFirstOfTechnical && (
            <div className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-2">
              Now switching to the technical track
            </div>
          )}
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            {current.title}
          </h2>
          <div className="text-stone-700 leading-relaxed">{current.body}</div>
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 px-6 py-3 flex items-center justify-between bg-stone-50 rounded-b-lg">
          <div className="flex gap-1.5">
            {currentSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i === sectionStep
                    ? "bg-stone-800"
                    : i < sectionStep
                      ? "bg-stone-500"
                      : "bg-stone-300"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="text-sm text-stone-600 hover:text-stone-900 px-3 py-1.5"
              >
                Back
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="text-sm bg-stone-900 text-white hover:bg-stone-700 px-4 py-1.5 rounded-md"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={dismiss}
                className="text-sm bg-stone-900 text-white hover:bg-stone-700 px-4 py-1.5 rounded-md"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
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
      className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors
        ${
          active
            ? "border-stone-900 text-stone-900"
            : "border-transparent text-stone-500 hover:text-stone-800"
        }`}
    >
      {children}
    </button>
  );
}
