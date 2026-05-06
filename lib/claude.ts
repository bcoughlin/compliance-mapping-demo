import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type {
  SemgrepFinding,
  CallGraphEdge,
  Trace,
} from "./types";

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-7";

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

For the RED trace, additionally produce a draft incident report.

Voice in rationale_markdown AND in your between-tool-call narration:
first-person, direct, operator-pragmatic. The first-person speaker is
the engineer who deployed this agent ("I built this control to
surface...", "What I'm flagging here is..."). No filler; no
product-marketing phrasing.

Format your between-tool-call narration as short paragraphs separated
by blank lines (\\n\\n). One thought per paragraph — what flow you
are about to evaluate, what the deterministic findings say, what your
read on it is. The streaming UI renders \\n\\n as a paragraph break;
do not produce one wall of run-on text.

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
file. Each edge labeled with a one-line summary of what flows
("token", "PAN", "encrypted SSN", etc.).

When you have draft a trace, call submit_trace() with the full
artifact. Between tool calls, narrate what you are doing in plain
text — those tokens stream live to the user.`;

const SUBMIT_TRACE_TOOL = {
  name: "submit_trace",
  description:
    "Submit one fully-formed trace artifact — call this exactly once per trace.",
  input_schema: {
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
      incident_report: {
        type: "object",
        description:
          "Required for RED traces; omitted for GREEN and YELLOW.",
        required: [
          "rca_id",
          "title",
          "severity",
          "status",
          "short_hash",
          "date",
          "summary",
          "timeline",
          "five_whys",
          "control_mapping",
          "proposed_remediation",
        ],
        properties: {
          rca_id: { type: "string", description: "Format: RCA-{short-hash}-{YYYY-MM-DD}" },
          title: { type: "string" },
          severity: { type: "string", enum: ["S1", "S2", "S3", "S4"] },
          status: { type: "string" },
          short_hash: { type: "string" },
          date: { type: "string" },
          summary: { type: "string" },
          timeline: {
            type: "array",
            items: {
              type: "object",
              required: ["at", "event"],
              properties: {
                at: { type: "string" },
                event: { type: "string" },
              },
            },
          },
          five_whys: {
            type: "array",
            items: {
              type: "object",
              required: ["question", "answer"],
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
              },
            },
          },
          control_mapping: {
            type: "array",
            items: {
              type: "object",
              required: ["framework", "control", "operated_as_designed", "note"],
              properties: {
                framework: { type: "string" },
                control: { type: "string" },
                operated_as_designed: { type: "string", enum: ["yes", "no", "partial"] },
                note: { type: "string" },
              },
            },
          },
          proposed_remediation: {
            type: "array",
            items: { type: "string" },
          },
        },
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

Produce exactly three traces — GREEN checkout, YELLOW reporting, RED
refund — by calling submit_trace once for each. Narrate briefly in
plain text between tool calls so the human reviewer can follow your
reasoning live.`;
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
  const conversation: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: userMessage(inputs),
    },
  ];

  // Loop until the model decides it's done (stop_reason !== "tool_use").
  // Cap at 8 turns as a safety net.
  for (let turn = 0; turn < 8; turn++) {
    const stream = client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_TRACE_TOOL],
      messages: conversation,
    });

    const toolCallsInTurn: Array<{
      id: string;
      name: string;
      jsonAccum: string;
    }> = [];
    const indexToToolCall = new Map<number, number>();

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "tool_use" && block.name === "submit_trace") {
          const idx =
            toolCallsInTurn.push({
              id: block.id,
              name: block.name,
              jsonAccum: "",
            }) - 1;
          indexToToolCall.set(event.index, idx);
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          callbacks.onTextDelta(delta.text);
        } else if (delta.type === "input_json_delta") {
          const tcIdx = indexToToolCall.get(event.index);
          if (tcIdx !== undefined) {
            toolCallsInTurn[tcIdx].jsonAccum += delta.partial_json;
          }
        }
      } else if (event.type === "content_block_stop") {
        const tcIdx = indexToToolCall.get(event.index);
        if (tcIdx !== undefined) {
          const tc = toolCallsInTurn[tcIdx];
          let parsed: Trace | null = null;
          try {
            parsed = JSON.parse(tc.jsonAccum) as Trace;
          } catch (err) {
            console.error(
              "[claude] failed to parse submit_trace JSON:",
              err,
              tc.jsonAccum,
            );
          }
          if (parsed) {
            // Deduplicate — skip if we already have a trace with this severity.
            if (traces.some((t) => t.severity === parsed!.severity)) {
              console.warn(`[claude] duplicate ${parsed.severity} trace ignored`);
            } else {
              traces.push(parsed);
              try {
                callbacks.onTraceComplete(parsed);
              } catch (err) {
                // The controller is closed if the SSE client disconnected.
                // Log once and let the agent loop continue — its work is
                // done, the trace is in the traces[] list either way.
                console.error("[claude] onTraceComplete callback threw:", err);
              }
            }
          }
        }
      }
    }

    const finalMessage = await stream.finalMessage();

    // Echo the assistant's full reply (text + tool_use) back into the conversation.
    conversation.push({
      role: "assistant",
      content: finalMessage.content,
    });

    if (finalMessage.stop_reason !== "tool_use" || traces.length >= 3) {
      break;
    }

    // Server-side visual separator so each trace's narration is
    // clearly bounded in the live stream. This is metadata, not
    // model output.
    callbacks.onTextDelta("\n\n———\n\n");

    // Reply with tool_result blocks so the model can keep going.
    const submitted = traces.map((t) => t.severity).join(", ");
    const remaining = (["green", "yellow", "red"] as const)
      .filter((s) => !traces.some((t) => t.severity === s))
      .join(", ");
    conversation.push({
      role: "user",
      content: toolCallsInTurn.map((tc) => ({
        type: "tool_result" as const,
        tool_use_id: tc.id,
        content: remaining
          ? `Trace recorded. Submitted so far: ${submitted}. Still needed: ${remaining}. Narrate and submit the next one.`
          : `All three traces recorded (${submitted}). End your turn now — do not submit any more traces.`,
      })),
    });
  }

  return { traces };
}
