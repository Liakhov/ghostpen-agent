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
    // Parse --profile and --mix flags from args
    const remaining: string[] = [];
    let profileName: string | undefined;
    let mixProfiles: [string, string] | undefined;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--profile" && i + 1 < args.length) {
        profileName = args[i + 1];
        i++; // skip value
      } else if (args[i] === "--mix" && i + 2 < args.length) {
        mixProfiles = [args[i + 1], args[i + 2]];
        i += 2; // skip both values
      } else {
        remaining.push(args[i]);
      }
    }

    const input = remaining.join(" ");
    if (!input) {
      printUsage();
      process.exit(0);
    }

    const options: { profile?: string; mix?: [string, string] } = {};
    if (mixProfiles) {
      options.mix = mixProfiles;
    } else if (profileName) {
      options.profile = profileName;
    }

    await runAgent(input, Object.keys(options).length > 0 ? options : undefined);
  }
} catch (error) {
  if (error instanceof Error) {
    console.error(`Помилка: ${error.message}`);
  } else {
    console.error("Невідома помилка:", error);
  }
  process.exit(1);
}
