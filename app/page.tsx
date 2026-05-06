"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRunStream } from "@/app/hooks/useRunStream";
import { Header } from "@/app/components/Header";
import { IntroTour } from "@/app/components/IntroTour";
import { RunModal } from "@/app/components/RunModal";
import { TraceList } from "@/app/components/TraceList";
import { MermaidView } from "@/app/components/MermaidView";
import { CodeViewModal } from "@/app/components/CodeViewModal";
import { ArtifactPanel } from "@/app/components/ArtifactPanel";

export default function HomePage() {
  const { state, start } = useRunStream();
  const [tourOpen, setTourOpen] = useState(true); // every visit
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [centerTab, setCenterTab] = useState<"diagram" | "artifact">("diagram");

  const handleStartRun = useCallback(() => {
    start();
    setRunModalOpen(true);
    setSelectedTraceId(null);
    setSelectedFile(null);
    setCodeModalOpen(false);
  }, [start]);

  const handleNodeFile = useCallback((file: string) => {
    setSelectedFile(file);
    setCodeModalOpen(true);
  }, []);

  const hasRunHistory = state.status !== "idle" || state.phases.length > 0;

  // Auto-select first trace as it arrives
  useEffect(() => {
    if (state.traces.length > 0 && !selectedTraceId) {
      setSelectedTraceId(state.traces[0].trace_id);
    }
  }, [state.traces, selectedTraceId]);

  // Auto-pick a default file when a trace is first selected
  const selectedTrace = useMemo(
    () => state.traces.find((t) => t.trace_id === selectedTraceId) ?? null,
    [state.traces, selectedTraceId],
  );

  // Track the worst-severity annotation file as the default when the
  // user opens the code modal without explicitly clicking a node.
  const defaultCodeFile = useMemo(() => {
    if (!selectedTrace) return null;
    const rank = { red: 3, yellow: 2, green: 1 } as const;
    const worst = [...selectedTrace.line_annotations].sort(
      (a, b) => rank[b.severity] - rank[a.severity],
    )[0];
    return worst ? worst.file : selectedTrace.files[0] ?? null;
  }, [selectedTrace]);

  // List of files that have annotations in the current trace —
  // used by the code modal's file selector dropdown.
  const annotatedFiles = useMemo(() => {
    if (!selectedTrace) return [];
    const files = new Set<string>();
    for (const a of selectedTrace.line_annotations) files.add(a.file);
    return Array.from(files);
  }, [selectedTrace]);

  // When trace switches, reset selected file and close the code modal.
  useEffect(() => {
    setSelectedFile(null);
    setCodeModalOpen(false);
  }, [selectedTraceId]);

  return (
    <div className="h-screen flex flex-col bg-stone-50 text-stone-900">
      <Header
        status={state.status}
        hasRunHistory={hasRunHistory}
        onRun={handleStartRun}
        onOpenRunModal={() => setRunModalOpen(true)}
        onShowTour={() => setTourOpen(true)}
        totalFindings={state.totalFindings}
        totalTraces={state.traces.length}
      />

      <IntroTour open={tourOpen} onClose={() => setTourOpen(false)} />

      <RunModal
        open={runModalOpen}
        onClose={() => setRunModalOpen(false)}
        onRunAgain={handleStartRun}
        status={state.status}
        phases={state.phases}
        errorMessage={state.errorMessage}
        totalFindings={state.totalFindings}
        totalTraces={state.traces.length}
      />

      <CodeViewModal
        open={codeModalOpen}
        filePath={selectedFile ?? defaultCodeFile}
        annotations={selectedTrace?.line_annotations ?? []}
        annotatedFiles={annotatedFiles}
        onSelectFile={(f) => setSelectedFile(f)}
        onClose={() => setCodeModalOpen(false)}
      />

      <main className="flex-1 min-h-0 flex flex-col">
        {/* Two-pane workspace: trace list (left) + diagram/artifact (right). */}
        {/* The code view lives in a modal that opens when you click a node. */}
        <section className="flex-1 min-h-0 grid grid-cols-12 gap-0">
          {/* Left: trace list */}
          <aside className="col-span-3 border-r border-stone-200 bg-white overflow-y-auto">
            <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-white flex items-center justify-between">
              <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">
                Traces
              </h3>
              {state.traces.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTrace) {
                      setSelectedFile(defaultCodeFile);
                      setCodeModalOpen(true);
                    }
                  }}
                  disabled={!selectedTrace}
                  className="text-[11px] text-stone-600 hover:text-stone-900 disabled:opacity-40 underline-offset-4 hover:underline"
                  title="Open code for the worst-severity finding in this trace"
                >
                  View code →
                </button>
              )}
            </div>
            <TraceList
              traces={state.traces}
              selectedId={selectedTraceId}
              onSelect={setSelectedTraceId}
            />
          </aside>

          {/* Right: diagram or artifact, full width */}
          <div className="col-span-9 bg-white overflow-hidden flex flex-col min-h-0">
            <div className="border-b border-stone-200 flex">
              <CenterTab
                active={centerTab === "diagram"}
                onClick={() => setCenterTab("diagram")}
              >
                Diagram
              </CenterTab>
              <CenterTab
                active={centerTab === "artifact"}
                onClick={() => setCenterTab("artifact")}
                disabled={!selectedTrace}
              >
                Artifact
              </CenterTab>
            </div>
            <div className="flex-1 min-h-0">
              {centerTab === "diagram" ? (
                <MermaidView
                  trace={selectedTrace}
                  selectedFile={selectedFile ?? defaultCodeFile}
                  onNodeFile={handleNodeFile}
                />
              ) : selectedTrace ? (
                <ArtifactPanel trace={selectedTrace} />
              ) : (
                <div className="h-full flex items-center justify-center text-stone-400 text-sm">
                  Select a trace to view its artifact.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function CenterTab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors
        ${
          active
            ? "border-stone-900 text-stone-900"
            : "border-transparent text-stone-500 hover:text-stone-800"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}
