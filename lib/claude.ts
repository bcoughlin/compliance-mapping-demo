import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type {
  SemgrepFinding,
  CallGraphEdge,
  Trace,
} from "./types";

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

/**
 * Read an env var with a fallback to .env.local if the process env value
 * is empty. Necessary because Next.js's env loader does not override
 * variables already set in process.env (even when set to empty string),
 * so a parent shell with `ANTHROPIC_API_KEY=""` exported masks the
 * value in our local file.
 */
function readEnvWithFallback(name: string): string {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  try {
    const filePath = path.join(process.cwd(), ".env.local");
    const contents = fs.readFileSync(filePath, "utf-8");
    const match = contents.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (match) return match[1].trim();
  } catch {
    // .env.local missing → fine, return empty
  }

  return "";
}

export interface AgentInputs {
  registryYaml: { filename: string; contents: string }[];
  codebaseFiles: { path: string; contents: string }[];
  semgrepFindings: SemgrepFinding[];
  callGraph: CallGraphEdge[];
}

export interface NarrationCallbacks {
  onTextDelta(text: string): void;
  onTraceComplete(trace: Trace): void;
}

const SYSTEM_PROMPT = `You are the Compliance Mapping Agent for a payroll/payments platform's
agentic SDLC. You analyze a small Python payment service that has
ALREADY been tagged in regulatory scope (PCI-DSS, GLBA) by humans —
the governance forum makes scoping decisions, not you.

Your job: trace how regulated data moves through the codebase, classify
each trace by risk against the provided theme registry, and produce
audit-ready artifacts that cite the specific theme record and
regulatory requirement that anchors each finding.

Hard constraints:
  - You do NOT invent regulatory scope. The registry is authoritative.
  - You do NOT use the absence of a theme to mean "safe" — only the
    presence of a theme grants you authority to classify.
  - When you cite a regulation, name the framework, requirement number,
    and quote the requirement text from the registry verbatim.
  - When the agent is uncertain, you tier UP, not down.

You produce exactly THREE traces for this codebase:

  1. GREEN — the checkout flow. PAN enters via api/payment_handler.checkout,
     is sanitized through tokenization.tokenize, and only token IDs
     reach storage and the audit log. All required evidence is present.

  2. YELLOW — the reporting flow. NPI (SSN, bank account) is fetched
     from encrypted storage and returned in the HTTP response. Encryption
     at rest is in place (control PFD_001), but no IAM-verification
     function is called before the fetch — control PFD_002 evidence is
     missing.

  3. RED — the refund flow. Raw PAN reaches the audit log inside
     services/refund_processor.py BEFORE going through tokenize().
     PCI-DSS 3.4.1 violation. Hard finding.

Voice in rationale_markdown AND in your narration: first-person,
direct, operator-pragmatic. The first-person speaker is the engineer
who deployed this agent. No filler; no product-marketing phrasing.

Treat the codebase as a real production service under review. Do NOT
use meta-language that breaks frame: never say "planted", "seeded",
"staged", "intentional", "demo", "example", "sample", or otherwise
suggest the violation was placed for illustration. The RED finding is
a genuine bug in this service. Describe it the way you would describe
a real hard finding caught in CI.

Format narration as short paragraphs separated by blank lines (\\n\\n).
One thought per paragraph. The streaming UI renders \\n\\n as a
paragraph break; do not produce one wall of run-on text.

Mermaid diagrams must use top-to-bottom orientation (flowchart TB),
not LR — the demo renders them in a vertical pane:

\`\`\`
flowchart TB
    REQ([request]):::reqStyle --> H[api.payment_handler.checkout]
    H -->|"line 26"| T[tokenization.tokenize]:::sanitizer
    T -->|token| P[payment_processor.charge]
    ...
    classDef reqStyle fill:#fef3c7,stroke:#d97706
    classDef sanitizer fill:#dcfce7,stroke:#16a34a
    classDef sink fill:#fecaca,stroke:#dc2626
\`\`\`

Color-code edges/nodes by risk. Each node label is a function or
file. Each edge labeled with a one-line summary of what flows.`;

const TRACE_ITEM_SCHEMA = {
  type: "object" as const,
  required: [
    "trace_id",
    "label",
    "severity",
    "files",
    "mermaid",
    "rationale_markdown",
    "line_annotations",
    "compliance_record",
  ],
  properties: {
    trace_id: { type: "string" },
    label: { type: "string", description: "Short label for the trace list — e.g. 'Refund flow'." },
    severity: { type: "string", enum: ["green", "yellow", "red"] },
    files: {
      type: "array",
      items: { type: "string" },
      description: "Repo-relative file paths involved in this trace.",
    },
    mermaid: {
      type: "string",
      description: "Full Mermaid flowchart source for this trace.",
    },
    rationale_markdown: {
      type: "string",
      description:
        "First-person markdown narration for the human reviewer. 100–300 words.",
    },
    line_annotations: {
      type: "array",
      items: {
        type: "object",
        required: ["file", "line", "severity", "citation", "note"],
        properties: {
          file: { type: "string" },
          line: { type: "number" },
          severity: { type: "string", enum: ["green", "yellow", "red"] },
          citation: {
            type: "object",
            required: ["theme_id", "theme_version", "control_id", "framework", "requirement", "requirement_text"],
            properties: {
              theme_id: { type: "string" },
              theme_version: { type: "string" },
              control_id: { type: "string" },
              framework: { type: "string" },
              requirement: { type: "string" },
              requirement_text: { type: "string" },
            },
          },
          note: { type: "string" },
        },
      },
    },
    compliance_record: {
      type: "object",
      description:
        "The full v7-schema audit artifact for this trace. This is the ONLY field that contains the formal record; do not nest other top-level trace fields inside it.",
      required: [
        "artifact_version",
        "trace_id",
        "timestamp_utc",
        "decision",
        "risk_tier",
        "regulatory_tags",
        "evidence_state",
        "rationale",
        "failure_points",
      ],
      properties: {
        artifact_version: { type: "string" },
        trace_id: { type: "string" },
        timestamp_utc: { type: "string" },
        decision: { type: "string", enum: ["OK", "REVIEW", "BLOCK"] },
        risk_tier: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        regulatory_tags: {
          type: "array",
          items: {
            type: "object",
            required: ["theme_id", "framework", "requirement", "triggered_by"],
            properties: {
              theme_id: { type: "string" },
              framework: { type: "string" },
              requirement: { type: "string" },
              triggered_by: { type: "string" },
            },
          },
        },
        evidence_state: {
          type: "object",
          required: ["sanitizer_present", "encryption_at_rest", "iam_verification", "notes"],
          properties: {
            sanitizer_present: { type: "boolean" },
            encryption_at_rest: { type: "boolean" },
            iam_verification: { type: "boolean" },
            notes: { type: "array", items: { type: "string" } },
          },
        },
        rationale: { type: "string" },
        failure_points: {
          type: "array",
          items: {
            type: "object",
            required: ["file", "line", "description"],
            properties: {
              file: { type: "string" },
              line: { type: "number" },
              description: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const SUBMIT_ALL_TRACES_TOOL = {
  name: "submit_all_traces",
  description:
    "Submit all three trace artifacts (green, yellow, red) in a single call. The traces array MUST contain exactly three elements, in order: green, yellow, red.",
  input_schema: {
    type: "object" as const,
    required: ["traces"],
    properties: {
      traces: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        description: "Exactly three trace artifacts, ordered green → yellow → red.",
        items: TRACE_ITEM_SCHEMA,
      },
    },
  },
};

function userMessage(inputs: AgentInputs): string {
  const registryBlob = inputs.registryYaml
    .map((r) => `### registry/${r.filename}\n\n\`\`\`yaml\n${r.contents}\n\`\`\``)
    .join("\n\n");

  const codebaseBlob = inputs.codebaseFiles
    .map((f) => `### ${f.path}\n\n\`\`\`python\n${f.contents}\n\`\`\``)
    .join("\n\n");

  const findingsBlob = JSON.stringify(inputs.semgrepFindings, null, 2);
  const callGraphBlob = JSON.stringify(inputs.callGraph, null, 2);

  return `# Theme Registry (authoritative)

${registryBlob}

# Codebase under analysis

${codebaseBlob}

# Semgrep findings (deterministic)

\`\`\`json
${findingsBlob}
\`\`\`

# Call graph (deterministic, file-level)

\`\`\`json
${callGraphBlob}
\`\`\`

---

Produce your full response now. It must contain:
  - 2–3 short paragraphs of plain-text narration (not one per trace)
  - one submit_all_traces tool call carrying all three traces, in order:
    [green, yellow, red].

End your turn after the tool call.`;
}

export async function streamMappingRun(
  inputs: AgentInputs,
  callbacks: NarrationCallbacks,
): Promise<{ traces: Trace[] }> {
  const apiKey = readEnvWithFallback("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set (checked process.env and .env.local)");
  }

  const client = new Anthropic({ apiKey });

  const traces: Trace[] = [];
  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_ALL_TRACES_TOOL],
    messages: [{ role: "user", content: userMessage(inputs) }],
  });

  let toolJsonAccum = "";
  let toolOpened = false;

  for await (const event of stream) {
    if (event.type === "content_block_start") {
      const block = event.content_block;
      if (block.type === "tool_use") {
        toolOpened = true;
        // Visible placeholder while the model writes the JSON. The
        // cursor at the end of liveText animates by itself; we don't
        // stream input_json_delta tokens to the UI because the JSON
        // is large and not user-readable mid-generation.
        callbacks.onTextDelta("\n\n```text\ndrafting trace artifacts…\n");
      }
    } else if (event.type === "content_block_delta") {
      const delta = event.delta;
      if (delta.type === "text_delta") {
        callbacks.onTextDelta(delta.text);
      } else if (delta.type === "input_json_delta") {
        // Accumulate server-side for parsing on stop, do not forward to UI.
        toolJsonAccum += delta.partial_json;
      }
    } else if (event.type === "content_block_stop") {
      if (toolOpened && toolJsonAccum.length > 0) {
        callbacks.onTextDelta("```\n\n");

        let parsed: { traces?: Trace[] } | null = null;
        try {
          parsed = JSON.parse(toolJsonAccum) as { traces?: Trace[] };
        } catch (err) {
          console.error("[claude] failed to parse submit_all_traces JSON:", err);
        }
        if (parsed?.traces && Array.isArray(parsed.traces)) {
          for (const trace of parsed.traces) {
            if (traces.some((t) => t.severity === trace.severity)) {
              console.warn(`[claude] duplicate ${trace.severity} trace ignored`);
              continue;
            }
            traces.push(trace);
            try { callbacks.onTraceComplete(trace); } catch (err) {
              console.error("[claude] onTraceComplete callback threw:", err);
            }
          }
        }
        toolOpened = false;
        toolJsonAccum = "";
      }
    }
  }

  const finalMessage = await stream.finalMessage();
  console.log(JSON.stringify({
    event: "claude_turn",
    turn: 0,
    stop_reason: finalMessage.stop_reason,
    input_tokens: finalMessage.usage.input_tokens,
    output_tokens: finalMessage.usage.output_tokens,
    traces_so_far: traces.length,
  }));

  return { traces };
}
