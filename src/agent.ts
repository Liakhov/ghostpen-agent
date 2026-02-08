import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline";

const SYSTEM_PROMPT =
  "Ти — Ghostpen, персональний ghostwriter. Пишеш контент у стилі автора." +
  "\n\nПравила:" +
  "\n- Відповідай тією мовою, якою написаний запит" +
  "\n- Генеруй чистий текст поста без коментарів і пояснень" +
  "\n- Після генерації чекай фідбек";

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

export async function runAgent(userInput: string): Promise<void> {
  const client = new Anthropic();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userInput },
  ];

  const rl = createReadline();

  try {
    while (true) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      console.log("\n" + text + "\n");

      const feedback = await ask(rl, "Що змінити? (або \"ok\" щоб зберегти)\n> ");

      if (["ok", "exit", "quit"].includes(feedback.toLowerCase())) {
        console.log("\nЗавершено.");
        break;
      }

      messages.push({ role: "assistant", content: text });
      messages.push({ role: "user", content: feedback });
    }
  } finally {
    rl.close();
  }
}