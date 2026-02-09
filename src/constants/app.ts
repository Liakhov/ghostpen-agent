export const MODEL = "claude-sonnet-4-20250514";

export const MAX_HISTORY_PAIRS = 6;

export const TOOL_LABELS: Record<string, string> = {
  read_style_profile: "📖 Читаю style profile...",
  save_to_file: "💾 Зберігаю файл...",
  search_web: "🔍 Шукаю в інтернеті...",
  read_past_posts: "📚 Перевіряю минулі пости...",
  read_notion_page: "📄 Читаю Notion-сторінку...",
  write_to_notion: "📋 Зберігаю в Notion...",
  track_feedback: "📝 Записую фідбек...",
  update_style_profile: "🔄 Оновлюю profile...",
};

export const TOOL_SUMMARIES: Record<string, string> = {
  read_style_profile: '{"summary":"style profile loaded"}',
  save_to_file: '{"summary":"file saved"}',
  track_feedback: '{"summary":"feedback tracked"}',
  update_style_profile: '{"summary":"profile updated"}',
  read_past_posts: '{"summary":"past posts checked"}',
  read_notion_page: '{"summary":"notion page read"}',
  write_to_notion: '{"summary":"saved to notion"}',
};
