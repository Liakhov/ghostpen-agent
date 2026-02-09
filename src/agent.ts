import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline";
import chalk from "chalk";
import { toolDefinitions, toolHandlers } from "./tools/index.js";
import { readStyleProfile } from "./tools/style-profile.js";
import { webSearchTool } from "./tools/search-web.js";
import { MIX_MODE_TEMPLATE } from "./prompts/templates/mix-mode.js";
import { SYSTEM_PROMPT, NOTION_PROMPT } from "./prompts/system.js";
import { MODEL, MAX_HISTORY_PAIRS, TOOL_LABELS, TOOL_SUMMARIES } from "./constants/app.js";
import { calculateCost } from "./utils/pricing.js";
import { isNotionConfigured } from "./utils/config.js";
import { SessionLogger } from "./utils/logger.js";
import { saveToFile } from "./tools/save-to-file.js";


function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function extractTopic(input: string): string {
  return input
    .replace(/^(напиши|створи|згенеруй|зроби|write|create|generate|make)\s+(пост|допис|тред|статтю|текст|post|thread|article)\s+(про|на тему|about)\s+/i, "")
    .trim();
}

/**
 * Strip the model's preamble line (e.g. "Прочитав профіль, генерую для LinkedIn.")
 * The system prompt instructs the model to output a 1-line summary first,
 * followed by a blank line, then the actual post.
 */
function stripPreamble(text: string): string {
  const idx = text.indexOf("\n\n");
  if (idx === -1) return text;
  const firstLine = text.slice(0, idx);
  // Only strip if it looks like a preamble (short, contains keywords)
  if (firstLine.length < 200 && /профіль|генерую|profile|generating/i.test(firstLine)) {
    return text.slice(idx + 2);
  }
  return text;
}

function extractDefaultPlatform(profile: object | undefined): string {
  if (!profile || typeof profile !== "object") return "linkedin";
  const p = profile as Record<string, unknown>;
  if (p.platforms && typeof p.platforms === "object") {
    const platforms = Object.keys(p.platforms as object);
    if (platforms.length > 0) return platforms[0];
  }
  return "linkedin";
}


async function handleToolCalls(
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

// --- Optimization helpers ---


/**
 * #2: Trim old messages — keep first user message + last N pairs.
 * Tool call/result pairs count as part of the exchange, not separate pairs.
 */
function trimMessages(messages: Anthropic.MessageParam[]): void {
  // First message is always the original user request — keep it
  const maxMessages = 1 + MAX_HISTORY_PAIRS * 2;
  if (messages.length > maxMessages) {
    const keep = messages.slice(-MAX_HISTORY_PAIRS * 2);
    messages.length = 0;
    messages.push({ role: "user", content: "[...попередня історія обрізана...]" });
    messages.push(...keep);
  }
}

/**
 * #3: Compress tool results in history.
 * After model has consumed a tool result, replace large JSON with a short summary.
 */

function compressToolResults(messages: Anthropic.MessageParam[]): void {
  for (const msg of messages) {
    if (msg.role !== "user" || typeof msg.content === "string") continue;
    const blocks = msg.content as Anthropic.ToolResultBlockParam[];
    for (const block of blocks) {
      if (block.type !== "tool_result" || typeof block.content !== "string")
        continue;
      // Only compress if content is large (>200 chars)
      if (block.content.length <= 200) continue;
      // Find matching tool name from preceding assistant message
      const toolName = findToolName(messages, block.tool_use_id);
      if (toolName && TOOL_SUMMARIES[toolName]) {
        block.content = TOOL_SUMMARIES[toolName];
      }
    }
  }
}

function findToolName(
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

export async function runAgent(
  userInput: string,
  options?: { profile?: string; mix?: [string, string]; debug?: boolean },
): Promise<void> {
  const debug = options?.debug ?? false;
  const client = new Anthropic();

  console.log(chalk.bold("\n✍️  Ghostpen\n"));

  // Determine which profile(s) to load
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  let profileUsed: string;
  let defaultPlatform = "linkedin";

  if (options?.mix) {
    const [baseName, refName] = options.mix;
    const baseResult = await readStyleProfile({ profile_name: baseName });
    const refResult = await readStyleProfile({ profile_name: refName });
    const baseData = (baseResult as { success: boolean; profile?: object }).profile;
    const refData = (refResult as { success: boolean; profile?: object }).profile;

    if (!baseData) {
      console.log(chalk.red(`❌ Не вдалося завантажити base профіль "${baseName}".`));
      return;
    }
    if (!refData) {
      console.log(chalk.red(`❌ Не вдалося завантажити reference профіль "${refName}".`));
      return;
    }

    defaultPlatform = extractDefaultPlatform(baseData);

    systemBlocks.push(
      {
        type: "text",
        text: `\n--- BASE PROFILE ---\n${JSON.stringify(baseData, null, 2)}`,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `\n--- REFERENCE PROFILE ---\n${JSON.stringify(refData, null, 2)}`,
      },
      {
        type: "text",
        text: `\n${MIX_MODE_TEMPLATE}`,
        cache_control: { type: "ephemeral" },
      },
    );

    profileUsed = `mix:${baseName}+${refName}`;
    console.log(chalk.dim(`📎 Mix mode: ${baseName} + ${refName}\n`));
  } else {
    const profileName = options?.profile ?? "default";
    const profileResult = await readStyleProfile({ profile_name: profileName });
    const profileData = (profileResult as { success: boolean; profile?: object }).profile;

    if (!profileData) {
      console.log(
        chalk.red(
          `❌ Не вдалося завантажити style profile "${profileName}". Запусти ghostpen init.`,
        ),
      );
      return;
    }

    defaultPlatform = extractDefaultPlatform(profileData);

    systemBlocks.push({
      type: "text",
      text: `\n--- STYLE PROFILE (${profileName}) ---\n${JSON.stringify(profileData, null, 2)}`,
      cache_control: { type: "ephemeral" },
    });

    profileUsed = profileName;
    if (profileName !== "default") {
      console.log(chalk.dim(`📎 Профіль: ${profileName}\n`));
    }
  }

  // Add profile_used metadata to system prompt so model can pass it to save_to_file
  systemBlocks.push({
    type: "text",
    text: `\nprofile_used: "${profileUsed}" — передавай це значення в save_to_file та write_to_notion.`,
  });

  // Add Notion instructions only when configured
  if (isNotionConfigured()) {
    systemBlocks.push({
      type: "text",
      text: NOTION_PROMPT,
    });
    if (debug) console.log(chalk.gray("[debug] Notion інтеграція активна"));
  }

  if (debug) {
    console.log(chalk.gray(`[debug] Profile: ${profileUsed}`));
    console.log(chalk.gray(`[debug] System blocks: ${systemBlocks.length}`));
    console.log(chalk.gray(`[debug] Tools: ${toolDefinitions.map((t) => t.name).join(", ")}`));
    console.log("");
  }

  const logger = new SessionLogger(userInput, profileUsed, isNotionConfigured());

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
        console.log(chalk.gray(`[debug] stop_reason: ${response.stop_reason}, blocks: ${response.content.length}`));
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
        // Compress tool results before next API call
        compressToolResults(messages);
        continue;
      }

      isFirstResponse = false;

      // Log server tool usage (web search)
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

      logger.event("assistant_text", { length: text.length, preview: text.slice(0, 200) });

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
        // Save directly without API call
        const saveResult = await saveToFile({
          content: stripPreamble(text),
          platform: defaultPlatform,
          topic: extractTopic(userInput),
          profile_used: profileUsed,
        });
        const sr = saveResult as { success: boolean; file_path?: string };
        if (sr.success) {
          console.log(chalk.green(`💾 Збережено: ${sr.file_path}`) + "\n");
        } else {
          console.log(chalk.red("❌ Помилка збереження\n"));
        }
        logger.event("save", { direct: true, ...sr });

        // Notion integration (if configured)
        if (isNotionConfigured()) {
          const notionAnswer = await ask(rl, "📋 Зберегти також в Notion? (y/n)\n> ");
          if (["y", "так", "yes"].includes(notionAnswer.toLowerCase())) {
            const notionHandler = toolHandlers.write_to_notion;
            if (notionHandler) {
              console.log(chalk.dim("📋 Зберігаю в Notion...\n"));
              const notionResult = await notionHandler({
                content: stripPreamble(text),
                platform: defaultPlatform,
                topic: extractTopic(userInput),
                profile_used: profileUsed,
              });
              const nr = notionResult as { success: boolean; url?: string; message?: string };
              if (nr.success) {
                console.log(chalk.green(`📋 Збережено в Notion: ${nr.url}\n`));
              } else {
                console.log(chalk.yellow(`⚠ ${nr.message ?? "Notion помилка"}\n`));
              }
            }
          }
        }

        break;
      }

      // Optimize before next iteration
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
