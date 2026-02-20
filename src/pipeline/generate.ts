import chalk from "chalk";
import { callLLM } from "../services/openai.js";
import { buildSystemPrompt } from "../prompts/system.js";
import { buildGeneratePrompt } from "../prompts/tasks/generate.js";
import { loadProfile, displayDraft, savePost } from "./runner.js";
import { MODELS } from "../constants/app.js";
import type { PostMeta } from "../types/index.js";

export interface GenerateParams {
  topic: string;
  platform: string;
  profileName: string;
}

export async function generate(params: GenerateParams): Promise<void> {
  const { topic, platform, profileName } = params;

  // Step 1: Load profile
  const profile = await loadProfile(profileName);
  console.log(chalk.dim(`\nProfile: ${profileName} | Platform: ${platform}`));

  // Step 2: Build prompts
  const systemPrompt = buildSystemPrompt(profile.body);
  const userPrompt = buildGeneratePrompt({ topic, platform });

  // Step 3: Generate
  console.log(chalk.dim("Generating...\n"));

  const result = await callLLM({
    system: systemPrompt,
    user: userPrompt,
    model: MODELS.generation,
    temperature: 0.8,
    maxTokens: 2000,
  });

  // Step 4: Display
  displayDraft(result);

  // Step 5: Save
  const metadata: PostMeta = {
    platform,
    topic,
    profile: profileName,
    created: new Date().toISOString(),
    iterations: 0,
  };

  const savedPath = await savePost(result, metadata);
  console.log(chalk.green(`Saved: ${savedPath}`));
}