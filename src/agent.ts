import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { toolDefinitions, toolHandlers } from "./tools/index.js";
import { webSearchTool } from "./tools/search-web.js";
import { MODEL } from "./constants/app.js";
import { calculateCost } from "./utils/pricing.js";
import { SessionLogger } from "./utils/logger.js";
import { createReadline, ask } from "./utils/cli.js";
import { saveToFile } from "./tools/save-to-file.js";
import { loadProfile } from "./agent/profile-loader.js";
import { handleToolCalls } from "./agent/tool-handler.js";
import {
  compressToolResults,
  trimMessages,
} from "./agent/message-optimizer.js";
import {
  extractTopic,
  stripPreamble,
} from "./agent/helpers.js";

export async function runAgent(
  userInput: string,
  options?: { profile?: string; mix?: [string, string]; debug?: boolean },
): Promise<void> {
  const debug = options?.debug ?? false;
  const client = new Anthropic();

  console.log(chalk.bold("\n✍️  Ghostpen\n"));

  const loaded = await loadProfile(options);
  if (!loaded) return;

  const { systemBlocks, profileUsed, defaultPlatform } = loaded;

  if (debug) {
    console.log(chalk.gray(`[debug] Profile: ${profileUsed}`));
    console.log(chalk.gray(`[debug] System blocks: ${systemBlocks.length}`));
    console.log(chalk.gray(`[debug] Tools: ${toolDefinitions.map((t) => t.name).join(", ")}`));
    console.log("");
  }

  const logger = new SessionLogger(userInput, profileUsed);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userInput },
  ];

  const tools: Anthropic.Messages.ToolUnion[] = [
    webSearchTool,
    ...toolDefinitions.map((t, i) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      ...(i === toolDefinitions.length - 1 && {
        cache_control: { type: "ephemeral" as const },
      }),
    })),
  ];

  const usage = { input: 0, output: 0, cache_write: 0, cache_read: 0 };

  function trackUsage(response: Anthropic.Message): void {
    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;
    const u = response.usage as unknown as Record<string, number>;
    usage.cache_write += u.cache_creation_input_tokens ?? 0;
    usage.cache_read += u.cache_read_input_tokens ?? 0;
  }

  function printUsage(): void {
    const total = usage.input + usage.output;
    const saved = usage.cache_read;
    const cost = calculateCost(usage);
    console.log(
      chalk.dim(
        `\n📊 Tokens: ${total} total (in: ${usage.input}, out: ${usage.output}) | ` +
          `Cache: ${usage.cache_read} read, ${usage.cache_write} write` +
          (saved > 0
            ? ` | Saved ~${Math.round((saved / (usage.input + saved)) * 100)}% via cache`
            : "") +
          ` | 💰 $${cost.toFixed(4)}`,
      ),
    );
  }

  const rl = createReadline();
  let isFirstResponse = true;

  try {
    while (true) {
      if (isFirstResponse) {
        console.log(chalk.dim("🧠 Думаю...\n"));
      }

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemBlocks,
        tools,
        messages,
      });
      trackUsage(response);
      logger.event("api_call", {
        stop_reason: response.stop_reason,
        usage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      });

      if (debug) {
        console.log(
          chalk.gray(
            `[debug] stop_reason: ${response.stop_reason}, blocks: ${response.content.length}`,
          ),
        );
      }

      if (response.stop_reason === "tool_use") {
        const toolNames = response.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
          .map((b) => b.name);
        if (debug) {
          console.log(chalk.gray(`[debug] Tool calls: ${toolNames.join(", ")}`));
        }
        logger.event("tool_call", { tools: toolNames });
        const toolMessages = await handleToolCalls(response);
        messages.push(...toolMessages);
        compressToolResults(messages);
        continue;
      }

      isFirstResponse = false;

      for (const block of response.content) {
        if (block.type === "server_tool_use") {
          const query = (block.input as { query?: string })?.query ?? "";
          console.log(chalk.dim(`🔍 Шукаю: "${query}"\n`));
        }
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      logger.event("assistant_text", {
        length: text.length,
        preview: text.slice(0, 200),
      });

      console.log(chalk.dim("  ✏️  Генерую відповідь...\n"));
      console.log(text + "\n");

      let feedback = "";
      while (!feedback) {
        feedback = await ask(
          rl,
          'Що змінити? (або "ok" щоб зберегти)\n> ',
        );
      }

      logger.event("user_feedback", { feedback });

      if (["exit", "quit"].includes(feedback.toLowerCase())) {
        console.log(chalk.dim("\n👋 Завершено без збереження."));
        break;
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: feedback });

      if (["ok", "зберігай", "готово"].includes(feedback.toLowerCase())) {
        console.log("");
        const saveResult = await saveToFile({
          content: stripPreamble(text),
          platform: defaultPlatform,
          topic: extractTopic(userInput),
          profile_used: profileUsed,
        });
        if (saveResult.success) {
          console.log(chalk.green(`💾 Збережено: ${saveResult.file_path}`) + "\n");
        } else {
          console.log(chalk.red("❌ Помилка збереження\n"));
        }
        logger.event("save", { direct: true, ...saveResult });

        break;
      }

      compressToolResults(messages);
      trimMessages(messages);

      console.log(chalk.dim("\n  🔄 Переробляю...\n"));
    }
  } finally {
    printUsage();
    logger.updateUsage(usage, calculateCost(usage));
    const logPath = await logger.flush();
    console.log(chalk.dim(`📋 Лог: ${logPath}`));
    rl.close();
  }
}
