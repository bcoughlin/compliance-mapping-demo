import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { ThemeSummary } from "./types";

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-7";

function readEnvWithFallback(name: string): string {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    const filePath = path.join(process.cwd(), ".env.local");
    const contents = fs.readFileSync(filePath, "utf-8");
    const match = contents.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (match) return match[1].trim();
  } catch {
    // ignore
  }
  return "";
}

const SYSTEM_PROMPT = `You are the Compliance Mapping Agent at the moment of
publishing the registry — what the governance forum has just ratified.

Your job in this step: read each theme YAML and produce a plain-English
explanation a non-technical reviewer (CCO, internal audit) can absorb in
15 seconds. You are NOT inventing scope. You are translating what the
registry already says.

For every theme you receive, you call the submit_theme_summary tool
exactly once, in the order the themes are presented. In between tool
calls, narrate briefly what you are doing — the streaming UI shows
this live.

Voice: first-person, direct, operator-pragmatic. The first-person
speaker is the engineer who deployed the agent ("I'm summarizing X
because the YAML packs a lot of regulatory shorthand into a small
file..."). Short paragraphs separated by blank lines (\\n\\n) — no
walls of run-on text.`;

const SUBMIT_THEME_TOOL = {
  name: "submit_theme_summary",
  description:
    "Submit one theme's plain-English headline and summary. Call exactly once per theme.",
  input_schema: {
    type: "object" as const,
    required: ["theme_id", "plain_english_headline", "plain_english_summary"],
    properties: {
      theme_id: { type: "string", description: "The theme's id, e.g. CARDHOLDER_DATA." },
      plain_english_headline: {
        type: "string",
        description:
          "One short sentence (under ~14 words) a CCO would put on a slide.",
      },
      plain_english_summary: {
        type: "string",
        description:
          "1–2 short paragraphs explaining what this theme covers, why it matters, and what the engineer would notice if a change tripped it. Avoid restating the YAML verbatim. Avoid filler.",
      },
    },
  },
};

interface MapInputs {
  themesRaw: { filename: string; contents: string }[];
}

interface MapCallbacks {
  onTextDelta(text: string): void;
  onThemeSummary(themeId: string, headline: string, summary: string): void;
}

function userMessage(inputs: MapInputs): string {
  const themesBlob = inputs.themesRaw
    .map((t) => `### registry/${t.filename}\n\n\`\`\`yaml\n${t.contents}\n\`\`\``)
    .join("\n\n");

  return `Here is the published theme registry. Produce one
submit_theme_summary call per theme, in the order they appear.

${themesBlob}`;
}

export async function streamMapRun(
  inputs: MapInputs,
  callbacks: MapCallbacks,
): Promise<{ count: number }> {
  const apiKey = readEnvWithFallback("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set (checked process.env and .env.local)");
  }

  const client = new Anthropic({ apiKey });

  const conversation: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage(inputs) },
  ];

  let count = 0;

  for (let turn = 0; turn < 6; turn++) {
    const stream = client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_THEME_TOOL],
      messages: conversation,
    });

    const toolCallsInTurn: Array<{ id: string; jsonAccum: string }> = [];
    const indexToToolCall = new Map<number, number>();

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "tool_use" && block.name === "submit_theme_summary") {
          const idx =
            toolCallsInTurn.push({ id: block.id, jsonAccum: "" }) - 1;
          indexToToolCall.set(event.index, idx);
          callbacks.onTextDelta("\n\n```json\n");
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          callbacks.onTextDelta(delta.text);
        } else if (delta.type === "input_json_delta") {
          const tcIdx = indexToToolCall.get(event.index);
          if (tcIdx !== undefined) {
            toolCallsInTurn[tcIdx].jsonAccum += delta.partial_json;
            callbacks.onTextDelta(delta.partial_json);
          }
        }
      } else if (event.type === "content_block_stop") {
        const tcIdx = indexToToolCall.get(event.index);
        if (tcIdx !== undefined) {
          callbacks.onTextDelta("\n```\n\n");
          const tc = toolCallsInTurn[tcIdx];
          try {
            const parsed = JSON.parse(tc.jsonAccum) as {
              theme_id: string;
              plain_english_headline: string;
              plain_english_summary: string;
            };
            callbacks.onThemeSummary(
              parsed.theme_id,
              parsed.plain_english_headline,
              parsed.plain_english_summary,
            );
            count++;
          } catch (err) {
            console.error("failed to parse theme tool call json", err, tc.jsonAccum);
          }
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    conversation.push({ role: "assistant", content: finalMessage.content });

    if (finalMessage.stop_reason !== "tool_use") {
      break;
    }

    callbacks.onTextDelta("\n\n");

    conversation.push({
      role: "user",
      content: toolCallsInTurn.map((tc) => ({
        type: "tool_result" as const,
        tool_use_id: tc.id,
        content: "Theme summary recorded. Continue with the next theme, or end your turn if all are done.",
      })),
    });
  }

  return { count };
}
