import { NextRequest } from "next/server";
import path from "node:path";

import { runSemgrep } from "@/lib/semgrep";
import { buildCallGraph } from "@/lib/callgraph";
import { readRegistry, readCodebase } from "@/lib/inputs";
import { streamMappingRun } from "@/lib/claude";
import { encodeSSE, nowIso } from "@/lib/sse";
import type { RunEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // Lambda max for Amplify SSR; ample.

export async function GET(_req: NextRequest) {
  const projectRoot = process.cwd();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (event: RunEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch {
          // Client disconnected; stop trying to write.
          closed = true;
        }
      };

      // Heartbeat — write an SSE comment every 25s so any idle-timeout
      // proxy in front of the app (App Runner's load balancer) doesn't
      // consider the stream dead. The leading colon makes this a
      // comment that the EventSource client will ignore.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 25_000);

      const runId = `run-${Date.now()}`;
      const t = (label: string, start: number) =>
        console.log(JSON.stringify({ runId, event: label, ms: Date.now() - start }));

      try {
        // ── Phase: semgrep
        console.log(JSON.stringify({ runId, event: "phase_start", phase: "semgrep" }));
        const t0 = Date.now();
        send({
          type: "phase_started",
          phase: "semgrep",
          message: "Scanning sample_codebase/ with Semgrep...",
          at: nowIso(),
        });

        const findings = await runSemgrep(projectRoot, "semgrep", "sample_codebase");
        t("phase_done:semgrep", t0);

        send({
          type: "phase_completed",
          phase: "semgrep",
          summary: `Scanned ${findings.length === 0 ? "clean" : `${findings.length} finding${findings.length === 1 ? "" : "s"}`}`,
          detail: findings
            .map((f) => `${f.file}:${f.start_line} — ${f.rule_id}`)
            .join("\n"),
          at: nowIso(),
        });

        // ── Phase: callgraph
        console.log(JSON.stringify({ runId, event: "phase_start", phase: "callgraph" }));
        const t1 = Date.now();
        send({
          type: "phase_started",
          phase: "callgraph",
          message: "Building call graph from AST...",
          at: nowIso(),
        });

        const callGraph = await buildCallGraph(projectRoot, "sample_codebase");
        t("phase_done:callgraph", t1);

        const crossModule = callGraph.filter(
          (e) => e.target_file && e.target_file !== e.source_file,
        );
        const fileCount = new Set(callGraph.map((e) => e.source_file)).size;

        const sampleLines = crossModule.slice(0, 12).map((e) => {
          const src = e.source_file.replace(/^sample_codebase\//, "");
          const tgt = (e.target_file ?? "?").replace(/^sample_codebase\//, "");
          return `${src}:${e.source_line} → ${tgt} (.${e.target_function})`;
        });
        const remainder = crossModule.length - sampleLines.length;
        const detail =
          [
            `${callGraph.length} edges across ${fileCount} files (${crossModule.length} cross-module)`,
            "",
            ...sampleLines,
            remainder > 0 ? `… and ${remainder} more cross-module edges` : "",
          ]
            .filter(Boolean)
            .join("\n");

        send({
          type: "phase_completed",
          phase: "callgraph",
          summary: `Resolved ${callGraph.length} edges (${crossModule.length} cross-module)`,
          detail,
          at: nowIso(),
        });

        // ── Phase: narrate
        console.log(JSON.stringify({ runId, event: "phase_start", phase: "narrate" }));
        const t2 = Date.now();
        send({
          type: "phase_started",
          phase: "narrate",
          message: "Asking Claude to narrate the findings against the registry...",
          at: nowIso(),
        });

        const registryYaml = await readRegistry(projectRoot);
        const codebaseFiles = await readCodebase(projectRoot, "sample_codebase");

        const result = await streamMappingRun(
          {
            registryYaml,
            codebaseFiles,
            semgrepFindings: findings,
            callGraph,
          },
          {
            onTextDelta: (text) => {
              send({
                type: "narration_token",
                text,
                at: nowIso(),
              });
            },
            onTraceComplete: (trace) => {
              console.log(JSON.stringify({ runId, event: "trace_drafted", severity: trace.severity, ms: Date.now() - t2 }));
              send({ type: "trace_drafted", trace, at: nowIso() });
            },
            onIncidentReport: (traceId, report) => {
              console.log(JSON.stringify({ runId, event: "incident_report_drafted", ms: Date.now() - t2 }));
              send({ type: "trace_updated", traceId, incident_report: report, at: nowIso() });
            },
          },
        );
        t("phase_done:narrate", t2);

        send({
          type: "phase_completed",
          phase: "narrate",
          summary: `Drafted ${result.traces.length} trace${result.traces.length === 1 ? "" : "s"}`,
          detail: result.traces
            .map((t) => {
              const sev = (t?.severity ?? "?").toString().toUpperCase();
              const label = t?.label ?? "(unlabeled)";
              return `${sev} — ${label}`;
            })
            .join("\n"),
          at: nowIso(),
        });

        console.log(JSON.stringify({ runId, event: "run_completed", traces: result.traces.length, findings: findings.length }));
        send({
          type: "run_completed",
          total_findings: findings.length,
          total_traces: result.traces.length,
          at: nowIso(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ runId, event: "run_error", message }));
        send({
          type: "run_error",
          message,
          at: nowIso(),
        });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          try {
            // Send a trailing comment to flush any buffered bytes before
            // closing — prevents ERR_INCOMPLETE_CHUNKED_ENCODING in prod.
            controller.enqueue(encoder.encode(": end\n\n"));
            await new Promise((r) => setTimeout(r, 50));
            controller.close();
          } catch {
            // already closed
          }
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
