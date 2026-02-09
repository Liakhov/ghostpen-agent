import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OUTPUT_DIR } from "../constants/paths.js";

export const readPastPostsSchema = {
  name: "read_past_posts" as const,
  description:
    "Шукає серед раніше згенерованих постів за ключовими словами та платформою. " +
    "Використовуй щоб НЕ повторювати теми і для reference на попередній контент.",
  input_schema: {
    type: "object" as const,
    properties: {
      keywords: {
        type: "array",
        items: { type: "string" },
        description: "Ключові слова для пошуку (case-insensitive)",
      },
      platform: {
        type: "string",
        enum: ["linkedin", "instagram", "x"],
        description: "Фільтр по платформі (опціонально)",
      },
      limit: {
        type: "number",
        description: "Максимум результатів. Default: 5",
      },
    },
    required: ["keywords"] as string[],
  },
};

interface PostMeta {
  platform: string;
  topic: string;
  created: string;
  profile_used: string;
}

function parseFrontmatter(raw: string): { meta: PostMeta; content: string } | null {
  const parts = raw.split("---\n");
  if (parts.length < 3) return null;

  const meta: Record<string, string> = {};
  for (const line of parts[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value) meta[key] = value;
  }

  if (!meta.platform || !meta.topic) return null;

  return {
    meta: {
      platform: meta.platform,
      topic: meta.topic,
      created: meta.created ?? "",
      profile_used: meta.profile_used ?? "default",
    },
    content: parts.slice(2).join("---\n").trim(),
  };
}

export async function readPastPosts(input: {
  keywords: string[];
  platform?: string;
  limit?: number;
}): Promise<object> {
  const { keywords, platform, limit = 5 } = input;

  try {
    const files = await fs.readdir(OUTPUT_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      return { success: true, posts: [], message: "Немає збережених постів." };
    }

    const matches: {
      file: string;
      meta: PostMeta;
      preview: string;
      score: number;
    }[] = [];

    const lowerKeywords = keywords.map((k) => k.toLowerCase());

    for (const file of mdFiles) {
      const raw = await fs.readFile(path.join(OUTPUT_DIR, file), "utf-8");
      const parsed = parseFrontmatter(raw);
      if (!parsed) continue;

      if (platform && parsed.meta.platform !== platform) continue;

      const searchText = `${parsed.meta.topic} ${parsed.content}`.toLowerCase();
      let score = 0;
      for (const kw of lowerKeywords) {
        if (searchText.includes(kw)) score++;
      }

      if (score === 0) continue;

      matches.push({
        file,
        meta: parsed.meta,
        preview: parsed.content.slice(0, 200) + (parsed.content.length > 200 ? "..." : ""),
        score,
      });
    }

    matches.sort((a, b) => b.score - a.score);
    const results = matches.slice(0, limit);

    return {
      success: true,
      total_posts: mdFiles.length,
      matched: results.length,
      posts: results.map(({ file, meta, preview }) => ({
        file,
        platform: meta.platform,
        topic: meta.topic,
        created: meta.created,
        preview,
      })),
    };
  } catch {
    return { success: true, posts: [], message: "Папка з постами не знайдена." };
  }
}
