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
      const send = (event: RunEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };

      try {
        // ── Phase: semgrep
        send({
          type: "phase_started",
          phase: "semgrep",
          message: "Scanning sample_codebase/ with Semgrep...",
          at: nowIso(),
        });

        const findings = await runSemgrep(projectRoot, "semgrep", "sample_codebase");

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
        send({
          type: "phase_started",
          phase: "callgraph",
          message: "Building call graph from AST...",
          at: nowIso(),
        });

        const callGraph = await buildCallGraph(projectRoot, "sample_codebase");

        send({
          type: "phase_completed",
          phase: "callgraph",
          summary: `Resolved ${callGraph.length} edges`,
          detail: `${new Set(callGraph.map((e) => e.source_file)).size} files contributed call sites`,
          at: nowIso(),
        });

        // ── Phase: narrate
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
              send({
                type: "trace_drafted",
                trace,
                at: nowIso(),
              });
            },
          },
        );

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

        send({
          type: "run_completed",
          total_findings: findings.length,
          total_traces: result.traces.length,
          at: nowIso(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        send({
          type: "error",
          message,
          at: nowIso(),
        });
      } finally {
        controller.close();
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
