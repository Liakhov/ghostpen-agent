import * as fs from "node:fs/promises";
import * as path from "node:path";
import { TRACKER_PATH } from "../constants/paths.js";
const THRESHOLD = 3;
const MAX_HISTORY = 10;

const CATEGORIES = [
  "too_formal",
  "too_casual",
  "too_long",
  "too_short",
  "hook_weak",
  "hook_strong",
  "tone_off",
  "structure_wrong",
  "vocabulary_wrong",
  "cta_missing",
  "cta_too_pushy",
  "other",
] as const;

type Category = (typeof CATEGORIES)[number];

interface HistoryEntry {
  date: string;
  raw: string;
}

interface CategoryData {
  count: number;
  last_seen: string;
  history: HistoryEntry[];
}

type FeedbackTracker = Record<string, CategoryData>;

const SUGGESTIONS: Record<Category, string> = {
  too_formal:
    "Користувач {count} разів сказав що текст занадто формальний. Запропонуй оновити voice.formality у style profile.",
  too_casual:
    "Користувач {count} разів сказав що текст занадто неформальний. Запропонуй оновити voice.formality у style profile.",
  too_long:
    "Користувач {count} разів просив коротший текст. Запропонуй зменшити platforms.*.max_length у style profile.",
  too_short:
    "Користувач {count} разів просив довший текст. Запропонуй збільшити platforms.*.max_length у style profile.",
  hook_weak:
    "Користувач {count} разів сказав що hook слабкий. Запропонуй оновити voice.hooks у style profile.",
  hook_strong:
    "Користувач {count} разів сказав що hook занадто агресивний. Запропонуй оновити voice.hooks у style profile.",
  tone_off:
    "Користувач {count} разів сказав що тон не той. Запропонуй оновити voice.tone у style profile.",
  structure_wrong:
    "Користувач {count} разів скаржився на структуру. Запропонуй оновити platforms.*.structure у style profile.",
  vocabulary_wrong:
    "Користувач {count} разів скаржився на лексику. Запропонуй оновити voice.avoid або voice.signature_phrases у style profile.",
  cta_missing:
    "Користувач {count} разів просив додати CTA. Запропонуй оновити voice.closings у style profile.",
  cta_too_pushy:
    "Користувач {count} разів сказав що CTA занадто нав'язливий. Запропонуй оновити voice.closings у style profile.",
  other:
    "Користувач {count} разів давав схожий фідбек. Перевір чи потрібно оновити style profile.",
};

export const trackFeedbackSchema = {
  name: "track_feedback" as const,
  description:
    "Записує фідбек користувача в трекер. Автоматично категоризує за типом. " +
    "Коли лічильник категорії досягає 3 — повідом, що варто запропонувати " +
    "оновлення style profile.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        description: "Категорія фідбеку",
        enum: CATEGORIES,
      },
      raw_feedback: {
        type: "string",
        description: "Оригінальний текст фідбеку від користувача",
      },
    },
    required: ["category", "raw_feedback"],
  },
};

async function readTracker(): Promise<FeedbackTracker> {
  try {
    const raw = await fs.readFile(TRACKER_PATH, "utf-8");
    return JSON.parse(raw) as FeedbackTracker;
  } catch {
    return {};
  }
}

async function writeTracker(tracker: FeedbackTracker): Promise<void> {
  await fs.mkdir(path.dirname(TRACKER_PATH), { recursive: true });
  await fs.writeFile(TRACKER_PATH, JSON.stringify(tracker, null, 2), "utf-8");
}

export async function trackFeedback(input: {
  category: string;
  raw_feedback: string;
}): Promise<object> {
  const { category, raw_feedback } = input;

  if (!CATEGORIES.includes(category as Category)) {
    return {
      success: false,
      error: "invalid_category",
      message: `Invalid category '${category}'. Valid: ${CATEGORIES.join(", ")}`,
    };
  }

  const tracker = await readTracker();
  const now = new Date().toISOString();
  const today = now.split("T")[0];

  if (!tracker[category]) {
    tracker[category] = { count: 0, last_seen: now, history: [] };
  }

  const entry = tracker[category];
  entry.count += 1;
  entry.last_seen = now;
  entry.history.push({ date: today, raw: raw_feedback });

  if (entry.history.length > MAX_HISTORY) {
    entry.history = entry.history.slice(-MAX_HISTORY);
  }

  await writeTracker(tracker);

  const thresholdReached = entry.count >= THRESHOLD;
  const suggestion = thresholdReached
    ? SUGGESTIONS[category as Category].replace("{count}", String(entry.count))
    : undefined;

  return {
    success: true,
    category,
    count: entry.count,
    threshold_reached: thresholdReached,
    ...(suggestion && { suggestion }),
  };
}