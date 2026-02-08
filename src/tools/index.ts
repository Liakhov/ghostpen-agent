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

export const toolDefinitions = [
  readStyleProfileSchema,
  saveToFileSchema,
  trackFeedbackSchema,
  updateStyleProfileSchema,
];

type ToolHandler = (input: Record<string, unknown>) => Promise<object>;

export const toolHandlers: Record<string, ToolHandler> = {
  read_style_profile: readStyleProfile as ToolHandler,
  save_to_file: saveToFile as ToolHandler,
  track_feedback: trackFeedback as ToolHandler,
  update_style_profile: updateStyleProfile as ToolHandler,
};
