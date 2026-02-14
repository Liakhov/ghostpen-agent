import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { StyleProfile } from "../types/style-profile.js";
import type { ReadStyleProfileResult } from "../types/tool-results.js";
import { PROFILES_DIR } from "../constants/paths.js";
import { validateProfile } from "../utils/profile-validation.js";

export const readStyleProfileSchema = {
  name: "read_style_profile" as const,
  description:
    "Читає додатковий Style Profile з data/profiles/. " +
    "Дефолтний профіль вже в system prompt — НЕ викликай для нього. " +
    "Використовуй ТІЛЬКИ для mix mode (завантаження другого профілю).",
  input_schema: {
    type: "object" as const,
    properties: {
      profile_name: {
        type: "string",
        description: "Ім'я профілю для читання. Default: 'default'",
      },
    },
    required: [] as string[],
  },
};

async function listAvailableProfiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(PROFILES_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

export async function readStyleProfile(input: {
  profile_name?: string;
}): Promise<ReadStyleProfileResult> {
  const profileName = input.profile_name || "default";
  const filePath = path.join(PROFILES_DIR, `${profileName}.json`);

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data: unknown = JSON.parse(raw);

    if (!validateProfile(data)) {
      return {
        success: false,
        error: "invalid_profile",
        message: `Profile '${profileName}' has invalid structure. Check required fields: voice.hooks, voice.avoid, platforms, examples.`,
      };
    }

    return { success: true, profile: data };
  } catch (err) {
    const available = await listAvailableProfiles();

    if (profileName === "default" && available.length === 0) {
      return {
        success: false,
        error: "no_profiles",
        message:
          "No style profiles found. Run 'ghostpen init' to create your personal profile.",
      };
    }

    return {
      success: false,
      error: "profile_not_found",
      message: `Profile '${profileName}' not found. Available profiles: ${available.join(", ") || "none"}`,
      available_profiles: available,
    };
  }
}
