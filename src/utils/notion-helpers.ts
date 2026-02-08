/**
 * Notion ↔ Markdown conversion helpers.
 *
 * blocksToMarkdown  — read path  (Notion → markdown)
 * markdownToBlocks  — write path (markdown → Notion)
 * extractPageId     — pull page ID from URL or bare string
 */

// ── Types (minimal, matches Notion API shapes) ─────────────────────

interface RichText {
  type: string;
  plain_text: string;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
  href?: string | null;
}

interface NotionBlock {
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

// ── extractPageId ──────────────────────────────────────────────────

const NOTION_PAGE_RE =
  /(?:notion\.so|notion\.site)\/(?:.*-)?([a-f0-9]{32})\b/i;
const BARE_ID_RE = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
const HEX32_RE = /^[a-f0-9]{32}$/i;

export function extractPageId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();

  // bare UUID with dashes
  if (BARE_ID_RE.test(trimmed)) {
    return trimmed.replace(/-/g, "");
  }

  // bare 32-hex
  if (HEX32_RE.test(trimmed)) {
    return trimmed;
  }

  // full Notion URL
  const m = trimmed.match(NOTION_PAGE_RE);
  if (m?.[1]) return m[1];

  return null;
}

// ── blocksToMarkdown ───────────────────────────────────────────────

function richTextToMd(items: RichText[]): string {
  return items
    .map((rt) => {
      let text = rt.plain_text;
      const a = rt.annotations;
      if (a?.code) text = `\`${text}\``;
      if (a?.bold) text = `**${text}**`;
      if (a?.italic) text = `*${text}*`;
      if (a?.strikethrough) text = `~~${text}~~`;
      if (rt.href) text = `[${text}](${rt.href})`;
      return text;
    })
    .join("");
}

function getRichText(block: NotionBlock): RichText[] {
  const data = block[block.type] as { rich_text?: RichText[] } | undefined;
  return data?.rich_text ?? [];
}

function blockToMd(block: NotionBlock, indent = ""): string {
  const rt = getRichText(block);
  const text = richTextToMd(rt);

  switch (block.type) {
    case "paragraph":
      return text ? `${indent}${text}` : "";
    case "heading_1":
      return `# ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "bulleted_list_item":
      return `${indent}- ${text}`;
    case "numbered_list_item":
      return `${indent}1. ${text}`;
    case "to_do": {
      const data = block.to_do as { checked?: boolean } | undefined;
      const check = data?.checked ? "x" : " ";
      return `${indent}- [${check}] ${text}`;
    }
    case "toggle":
      return `${indent}<details><summary>${text}</summary></details>`;
    case "quote":
      return `${indent}> ${text}`;
    case "callout":
      return `> ${text}`;
    case "code": {
      const data = block.code as { language?: string } | undefined;
      const lang = data?.language ?? "";
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }
    case "divider":
      return "---";
    case "image": {
      const img = block.image as {
        type?: string;
        file?: { url?: string };
        external?: { url?: string };
        caption?: RichText[];
      } | undefined;
      const url =
        img?.type === "file" ? img.file?.url : img?.external?.url;
      const caption = img?.caption ? richTextToMd(img.caption) : "";
      return url ? `![${caption}](${url})` : "";
    }
    case "bookmark": {
      const bm = block.bookmark as { url?: string } | undefined;
      return bm?.url ? `[${bm.url}](${bm.url})` : "";
    }
    default:
      return text || "";
  }
}

export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const line = blockToMd(block);
    lines.push(line);
  }
  return lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── markdownToBlocks ───────────────────────────────────────────────
// Converts markdown text → array of Notion block objects for page creation.
// Covers the most common cases; exotic markdown falls back to paragraph.

interface NotionBlockInput {
  object: "block";
  type: string;
  [key: string]: unknown;
}

function textBlock(
  type: string,
  content: string,
): NotionBlockInput {
  return {
    object: "block",
    type,
    [type]: {
      rich_text: [{ type: "text", text: { content } }],
    },
  };
}

export function markdownToBlocks(md: string): NotionBlockInput[] {
  const blocks: NotionBlockInput[] = [];
  const lines = md.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // empty line → skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [
            { type: "text", text: { content: codeLines.join("\n") } },
          ],
          language: lang || "plain text",
        },
      });
      continue;
    }

    // headings
    if (line.startsWith("### ")) {
      blocks.push(textBlock("heading_3", line.slice(4)));
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(textBlock("heading_2", line.slice(3)));
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(textBlock("heading_1", line.slice(2)));
      i++;
      continue;
    }

    // blockquote
    if (line.startsWith("> ")) {
      blocks.push(textBlock("quote", line.slice(2)));
      i++;
      continue;
    }

    // bulleted list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push(textBlock("bulleted_list_item", line.slice(2)));
      i++;
      continue;
    }

    // numbered list
    const numMatch = line.match(/^\d+\.\s/);
    if (numMatch) {
      blocks.push(
        textBlock("numbered_list_item", line.slice(numMatch[0].length)),
      );
      i++;
      continue;
    }

    // divider
    if (/^---+$/.test(line.trim())) {
      blocks.push({ object: "block", type: "divider", divider: {} });
      i++;
      continue;
    }

    // default: paragraph
    blocks.push(textBlock("paragraph", line));
    i++;
  }

  return blocks;
}
