import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OUTPUT_DIR } from "../constants/paths.js";
import type { SaveToFileResult } from "../types/tool-results.js";

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ye",
  ж: "zh", з: "z", и: "y", і: "i", ї: "yi", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "",
  ю: "yu", я: "ya",
};

function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join("");
}

function toSlug(text: string): string {
  return transliterate(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export const saveToFileSchema = {
  name: "save_to_file" as const,
  description:
    "Зберігає фінальну версію поста як Markdown файл з метаданими. " +
    "Викликай після того як користувач підтвердив фінальну версію ('ok', 'зберігай', 'готово').",
  input_schema: {
    type: "object" as const,
    properties: {
      content: {
        type: "string",
        description: "Повний текст поста",
      },
      platform: {
        type: "string",
        enum: ["linkedin", "instagram", "x"],
        description: "Платформа для якої написаний пост",
      },
      topic: {
        type: "string",
        description: "Тема поста в 2-3 словах для назви файлу",
      },
      profile_used: {
        type: "string",
        description:
          "Ім'я профілю або 'mix:default+competitor-alex'. Default: 'default'",
      },
    },
    required: ["content", "platform", "topic"] as string[],
  },
};

export async function saveToFile(input: {
  content: string;
  platform: string;
  topic: string;
  profile_used?: string;
}): Promise<SaveToFileResult> {
  const { content, platform, topic, profile_used = "default" } = input;

  const date = new Date().toISOString().slice(0, 10);
  const slug = toSlug(topic);
  const baseName = `${date}-${slug}-${platform}`;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let fileName = `${baseName}.md`;
  let filePath = path.join(OUTPUT_DIR, fileName);
  let suffix = 1;

  while (true) {
    try {
      await fs.access(filePath);
      suffix++;
      fileName = `${baseName}-${suffix}.md`;
      filePath = path.join(OUTPUT_DIR, fileName);
    } catch {
      break;
    }
  }

  const frontmatter = [
    "---",
    `platform: ${platform}`,
    `topic: ${topic}`,
    `created: ${new Date().toISOString()}`,
    `profile_used: ${profile_used}`,
    "---",
  ].join("\n");

  const fileContent = `${frontmatter}\n\n${content}\n`;

  await fs.writeFile(filePath, fileContent, "utf-8");

  const relativePath = path.relative(process.cwd(), filePath);

  return {
    success: true,
    file_path: relativePath,
  };
}
