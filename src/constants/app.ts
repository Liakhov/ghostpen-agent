export const MODELS = {
  generation: "gpt-4.1-mini",
  refine: "gpt-4.1-mini",
  analysis: "gpt-4.1-nano",
  profileCreation: "gpt-4.1-nano",
} as const;

export const DEFAULT_MODEL = MODELS.generation;

export const MAX_HISTORY_PAIRS = 6;
