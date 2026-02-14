import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { toolHandlers } from "../tools/index.js";
import { TOOL_LABELS } from "../constants/app.js";

export async function handleToolCalls(
  response: Anthropic.Message,
): Promise<Anthropic.MessageParam[]> {
  const assistantContent = response.content;
  const toolResults: Anthropic.ToolResultBlockParam[] = [];

  for (const block of assistantContent) {
    if (block.type === "tool_use") {
      const label = TOOL_LABELS[block.name] ?? block.name;
      console.log(chalk.dim(`${label}\n`));

      const handler = toolHandlers[block.name];
      if (!handler) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({
            success: false,
            error: "unknown_tool",
            message: `Tool '${block.name}' not found`,
          }),
        });
        continue;
      }

      const result = await handler(block.input as Record<string, unknown>);
      const res = result as Record<string, unknown>;

      if (res.success === false) {
        console.log(chalk.yellow(`⚠ ${res.message ?? "помилка"}`));
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
  }

  return [
    { role: "assistant", content: assistantContent },
    { role: "user", content: toolResults },
  ];
}
