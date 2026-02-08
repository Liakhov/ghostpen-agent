import "dotenv/config";
import { runAgent } from "./agent.js";

const input = process.argv.slice(2).join(" ");

if (!input) {
  console.log("Використання: ghostpen \"тема для платформи\"");
  console.log("Приклад:     ghostpen \"напиши пост про вигорання для LinkedIn\"");
  process.exit(0);
}

try {
  await runAgent(input);
} catch (error) {
  if (error instanceof Error) {
    console.error(`Помилка: ${error.message}`);
  } else {
    console.error("Невідома помилка:", error);
  }
  process.exit(1);
}
