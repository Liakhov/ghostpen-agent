import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { StyleProfile } from "../types/style-profile.js";
import { PROFILES_DIR } from "../constants/paths.js";

const IMMUTABLE_FIELDS = new Set([
  "profile_name",
  "profile_type",
  "created_at",
]);

export const updateStyleProfileSchema = {
  name: "update_style_profile" as const,
  description:
    "Оновлює Style Profile користувача. Використовуй ТІЛЬКИ після явного підтвердження " +
    "користувача. Ніколи не оновлюй reference профілі через фідбек — тільки personal. " +
    "Кожне оновлення автоматично інкрементує version і додає changelog запис.",
  input_schema: {
    type: "object" as const,
    properties: {
      profile_name: {
        type: "string",
        description: "Ім'я профілю. Default: 'default'",
      },
      changes: {
        type: "object",
        description:
          "Об'єкт змін у форматі dot-notation path → new value. " +
          'Приклад: { "voice.formality": "casual але експертний" }',
      },
      reason: {
        type: "string",
        description: "Чому вноситься зміна — для changelog",
      },
    },
    required: ["changes", "reason"],
  },
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): void {
  const keys = dotPath.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

function validateChange(dotPath: string, value: unknown): string | null {
  const topField = dotPath.split(".")[0];
  if (IMMUTABLE_FIELDS.has(topField)) {
    return `Field '${topField}' is immutable and cannot be changed`;
  }

  if (dotPath === "voice.hooks" || dotPath === "voice.avoid") {
    if (
      !Array.isArray(value) ||
      !value.every((v) => typeof v === "string")
    ) {
      return `'${dotPath}' must be an array of strings`;
    }
    if (value.length === 0) {
      return `'${dotPath}' cannot be empty`;
    }
  }

  if (dotPath.match(/^platforms\..+\.max_length$/)) {
    if (typeof value !== "number" || value <= 0) {
      return `'${dotPath}' must be a positive number`;
    }
  }

  return null;
}

function validateProfile(data: unknown): data is StyleProfile {
  const p = data as Record<string, unknown>;
  if (!p || typeof p !== "object") return false;
  if (typeof p.profile_name !== "string") return false;
  if (p.profile_type !== "personal" && p.profile_type !== "reference")
    return false;
  if (typeof p.version !== "number" || p.version < 1) return false;

  const voice = p.voice as Record<string, unknown> | undefined;
  if (!voice || typeof voice !== "object") return false;
  if (!Array.isArray(voice.hooks) || voice.hooks.length === 0) return false;
  if (!Array.isArray(voice.avoid) || voice.avoid.length === 0) return false;

  if (!p.platforms || typeof p.platforms !== "object") return false;
  if (Object.keys(p.platforms as object).length === 0) return false;

  if (!Array.isArray(p.examples) || p.examples.length === 0) return false;

  return true;
}

export async function updateStyleProfile(input: {
  profile_name?: string;
  changes: Record<string, unknown>;
  reason: string;
}): Promise<object> {
  const profileName = input.profile_name || "default";
  const filePath = path.join(PROFILES_DIR, `${profileName}.json`);

  // Read current profile
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    return {
      success: false,
      error: "profile_not_found",
      message: `Profile '${profileName}' not found`,
    };
  }

  let profile: Record<string, unknown>;
  try {
    profile = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      success: false,
      error: "invalid_json",
      message: `Profile '${profileName}' contains invalid JSON`,
    };
  }

  // Check profile_type
  if (profile.profile_type === "reference") {
    return {
      success: false,
      error: "reference_profile",
      message:
        "Reference профілі не можна оновлювати через фідбек. Вони призначені тільки для читання.",
    };
  }

  // Keep backup for rollback
  const backup = JSON.stringify(profile);

  // Validate and apply changes
  const changesApplied: string[] = [];
  for (const [dotPath, value] of Object.entries(input.changes)) {
    const error = validateChange(dotPath, value);
    if (error) {
      // Rollback
      profile = JSON.parse(backup) as Record<string, unknown>;
      return {
        success: false,
        error: "validation_failed",
        message: error,
        field: dotPath,
      };
    }
    setNestedValue(profile, dotPath, value);
    changesApplied.push(dotPath);
  }

  // Increment version and update timestamps
  const newVersion = ((profile.version as number) || 0) + 1;
  profile.version = newVersion;
  profile.updated_at = new Date().toISOString();

  // Add changelog entry
  const changelogEntry = {
    version: newVersion,
    date: new Date().toISOString(),
    action: "updated",
    description: `${input.reason}`,
    fields_changed: changesApplied,
  };

  if (!Array.isArray(profile.changelog)) {
    profile.changelog = [];
  }
  (profile.changelog as unknown[]).push(changelogEntry);

  // Validate the final result
  if (!validateProfile(profile)) {
    return {
      success: false,
      error: "validation_failed",
      message:
        "Profile validation failed after applying changes. Changes rolled back.",
    };
  }

  // Save
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2), "utf-8");

  return {
    success: true,
    version: newVersion,
    changes_applied: changesApplied,
    changelog_entry: changelogEntry,
  };
}