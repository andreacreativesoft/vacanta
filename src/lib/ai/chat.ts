import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { ulid } from "ulid";

import { appendChatMessage, listChatMessages } from "@/lib/db/queries";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "./system-prompt";
import { TOOL_DEFINITIONS, executeTool } from "./tools";
import type { ChatMessage } from "@/types/dto";

const log = createLogger("chat");

const MODEL = "claude-sonnet-4-5";
const MAX_TOOL_TURNS = 5;

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    };

type AnthropicMessage = Anthropic.Messages.MessageParam;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in .env.local");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export type HandleChatTurnArgs = {
  searchId: string | null;
  message: string;
};

export type HandleChatTurnResult = {
  reply: ChatMessage;
  userMessageId: string;
};

export async function handleChatTurn(
  args: HandleChatTurnArgs,
): Promise<HandleChatTurnResult> {
  const client = getClient();

  // Persist the user message immediately
  const userRow = appendChatMessage({
    id: ulid(),
    searchId: args.searchId ?? null,
    role: "user",
    contentJson: JSON.stringify({ text: args.message }),
  });

  const history = buildAnthropicHistory(args.searchId, args.message, userRow.id);

  let messages: AnthropicMessage[] = history;
  let finalText = "";

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    const blocks = response.content as AnthropicContentBlock[];
    const toolUses = blocks.filter(
      (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> =>
        b.type === "tool_use",
    );
    const text = blocks
      .filter(
        (b): b is Extract<AnthropicContentBlock, { type: "text" }> =>
          b.type === "text",
      )
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (text) finalText = text;

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      break;
    }

    messages = [
      ...messages,
      { role: "assistant", content: blocks },
      {
        role: "user",
        content: await Promise.all(
          toolUses.map(async (tu) => {
            try {
              const result = await executeTool(tu.name, tu.input);
              return {
                type: "tool_result" as const,
                tool_use_id: tu.id,
                content: JSON.stringify(result),
                is_error: !result.ok,
              };
            } catch (e) {
              log.error("tool execution failed", e);
              return {
                type: "tool_result" as const,
                tool_use_id: tu.id,
                content: JSON.stringify({
                  ok: false,
                  error: e instanceof Error ? e.message : "tool error",
                }),
                is_error: true,
              };
            }
          }),
        ),
      },
    ];
  }

  if (!finalText) {
    finalText =
      "Sorry — I wasn't able to come up with a response. Try rephrasing or check the logs.";
  }

  const assistantRow = appendChatMessage({
    id: ulid(),
    searchId: args.searchId ?? null,
    role: "assistant",
    contentJson: JSON.stringify({ text: finalText }),
  });

  return {
    userMessageId: userRow.id,
    reply: {
      id: assistantRow.id,
      role: "assistant",
      content: finalText,
      createdAt: assistantRow.createdAt.toISOString(),
    },
  };
}

function buildAnthropicHistory(
  searchId: string | null,
  newUserMessage: string,
  newUserMessageId: string,
): AnthropicMessage[] {
  const past = listChatMessages(searchId).filter(
    (m) => m.id !== newUserMessageId,
  );
  const messages: AnthropicMessage[] = [];
  for (const m of past) {
    if (m.role === "tool") continue; // tool messages are ephemeral; we skip replaying them
    const text = parseText(m.contentJson);
    if (!text) continue;
    messages.push({
      role: m.role === "user" ? "user" : "assistant",
      content: text,
    });
  }
  messages.push({ role: "user", content: newUserMessage });
  return messages;
}

function parseText(contentJson: string): string {
  try {
    const v = JSON.parse(contentJson) as { text?: string } | string;
    if (typeof v === "string") return v;
    return v?.text ?? "";
  } catch {
    return contentJson;
  }
}
