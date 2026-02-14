import type { StyleProfile } from "../types/style-profile.js";

export function validateProfile(data: unknown): data is StyleProfile {
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
