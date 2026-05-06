import type { RunEvent } from "./types";

export function encodeSSE(event: RunEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
