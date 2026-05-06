# Compliance Mapping Agent Demo — Plan v2

*Author: Brad Coughlin*
*Date: 2026-05-05*
*Status: Aligned through conversation; ready to build*
*Capacity batch: `~/Code/claude-capacity/batches/20260505_gusto_mapping_demo.json` — 13 points, uncalibrated*

---

## Problem

The written submission (`v7-compliance-agent.md`, the RCA, the mapping artifact sample, the Exercise 3 memo) demonstrates judgment and systems thinking on paper. It does not demonstrate that the candidate can *ship*. The hiring panel — particularly the CCO — will read dozens of similarly-shaped AI-assisted submissions. A working, hosted demo collapses the distinction between candidates who can describe and candidates who can build.

The demo answers one question concretely: **what does the Compliance *Mapping* Agent actually do?** The Mapping Agent is the upstream context for everything else in the four-agent program. If it is convincing, the Review Agent, Intelligence Agent, and Adversarial Audit Agent have somewhere to stand. If it is not, the rest of the architecture is theoretical.

---

## Story arc

**Pass 1 (this build):** the agent maps a pre-tagged codebase and surfaces existing problems. Mostly Layer 1 work — Semgrep finds the flows, Claude narrates them in regulatory language. The demo header says this out loud. No wizard-of-Oz.

**Pass 2 (later, if it happens):** same agent, now wired up as a tool the Review Agent calls when a change arrives at the merge gate. Layer 2 reasoning lights up — substantive adequacy, drift, novel patterns. The role this is in service of is *enabling SDLC*, not being a wizard of compliance.

This plan covers Pass 1 only.

---

## Thesis

The Mapping Agent traces how regulated data moves through a pre-tagged codebase, classifies each trace by risk against a versioned theme registry, and produces a per-trace audit artifact citing the specific regulatory requirement that anchors each finding.

The agent does not invent regulatory scope. The codebase is tagged in-scope by humans (governance forum) before the agent runs — matching design assumption #1 in the written submission. The agent's job is the *evaluation*, not the scoping.

The honest tool boundary:
- **Semgrep** does the dataflow (sources → sanitizers → sinks). Deterministic.
- **Python `ast`** produces the structural call graph. Deterministic.
- **Claude Opus 4.7** reads the structured outputs plus the theme registry and produces the regulatory narration plus the per-trace risk classification. Reasoning.

Same shift-left honesty as the written submission: deterministic for the rule, LLM for the reasoning.

---

## Demo experience (what the hiring manager sees)

A hosted three-pane web app on AWS Amplify. The repo is **public** (confidence signal; reviewers can read the source).

### First-visit auto-tour (every visit, dismissable for the session only)

Two tabs at the top of the tour modal — reviewer picks their lens:

- **"How this works (compliance)"** — 4 steps, with real examples:
  1. Regulation published — show actual PCI-DSS 3.4 text
  2. Mapping Agent drafts a theme — show the proposed YAML, highlighting what came from the reg vs. what's Gusto-specific
  3. Governance forum ratifies — show signers (Compliance, Legal, Security, Engineering), version stamp, ratified-at date
  4. Registry now queryable — theme available to all downstream agents

- **"How this works (technical)"** — for engineering-shaped reviewers:
  - Tool boundary: Semgrep deterministic vs. Claude reasoning
  - Streaming architecture: SSE over Lambda
  - Real Python is being analyzed; integrations are stubbed
  - Theme registry is input here, agent output in production
  - Link to source repo

No "don't show again" — every visit is potentially a new reviewer.

**Voice — first person, Brad's voice.** All in-demo prose (the tour, the about page, the run button copy, error messages, the header) is written first-person as Brad. *"I built this to show what the Mapping Agent actually does — not theoretically, but actually."* / *"My thinking: the Mapping Agent is the upstream context for the rest of the four-agent program."* / *"What you're seeing here is real Python being analyzed by Semgrep — the integrations are stubbed because the demo doesn't need to charge a card to prove the point."* Direct, operator-pragmatic, no hedging where conviction is earned, honest hedging where it isn't. Not product copy. Not Claude's voice with Brad's name on it.

### Main screen

**Top bar:** "Run mapping" button. User triggers the agent.

When triggered, agent activity renders the way tool calls render in modern Claude UIs:

```
▸ Scanning api/payment_handler.py...           [live tokens streaming]
▸ Scanning services/tokenization.py...         [live tokens streaming]
✓ Scanned 7 files — 3 findings  [click to expand stream]
▸ Analyzing PAN flow through refund_processor... [Claude tokens streaming]
✓ Trace identified — RED: PAN reaches audit_logger (PCI 3.4)  [click to expand]
```

Active phase expanded with live output. Completed phases collapse to a one-line result. Click the ✓ to expand and see the full stream that ran. Disclosure-triangle pattern.

**Three panes (populate as traces are discovered):**

- **Left** — trace list. Each entry: severity badge (🟢🟡🔴), short label ("Refund flow"), file count.
- **Middle** — Mermaid diagram for the selected trace. Files are nodes, data flows are edges, both colored by risk. Tab toggle: **Diagram** | **Artifact** (artifact = v7 JSON schema output for the trace).
- **Right** — code view for whichever file you click in the middle pane. Shiki-rendered Python with green/yellow/red line highlights and a hover tooltip showing the regulatory citation (theme ID, framework, requirement, version).

### Dynamic incident report on red traces

When the red trace closes, the agent additionally produces a **draft incident report** as part of its output. Same Claude call, additional artifact alongside the per-trace JSON. Has the right shape (timeline, root cause, control mapping, remediation), explicitly labeled "DRAFT — human review required."

Naming convention: **`RCA-{short-commit-hash}-{YYYY-MM-DD}`** — anchors to the actual commit being analyzed, dated for human readability and sorting. Matches real incident-tracking conventions and ties cleanly to the v7 artifact schema's `change_id` field.

The hand-crafted `RCA-2026-Q1-014.md` from the written submission becomes a **reference example** on the About page, showing what a draft like this becomes after human investigation, remediation, and forum review.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       AWS Amplify (Lambda SSR)                        │
│                                                                        │
│  Browser (Next.js client)                                             │
│      │                                                                 │
│      └──→ /api/run  (Server-Sent Events, streaming)                   │
│             │                                                          │
│             ├──→ Semgrep subprocess  (file-by-file findings)          │
│             │       ↳ stream events as files complete                 │
│             │                                                          │
│             ├──→ Python AST pass  (call graph)                        │
│             │       ↳ stream events as edges resolve                  │
│             │                                                          │
│             └──→ Anthropic SDK (Claude Opus 4.7)                      │
│                     ↳ stream tokens for narration                     │
│                     ↳ structured output for trace artifact + RCA      │
│                                                                        │
│  Static assets:                                                       │
│    sample_codebase/    — synthetic Python                             │
│    registry/*.yaml     — theme registry (input here, output in prod)  │
│    semgrep/*.yaml      — taint rules derived from registry            │
│    fixtures/example.json — last successful run, served if API down    │
└──────────────────────────────────────────────────────────────────────┘
```

**Why AWS Amplify, not Vercel.** Brad already has Amplify. Lambda's 15-minute timeout removes the streaming-timeout concern that Vercel's 60–300s function limit would have introduced.

**Why live, not cached.** The user explicitly wants this under reviewer control. Pre-cached fixtures feel like vaporware. The agent runs live per session. A `fixtures/example.json` exists as a fallback only if the API misbehaves.

---

## The synthetic codebase

A small Python payment service, ~200–300 lines across 7 files. Real Python that real tools really analyze (parses, imports cleanly, structures real function calls, Semgrep traces it genuinely). External integrations (Stripe, KMS, DB) are **stubbed** — the demo doesn't need to charge a card to demonstrate that data-flow analysis works. Static structure is real; runtime behavior is mocked.

File paths deliberately echo `RCA-2026-Q1-014` Appendix A so the demo ties back to the written submission.

```
sample_codebase/
  api/
    payment_handler.py        # HTTP entrypoint; receives PAN
  services/
    tokenization.py           # tokenize(pan) → token (the sanitizer)
    payment_processor.py      # uses token only (clean path)
    refund_processor.py       # services/payments/refund/processor.py — RED
  storage/
    payment_store.py          # writes tokens, encrypted at rest
  audit/
    audit_logger.py           # services/payments/audit/logger.py — RED sink
  notifications/
    email_sender.py           # YELLOW: NPI flow with missing evidence
  utils/
    format_helpers.py         # services/payments/utils/format_helpers.py — has CVV bug
```

**Three planted scenarios:**

1. **Green — checkout.** `payment_handler` → `tokenize()` → `payment_processor` → `payment_store.save(token)` → `audit_logger.write(token_id)`. PAN never reaches a sink unsanitized. All required evidence present.

2. **Yellow — reporting.** `reporting_handler` → reads encrypted SSN from `payment_store` → returns to client. Data is encrypted at rest (control present), but the IAM evidence on who-can-call-this-endpoint is missing from the evidence bundle. Compliant data handling, incomplete evidence trail. Demonstrates the agent surfaces *evidence completeness*, not just data leakage.

3. **Red — refund.** `refund_processor` → `audit_logger.write(f"...PAN {full_pan}")`. PAN reaches log sink without going through `tokenize()`. This is the `pay-svc-4889` failure mode from the RCA, deliberately replicated. The demo agent catches what the v1.0.0 Review Agent missed in the post-mortem — narrative payoff, plus triggers the dynamic RCA generation.

---

## The theme registry

Three theme YAMLs, modeled on `mapping-artifact-sample.md`. Filenames describe what the data IS, not what regulates it — the registry's whole job is to be the abstraction layer between code and regulation. New regimes get added by editing a theme's `regulations:` block, not by renaming files.

```
registry/
  cardholder_data.yaml          # PCI-DSS 3.4 (PAN unreadable wherever stored)
  personal_financial_data.yaml  # GLBA Safeguards §314.4(c)
  cryptographic_keys.yaml       # PCI-DSS 3.5.1 (verbatim from sample)
```

Each theme has the same shape: `theme_id`, `theme_version`, `regulations[]`, `triggers`, `required_controls`, `required_evidence`. Semgrep rules derive from `triggers`; narration cites `required_controls` and `required_evidence`.

In production these would be **agent output** that the governance forum ratifies — the v7 design has the Mapping Agent synthesizing themes from regulatory text. For this demo they are **input fixtures** because theme synthesis is a separate (huge) demo, and the data-flow tracing is the part being shown. The intro tour's "compliance" tab makes this distinction explicit.

---

## Tooling decisions

| Layer | Tool | Why |
|---|---|---|
| Static parsing | tree-sitter (under Semgrep) | Industry standard. No reason to touch directly. |
| Dataflow / taint | **Semgrep CLI** + custom YAML rules | Open source, has a taint mode, JSON output. Real security teams use it — name carries weight. |
| Call graph | Python `ast` + small custom pass | ~50 lines. Produces the structural mermaid skeleton before coloring. |
| LLM reasoning | **Claude Opus 4.7** (streaming) | Higher quality narration. Cost negligible at three traces per session. Sonnet 4.6 fallback if rate-limited. |
| Frontend | **Next.js 15** (App Router) + Tailwind | Amplify deploys Next.js with SSR via Lambda. SSE streaming built in. |
| Mermaid render | `mermaid` JS library | Visual continuity with the policy flowchart in the written submission. |
| Code highlighting | `shiki` | Best Python highlighting in JS land. Supports per-line decorators for the colored overlay. |
| Hosting | **AWS Amplify** | Already have it; 15-minute Lambda timeout is comfortable for streaming. |

**Rejected:**
- *Pure-LLM tracing* — hallucinates on anything bigger than a toy.
- *CodeQL* — heavy setup, slow, overkill for 300 lines.
- *D3 force graph* — fancier visual but disconnected from the written submission's Mermaid vocabulary.
- *Vercel* — would have worked but Brad already runs Amplify and the timeout headroom is better.
- *Cached fixtures as default UX* — explicitly rejected; live runs only.

---

## Files to create

```
gusto-mapping-demo/
  vibeplan/
    20260505_plan_1_compliance_mapping_demo.md   # this file
  README.md                                       # demo overview, deploy steps
  .gitignore                                      # node_modules, .env
  package.json                                    # next, react, mermaid, shiki, tailwind
  next.config.js
  tsconfig.json
  tailwind.config.ts
  amplify.yml                                     # Amplify build spec

  app/
    layout.tsx                                    # global shell
    page.tsx                                      # main three-pane UI + run button
    about/page.tsx                                # references, including reference RCA
    api/
      run/route.ts                                # GET SSE — orchestrates Semgrep + AST + Claude
    components/
      Header.tsx
      IntroTour.tsx                               # two-track first-visit modal
      RunButton.tsx
      ActivityStream.tsx                          # collapsible phase log
      TraceList.tsx
      MermaidView.tsx
      CodeView.tsx
      ArtifactTab.tsx
      IncidentReport.tsx                          # dynamic RCA renderer

  lib/
    types.ts                                      # Trace, Finding, Theme, Artifact, IncidentReport
    sse.ts                                        # SSE helpers
    semgrep.ts                                    # subprocess wrapper, JSON parsing
    callgraph.ts                                  # ast → edge list
    claude.ts                                     # Anthropic SDK wrapper, streaming, structured output
    citations.ts                                  # theme_id → human-readable cite

  sample_codebase/
    api/payment_handler.py
    services/tokenization.py
    services/payment_processor.py
    services/refund_processor.py                  # has the planted red bug
    storage/payment_store.py
    audit/audit_logger.py
    notifications/email_sender.py
    utils/format_helpers.py                       # has the planted CVV bug

  registry/
    cardholder_data.yaml
    personal_financial_data.yaml
    cryptographic_keys.yaml

  semgrep/
    cardholder_sources.yaml
    pfd_sources.yaml
    log_sinks.yaml
    sanitizers.yaml

  fixtures/
    example_run.json                              # last successful run; fallback only
```

---

## Build sequence

Phased so the demo is shippable at the end of each phase, even if the next phase doesn't land.

**Phase 0 — Bootstrap.**
- `git init`, `.gitignore`, `gh repo create gusto-mapping-demo --public --source=. --push`.
- `npx create-next-app@latest` with TypeScript + Tailwind + App Router. Strip boilerplate.
- `amplify.yml` build spec; connect repo to Amplify; first deploy with empty page.
- Smoke test: deploy URL renders.

**Phase 1 — Static substrate.**
- Synthetic codebase (7 files). Verify `python -m compileall sample_codebase/`.
- Three theme YAMLs.
- Semgrep rules deriving from the themes. Run locally; confirm green/yellow/red findings appear as expected.
- Python `ast` call-graph pass; run locally; emits a JSON edge list.

**Phase 2 — Backend orchestration.**
- `/api/run` route: spawns Semgrep, runs AST pass, calls Claude (Opus 4.7) with structured output for trace artifacts + draft RCA.
- All three steps emit SSE events as they progress.
- Local end-to-end run produces the three traces and the red-trace incident report.

**Phase 3 — Frontend.**
- Run button + activity stream UI (live phase / collapsed completed phase).
- Trace list populates from SSE events.
- Mermaid view renders selected trace with colored edges; click node → set selected file.
- Code view renders selected file with line-level highlights and citation tooltips.
- Artifact tab renders v7 JSON pretty.
- Dynamic incident report renders for red trace.

**Phase 4 — Tour + polish.**
- Two-track intro tour modal (compliance / technical), auto-shown on every visit.
- About page with the reference RCA and architecture notes.
- Mobile-decent layout (the hiring manager might open the link on a phone).

**Phase 5 — Deploy and smoke.**
- Push; let Amplify build and deploy.
- Verify SSE streams correctly through Lambda.
- Test from incognito on desktop and mobile.
- Share link.

---

## Out of scope (Pass 1)

- The Compliance *Review* Agent. This demo is the *Mapping* Agent. Pass 2.
- Adversarial Audit Layer 3. Mapping Agent doesn't have one.
- Multi-language. Python only.
- User-uploaded code. Three planted scenarios. Paste-your-own is a v3 idea.
- Authentication / accounts.
- Live theme synthesis (themes are pre-authored input here; the intro tour explains they'd be agent output in production).
- Loom replay UI port. Mermaid-with-overlay is enough; full Loom port is a separate project.

---

## Open questions (carried forward)

- **Custom domain** — currently Amplify default URL. Subdomain of bradcoughlin.com is an option later; not a blocker.
- **Mobile UX** — three-pane layout doesn't naturally fit a phone. Need to decide stacking order or a "view trace artifact only" mobile mode.
- **Anthropic API key for the deployed app** — set as an Amplify environment variable. No client-side key exposure. Confirm Amplify secret-handling at deploy time.
- **Rate-limit fallback** — if Opus is rate-limited mid-session, do we fall back to Sonnet 4.6 transparently, or surface the failure to the user? Default to transparent fallback with a small inline note.

---

## What's *not* in this plan that informed it

- The CLAUDE.md update on chat-focus and the no-volunteered-time-estimates rule. Those changed how the plan is written, not what it builds.
- The `~/Code/claude-capacity` capacity-tracking system. The batch entry for this build is open; outcome will close it on completion. This batch is the first calibration data point in the system.
