import "dotenv/config";
import { runAgent } from "./agent.js";
import { runInit } from "./commands/init.js";
import {
  createProfile,
  listProfiles,
  showProfile,
  deleteProfile,
} from "./commands/profile.js";

const args = process.argv.slice(2);

function printUsage(): void {
  console.log('Використання: ghostpen "тема для платформи"');
  console.log("             ghostpen init");
  console.log("             ghostpen profile create <name>");
  console.log("             ghostpen profile list");
  console.log("             ghostpen profile show <name>");
  console.log("             ghostpen profile delete <name>");
  console.log(
    '\nПриклад:     ghostpen "напиши пост про вигорання для LinkedIn"',
  );
  console.log(
    '             ghostpen "пост про наймання" --profile competitor-alex',
  );
  console.log(
    '             ghostpen "пост про наймання" --mix default competitor-alex',
  );
}

if (args.length === 0) {
  printUsage();
  process.exit(0);
}

try {
  if (args[0] === "init") {
    await runInit();
  } else if (args[0] === "profile") {
    const subcommand = args[1];
    const name = args[2];

    if (subcommand === "create") {
      if (!name) {
        console.log("Використання: ghostpen profile create <name>");
        process.exit(1);
      }
      await createProfile(name);
    } else if (subcommand === "list") {
      await listProfiles();
    } else if (subcommand === "show") {
      if (!name) {
        console.log("Використання: ghostpen profile show <name>");
        process.exit(1);
      }
      await showProfile(name);
    } else if (subcommand === "delete") {
      if (!name) {
        console.log("Використання: ghostpen profile delete <name>");
        process.exit(1);
      }
      await deleteProfile(name);
    } else {
      console.log(`Невідома підкоманда: profile ${subcommand ?? ""}`);
      printUsage();
      process.exit(1);
    }
  } else {
    // Parse --profile, --mix, --debug flags from args
    const remaining: string[] = [];
    let profileName: string | undefined;
    let mixProfiles: [string, string] | undefined;
    let debugMode = false;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--profile" && i + 1 < args.length) {
        profileName = args[i + 1];
        i++;
      } else if (args[i] === "--mix" && i + 2 < args.length) {
        mixProfiles = [args[i + 1], args[i + 2]];
        i += 2;
      } else if (args[i] === "--debug") {
        debugMode = true;
      } else {
        remaining.push(args[i]);
      }
    }

    const input = remaining.join(" ");
    if (!input) {
      printUsage();
      process.exit(0);
    }

    const options: { profile?: string; mix?: [string, string]; debug?: boolean } = {};
    if (mixProfiles) {
      options.mix = mixProfiles;
    } else if (profileName) {
      options.profile = profileName;
    }
    if (debugMode) {
      options.debug = true;
    }

    await runAgent(input, Object.keys(options).length > 0 ? options : undefined);
  }
} catch (error) {
  if (error instanceof Error) {
    // Friendly messages for common errors
    if (error.message.includes("ANTHROPIC_API_KEY") || error.message.includes("authentication")) {
      console.error("Помилка: ANTHROPIC_API_KEY не налаштований або невалідний. Перевір .env файл.");
    } else if (error.message.includes("rate_limit") || error.message.includes("429")) {
      console.error("Помилка: Перевищено ліміт запитів до API. Зачекай хвилину і спробуй ще.");
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
      console.error("Помилка: Немає з'єднання з інтернетом.");
    } else if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
      console.error("Помилка: Запит завершився по таймауту. Спробуй ще раз.");
    } else {
      console.error(`Помилка: ${error.message}`);
    }
  } else {
    console.error("Невідома помилка:", error);
  }
  process.exit(1);
}
