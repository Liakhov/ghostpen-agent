import { MODEL } from "../constants/app.js";

const PRICING: Record<string, { input: number; cache_write: number; cache_read: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, cache_write: 3.75, cache_read: 0.30, output: 15 },
  "claude-sonnet-4": { input: 3, cache_write: 3.75, cache_read: 0.30, output: 15 },
  "claude-haiku-4-5": { input: 1, cache_write: 1.25, cache_read: 0.10, output: 5 },
  "claude-opus-4-6": { input: 5, cache_write: 6.25, cache_read: 0.50, output: 25 },
};

export function calculateCost(u: { input: number; output: number; cache_write: number; cache_read: number }): number {
  const p = PRICING[MODEL] ?? PRICING["claude-sonnet-4-20250514"];
  return (
    (u.input * p.input +
      u.cache_write * p.cache_write +
      u.cache_read * p.cache_read +
      u.output * p.output) / 1_000_000
  );
}
