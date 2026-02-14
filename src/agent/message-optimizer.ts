import type Anthropic from "@anthropic-ai/sdk";
import { MAX_HISTORY_PAIRS, TOOL_SUMMARIES } from "../constants/app.js";

export function trimMessages(messages: Anthropic.MessageParam[]): void {
  const maxMessages = 1 + MAX_HISTORY_PAIRS * 2;
  if (messages.length > maxMessages) {
    const keep = messages.slice(-MAX_HISTORY_PAIRS * 2);
    messages.length = 0;
    messages.push({
      role: "user",
      content: "[...попередня історія обрізана...]",
    });
    messages.push(...keep);
  }
}

export function compressToolResults(
  messages: Anthropic.MessageParam[],
): void {
  for (const msg of messages) {
    if (msg.role !== "user" || typeof msg.content === "string") continue;
    const blocks = msg.content as Anthropic.ToolResultBlockParam[];
    for (const block of blocks) {
      if (block.type !== "tool_result" || typeof block.content !== "string")
        continue;
      if (block.content.length <= 200) continue;
      const toolName = findToolName(messages, block.tool_use_id);
      if (toolName && TOOL_SUMMARIES[toolName]) {
        block.content = TOOL_SUMMARIES[toolName];
      }
    }
  }
}

export function findToolName(
  messages: Anthropic.MessageParam[],
  toolUseId: string,
): string | undefined {
  for (const msg of messages) {
    if (msg.role !== "assistant" || typeof msg.content === "string") continue;
    for (const block of msg.content as Anthropic.ContentBlock[]) {
      if (block.type === "tool_use" && block.id === toolUseId) {
        return block.name;
      }
    }
  }
  return undefined;
}
