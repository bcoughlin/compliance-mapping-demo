import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { ThemeSummary } from "./types";

interface RawRegulation {
  framework: string;
  requirements?: Array<{ id: string; text: string }>;
  criteria?: string[];
}

interface RawTheme {
  theme_id: string;
  theme_version: string;
  description?: string;
  regulations?: RawRegulation[];
  triggers?: {
    fields?: Array<{ name: string; aliases?: string[] }>;
    request_keys?: string[];
    imports?: string[];
    iac_resources?: string[];
  };
  required_controls?: Array<{ control_id: string; description: string }>;
  required_evidence?: string[];
  sanitizers?: string[];
  sinks?: string[];
}

export interface ParsedRegistry {
  themes: ThemeSummary[];
  rawYaml: { filename: string; contents: string }[];
}

/**
 * Read every YAML in registry/, parse it, and produce a ThemeSummary for
 * each one. Plain-English fields (`plain_english_headline`,
 * `plain_english_summary`) are left blank — Claude fills them in during
 * the map run's narration phase.
 */
export async function readAndParseRegistry(
  projectRoot: string,
): Promise<ParsedRegistry> {
  const dir = path.join(projectRoot, "registry");
  const files = await readdir(dir);
  const themes: ThemeSummary[] = [];
  const rawYaml: { filename: string; contents: string }[] = [];

  for (const filename of files) {
    if (!filename.endsWith(".yaml") && !filename.endsWith(".yml")) continue;
    const contents = await readFile(path.join(dir, filename), "utf-8");
    rawYaml.push({ filename, contents });

    const raw = yaml.load(contents) as RawTheme;

    const triggerParts: string[] = [];
    if (raw.triggers?.request_keys?.length) {
      triggerParts.push(
        `request keys: ${raw.triggers.request_keys.map((k) => `\`${k}\``).join(", ")}`,
      );
    }
    if (raw.triggers?.fields?.length) {
      const fieldNames = raw.triggers.fields.map((f) => `\`${f.name}\``).join(", ");
      triggerParts.push(`field names: ${fieldNames}`);
    }
    if (raw.triggers?.imports?.length) {
      triggerParts.push(
        `imports: ${raw.triggers.imports.map((i) => `\`${i}\``).join(", ")}`,
      );
    }
    if (raw.triggers?.iac_resources?.length) {
      triggerParts.push(
        `IaC resources: ${raw.triggers.iac_resources.map((r) => `\`${r}\``).join(", ")}`,
      );
    }

    themes.push({
      theme_id: raw.theme_id,
      theme_version: raw.theme_version,
      filename,
      description: (raw.description ?? "").trim(),
      regulations: (raw.regulations ?? []).map((r) => ({
        framework: r.framework,
        requirements: [
          ...(r.requirements ?? []).map((req) => `${req.id}: ${req.text}`),
          ...(r.criteria ?? []).map((c) => `criterion ${c}`),
        ],
      })),
      control_count: (raw.required_controls ?? []).length,
      evidence_items: raw.required_evidence ?? [],
      trigger_summary: triggerParts.join(" · ") || "(no triggers declared)",
      sanitizers: raw.sanitizers ?? [],
      sinks: raw.sinks ?? [],
      plain_english_headline: "",
      plain_english_summary: "",
    });
  }

  return { themes, rawYaml };
}
