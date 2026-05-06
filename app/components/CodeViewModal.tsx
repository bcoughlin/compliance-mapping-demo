"use client";

import { useEffect } from "react";
import { CodeView } from "@/app/components/CodeView";
import type { LineAnnotation } from "@/lib/types";

interface CodeViewModalProps {
  open: boolean;
  filePath: string | null;
  annotations: LineAnnotation[];
  annotatedFiles: string[];
  onSelectFile: (file: string) => void;
  onClose: () => void;
}

export function CodeViewModal({
  open,
  filePath,
  annotations,
  annotatedFiles,
  onSelectFile,
  onClose,
}: CodeViewModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !filePath) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4 py-6">
      <div
        className="bg-white rounded-lg shadow-2xl overflow-hidden grid"
        style={{
          width: "80vw",
          height: "70vh",
          gridTemplateRows: "auto 1fr auto",
        }}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-sm font-semibold text-stone-900">
              Source — annotated for this trace
            </h3>
            {annotatedFiles.length > 1 && (
              <select
                value={filePath}
                onChange={(e) => onSelectFile(e.target.value)}
                className="text-xs bg-stone-100 border border-stone-200 rounded px-2 py-1 font-mono text-stone-700 max-w-md"
              >
                {annotatedFiles.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-sm px-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-hidden min-h-0">
          <CodeView filePath={filePath} annotations={annotations} />
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2 border-t border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
          <span>Hover an annotated line to see its regulatory citation.</span>
          <span className="text-stone-400">Esc to close</span>
        </div>
      </div>
    </div>
  );
}
