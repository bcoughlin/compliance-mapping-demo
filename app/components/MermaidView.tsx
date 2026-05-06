"use client";

import { useEffect, useRef, useState } from "react";
import type { Trace } from "@/lib/types";

interface MermaidViewProps {
  trace: Trace | null;
  onNodeFile: (file: string) => void;
}

export function MermaidView({ trace, onNodeFile }: MermaidViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!trace || !containerRef.current) return;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          themeVariables: {
            primaryColor: "#f5f5f4",
            primaryBorderColor: "#78716c",
            primaryTextColor: "#1c1917",
            lineColor: "#78716c",
            tertiaryColor: "#fafaf9",
          },
        });

        const id = `mmd-${trace.trace_id}-${Date.now()}`;
        const { svg } = await mermaid.render(id, trace.mermaid);

        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setError(null);

        // Wire click handlers to nodes that match files in trace.files
        const nodes = containerRef.current.querySelectorAll<SVGGElement>(
          "g.node",
        );
        nodes.forEach((node) => {
          const text = node.textContent ?? "";
          // Try to find a file mention in the node label that matches one of trace.files
          const matched = trace.files.find((f) => {
            const moduleSegments = f.replace(/\.py$/, "").split("/");
            return moduleSegments.some((seg) => text.includes(seg));
          });
          if (matched) {
            (node as unknown as HTMLElement).style.cursor = "pointer";
            node.addEventListener("click", () => onNodeFile(matched));
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trace, onNodeFile]);

  if (!trace) {
    return (
      <div className="h-full flex items-center justify-center text-stone-400 text-sm">
        Select a trace from the left to see its data flow.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-stone-200 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-900">{trace.label}</h3>
        <span className="text-[11px] text-stone-500 font-mono">
          {trace.trace_id}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-stone-50/50 flex items-start justify-center">
        {error ? (
          <pre className="text-xs text-red-700 whitespace-pre-wrap">{error}</pre>
        ) : (
          <div ref={containerRef} className="mermaid-render w-full max-w-3xl" />
        )}
      </div>
      {trace.rationale_markdown && (
        <div className="border-t border-stone-200 px-4 py-3 bg-white max-h-48 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-medium">
            Agent rationale
          </p>
          <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap font-sans">
            {trace.rationale_markdown}
          </div>
        </div>
      )}
    </div>
  );
}
