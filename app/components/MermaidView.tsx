"use client";

import { useEffect, useRef, useState } from "react";
import type { Trace } from "@/lib/types";
import { Markdown } from "@/app/components/Markdown";

// svg-pan-zoom touches `window` at load time, so it must NOT be
// statically imported in a Next.js client component (the build
// pre-renders the page on the server). We dynamic-import it inside
// the effect. Structural type for the small slice of the API we use.
interface SvgPanZoomInstance {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  destroy?(): void;
}

interface MermaidViewProps {
  trace: Trace | null;
  selectedFile: string | null;
  onNodeFile: (file: string) => void;
}

function forceVerticalOrientation(source: string): string {
  // Patch flowchart LR / RL → TB so older traces (and any model output
  // that ignores the system prompt) still render top-to-bottom.
  return source.replace(/^(\s*)flowchart\s+(LR|RL|BT)\b/m, "$1flowchart TB");
}

export function MermaidView({
  trace,
  selectedFile,
  onNodeFile,
}: MermaidViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<SvgPanZoomInstance | null>(null);
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
          flowchart: { useMaxWidth: false, htmlLabels: true },
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

        const source = forceVerticalOrientation(trace.mermaid);
        const id = `mmd-${trace.trace_id}-${Date.now()}`;
        const { svg } = await mermaid.render(id, source);

        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setError(null);

        // Make the rendered SVG fill its container so pan/zoom feels right.
        const svgEl = containerRef.current.querySelector("svg");
        if (svgEl) {
          svgEl.removeAttribute("width");
          svgEl.removeAttribute("height");
          svgEl.setAttribute("width", "100%");
          svgEl.setAttribute("height", "100%");
          (svgEl as SVGSVGElement).style.maxWidth = "100%";
          (svgEl as SVGSVGElement).style.maxHeight = "100%";
        }

        // Wire click handlers to nodes that match files in trace.files
        // and add a visible ring to the node corresponding to the
        // currently selected file in the right-hand code view.
        const nodes = containerRef.current.querySelectorAll<SVGGElement>(
          "g.node",
        );
        nodes.forEach((node) => {
          const text = node.textContent ?? "";
          // Match the most-specific (longest) segment first so e.g.
          // "audit_logger" wins over a shorter "audit" appearing in
          // another file path.
          const matched = trace.files
            .map((f) => {
              const stem = f.replace(/\.py$/, "");
              const segments = stem.split("/").filter(Boolean);
              const longest = segments.sort((a, b) => b.length - a.length)[0];
              return text.includes(longest) ? f : null;
            })
            .find((f): f is string => Boolean(f));

          if (matched) {
            (node as unknown as HTMLElement).style.cursor = "pointer";
            node.addEventListener("click", () => onNodeFile(matched));

            if (matched === selectedFile) {
              const rect = node.querySelector<SVGRectElement>(
                "rect, polygon, circle, ellipse, path",
              );
              if (rect) {
                rect.setAttribute("stroke", "#1c1917");
                rect.setAttribute("stroke-width", "3");
                rect.setAttribute("stroke-dasharray", "4 2");
              }
            }
          }
        });

        // Initialize pan/zoom on the SVG.
        const svgPanZoom = (await import("svg-pan-zoom")).default;
        const svgForPanZoom = containerRef.current.querySelector("svg");
        if (svgForPanZoom) {
          panZoomRef.current?.destroy?.();
          panZoomRef.current = svgPanZoom(svgForPanZoom as SVGElement, {
            zoomEnabled: true,
            mouseWheelZoomEnabled: false, // too easy to trigger accidentally
            dblClickZoomEnabled: true,
            controlIconsEnabled: false,
            fit: true,
            center: true,
            minZoom: 0.4,
            maxZoom: 6,
            zoomScaleSensitivity: 0.3,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      panZoomRef.current?.destroy?.();
      panZoomRef.current = null;
    };
  }, [trace, onNodeFile, selectedFile]);

  function resetView() {
    if (panZoomRef.current) {
      panZoomRef.current.reset();
    }
  }

  function zoomIn() {
    panZoomRef.current?.zoomIn();
  }

  function zoomOut() {
    panZoomRef.current?.zoomOut();
  }

  if (!trace) {
    return (
      <div className="h-full flex items-center justify-center text-stone-400 text-sm">
        Select a trace from the left to see its data flow.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-stone-200 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="text-sm font-semibold text-stone-900 truncate">{trace.label}</h3>
          <span className="text-[11px] text-stone-500 font-mono truncate">
            {trace.trace_id}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <ZoomButton onClick={zoomOut} label="Zoom out">−</ZoomButton>
          <ZoomButton onClick={zoomIn} label="Zoom in">+</ZoomButton>
          <ZoomButton onClick={resetView} label="Reset view">⟲</ZoomButton>
        </div>
      </div>
      <div className="flex-1 relative bg-stone-50/50 overflow-hidden">
        {error ? (
          <pre className="text-xs text-red-700 whitespace-pre-wrap p-4">{error}</pre>
        ) : (
          <div
            ref={containerRef}
            className="mermaid-render absolute inset-0"
          />
        )}
        <div className="absolute bottom-2 right-3 text-[10px] uppercase tracking-wider text-stone-400 pointer-events-none select-none">
          drag to pan · use +/− to zoom · click a node to view code
        </div>
      </div>
      {trace.rationale_markdown && (
        <div className="border-t border-stone-200 px-4 py-3 bg-white max-h-44 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-medium">
            Agent rationale
          </p>
          <Markdown
            text={trace.rationale_markdown}
            className="text-sm text-stone-800 leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}

function ZoomButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-7 h-7 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md text-sm font-medium"
    >
      {children}
    </button>
  );
}
