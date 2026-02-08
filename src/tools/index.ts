import {
  readStyleProfile,
  readStyleProfileSchema,
} from "./style-profile.js";

export const toolDefinitions = [readStyleProfileSchema];

type ToolHandler = (input: Record<string, unknown>) => Promise<object>;

export const toolHandlers: Record<string, ToolHandler> = {
  read_style_profile: readStyleProfile as ToolHandler,
};
