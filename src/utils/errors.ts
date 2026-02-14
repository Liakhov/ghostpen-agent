export function formatError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("ANTHROPIC_API_KEY") || msg.includes("authentication")) {
      return "ANTHROPIC_API_KEY не налаштований або невалідний. Перевір .env файл.";
    }
    if (msg.includes("rate_limit") || msg.includes("429")) {
      return "Перевищено ліміт запитів до API. Зачекай хвилину і спробуй ще.";
    }
    if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      return "Немає з'єднання з інтернетом.";
    }
    if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
      return "Запит завершився по таймауту. Спробуй ще раз.";
    }
    return msg;
  }
  return String(error);
}
