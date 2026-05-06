import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { SemgrepFinding } from "./types";

const execFileAsync = promisify(execFile);

interface SemgrepRawResult {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: {
    message: string;
    severity: string;
    metadata?: Record<string, string>;
    lines?: string;
  };
}

interface SemgrepRawOutput {
  results: SemgrepRawResult[];
  errors: unknown[];
}

export async function runSemgrep(
  projectRoot: string,
  rulesDir: string,
  targetDir: string,
): Promise<SemgrepFinding[]> {
  const rulesPath = path.join(projectRoot, rulesDir);
  const targetPath = path.join(projectRoot, targetDir);

  // Build a config arg per rule file in the rulesDir.
  const fs = await import("node:fs/promises");
  const ruleFiles = (await fs.readdir(rulesPath))
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(rulesPath, f));

  const args = [
    "--json",
    "--quiet",
    "--no-git-ignore",
    "--metrics=off",
    ...ruleFiles.flatMap((r) => ["--config", r]),
    targetPath,
  ];

  let stdout = "";
  try {
    const result = await execFileAsync("semgrep", args, {
      maxBuffer: 16 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (err: unknown) {
    // Semgrep exits 1 when findings exist; that's not an error for us.
    const e = err as { code?: number; stdout?: string; stderr?: string };
    if (e.stdout) stdout = e.stdout;
    else throw err;
  }

  const parsed = JSON.parse(stdout) as SemgrepRawOutput;

  return parsed.results.map((r) => ({
    rule_id: r.check_id,
    file: path.relative(projectRoot, r.path),
    start_line: r.start.line,
    end_line: r.end.line,
    message: r.extra.message,
    severity: (r.extra.severity as SemgrepFinding["severity"]) ?? "INFO",
    metadata: {
      theme_id: r.extra.metadata?.theme_id,
      theme_version: r.extra.metadata?.theme_version,
      control_id: r.extra.metadata?.control_id,
      framework: r.extra.metadata?.framework,
      requirement: r.extra.metadata?.requirement,
    },
    matched_code: r.extra.lines ?? "",
  }));
}
