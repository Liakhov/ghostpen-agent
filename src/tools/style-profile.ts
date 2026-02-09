import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { StyleProfile } from "../types/style-profile.js";
import { PROFILES_DIR } from "../constants/paths.js";

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

function validateProfile(data: unknown): data is StyleProfile {
  const p = data as Record<string, unknown>;
  if (!p || typeof p !== "object") return false;
  if (typeof p.profile_name !== "string") return false;
  if (p.profile_type !== "personal" && p.profile_type !== "reference")
    return false;
  if (typeof p.version !== "number" || p.version < 1) return false;
  if (typeof p.language !== "string") return false;

  const voice = p.voice as Record<string, unknown> | undefined;
  if (!voice || typeof voice !== "object") return false;
  if (!Array.isArray(voice.hooks) || voice.hooks.length === 0) return false;
  if (!Array.isArray(voice.avoid) || voice.avoid.length === 0) return false;

  if (!p.platforms || typeof p.platforms !== "object") return false;
  if (Object.keys(p.platforms as object).length === 0) return false;

  if (!Array.isArray(p.examples) || p.examples.length === 0) return false;

  return true;
}

export async function readStyleProfile(input: {
  profile_name?: string;
}): Promise<object> {
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
