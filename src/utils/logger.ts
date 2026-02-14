import * as fs from "node:fs/promises";
import * as path from "node:path";
import { LOGS_DIR } from "../constants/paths.js";

export interface SessionLog {
  session_id: string;
  started_at: string;
  input: string;
  profile_used: string;
  events: LogEvent[];
  usage: TokenUsage;
  cost_usd?: number;
  finished_at?: string;
}

export interface LogEvent {
  timestamp: string;
  type: "api_call" | "tool_call" | "tool_result" | "assistant_text" | "user_feedback" | "error" | "save";
  data: Record<string, unknown>;
}

export interface TokenUsage {
  input: number;
  output: number;
  cache_write: number;
  cache_read: number;
}

function ts(): string {
  return new Date().toISOString();
}

function sessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  return `${date}-${time}`;
}

export class SessionLogger {
  private log: SessionLog;
  private filePath: string;

  constructor(input: string, profileUsed: string) {
    const id = sessionId();
    this.log = {
      session_id: id,
      started_at: ts(),
      input,
      profile_used: profileUsed,
      events: [],
      usage: { input: 0, output: 0, cache_write: 0, cache_read: 0 },
    };
    this.filePath = path.join(LOGS_DIR, `${id}.json`);
  }

  event(type: LogEvent["type"], data: Record<string, unknown>): void {
    this.log.events.push({ timestamp: ts(), type, data });
  }

  updateUsage(usage: TokenUsage, costUsd?: number): void {
    this.log.usage = { ...usage };
    if (costUsd !== undefined) {
      this.log.cost_usd = costUsd;
    }
  }

  async flush(): Promise<string> {
    this.log.finished_at = ts();
    await fs.mkdir(LOGS_DIR, { recursive: true });

    // Avoid filename collisions
    let filePath = this.filePath;
    let suffix = 1;
    while (true) {
      try {
        await fs.access(filePath);
        suffix++;
        filePath = this.filePath.replace(".json", `-${suffix}.json`);
      } catch {
        break;
      }
    }
    this.filePath = filePath;

    await fs.writeFile(this.filePath, JSON.stringify(this.log, null, 2), "utf-8");
    return path.relative(process.cwd(), this.filePath);
  }
}
