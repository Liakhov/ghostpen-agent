import {
  readStyleProfile,
  readStyleProfileSchema,
} from "./style-profile.js";
import { saveToFile, saveToFileSchema } from "./save-to-file.js";

export const toolDefinitions = [readStyleProfileSchema, saveToFileSchema];

type ToolHandler = (input: Record<string, unknown>) => Promise<object>;

export const toolHandlers: Record<string, ToolHandler> = {
  read_style_profile: readStyleProfile as ToolHandler,
  save_to_file: saveToFile as ToolHandler,
};
