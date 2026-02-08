import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as readline from "node:readline";
import chalk from "chalk";
import { buildAnalyzePrompt } from "../prompts/tasks/analyze-style.js";
import { buildCreateProfilePrompt } from "../prompts/tasks/create-profile.js";
import type { StyleProfile } from "../types/style-profile.js";
import {
  readMultilineInput,
  parsePosts,
  extractJson,
  validateProfile,
  formatSummary,
} from "./init.js";

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

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export async function createProfile(name: string): Promise<void> {
  if (name === "default") {
    console.log(
      chalk.red(
        'Профіль "default" створюється через ghostpen init. Обери інше ім\'я.',
      ),
    );
    return;
  }

  const client = new Anthropic();
  const rl = createReadline();

  try {
    console.log(
      chalk.bold(`\nGhostpen — створення reference профілю "${name}"\n`),
    );
    console.log("Встав пости автора (10-20 штук).");
    console.log("Розділяй пости рядком --- між ними.");

    const raw = await readMultilineInput(rl);
    const posts = parsePosts(raw);

    if (posts.length < 3) {
      console.log(
        chalk.yellow(
          `\nОтримано тільки ${posts.length} пост(ів). Рекомендовано мінімум 5 для якісного аналізу.`,
        ),
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
          content: buildCreateProfilePrompt(analysis, "reference", name),
        },
      ],
    });

    const profileText = extractText(profileResponse);
    const jsonText = extractJson(profileText);

    let profile: StyleProfile;
    try {
      profile = JSON.parse(jsonText) as StyleProfile;
    } catch {
      console.log(
        chalk.red("Не вдалося розпарсити JSON від Claude. Спробуй ще раз."),
      );
      console.log(chalk.dim("\nRaw output:\n" + profileText.slice(0, 500)));
      return;
    }

    if (!validateProfile(profile)) {
      console.log(
        chalk.yellow("Профіль неповний. Деякі обов'язкові поля відсутні."),
      );
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
            content: buildCreateProfilePrompt(analysis, "reference", name),
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
          console.log(
            chalk.yellow(
              "Оновлення не вдалося, деякі поля відсутні. Спробуй інший фідбек.",
            ),
          );
        }
      } catch {
        console.log(
          chalk.yellow(
            "Не вдалося розпарсити оновлений JSON. Спробуй інший фідбек.",
          ),
        );
      }
    }

    // Save profile
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    const filePath = path.join(PROFILES_DIR, `${name}.json`);
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), "utf-8");

    console.log(
      chalk.green(
        `\n✅ Профіль збережено: ${path.relative(process.cwd(), filePath)}`,
      ),
    );
  } finally {
    rl.close();
  }
}

export async function listProfiles(): Promise<void> {
  try {
    await fs.access(PROFILES_DIR);
  } catch {
    console.log(chalk.yellow("Профілів ще немає. Запусти ghostpen init."));
    return;
  }

  const files = await fs.readdir(PROFILES_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  if (jsonFiles.length === 0) {
    console.log(chalk.yellow("Профілів ще немає. Запусти ghostpen init."));
    return;
  }

  console.log(chalk.bold("\nПрофілі:\n"));

  const rows: { name: string; type: string; tone: string; updated: string }[] =
    [];

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(PROFILES_DIR, file), "utf-8");
      const data = JSON.parse(raw) as StyleProfile;
      rows.push({
        name: data.profile_name,
        type: data.profile_type,
        tone: data.voice?.tone ?? "—",
        updated: data.updated_at?.slice(0, 10) ?? "—",
      });
    } catch {
      rows.push({
        name: file.replace(".json", ""),
        type: "?",
        tone: "?",
        updated: "?",
      });
    }
  }

  const maxName = Math.max(...rows.map((r) => r.name.length), 4);
  const maxType = Math.max(...rows.map((r) => r.type.length), 4);
  const maxTone = Math.max(...rows.map((r) => r.tone.length), 4);

  const header = `  ${chalk.dim("NAME".padEnd(maxName))}  ${chalk.dim("TYPE".padEnd(maxType))}  ${chalk.dim("TONE".padEnd(maxTone))}  ${chalk.dim("UPDATED")}`;
  console.log(header);

  for (const row of rows) {
    console.log(
      `  ${chalk.cyan(row.name.padEnd(maxName))}  ${row.type.padEnd(maxType)}  ${row.tone.padEnd(maxTone)}  ${row.updated}`,
    );
  }

  console.log("");
}

export async function showProfile(name: string): Promise<void> {
  const filePath = path.join(PROFILES_DIR, `${name}.json`);

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const profile = JSON.parse(raw) as StyleProfile;
    console.log(formatSummary(profile));
  } catch {
    console.log(chalk.red(`Профіль "${name}" не знайдено.`));
  }
}

export async function deleteProfile(name: string): Promise<void> {
  if (name === "default") {
    console.log(
      chalk.red('Профіль "default" не можна видалити.'),
    );
    return;
  }

  const filePath = path.join(PROFILES_DIR, `${name}.json`);

  try {
    await fs.access(filePath);
  } catch {
    console.log(chalk.red(`Профіль "${name}" не знайдено.`));
    return;
  }

  await fs.unlink(filePath);
  console.log(chalk.green(`✅ Профіль "${name}" видалено.`));
}
