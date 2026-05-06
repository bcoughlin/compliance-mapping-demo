// Shared types between the API route and the UI.

export type Severity = "green" | "yellow" | "red";

export type Phase =
  | "semgrep"
  | "callgraph"
  | "narrate"
  | "registry"
  | "summarize";

export interface ThemeSummary {
  theme_id: string;
  theme_version: string;
  filename: string;
  description: string;
  regulations: Array<{
    framework: string;
    requirements: string[];
  }>;
  control_count: number;
  evidence_items: string[];
  trigger_summary: string;
  sanitizers: string[];
  sinks: string[];
  plain_english_headline: string;
  plain_english_summary: string;
}

export interface SemgrepFinding {
  rule_id: string;
  file: string;
  start_line: number;
  end_line: number;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR";
  metadata: {
    theme_id?: string;
    theme_version?: string;
    control_id?: string;
    framework?: string;
    requirement?: string;
  };
  matched_code: string;
}

export interface CallGraphEdge {
  source_file: string;
  source_function: string;
  source_line: number;
  target_module: string;
  target_function: string;
  target_file: string | null;
}

export interface RegulatoryCitation {
  theme_id: string;
  theme_version: string;
  control_id: string;
  framework: string;
  requirement: string;
  requirement_text: string;
}

export interface LineAnnotation {
  file: string;
  line: number;
  severity: Severity;
  citation: RegulatoryCitation;
  note: string;
}

export interface ComplianceArtifact {
  artifact_version: string;
  trace_id: string;
  timestamp_utc: string;
  decision: "OK" | "REVIEW" | "BLOCK";
  risk_tier: "LOW" | "MEDIUM" | "HIGH";
  regulatory_tags: Array<{
    theme_id: string;
    framework: string;
    requirement: string;
    triggered_by: string;
  }>;
  evidence_state: {
    sanitizer_present: boolean;
    encryption_at_rest: boolean;
    iam_verification: boolean;
    notes: string[];
  };
  rationale: string;
  failure_points: Array<{ file: string; line: number; description: string }>;
}

export interface IncidentReportDraft {
  rca_id: string;
  title: string;
  severity: "S1" | "S2" | "S3" | "S4";
  status: "DRAFT — human review required";
  short_hash: string;
  date: string;
  summary: string;
  timeline: Array<{ at: string; event: string }>;
  five_whys: Array<{ question: string; answer: string }>;
  control_mapping: Array<{
    framework: string;
    control: string;
    operated_as_designed: "yes" | "no" | "partial";
    note: string;
  }>;
  proposed_remediation: string[];
}

export interface Trace {
  trace_id: string;
  label: string;
  severity: Severity;
  files: string[];
  mermaid: string;
  rationale_markdown: string;
  line_annotations: LineAnnotation[];
  compliance_record: ComplianceArtifact;
  incident_report?: IncidentReportDraft;
}

// Server-Sent Event payloads.
export type RunEvent =
  | {
      type: "phase_started";
      phase: Phase;
      message: string;
      at: string;
    }
  | {
      type: "phase_progress";
      phase: Phase;
      message: string;
      at: string;
    }
  | {
      type: "narration_token";
      text: string;
      at: string;
    }
  | {
      type: "phase_completed";
      phase: Phase;
      summary: string;
      detail: string;
      at: string;
    }
  | {
      type: "trace_drafted";
      trace: Trace;
      at: string;
    }
  | {
      type: "theme_summarized";
      summary: ThemeSummary;
      at: string;
    }
  | {
      type: "run_completed";
      total_findings?: number;
      total_traces?: number;
      total_themes?: number;
      at: string;
    }
  | {
      type: "run_error";
      phase?: Phase;
      message: string;
      at: string;
    };

export interface ThemeYaml {
  theme_id: string;
  theme_version: string;
  description: string;
  regulations: Array<{
    framework: string;
    requirements?: Array<{ id: string; text: string }>;
    criteria?: string[];
  }>;
  required_controls: Array<{ control_id: string; description: string; detection?: string }>;
  required_evidence: string[];
  sanitizers?: string[];
  sinks?: string[];
}
