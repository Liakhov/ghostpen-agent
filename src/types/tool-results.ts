import type { StyleProfile } from "./style-profile.js";

/** Base for all tool results - tools return JSON-serializable objects */
export interface ToolResultBase {
  success: boolean;
}

export interface ReadStyleProfileSuccess extends ToolResultBase {
  success: true;
  profile: StyleProfile;
}

export interface ReadStyleProfileError extends ToolResultBase {
  success: false;
  error: string;
  message: string;
  available_profiles?: string[];
}

export type ReadStyleProfileResult =
  | ReadStyleProfileSuccess
  | ReadStyleProfileError;

export interface SaveToFileSuccess extends ToolResultBase {
  success: true;
  file_path: string;
}

export interface SaveToFileError extends ToolResultBase {
  success: false;
  error?: string;
  message?: string;
}

export type SaveToFileResult = SaveToFileSuccess | SaveToFileError;
