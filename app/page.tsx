"use client";

import { useEffect, useMemo, useState } from "react";
import { useRunStream } from "@/app/hooks/useRunStream";
import { Header } from "@/app/components/Header";
import { IntroTour } from "@/app/components/IntroTour";
import { ActivityStream } from "@/app/components/ActivityStream";
import { TraceList } from "@/app/components/TraceList";
import { MermaidView } from "@/app/components/MermaidView";
import { CodeView } from "@/app/components/CodeView";
import { ArtifactPanel } from "@/app/components/ArtifactPanel";

export default function HomePage() {
  const { state, start } = useRunStream();
  const [tourOpen, setTourOpen] = useState(true); // every visit
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<"diagram" | "artifact">("diagram");

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

  useEffect(() => {
    if (selectedTrace && !selectedFile) {
      // Default to the file containing the first annotation
      const firstAnn = selectedTrace.line_annotations[0];
      setSelectedFile(firstAnn ? firstAnn.file : selectedTrace.files[0] ?? null);
    }
  }, [selectedTrace, selectedFile]);

  // When trace switches, reset selected file
  useEffect(() => {
    setSelectedFile(null);
  }, [selectedTraceId]);

  return (
    <div className="h-screen flex flex-col bg-stone-50 text-stone-900">
      <Header
        status={state.status}
        onRun={start}
        onShowTour={() => setTourOpen(true)}
        totalFindings={state.totalFindings}
        totalTraces={state.traces.length}
      />

      <IntroTour open={tourOpen} onClose={() => setTourOpen(false)} />

      <main className="flex-1 min-h-0 flex flex-col">
        {/* Activity stream */}
        <section className="border-b border-stone-200 bg-white max-h-[40vh] overflow-y-auto">
          <ActivityStream
            phases={state.phases}
            status={state.status}
            errorMessage={state.errorMessage}
          />
        </section>

        {/* Three-pane workspace */}
        <section className="flex-1 min-h-0 grid grid-cols-12 gap-0">
          {/* Left: trace list */}
          <aside className="col-span-3 border-r border-stone-200 bg-white overflow-y-auto">
            <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-white">
              <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">
                Traces
              </h3>
            </div>
            <TraceList
              traces={state.traces}
              selectedId={selectedTraceId}
              onSelect={setSelectedTraceId}
            />
          </aside>

          {/* Middle: diagram or artifact */}
          <div className="col-span-5 border-r border-stone-200 bg-white overflow-hidden flex flex-col min-h-0">
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
                  onNodeFile={setSelectedFile}
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

          {/* Right: code view */}
          <aside className="col-span-4 bg-white overflow-hidden flex flex-col min-h-0">
            <CodeView
              filePath={selectedFile}
              annotations={selectedTrace?.line_annotations ?? []}
            />
          </aside>
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
