import "dotenv/config";
import { runAgent } from "./agent.js";
import { runInit } from "./commands/init.js";

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log('Використання: ghostpen "тема для платформи"');
  console.log("             ghostpen init");
  console.log(
    '\nПриклад:     ghostpen "напиши пост про вигорання для LinkedIn"',
  );
  process.exit(0);
}

try {
  if (command === "init") {
    await runInit();
  } else {
    const input = args.join(" ");
    await runAgent(input);
  }
} catch (error) {
  if (error instanceof Error) {
    console.error(`Помилка: ${error.message}`);
  } else {
    console.error("Невідома помилка:", error);
  }
  process.exit(1);
}