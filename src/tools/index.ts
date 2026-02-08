import {
  readStyleProfile,
  readStyleProfileSchema,
} from "./style-profile.js";
import { saveToFile, saveToFileSchema } from "./save-to-file.js";
import { trackFeedback, trackFeedbackSchema } from "./track-feedback.js";
import {
  updateStyleProfile,
  updateStyleProfileSchema,
} from "./update-style-profile.js";
import {
  readPastPosts,
  readPastPostsSchema,
} from "./read-past-posts.js";
import {
  readNotionPage,
  readNotionPageSchema,
  writeToNotion,
  writeToNotionSchema,
} from "./notion.js";
import { isNotionConfigured } from "../utils/config.js";

type ToolSchema = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const baseToolDefinitions: ToolSchema[] = [
  readStyleProfileSchema,
  saveToFileSchema,
  trackFeedbackSchema,
  updateStyleProfileSchema,
  readPastPostsSchema,
];

type ToolHandler = (input: Record<string, unknown>) => Promise<object>;

const baseToolHandlers: Record<string, ToolHandler> = {
  read_style_profile: readStyleProfile as ToolHandler,
  save_to_file: saveToFile as ToolHandler,
  track_feedback: trackFeedback as ToolHandler,
  update_style_profile: updateStyleProfile as ToolHandler,
  read_past_posts: readPastPosts as ToolHandler,
};

// Conditionally add Notion tools
if (isNotionConfigured()) {
  baseToolDefinitions.push(readNotionPageSchema, writeToNotionSchema);
  baseToolHandlers.read_notion_page = readNotionPage as ToolHandler;
  baseToolHandlers.write_to_notion = writeToNotion as ToolHandler;
}

export const toolDefinitions = baseToolDefinitions;
export const toolHandlers = baseToolHandlers;
