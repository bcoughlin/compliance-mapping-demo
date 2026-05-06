"use client";

import { useCallback, useReducer, useRef } from "react";
import type { Phase, RunEvent, Trace } from "@/lib/types";

export type PhaseState = {
  phase: Phase;
  status: "active" | "completed";
  startedAt: string;
  completedAt?: string;
  message: string;
  summary?: string;
  detail?: string;
  liveText: string;
};

export type StreamState = {
  status: "idle" | "running" | "completed" | "errored";
  phases: PhaseState[];
  traces: Trace[];
  errorMessage?: string;
  totalFindings?: number;
};

type Action =
  | { kind: "reset" }
  | { kind: "event"; event: RunEvent };

const initial: StreamState = {
  status: "idle",
  phases: [],
  traces: [],
};

function reducer(state: StreamState, action: Action): StreamState {
  if (action.kind === "reset") {
    return { ...initial, status: "running" };
  }

  const e = action.event;

  switch (e.type) {
    case "phase_started": {
      const phases = [
        ...state.phases,
        {
          phase: e.phase,
          status: "active" as const,
          startedAt: e.at,
          message: e.message,
          liveText: "",
        },
      ];
      return { ...state, phases };
    }

    case "phase_progress": {
      const phases = state.phases.map((p) =>
        p.phase === e.phase && p.status === "active"
          ? { ...p, message: e.message }
          : p,
      );
      return { ...state, phases };
    }

    case "narration_token": {
      const phases = state.phases.map((p) =>
        p.phase === "narrate" && p.status === "active"
          ? { ...p, liveText: p.liveText + e.text }
          : p,
      );
      return { ...state, phases };
    }

    case "phase_completed": {
      const phases = state.phases.map((p) =>
        p.phase === e.phase && p.status === "active"
          ? {
              ...p,
              status: "completed" as const,
              completedAt: e.at,
              summary: e.summary,
              detail: e.detail,
            }
          : p,
      );
      return { ...state, phases };
    }

    case "trace_drafted": {
      return {
        ...state,
        traces: [...state.traces, e.trace],
      };
    }

    case "run_completed": {
      return {
        ...state,
        status: "completed",
        totalFindings: e.total_findings,
      };
    }

    case "error": {
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

export function useRunStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const sourceRef = useRef<EventSource | null>(null);

  const start = useCallback(() => {
    sourceRef.current?.close();

    dispatch({ kind: "reset" });

    const source = new EventSource("/api/run");
    sourceRef.current = source;

    const handle = (rawType: string) => (msg: MessageEvent) => {
      try {
        const parsed = JSON.parse(msg.data) as RunEvent;
        dispatch({ kind: "event", event: parsed });
        if (parsed.type === "run_completed" || parsed.type === "error") {
          source.close();
        }
      } catch (err) {
        console.error("failed to parse event", rawType, err);
      }
    };

    [
      "phase_started",
      "phase_progress",
      "phase_completed",
      "narration_token",
      "trace_drafted",
      "run_completed",
      "error",
    ].forEach((type) => {
      source.addEventListener(type, handle(type) as EventListener);
    });

    source.onerror = () => {
      // EventSource will fire onerror when the server closes the stream
      // normally; only flag as a real error if we haven't completed.
      if (state.status === "running" && sourceRef.current === source) {
        source.close();
      }
    };
  }, [state.status]);

  const stop = useCallback(() => {
    sourceRef.current?.close();
  }, []);

  return { state, start, stop };
}
