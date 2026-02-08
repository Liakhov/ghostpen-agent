import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as readline from "node:readline";
import chalk from "chalk";
import { buildAnalyzePrompt } from "../prompts/tasks/analyze-style.js";
import { buildCreateProfilePrompt } from "../prompts/tasks/create-profile.js";
import type { StyleProfile } from "../types/style-profile.js";

const MODEL = "claude-sonnet-4-20250514";
const PROFILES_DIR = path.resolve("data/profiles");

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

async function readMultilineInput(rl: readline.Interface): Promise<string> {
  console.log(
    chalk.dim("(Встав пости, розділяючи їх рядком ---. Двічі Enter для завершення)\n"),
  );

  return new Promise((resolve) => {
    const lines: string[] = [];
    let emptyCount = 0;

    const onLine = (line: string) => {
      if (line === "") {
        emptyCount++;
        if (emptyCount >= 2) {
          rl.removeListener("line", onLine);
          resolve(lines.join("\n"));
          return;
        }
      } else {
        emptyCount = 0;
      }
      lines.push(line);
    };

    rl.on("line", onLine);
  });
}

function parsePosts(raw: string): string[] {
  return raw
    .split(/\n---\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function extractJson(text: string): string {
  // Try to find JSON in markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }
  // Otherwise try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0]) {
    return jsonMatch[0];
  }
  return text;
}

function validateProfile(data: unknown): data is StyleProfile {
  const p = data as Record<string, unknown>;
  if (!p || typeof p !== "object") return false;
  if (typeof p.profile_name !== "string") return false;
  if (p.profile_type !== "personal" && p.profile_type !== "reference")
    return false;
  if (typeof p.version !== "number") return false;

  const voice = p.voice as Record<string, unknown> | undefined;
  if (!voice || typeof voice !== "object") return false;
  if (!Array.isArray(voice.hooks) || voice.hooks.length === 0) return false;
  if (!Array.isArray(voice.avoid) || voice.avoid.length === 0) return false;

  if (!p.platforms || typeof p.platforms !== "object") return false;
  if (Object.keys(p.platforms as object).length === 0) return false;

  if (!Array.isArray(p.examples) || p.examples.length === 0) return false;

  return true;
}

function formatSummary(profile: StyleProfile): string {
  const v = profile.voice;
  const platforms = Object.keys(profile.platforms).join(", ");

  return [
    chalk.bold("\nТвій стиль:\n"),
    `${chalk.cyan("Тон:")} ${v.tone}`,
    `${chalk.cyan("Формальність:")} ${v.formality}`,
    `${chalk.cyan("Характер:")} ${v.personality}`,
    `${chalk.cyan("Речення:")} ${v.sentence_style}`,
    `${chalk.cyan("Абзаци:")} ${v.paragraph_style}`,
    `${chalk.cyan("Hooks:")} ${v.hooks.join("; ")}`,
    `${chalk.cyan("Closings:")} ${v.closings.join("; ")}`,
    `${chalk.cyan("Signature phrases:")} ${v.signature_phrases.join(", ")}`,
    `${chalk.cyan("Уникаєш:")} ${v.avoid.join("; ")}`,
    `${chalk.cyan("Emoji:")} ${v.emoji_usage}`,
    `${chalk.cyan("Платформи:")} ${platforms}`,
    `${chalk.cyan("Прикладів:")} ${profile.examples.length}`,
  ].join("\n");
}

export async function runInit(): Promise<void> {
  const client = new Anthropic();
  const rl = createReadline();

  try {
    console.log(chalk.bold("\nGhostpen Init — створення персонального Style Profile\n"));
    console.log("Встав свої найкращі пости (10-20 штук).");
    console.log("Розділяй пости рядком --- між ними.");

    const raw = await readMultilineInput(rl);
    const posts = parsePosts(raw);

    if (posts.length < 3) {
      console.log(
        chalk.yellow(`\nОтримано тільки ${posts.length} пост(ів). Рекомендовано мінімум 5 для якісного аналізу.`),
      );
      if (posts.length === 0) {
        console.log(chalk.red("Не знайдено жодного поста. Спробуй ще раз."));
        return;
      }
    }

    console.log(chalk.dim(`\nОтримано ${posts.length} постів.`));

    // Step 1: Analyze style
    console.log(chalk.dim("🔍 Аналізую стиль...\n"));

    const analysisResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: buildAnalyzePrompt(posts) }],
    });

    const analysis = extractText(analysisResponse);

    // Step 2: Create profile JSON
    console.log(chalk.dim("📝 Створюю Style Profile...\n"));

    const profileResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: buildCreateProfilePrompt(analysis, "personal", "default"),
        },
      ],
    });

    const profileText = extractText(profileResponse);
    const jsonText = extractJson(profileText);

    let profile: StyleProfile;
    try {
      profile = JSON.parse(jsonText) as StyleProfile;
    } catch {
      console.log(chalk.red("Не вдалося розпарсити JSON від Claude. Спробуй ще раз."));
      console.log(chalk.dim("\nRaw output:\n" + profileText.slice(0, 500)));
      return;
    }

    if (!validateProfile(profile)) {
      console.log(chalk.yellow("Профіль неповний. Деякі обов'язкові поля відсутні."));
    }

    // Show summary
    console.log(formatSummary(profile));

    // Feedback loop for adjustments
    while (true) {
      const feedback = await ask(
        rl,
        '\nВсе вірно? Що змінити? (або "ok" щоб зберегти)\n> ',
      );

      if (["ok", "зберігай", "готово", ""].includes(feedback.toLowerCase())) {
        break;
      }

      if (["exit", "quit"].includes(feedback.toLowerCase())) {
        console.log("\nСтворення профілю скасовано.");
        return;
      }

      console.log(chalk.dim("\n🔄 Оновлюю профіль...\n"));

      const updateResponse = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: buildCreateProfilePrompt(analysis, "personal", "default"),
          },
          { role: "assistant", content: jsonText },
          {
            role: "user",
            content: `Оновити цей Style Profile JSON згідно з фідбеком: "${feedback}". Поверни ТІЛЬКИ оновлений JSON. Без пояснень.`,
          },
        ],
      });

      const updatedText = extractText(updateResponse);
      const updatedJson = extractJson(updatedText);

      try {
        const updated = JSON.parse(updatedJson) as StyleProfile;
        if (validateProfile(updated)) {
          profile = updated;
          console.log(formatSummary(profile));
        } else {
          console.log(chalk.yellow("Оновлення не вдалося, деякі поля відсутні. Спробуй інший фідбек."));
        }
      } catch {
        console.log(chalk.yellow("Не вдалося розпарсити оновлений JSON. Спробуй інший фідбек."));
      }
    }

    // Save profile
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    const filePath = path.join(PROFILES_DIR, "default.json");
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), "utf-8");

    console.log(chalk.green(`\n✅ Профіль збережено: ${path.relative(process.cwd(), filePath)}`));
  } finally {
    rl.close();
  }
}