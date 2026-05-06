import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function readRegistry(
  projectRoot: string,
): Promise<{ filename: string; contents: string }[]> {
  const dir = path.join(projectRoot, "registry");
  const files = await readdir(dir);
  const out: { filename: string; contents: string }[] = [];
  for (const f of files) {
    if (f.endsWith(".yaml") || f.endsWith(".yml")) {
      const contents = await readFile(path.join(dir, f), "utf-8");
      out.push({ filename: f, contents });
    }
  }
  return out;
}

export async function readCodebase(
  projectRoot: string,
  targetDir: string,
): Promise<{ path: string; contents: string }[]> {
  const root = path.join(projectRoot, targetDir);
  const out: { path: string; contents: string }[] = [];

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith("__") || entry.name === "__pycache__") {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".py")) {
        const contents = await readFile(full, "utf-8");
        if (contents.trim().length === 0) continue;
        out.push({
          path: path.relative(projectRoot, full),
          contents,
        });
      }
    }
  }

  await walk(root);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}
