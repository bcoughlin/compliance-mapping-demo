import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { CallGraphEdge } from "./types";

const execFileAsync = promisify(execFile);

export async function buildCallGraph(
  projectRoot: string,
  targetDir: string,
): Promise<CallGraphEdge[]> {
  const targetPath = path.join(projectRoot, targetDir);

  const { stdout } = await execFileAsync(
    "python3",
    [path.join(projectRoot, "scripts/callgraph.py"), targetPath],
    { maxBuffer: 8 * 1024 * 1024 },
  );

  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    throw new Error(`callgraph script returned non-array: ${typeof parsed}`);
  }
  const edges = parsed as CallGraphEdge[];

  // Normalize absolute paths to project-relative for consumer code.
  return edges.map((e) => ({
    ...e,
    source_file: path.relative(projectRoot, e.source_file),
    target_file: e.target_file ? path.relative(projectRoot, e.target_file) : null,
  }));
}
