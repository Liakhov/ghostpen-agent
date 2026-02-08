export interface Voice {
  tone: string;
  formality: string;
  personality: string;
  sentence_style: string;
  paragraph_style: string;
  hooks: string[];
  closings: string[];
  signature_phrases: string[];
  avoid: string[];
  emoji_usage: string;
}

export interface Platform {
  max_length: number;
  structure: string;
  tone_override: string | null;
  formatting: string;
  hashtags?: string;
  notes?: string;
}

export interface Example {
  id: string;
  platform: string;
  text: string;
  why_good: string;
  added_at: string;
}

export interface ChangelogEntry {
  version: number;
  date: string;
  action: "created" | "updated";
  description: string;
  fields_changed?: string[];
}

export interface StyleProfile {
  profile_name: string;
  profile_type: "personal" | "reference";
  source: string;
  version: number;
  created_at: string;
  updated_at: string;
  language: string;
  voice: Voice;
  platforms: Record<string, Platform>;
  examples: Example[];
  changelog: ChangelogEntry[];
}
