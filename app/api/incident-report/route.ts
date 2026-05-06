import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { encodeSSE, nowIso } from "@/lib/sse";
import type { Trace, IncidentReportDraft } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function readEnvWithFallback(name: string): string {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    const filePath = path.join(process.cwd(), ".env.local");
    const contents = fs.readFileSync(filePath, "utf-8");
    const match = contents.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (match) return match[1].trim();
  } catch { /* .env.local missing */ }
  return "";
}

const TOOL = {
  name: "submit_incident_report",
  description: "Submit the completed RCA / incident report draft.",
  input_schema: {
    type: "object" as const,
    required: ["rca_id","title","severity","status","short_hash","date","summary","timeline","five_whys","control_mapping","proposed_remediation"],
    properties: {
      rca_id: { type: "string" },
      title: { type: "string" },
      severity: { type: "string", enum: ["S1","S2","S3","S4"] },
      status: { type: "string" },
      short_hash: { type: "string" },
      date: { type: "string" },
      summary: { type: "string" },
      timeline: { type: "array", items: { type: "object", properties: { at: { type: "string" }, event: { type: "string" } } } },
      five_whys: { type: "array", items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } } } },
      control_mapping: { type: "array", items: { type: "object", properties: { framework: { type: "string" }, control: { type: "string" }, operated_as_designed: { type: "string", enum: ["yes","no","partial"] }, note: { type: "string" } } } },
      proposed_remediation: { type: "array", items: { type: "string" } },
    },
  },
};

export async function POST(req: NextRequest) {
  const trace = (await req.json()) as Trace;
  const apiKey = readEnvWithFallback("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response("ANTHROPIC_API_KEY not set", { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(encodeSSE(event as Parameters<typeof encodeSSE>[0]))); }
        catch { closed = true; }
      };

      try {
        const client = new Anthropic({ apiKey });
        const prompt = `You are a compliance engineering lead writing a draft RCA for a hard finding in a payment service.

RED trace summary:
- Trace ID: ${trace.trace_id}
- Label: ${trace.label}
- Files: ${trace.files.join(", ")}
- Rationale: ${trace.rationale_markdown}
- Failure points: ${JSON.stringify(trace.compliance_record.failure_points)}
- Regulatory tags: ${JSON.stringify(trace.compliance_record.regulatory_tags)}

Write a concise, first-person RCA document (operator voice — direct, no filler) and call submit_incident_report.
rca_id format: RCA-{short_hash}-{YYYY-MM-DD}. Today: ${new Date().toISOString().slice(0,10)}.`;

        const apiStream = client.messages.stream({
          model: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5",
          max_tokens: 4000,
          tools: [TOOL],
          messages: [{ role: "user", content: prompt }],
        });

        let jsonAccum = "";
        for await (const event of apiStream) {
          if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              send({ type: "rca_token", text: event.delta.text, at: nowIso() });
            } else if (event.delta.type === "input_json_delta") {
              jsonAccum += event.delta.partial_json;
              send({ type: "rca_token", text: event.delta.partial_json, at: nowIso() });
            }
          }
        }

        const report = JSON.parse(jsonAccum) as IncidentReportDraft;
        send({ type: "rca_completed", report, at: nowIso() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "rca_error", message, at: nowIso() });
      } finally {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(": end\n\n"));
            await new Promise((r) => setTimeout(r, 50));
            controller.close();
          } catch { /* already closed */ }
          closed = true;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
