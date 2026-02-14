import type Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { readStyleProfile } from "../tools/style-profile.js";
import { MIX_MODE_TEMPLATE } from "../prompts/templates/mix-mode.js";
import { SYSTEM_PROMPT } from "../prompts/system.js";
import { extractDefaultPlatform } from "./helpers.js";

export interface LoadedProfile {
  systemBlocks: Anthropic.TextBlockParam[];
  profileUsed: string;
  defaultPlatform: string;
}

export async function loadProfile(options?: {
  profile?: string;
  mix?: [string, string];
}): Promise<LoadedProfile | null> {
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  let profileUsed: string;
  let defaultPlatform = "linkedin";

  if (options?.mix) {
    const [baseName, refName] = options.mix;
    const baseResult = await readStyleProfile({ profile_name: baseName });
    const refResult = await readStyleProfile({ profile_name: refName });
    const baseData = baseResult.success ? baseResult.profile : undefined;
    const refData = refResult.success ? refResult.profile : undefined;

    if (!baseData) {
      console.log(
        chalk.red(`❌ Не вдалося завантажити base профіль "${baseName}".`),
      );
      return null;
    }
    if (!refData) {
      console.log(
        chalk.red(
          `❌ Не вдалося завантажити reference профіль "${refName}".`,
        ),
      );
      return null;
    }

    defaultPlatform = extractDefaultPlatform(baseData);

    systemBlocks.push(
      {
        type: "text",
        text: `\n--- BASE PROFILE ---\n${JSON.stringify(baseData, null, 2)}`,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `\n--- REFERENCE PROFILE ---\n${JSON.stringify(refData, null, 2)}`,
      },
      {
        type: "text",
        text: `\n${MIX_MODE_TEMPLATE}`,
        cache_control: { type: "ephemeral" },
      },
    );

    profileUsed = `mix:${baseName}+${refName}`;
    console.log(chalk.dim(`📎 Mix mode: ${baseName} + ${refName}\n`));
  } else {
    const profileName = options?.profile ?? "default";
    const profileResult = await readStyleProfile({ profile_name: profileName });
    const profileData = profileResult.success ? profileResult.profile : undefined;

    if (!profileData) {
      console.log(
        chalk.red(
          `❌ Не вдалося завантажити style profile "${profileName}". Запусти ghostpen init.`,
        ),
      );
      return null;
    }

    defaultPlatform = extractDefaultPlatform(profileData);

    systemBlocks.push({
      type: "text",
      text: `\n--- STYLE PROFILE (${profileName}) ---\n${JSON.stringify(profileData, null, 2)}`,
      cache_control: { type: "ephemeral" },
    });

    profileUsed = profileName;
    if (profileName !== "default") {
      console.log(chalk.dim(`📎 Профіль: ${profileName}\n`));
    }
  }

  systemBlocks.push({
    type: "text",
    text: `\nprofile_used: "${profileUsed}" — передавай це значення в save_to_file.`,
  });

  return { systemBlocks, profileUsed, defaultPlatform };
}
