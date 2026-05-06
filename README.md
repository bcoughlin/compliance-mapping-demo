# Compliance Mapping Demo

A working demo of a Compliance Mapping Agent. Given a small synthetic Python payment service that has been pre-tagged in regulatory scope (PCI/GLBA), the agent traces how regulated data moves through the code, classifies each trace by risk against a versioned theme registry, and produces an audit-ready artifact for each finding — including a draft incident report when something dangerous is caught.

This is a companion to a written submission. The submission shows the design on paper. This shows the substrate working.

---

## What this demonstrates

- **Honest tool boundary.** Semgrep does the deterministic dataflow (sources → sanitizers → sinks). A Python AST pass produces the call graph. Claude Opus 4.7 narrates the findings and grounds them in specific regulatory citations. No wizard-of-Oz.
- **Pre-tagged scope.** The codebase is in regulatory scope because humans (the governance forum) said so — not because an LLM inferred it. The agent's job is evaluation, not scoping.
- **Three planted scenarios.** Green checkout (clean), yellow reporting (compliant data handling but missing evidence), red refund (PAN reaches an audit-log sink without sanitization). The red one mirrors a failure mode documented in the reference RCA in the source repo.
- **Live, under reviewer control.** The agent runs per-session when the visitor clicks "Run mapping." Streaming output renders the way tool calls render in modern Claude UIs — active phase expanded, completed phases collapse to a one-line result, click to expand.

---

## Architecture

- **Next.js 15 + App Router**, deployed on AWS Amplify (Lambda SSR).
- **`/api/run`** — Server-Sent Events route that orchestrates Semgrep + AST + Anthropic SDK and streams progress to the client.
- **Three-pane UI** — trace list (left), Mermaid diagram with risk-colored edges (middle), code view with line-level highlights (right). Plus an Artifact tab for the v7 JSON output.
- **First-visit auto-tour** with two tracks — Compliance and Technical — to set context for whichever lens the reviewer is using.

---

## Repository layout

```
app/                 — Next.js application (UI + API)
sample_codebase/     — synthetic Python payment service (real Python; integrations stubbed)
registry/            — theme YAML files (cardholder data, PFD, cryptographic keys)
semgrep/             — taint rules derived from the registry
lib/                 — TypeScript helpers (SSE, Semgrep wrapper, AST → call graph, Claude wrapper)
fixtures/            — last successful run cached as a fallback
vibeplan/            — design/implementation plan for this build
vibespark/           — captured ideas surfaced during the build
```

---

## Local development

```bash
npm install
cp .env.example .env.local      # add ANTHROPIC_API_KEY
npm run dev
```

Open <http://localhost:3000>.

---

## Status

In active build. See `vibeplan/20260505_plan_1_compliance_mapping_demo.md` for the current design.
