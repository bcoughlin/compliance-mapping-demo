import { NextRequest } from "next/server";

import { readAndParseRegistry } from "@/lib/registry";
import { streamMapRun } from "@/lib/map-claude";
import { encodeSSE, nowIso } from "@/lib/sse";
import type { RunEvent, ThemeSummary } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

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
          closed = true;
        }
      };

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 25_000);

      try {
        // ── Phase: registry — read and parse YAML
        send({
          type: "phase_started",
          phase: "registry",
          message: "Reading and parsing the theme registry...",
          at: nowIso(),
        });

        const { themes, rawYaml } = await readAndParseRegistry(projectRoot);

        const detail = themes
          .map(
            (t) =>
              `${t.theme_id}@${t.theme_version} — ${t.regulations.length} regulation${t.regulations.length === 1 ? "" : "s"}, ${t.control_count} control${t.control_count === 1 ? "" : "s"}, ${t.evidence_items.length} evidence item${t.evidence_items.length === 1 ? "" : "s"}`,
          )
          .join("\n");

        send({
          type: "phase_completed",
          phase: "registry",
          summary: `Parsed ${themes.length} theme${themes.length === 1 ? "" : "s"}`,
          detail,
          at: nowIso(),
        });

        // ── Phase: summarize — Claude produces plain-English summaries
        send({
          type: "phase_started",
          phase: "summarize",
          message: "Asking Claude to write a plain-English summary per theme...",
          at: nowIso(),
        });

        // Track summaries by theme_id so we can merge headline/summary back
        // into the parsed theme objects when emitting the theme_summarized event.
        const byId = new Map<string, ThemeSummary>(
          themes.map((t) => [t.theme_id, t]),
        );

        const result = await streamMapRun(
          { themesRaw: rawYaml },
          {
            onTextDelta: (text) => {
              send({ type: "narration_token", text, at: nowIso() });
            },
            onThemeSummary: (themeId, headline, summary) => {
              const base = byId.get(themeId);
              if (!base) return;
              const enriched: ThemeSummary = {
                ...base,
                plain_english_headline: headline,
                plain_english_summary: summary,
              };
              byId.set(themeId, enriched);
              send({
                type: "theme_summarized",
                summary: enriched,
                at: nowIso(),
              });
            },
          },
        );

        send({
          type: "phase_completed",
          phase: "summarize",
          summary: `Summarized ${result.count} theme${result.count === 1 ? "" : "s"}`,
          detail: "",
          at: nowIso(),
        });

        send({
          type: "run_completed",
          total_themes: result.count,
          at: nowIso(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", message, at: nowIso() });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          try {
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
