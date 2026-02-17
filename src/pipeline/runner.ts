import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import { PROFILES_DIR, OUTPUT_DIR } from "../constants/paths.js";
import { parseFrontmatter, serializeFrontmatter } from "../utils/frontmatter.js";
import type { ParsedDocument } from "../utils/frontmatter.js";
import type { PostMeta } from "../types/index.js";

export async function loadProfile(name: string): Promise<ParsedDocument> {
  const filePath = path.join(PROFILES_DIR, `${name}.md`);
  const content = await fs.readFile(filePath, "utf-8");
  return parseFrontmatter(content);
}

export async function savePost(
  text: string,
  metadata: PostMeta,
): Promise<string> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const slug = metadata.topic
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${timestamp}-${metadata.platform}-${slug}.md`;
  const filePath = path.join(OUTPUT_DIR, filename);

  const doc: ParsedDocument<PostMeta> = {
    frontmatter: metadata,
    body: text,
  };
  await fs.writeFile(filePath, serializeFrontmatter(doc), "utf-8");

  return path.relative(process.cwd(), filePath);
}

export function displayDraft(text: string): void {
  const border = chalk.dim("─".repeat(48));
  console.log(`\n${border}`);
  console.log(text);
  console.log(`${border}\n`);
}
