import { parse, stringify } from "yaml";

export interface ParsedDocument<T = Record<string, unknown>> {
  frontmatter: T;
  body: string;
}

const FENCE = "---";

export function parseFrontmatter<T = Record<string, unknown>>(
  content: string,
): ParsedDocument<T> {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith(FENCE)) {
    return { frontmatter: {} as T, body: content };
  }

  const end = trimmed.indexOf(`\n${FENCE}`, FENCE.length);
  if (end === -1) {
    return { frontmatter: {} as T, body: content };
  }

  const yamlBlock = trimmed.slice(FENCE.length + 1, end);
  const body = trimmed.slice(end + FENCE.length + 2); // skip past closing --- and \n

  return {
    frontmatter: (parse(yamlBlock) ?? {}) as T,
    body: body.startsWith("\n") ? body.slice(1) : body,
  };
}

export function serializeFrontmatter<T = Record<string, unknown>>(
  doc: ParsedDocument<T>,
): string {
  const yaml = stringify(doc.frontmatter, { lineWidth: 120 }).trimEnd();
  return `---\n${yaml}\n---\n\n${doc.body}`;
}
