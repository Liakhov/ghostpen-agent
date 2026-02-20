import "dotenv/config";
import { Command } from "commander";
import { runInit } from "./commands/init.js";
import {
  createProfile,
  listProfiles,
  showProfile,
  deleteProfile,
} from "./commands/profile.js";
import { generate } from "./pipeline/generate.js";
import { formatError } from "./utils/errors.js";

const program = new Command();

program
  .name("ghostpen")
  .description("AI-powered CLI agent that generates social media content in your voice")
  .version("1.0.0");

program
  .command("init")
  .description("Create your personal Style Profile")
  .action(runInit);

const profileCmd = program.command("profile").description("Manage profiles");

profileCmd
  .command("create <name>")
  .description("Create reference profile")
  .action(createProfile);

profileCmd
  .command("list")
  .description("List all profiles")
  .action(listProfiles);

profileCmd
  .command("show <name>")
  .description("Show profile details")
  .action(showProfile);

profileCmd
  .command("delete <name>")
  .description("Delete profile")
  .action(deleteProfile);

program
  .argument("[topic...]", 'Topic for the post (e.g. "напиши пост про вигорання для LinkedIn")')
  .option("-p, --profile <name>", "Profile to use", "default")
  .action(async (topic: string[], opts: { profile: string }) => {
    const input = topic?.join(" ") ?? "";
    if (!input.trim()) {
      program.outputHelp();
      process.exit(0);
    }

    await generate({
      topic: input,
      platform: "linkedin",
      profileName: opts.profile,
    });
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync();
  } catch (error) {
    console.error("Помилка:", formatError(error));
    process.exit(1);
  }
}

main();
