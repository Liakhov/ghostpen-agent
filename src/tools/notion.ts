import { Client } from "@notionhq/client";
import {
  getNotionToken,
  getNotionDatabaseId,
} from "../utils/config.js";
import {
  extractPageId,
  blocksToMarkdown,
  markdownToBlocks,
} from "../utils/notion-helpers.js";
import { saveToFile } from "./save-to-file.js";

// ── Schemas ────────────────────────────────────────────────────────

export const readNotionPageSchema = {
  name: "read_notion_page" as const,
  description:
    "Читає Notion-сторінку і повертає її вміст як markdown. " +
    "Приймає URL (https://notion.so/...) або bare page ID.",
  input_schema: {
    type: "object" as const,
    properties: {
      page_id: {
        type: "string",
        description: "Notion page URL або ID",
      },
    },
    required: ["page_id"] as string[],
  },
};

export const writeToNotionSchema = {
  name: "write_to_notion" as const,
  description:
    "Створює нову сторінку в Notion database з готовим постом. " +
    "При помилці автоматично зберігає локально через save_to_file.",
  input_schema: {
    type: "object" as const,
    properties: {
      content: {
        type: "string",
        description: "Повний текст поста",
      },
      title: {
        type: "string",
        description: "Заголовок сторінки в Notion",
      },
      platform: {
        type: "string",
        enum: ["linkedin", "instagram", "x"],
        description: "Платформа",
      },
      topic: {
        type: "string",
        description: "Тема поста",
      },
      profile_used: {
        type: "string",
        description: "Профіль що використовувався. Default: 'default'",
      },
    },
    required: ["content", "title", "platform", "topic"] as string[],
  },
};

// ── Handlers ───────────────────────────────────────────────────────

const TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Notion API timeout (${ms}ms)`)),
      ms,
    );
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e as Error); });
  });
}

export async function readNotionPage(input: {
  page_id: string;
}): Promise<object> {
  const pageId = extractPageId(input.page_id);
  if (!pageId) {
    return {
      success: false,
      error: "invalid_page_id",
      message: `Не вдалося розпарсити Notion page ID з "${input.page_id}". Передай URL або ID.`,
    };
  }

  try {
    const notion = new Client({ auth: getNotionToken() });

    // Get page title
    const page = await withTimeout(
      notion.pages.retrieve({ page_id: pageId }),
      TIMEOUT_MS,
    );

    let title = "Untitled";
    const props = (page as { properties?: Record<string, unknown> }).properties;
    if (props) {
      for (const val of Object.values(props)) {
        const prop = val as { type?: string; title?: Array<{ plain_text: string }> };
        if (prop.type === "title" && Array.isArray(prop.title)) {
          title = prop.title.map((t) => t.plain_text).join("") || title;
          break;
        }
      }
    }

    // Get all blocks (with pagination)
    const allBlocks: unknown[] = [];
    let cursor: string | undefined;

    do {
      const response = await withTimeout(
        notion.blocks.children.list({
          block_id: pageId,
          start_cursor: cursor,
          page_size: 100,
        }),
        TIMEOUT_MS,
      );
      allBlocks.push(...response.results);
      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    // Recursively fetch children
    for (const block of allBlocks) {
      const b = block as { has_children?: boolean; id?: string; type?: string; [key: string]: unknown };
      if (b.has_children && b.id && b.type && b.type !== "child_page" && b.type !== "child_database") {
        try {
          const children = await withTimeout(
            notion.blocks.children.list({ block_id: b.id, page_size: 100 }),
            TIMEOUT_MS,
          );
          // Attach children for conversion
          const blockData = b[b.type] as Record<string, unknown> | undefined;
          if (blockData) {
            blockData.children = children.results;
          }
        } catch {
          // skip failed child fetches
        }
      }
    }

    const markdown = blocksToMarkdown(
      allBlocks as Array<{ type: string; has_children?: boolean; [key: string]: unknown }>,
    );

    return {
      success: true,
      page_id: pageId,
      title,
      content: markdown,
      blocks_count: allBlocks.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка Notion API";
    return {
      success: false,
      error: "notion_read_error",
      message: `Не вдалося прочитати Notion-сторінку: ${message}`,
    };
  }
}

export async function writeToNotion(input: {
  content: string;
  title: string;
  platform: string;
  topic: string;
  profile_used?: string;
}): Promise<object> {
  const {
    content,
    title,
    platform,
    topic,
    profile_used = "default",
  } = input;

  try {
    const notion = new Client({ auth: getNotionToken() });
    const databaseId = getNotionDatabaseId();

    const blocks = markdownToBlocks(content);

    const response = await withTimeout(
      notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Title: {
            title: [{ text: { content: title } }],
          },
          Platform: {
            select: { name: platform },
          },
          Topic: {
            rich_text: [{ text: { content: topic } }],
          },
          Status: {
            select: { name: "Draft" },
          },
          Created: {
            date: { start: new Date().toISOString() },
          },
          Profile: {
            rich_text: [{ text: { content: profile_used } }],
          },
        },
        children: blocks as Parameters<typeof notion.pages.create>[0]["children"],
      }),
      TIMEOUT_MS,
    );

    const pageUrl = (response as { url?: string }).url ?? "";

    return {
      success: true,
      page_url: pageUrl,
      message: `Збережено в Notion: ${pageUrl}`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка Notion API";

    // Fallback: save locally
    const localResult = await saveToFile({
      content,
      platform,
      topic,
      profile_used,
    });

    const localPath = (localResult as { file_path?: string }).file_path ?? "";

    return {
      success: false,
      error: "notion_write_error",
      message: `Notion запис не вдався (${message}). Збережено локально: ${localPath}`,
      fallback_file: localPath,
    };
  }
}
