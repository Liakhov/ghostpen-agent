export function isNotionConfigured(): boolean {
  return !!(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID);
}

export function getNotionToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN не налаштований в .env");
  return token;
}

export function getNotionDatabaseId(): string {
  const id = process.env.NOTION_DATABASE_ID;
  if (!id) throw new Error("NOTION_DATABASE_ID не налаштований в .env");
  return id;
}
