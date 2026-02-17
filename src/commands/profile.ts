import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import type { StyleProfile } from "../types/style-profile.js";
import { formatSummary } from "./init.js";
import { PROFILES_DIR } from "../constants/paths.js";

export async function createProfile(name: string): Promise<void> {
  if (name === "default") {
    console.log(
      chalk.red(
        'Профіль "default" створюється через ghostpen init. Обери інше ім\'я.',
      ),
    );
    return;
  }

  // TODO: wire up init-profile pipeline for reference profiles (task #4)
  console.log(chalk.yellow(`Profile creation pipeline not yet implemented for "${name}".`));
}

export async function listProfiles(): Promise<void> {
  try {
    await fs.access(PROFILES_DIR);
  } catch {
    console.log(chalk.yellow("Профілів ще немає. Запусти ghostpen init."));
    return;
  }

  const files = await fs.readdir(PROFILES_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  if (jsonFiles.length === 0) {
    console.log(chalk.yellow("Профілів ще немає. Запусти ghostpen init."));
    return;
  }

  console.log(chalk.bold("\nПрофілі:\n"));

  const rows: { name: string; type: string; tone: string; updated: string }[] =
    [];

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(PROFILES_DIR, file), "utf-8");
      const data = JSON.parse(raw) as StyleProfile;
      rows.push({
        name: data.profile_name,
        type: data.profile_type,
        tone: data.voice?.tone ?? "—",
        updated: data.updated_at?.slice(0, 10) ?? "—",
      });
    } catch {
      rows.push({
        name: file.replace(".json", ""),
        type: "?",
        tone: "?",
        updated: "?",
      });
    }
  }

  const maxName = Math.max(...rows.map((r) => r.name.length), 4);
  const maxType = Math.max(...rows.map((r) => r.type.length), 4);
  const maxTone = Math.max(...rows.map((r) => r.tone.length), 4);

  const header = `  ${chalk.dim("NAME".padEnd(maxName))}  ${chalk.dim("TYPE".padEnd(maxType))}  ${chalk.dim("TONE".padEnd(maxTone))}  ${chalk.dim("UPDATED")}`;
  console.log(header);

  for (const row of rows) {
    console.log(
      `  ${chalk.cyan(row.name.padEnd(maxName))}  ${row.type.padEnd(maxType)}  ${row.tone.padEnd(maxTone)}  ${row.updated}`,
    );
  }

  console.log("");
}

export async function showProfile(name: string): Promise<void> {
  const filePath = path.join(PROFILES_DIR, `${name}.json`);

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const profile = JSON.parse(raw) as StyleProfile;
    console.log(formatSummary(profile));
  } catch {
    console.log(chalk.red(`Профіль "${name}" не знайдено.`));
  }
}

export async function deleteProfile(name: string): Promise<void> {
  if (name === "default") {
    console.log(
      chalk.red('Профіль "default" не можна видалити.'),
    );
    return;
  }

  const filePath = path.join(PROFILES_DIR, `${name}.json`);

  try {
    await fs.access(filePath);
  } catch {
    console.log(chalk.red(`Профіль "${name}" не знайдено.`));
    return;
  }

  await fs.unlink(filePath);
  console.log(chalk.green(`✅ Профіль "${name}" видалено.`));
}
