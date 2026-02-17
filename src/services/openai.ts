import OpenAI from "openai";
import { DEFAULT_MODEL } from "../constants/app.js";

const client = new OpenAI();

export interface LLMParams {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callLLM(params: LLMParams): Promise<string> {
  const {
    system,
    user,
    model = DEFAULT_MODEL,
    temperature = 0.8,
    maxTokens = 2000,
  } = params;

  const response = await client.chat.completions.create({
    model,
    temperature,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return content;
}
