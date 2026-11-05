import { PlatformError } from "./platform-error";

export interface LogFields {
  platform?: string;
  command?: string;
  status?: number;
  error_code?: number;
  error_name?: string;
}

function write(level: "info" | "warn" | "error", event: string, fields: LogFields): void {
  console[level]({ level, event, ...fields });
}

export const log = {
  info: (event: string, fields: LogFields = {}) => write("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => write("warn", event, fields),
  error: (event: string, fields: LogFields = {}) => write("error", event, fields),
};

// Never includes error.message, which can contain a token or message text.
export function errorFields(error: unknown): LogFields {
  if (error instanceof PlatformError) {
    return { error_name: error.name, status: error.status, error_code: error.errorCode };
  }
  return { error_name: error instanceof Error ? error.name : "UnknownError" };
}
