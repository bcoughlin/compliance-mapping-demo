"use client";

import React from "react";

/**
 * Tiny markdown renderer for the agent's streaming narration.
 *
 * Handles only what the model actually emits:
 *   - paragraphs separated by blank lines
 *   - inline code via backticks: `payment_handler.py`
 *   - bold via double asterisks: **GREEN**
 *   - simple bullet lines starting with "- "
 *
 * Resilient to partial input — if a backtick or `**` has no closer yet
 * (because the next token hasn't arrived), the unclosed marker is
 * rendered literally rather than swallowing the rest of the buffer.
 */

type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "bold"; text: string };

function tokenizeInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let i = 0;
  let plainStart = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) {
      out.push({ kind: "text", text: text.slice(plainStart, end) });
    }
  };

  while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end === -1) break; // unclosed — leave for plain flush
      flushPlain(i);
      out.push({ kind: "code", text: text.slice(i + 1, end) });
      i = end + 1;
      plainStart = i;
      continue;
    }

    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end === -1) break;
      flushPlain(i);
      out.push({ kind: "bold", text: text.slice(i + 2, end) });
      i = end + 2;
      plainStart = i;
      continue;
    }

    i++;
  }

  flushPlain(text.length);
  return out;
}

// Highlight specific severity / decision keywords with the same color
// vocabulary the trace list uses. Case-sensitive, whole-word.
const SEVERITY_PATTERN =
  /\b(GREEN|YELLOW|RED|OK|REVIEW|BLOCK|HIGH|MEDIUM|LOW)\b/g;

const SEVERITY_CLASS: Record<string, string> = {
  GREEN: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  OK: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  LOW: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  YELLOW: "bg-amber-100 text-amber-800 ring-amber-200",
  REVIEW: "bg-amber-100 text-amber-800 ring-amber-200",
  MEDIUM: "bg-amber-100 text-amber-800 ring-amber-200",
  RED: "bg-red-100 text-red-800 ring-red-200",
  BLOCK: "bg-red-100 text-red-800 ring-red-200",
  HIGH: "bg-red-100 text-red-800 ring-red-200",
};

function highlightSeverity(
  text: string,
  baseKey: string,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let count = 0;

  // Reset regex state for each call (it's a global regex).
  SEVERITY_PATTERN.lastIndex = 0;

  while ((match = SEVERITY_PATTERN.exec(text)) !== null) {
    const word = match[0];
    if (match.index > lastIndex) {
      out.push(
        <React.Fragment key={`${baseKey}-t-${count++}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>,
      );
    }
    out.push(
      <span
        key={`${baseKey}-s-${count++}`}
        className={`inline-block px-1.5 py-px rounded font-mono font-semibold text-[0.85em] ring-1 ${
          SEVERITY_CLASS[word] ?? ""
        }`}
      >
        {word}
      </span>,
    );
    lastIndex = match.index + word.length;
  }

  if (lastIndex < text.length) {
    out.push(
      <React.Fragment key={`${baseKey}-t-${count++}`}>
        {text.slice(lastIndex)}
      </React.Fragment>,
    );
  }

  return out;
}

function renderInline(text: string): React.ReactNode {
  return tokenizeInline(text).map((tok, idx) => {
    if (tok.kind === "code") {
      return (
        <code
          key={idx}
          className="font-mono text-[0.85em] px-1 py-px rounded bg-stone-200/70 text-stone-800 break-words"
        >
          {tok.text}
        </code>
      );
    }
    if (tok.kind === "bold") {
      return (
        <strong key={idx} className="font-semibold text-stone-900">
          {highlightSeverity(tok.text, `b${idx}`)}
        </strong>
      );
    }
    return (
      <React.Fragment key={idx}>
        {highlightSeverity(tok.text, `t${idx}`)}
      </React.Fragment>
    );
  });
}

interface MarkdownProps {
  text: string;
  className?: string;
}

export function Markdown({ text, className }: MarkdownProps) {
  if (!text) return null;

  const paragraphs = text.split(/\n{2,}/);

  return (
    <div className={className}>
      {paragraphs.map((para, pi) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Fenced code block — starts with ```, with or without closing fence
        // (the closing fence may not have arrived yet during streaming).
        if (trimmed.startsWith("```")) {
          const firstNewline = trimmed.indexOf("\n");
          const afterFence =
            firstNewline > -1 ? trimmed.slice(firstNewline + 1) : "";
          const closingIdx = afterFence.lastIndexOf("\n```");
          const content =
            closingIdx > -1 ? afterFence.slice(0, closingIdx) : afterFence;

          return (
            <pre
              key={pi}
              className="mb-3 last:mb-0 bg-stone-100 border border-stone-200 rounded-md px-3 py-2 text-[0.78em] font-mono text-stone-700 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
            >
              {content}
            </pre>
          );
        }

        // Bullet block — every line starts with "- ".
        const lines = trimmed.split("\n");
        const allBullets =
          lines.length > 1 && lines.every((l) => /^[-*]\s+/.test(l.trim()));

        if (allBullets) {
          return (
            <ul key={pi} className="list-disc pl-5 mb-3 last:mb-0 space-y-1">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={pi} className="mb-3 last:mb-0">
            {renderInline(para)}
          </p>
        );
      })}
    </div>
  );
}
