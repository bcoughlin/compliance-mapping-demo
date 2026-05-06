"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Phase, RunEvent, ThemeSummary } from "@/lib/types";
import type { PhaseState } from "@/app/hooks/useRunStream";

export type MapState = {
  status: "idle" | "running" | "completed" | "errored";
  phases: PhaseState[];
  themes: ThemeSummary[];
  errorMessage?: string;
  totalThemes?: number;
};

type Action =
  | { kind: "reset" }
  | { kind: "hydrate"; state: MapState }
  | { kind: "event"; event: RunEvent };

const initial: MapState = {
  status: "idle",
  phases: [],
  themes: [],
};

const STORAGE_KEY = "compliance-mapping-demo:last-map-v1";

function persistIfFinal(state: MapState) {
  if (typeof window === "undefined") return;
  if (state.status !== "completed" && state.status !== "errored") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function loadPersisted(): MapState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MapState;
    if (
      parsed &&
      Array.isArray(parsed.phases) &&
      Array.isArray(parsed.themes) &&
      (parsed.status === "completed" || parsed.status === "errored")
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function clearPersisted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function reducer(state: MapState, action: Action): MapState {
  if (action.kind === "reset") {
    return { ...initial, status: "running" };
  }
  if (action.kind === "hydrate") {
    return action.state;
  }

  const e = action.event;

  switch (e.type) {
    case "phase_started": {
      return {
        ...state,
        phases: [
          ...state.phases,
          {
            phase: e.phase,
            status: "active",
            startedAt: e.at,
            message: e.message,
            liveText: "",
          },
        ],
      };
    }
    case "narration_token": {
      const phases = state.phases.map((p): PhaseState =>
        p.phase === "summarize" && p.status === "active"
          ? { ...p, liveText: p.liveText + e.text }
          : p,
      );
      return { ...state, phases };
    }
    case "phase_completed": {
      const phases = state.phases.map((p): PhaseState =>
        p.phase === e.phase && p.status === "active"
          ? {
              ...p,
              status: "completed",
              completedAt: e.at,
              summary: e.summary,
              detail: e.detail,
            }
          : p,
      );
      return { ...state, phases };
    }
    case "theme_summarized": {
      // Replace if the theme exists already (e.g., from the registry parse
      // step), otherwise append.
      const idx = state.themes.findIndex(
        (t) => t.theme_id === e.summary.theme_id,
      );
      const next = [...state.themes];
      if (idx >= 0) next[idx] = e.summary;
      else next.push(e.summary);
      return { ...state, themes: next };
    }
    case "run_completed": {
      return {
        ...state,
        status: "completed",
        totalThemes: e.total_themes ?? state.themes.length,
      };
    }
    case "run_error": {
      return {
        ...state,
        status: "errored",
        errorMessage: e.message,
      };
    }
    default:
      return state;
  }
}

const RECOGNIZED_PHASES: Phase[] = ["registry", "summarize"];

export function useMapStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) {
      dispatch({ kind: "hydrate", state: persisted });
    }
  }, []);

  useEffect(() => {
    persistIfFinal(state);
  }, [state]);

  useEffect(() => {
    if (state.status !== "running") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "Mapping is in progress. Reloading will lose its output.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.status]);

  const start = useCallback(() => {
    sourceRef.current?.close();
    clearPersisted();
    dispatch({ kind: "reset" });

    const source = new EventSource("/api/run-map");
    sourceRef.current = source;

    const handle = (rawType: string) => (msg: MessageEvent) => {
      try {
        const parsed = JSON.parse(msg.data) as RunEvent;
        // Filter to phases this hook cares about, so a stray event from
        // /api/run wouldn't be applied here (defensive — different
        // EventSource so it shouldn't happen).
        if (
          (parsed.type === "phase_started" ||
            parsed.type === "phase_completed" ||
            parsed.type === "phase_progress") &&
          !RECOGNIZED_PHASES.includes(parsed.phase)
        ) {
          return;
        }
        dispatch({ kind: "event", event: parsed });
        if (parsed.type === "run_completed" || parsed.type === "run_error") {
          source.close();
        }
      } catch (err) {
        console.error("failed to parse map event", rawType, err);
      }
    };

    [
      "phase_started",
      "phase_progress",
      "phase_completed",
      "narration_token",
      "theme_summarized",
      "run_completed",
      "run_error",
    ].forEach((type) => {
      source.addEventListener(type, handle(type) as EventListener);
    });

    source.onerror = () => {
      if (sourceRef.current === source) {
        source.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the EventSource if the component unmounts mid-run.
  useEffect(() => {
    return () => { sourceRef.current?.close(); };
  }, []);

  const stop = useCallback(() => {
    sourceRef.current?.close();
  }, []);

  return { state, start, stop };
}
