import type { Interface as ReadlineInterface } from "node:readline";
import chalk from "chalk";
import type { StyleProfile } from "../types/style-profile.js";

export async function readMultilineInput(rl: ReadlineInterface): Promise<string> {
  console.log(
    chalk.dim("(Встав пости, розділяючи їх рядком ---. Двічі Enter для завершення)\n"),
  );

  return new Promise((resolve) => {
    const lines: string[] = [];
    let emptyCount = 0;

    const onLine = (line: string) => {
      if (line === "") {
        emptyCount++;
        if (emptyCount >= 2) {
          rl.removeListener("line", onLine);
          resolve(lines.join("\n"));
          return;
        }
      } else {
        emptyCount = 0;
      }
      lines.push(line);
    };

    rl.on("line", onLine);
  });
}

export function parsePosts(raw: string): string[] {
  return raw
    .split(/\n---\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function formatSummary(profile: StyleProfile): string {
  const v = profile.voice;
  const platforms = Object.keys(profile.platforms).join(", ");

  return [
    chalk.bold("\nТвій стиль:\n"),
    `${chalk.cyan("Тон:")} ${v.tone}`,
    `${chalk.cyan("Формальність:")} ${v.formality}`,
    `${chalk.cyan("Характер:")} ${v.personality}`,
    `${chalk.cyan("Речення:")} ${v.sentence_style}`,
    `${chalk.cyan("Абзаци:")} ${v.paragraph_style}`,
    `${chalk.cyan("Hooks:")} ${v.hooks.join("; ")}`,
    `${chalk.cyan("Closings:")} ${v.closings.join("; ")}`,
    `${chalk.cyan("Signature phrases:")} ${v.signature_phrases.join(", ")}`,
    `${chalk.cyan("Уникаєш:")} ${v.avoid.join("; ")}`,
    `${chalk.cyan("Emoji:")} ${v.emoji_usage}`,
    `${chalk.cyan("Платформи:")} ${platforms}`,
    `${chalk.cyan("Прикладів:")} ${profile.examples.length}`,
  ].join("\n");
}

export async function runInit(): Promise<void> {
  // TODO: wire up init-profile pipeline (task #4)
  console.log(chalk.yellow("Init pipeline not yet implemented."));
}