import "dotenv/config";
import { Command } from "commander";
import { runAgent } from "./agent.js";
import { runInit } from "./commands/init.js";
import {
  createProfile,
  listProfiles,
  showProfile,
  deleteProfile,
} from "./commands/profile.js";
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
  .option("-p, --profile <name>", "Profile to use")
  .option("--mix <profiles>", 'Mix mode: base + ref (e.g. --mix "default competitor-alex")')
  .option("--debug", "Debug mode")
  .action(async (topic: string[], options: { profile?: string; mix?: string; debug?: boolean }) => {
    const input = topic?.join(" ") ?? "";
    if (!input.trim()) {
      program.outputHelp();
      process.exit(0);
    }

    const agentOptions: { profile?: string; mix?: [string, string]; debug?: boolean } = {};
    if (options.mix) {
      const parts = options.mix.trim().split(/\s+/);
      if (parts.length >= 2) agentOptions.mix = [parts[0], parts[1]];
    } else if (options.profile) {
      agentOptions.profile = options.profile;
    }
    if (options.debug) agentOptions.debug = true;

    await runAgent(input, Object.keys(agentOptions).length > 0 ? agentOptions : undefined);
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
