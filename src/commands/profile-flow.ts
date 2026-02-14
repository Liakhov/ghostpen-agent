import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import { buildAnalyzePrompt } from "../prompts/tasks/analyze-style.js";
import { buildCreateProfilePrompt } from "../prompts/tasks/create-profile.js";
import { MODEL } from "../constants/app.js";
import { PROFILES_DIR } from "../constants/paths.js";
import { createReadline, ask } from "../utils/cli.js";
import { extractText, extractJson } from "../utils/response-parser.js";
import { validateProfile } from "../utils/profile-validation.js";
import type { StyleProfile } from "../types/style-profile.js";
import {
  readMultilineInput,
  parsePosts,
  formatSummary,
} from "./init.js";

export type ProfileType = "personal" | "reference";

export interface ProfileFlowOptions {
  profileType: ProfileType;
  profileName: string;
  title: string;
  postsPrompt: string;
}

export async function runProfileCreationFlow(
  options: ProfileFlowOptions,
): Promise<boolean> {
  const { profileType, profileName, title, postsPrompt } = options;
  const client = new Anthropic();
  const rl = createReadline();

  try {
    console.log(chalk.bold(`\n${title}\n`));
    console.log(postsPrompt);
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
        return false;
      }
    }

    console.log(chalk.dim(`\nОтримано ${posts.length} постів.`));

    console.log(chalk.dim("🔍 Аналізую стиль...\n"));

    const analysisResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: buildAnalyzePrompt(posts) }],
    });

    const analysis = extractText(analysisResponse);

    console.log(chalk.dim("📝 Створюю Style Profile...\n"));

    const profileResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: buildCreateProfilePrompt(analysis, profileType, profileName),
        },
      ],
    });

    const profileText = extractText(profileResponse);
    let jsonText = extractJson(profileText);

    let profile: StyleProfile;
    try {
      profile = JSON.parse(jsonText) as StyleProfile;
    } catch {
      console.log(
        chalk.red("Не вдалося розпарсити JSON від Claude. Спробуй ще раз."),
      );
      console.log(chalk.dim("\nRaw output:\n" + profileText.slice(0, 500)));
      return false;
    }

    if (!validateProfile(profile)) {
      console.log(
        chalk.yellow("Профіль неповний. Деякі обов'язкові поля відсутні."),
      );
    }

    console.log(formatSummary(profile));

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
        return false;
      }

      console.log(chalk.dim("\n🔄 Оновлюю профіль...\n"));

      const updateResponse = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: buildCreateProfilePrompt(analysis, profileType, profileName),
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
          jsonText = updatedJson;
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

    await fs.mkdir(PROFILES_DIR, { recursive: true });
    const filePath = path.join(PROFILES_DIR, `${profileName}.json`);
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), "utf-8");

    console.log(
      chalk.green(
        `\n✅ Профіль збережено: ${path.relative(process.cwd(), filePath)}`,
      ),
    );
    return true;
  } finally {
    rl.close();
  }
}
