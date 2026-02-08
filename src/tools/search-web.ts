import type Anthropic from "@anthropic-ai/sdk";

export const webSearchTool: Anthropic.Messages.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 3,
};
