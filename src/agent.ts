import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline";
import chalk from "chalk";
import { toolDefinitions, toolHandlers } from "./tools/index.js";
import { FEEDBACK_RULES } from "./prompts/tasks/feedback-rules.js";
import { readStyleProfile } from "./tools/style-profile.js";
import { webSearchTool } from "./tools/search-web.js";
import { MIX_MODE_TEMPLATE } from "./prompts/templates/mix-mode.js";
import { isNotionConfigured } from "./utils/config.js";

const SYSTEM_PROMPT = `Ти — Ghostpen, персональний ghostwriter.

Твоя місія: писати контент який звучить як автор, не як AI.

Ти працюєш так:
- Користувач каже ЩО написати
- Ти вирішуєш ЯК це зробити
- Ти завжди спираєшся на Style Profile автора

Ти НЕ:
- Генератор шаблонів
- Чатбот для розмов
- SEO-інструмент

Ти говориш тією ж мовою, якою написаний Style Profile.
Якщо profile українською — пишеш українською.
Якщо англійською — англійською.

Style Profile автора завантажено нижче в system prompt.
Використовуй його для кожної генерації. НЕ викликай read_style_profile — профіль вже тут.
read_style_profile потрібен ТІЛЬКИ для mix mode (завантаження другого профілю).

Style Profile — це закон. Не рекомендація.

Коли ти отримав профіль:

1. TONE: Кожне речення має відповідати voice.tone.
   Якщо tone = "іронічний" — не пиши серйозно-мотиваційно.

2. AVOID: Перед видачею тексту перевір кожен пункт voice.avoid.
   Якщо в avoid є "канцеляризми" і ти написав "в рамках" — перепиши.

3. HOOKS: Обирай hook з voice.hooks. Не вигадуй нових типів.
   Якщо перший в списку "провокативне твердження" — це пріоритетний hook.

4. STRUCTURE: Дотримуйся platforms[platform].structure точно.
   Якщо structure = "hook → story → insight → CTA" — не міняй порядок.

5. LENGTH: Ніколи не перевищуй platforms[platform].max_length.
   Краще коротше ніж довше.

6. SIGNATURE PHRASES: Використовуй 1-2 з voice.signature_phrases природно.
   Не впихуй всі. Не в кожен пост. Тільки де органічно.

7. EXAMPLES: Перед генерацією перечитай examples для цієї платформи.
   Твій текст має бути на тому ж рівні якості і в тому ж дусі.

Якщо ти не впевнений — перечитай examples ще раз.
Вони — золотий стандарт.

Формат відповіді при генерації:

1. Коротко (1 рядок) що ти зробив:
   "Прочитав профіль, генерую для LinkedIn"

2. Чернетка поста — чистий текст, без коментарів, без markdown headers.
   Пост має виглядати ТОЧНО так, як буде опублікований.

Чого НЕ робити:
- Не додавай "## Ось ваш пост:" перед текстом
- Не коментуй свій вибір ("Я обрав цей hook тому що...")
- Не пропонуй альтернативи без запиту
- Не додавай disclaimer "це AI-контент"
- Не пиши "---" лінії між секціями поста якщо цього немає в профілі

ЗБЕРЕЖЕННЯ:
Коли користувач каже "ok", "зберігай", "готово" або щось подібне — виклич save_to_file з повним текстом поста, платформою і темою.
Після збереження повідом користувача де збережено файл.
Завжди зберігай. Це обов'язковий крок.

РІШЕННЯ ПРО ПОШУК:
Перед генерацією визнач чи потрібна додаткова інформація:

1. WEB SEARCH — використовуй коли:
   - Тема про тренди, новини, статистику, свіжі дані
   - Потрібні конкретні факти, цифри, дати
   - Пост про індустрію/ринок/технології
   НЕ використовуй для: особисті історії, рефлексії, мотиваційні пости

2. МИНУЛІ ПОСТИ (read_past_posts) — використовуй коли:
   - Тема може перетинатися з попередніми постами
   - Щоб НЕ повторювати те саме
   - Для reference на попередній контент
   НЕ використовуй для: зовсім нових тем де точно не було постів

Web search: ЗАВЖДИ питай користувача перед пошуком. Наприклад: "Хочеш щоб я пошукав свіжу статистику по цій темі?"
Минулі пости: перевіряй сам без питань.

ФІДБЕК:
${FEEDBACK_RULES}`;

const NOTION_PROMPT = `
NOTION:
Notion інтеграція налаштована. Ти маєш два додаткові інструменти:

1. read_notion_page — читає Notion-сторінку за URL або ID.
   Використовуй коли користувач дає посилання на Notion як джерело/нотатку.

2. write_to_notion — зберігає пост в Notion database.
   Після збереження локально через save_to_file, ЗАПИТАЙ користувача:
   "📋 Зберегти також в Notion? (y/n)"
   Якщо "y" або "так" — виклич write_to_notion.
   Якщо "n" або "ні" — не зберігай.
   При помилці Notion — файл вже збережено локально, повідом про це.`;

const MODEL = "claude-sonnet-4-20250514";

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

const TOOL_LABELS: Record<string, string> = {
  read_style_profile: "📖 Читаю style profile...",
  save_to_file: "💾 Зберігаю файл...",
  search_web: "🔍 Шукаю в інтернеті...",
  read_past_posts: "📚 Перевіряю минулі пости...",
  read_notion_page: "📄 Читаю Notion-сторінку...",
  write_to_notion: "📋 Зберігаю в Notion...",
  track_feedback: "📝 Записую фідбек...",
  update_style_profile: "🔄 Оновлюю profile...",
};

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

const MAX_HISTORY_PAIRS = 6; // keep last N user+assistant pairs (12 messages)

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
const TOOL_SUMMARIES: Record<string, string> = {
  read_style_profile: '{"summary":"style profile loaded"}',
  save_to_file: '{"summary":"file saved"}',
  track_feedback: '{"summary":"feedback tracked"}',
  update_style_profile: '{"summary":"profile updated"}',
  read_past_posts: '{"summary":"past posts checked"}',
  read_notion_page: '{"summary":"notion page read"}',
  write_to_notion: '{"summary":"saved to notion"}',
};

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
    console.log(
      chalk.dim(
        `\n📊 Tokens: ${total} total (in: ${usage.input}, out: ${usage.output}) | ` +
          `Cache: ${usage.cache_read} read, ${usage.cache_write} write` +
          (saved > 0
            ? ` | Saved ~${Math.round((saved / (usage.input + saved)) * 100)}% input via cache`
            : ""),
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

      if (debug) {
        console.log(chalk.gray(`[debug] stop_reason: ${response.stop_reason}, blocks: ${response.content.length}`));
      }

      if (response.stop_reason === "tool_use") {
        if (debug) {
          const toolNames = response.content
            .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
            .map((b) => b.name);
          console.log(chalk.gray(`[debug] Tool calls: ${toolNames.join(", ")}`));
        }
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

      console.log(chalk.dim("  ✏️  Генерую відповідь...\n"));
      console.log(text + "\n");

      let feedback = "";
      while (!feedback) {
        feedback = await ask(
          rl,
          'Що змінити? (або "ok" щоб зберегти)\n> ',
        );
      }

      if (["exit", "quit"].includes(feedback.toLowerCase())) {
        console.log(chalk.dim("\n👋 Завершено без збереження."));
        break;
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: feedback });

      if (["ok", "зберігай", "готово"].includes(feedback.toLowerCase())) {
        console.log("");
        // Let agent call save_to_file, then finish
        while (true) {
          const saveResponse = await client.messages.create({
            model: MODEL,
            max_tokens: 1024,
            system: systemBlocks,
            tools,
            messages,
          });
          trackUsage(saveResponse);

          if (saveResponse.stop_reason === "tool_use") {
            const toolMessages = await handleToolCalls(saveResponse);
            messages.push(...toolMessages);
            continue;
          }

          const saveText = saveResponse.content
            .filter(
              (block): block is Anthropic.TextBlock => block.type === "text",
            )
            .map((block) => block.text)
            .join("\n");

          if (saveText) {
            console.log(saveText + "\n");
          }
          break;
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
    rl.close();
  }
}
