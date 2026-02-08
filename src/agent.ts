import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline";
import chalk from "chalk";
import { toolDefinitions, toolHandlers } from "./tools/index.js";

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

ОБОВ'ЯЗКОВО кожен раз перед генерацією:
1. Прочитай Style Profile (read_style_profile)

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

3. Питання: "Що змінити?"

Чого НЕ робити:
- Не додавай "## Ось ваш пост:" перед текстом
- Не коментуй свій вибір ("Я обрав цей hook тому що...")
- Не пропонуй альтернативи без запиту
- Не додавай disclaimer "це AI-контент"
- Не пиши "---" лінії між секціями поста якщо цього немає в профілі

ЗБЕРЕЖЕННЯ:
Коли користувач каже "ok", "зберігай", "готово" або щось подібне — виклич save_to_file з повним текстом поста, платформою і темою.
Після збереження повідом користувача де збережено файл.
Завжди зберігай. Це обов'язковий крок.`;

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
      console.log(chalk.dim(`  ${label}\n`));

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
        console.log(chalk.yellow(`  ⚠ ${res.message ?? "помилка"}`));
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

export async function runAgent(userInput: string): Promise<void> {
  const client = new Anthropic();

  console.log(chalk.bold("\n✍️  Ghostpen\n"));

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userInput },
  ];

  const tools: Anthropic.Tool[] = toolDefinitions.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  const rl = createReadline();
  let isFirstResponse = true;

  try {
    while (true) {
      if (isFirstResponse) {
        console.log(chalk.dim("  🧠 Думаю...\n"));
      }

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      if (response.stop_reason === "tool_use") {
        const toolMessages = await handleToolCalls(response);
        messages.push(...toolMessages);
        continue;
      }

      isFirstResponse = false;

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      console.log(chalk.dim("  ✏️  Генерую відповідь...\n"));
      console.log(text + "\n");

      const feedback = await ask(
        rl,
        'Що змінити? (або "ok" щоб зберегти)\n> ',
      );

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
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools,
            messages,
          });

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

      console.log(chalk.dim("\n  🔄 Переробляю...\n"));
    }
  } finally {
    rl.close();
  }
}
