"use client";

import { useEffect, useRef, useState } from "react";
import type { LineAnnotation, Severity } from "@/lib/types";

interface CodeViewProps {
  filePath: string | null;
  annotations: LineAnnotation[];
}

const SEVERITY_LINE_BG: Record<Severity, string> = {
  green: "rgb(220 252 231)",
  yellow: "rgb(254 249 195)",
  red: "rgb(254 226 226)",
};

const SEVERITY_LINE_BORDER: Record<Severity, string> = {
  green: "rgb(34 197 94)",
  yellow: "rgb(234 179 8)",
  red: "rgb(239 68 68)",
};

export function CodeView({ filePath, annotations }: CodeViewProps) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filePath) {
      setSource(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/source?path=${encodeURIComponent(filePath)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) {
          setSource(text);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSource(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Auto-scroll to first annotated line
  useEffect(() => {
    if (!containerRef.current || !annotations.length || !filePath) return;
    const fileAnns = annotations.filter((a) => a.file === filePath);
    if (fileAnns.length === 0) return;
    const first = fileAnns[0];
    const el = containerRef.current.querySelector<HTMLElement>(
      `[data-line="${first.line}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [filePath, source, annotations]);

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-stone-400 text-sm px-4 text-center">
        Click a node in the diagram to see the code for that file.
      </div>
    );
  }

  const lines = source?.split("\n") ?? [];
  const annsByLine = new Map<number, LineAnnotation[]>();
  for (const a of annotations) {
    if (a.file !== filePath) continue;
    const list = annsByLine.get(a.line) ?? [];
    list.push(a);
    annsByLine.set(a.line, list);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-stone-200 flex items-center justify-between">
        <code className="text-[11px] text-stone-700 font-mono truncate">
          {filePath}
        </code>
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-white font-mono text-[12.5px] leading-[1.55] py-2"
      >
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const annsHere = annsByLine.get(lineNum) ?? [];
          const sev = annsHere[0]?.severity;

          return (
            <div
              key={lineNum}
              data-line={lineNum}
              onMouseEnter={() => setHoverLine(lineNum)}
              onMouseLeave={() => setHoverLine(null)}
              className="flex relative group"
              style={{
                background: sev ? SEVERITY_LINE_BG[sev] : "transparent",
                borderLeft: sev
                  ? `3px solid ${SEVERITY_LINE_BORDER[sev]}`
                  : "3px solid transparent",
              }}
            >
              <span
                className="select-none text-stone-400 px-3 text-right tabular-nums"
                style={{ minWidth: "3.5rem" }}
              >
                {lineNum}
              </span>
              <pre className="flex-1 px-2 whitespace-pre overflow-x-visible">
                {line || " "}
              </pre>

              {annsHere.length > 0 && hoverLine === lineNum && (
                <div className="absolute right-2 top-full z-20 mt-1 max-w-md text-xs bg-stone-900 text-stone-100 px-3 py-2 rounded shadow-lg pointer-events-none">
                  {annsHere.map((a, idx) => (
                    <div key={idx} className={idx > 0 ? "mt-2 pt-2 border-t border-stone-700" : ""}>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                        {a.citation.framework} {a.citation.requirement} ·{" "}
                        {a.citation.theme_id}/{a.citation.control_id}
                      </div>
                      <div className="mt-1 text-stone-100">{a.note}</div>
                      <div className="mt-1 text-stone-400 italic">
                        &ldquo;{a.citation.requirement_text}&rdquo;
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
