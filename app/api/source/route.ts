import { NextRequest } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";

const ALLOWED_PREFIXES = ["sample_codebase/", "registry/"];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("path");
  if (!requested) {
    return new Response("missing path", { status: 400 });
  }

  // Constrain to known directories. Reject any path traversal.
  if (
    requested.includes("..") ||
    !ALLOWED_PREFIXES.some((p) => requested.startsWith(p))
  ) {
    return new Response("forbidden", { status: 403 });
  }

  const fullPath = path.join(process.cwd(), requested);
  try {
    const contents = await readFile(fullPath, "utf-8");
    return new Response(contents, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`not found: ${message}`, { status: 404 });
  }
}
