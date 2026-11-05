// test-exempt: declares types only, so it has no runtime behavior.
export interface Env {
  OMNIBOT_KV: KVNamespace;
  WEBHOOK_SECRET?: string;
  ZALO_BOT_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  DISCORD_APP_ID?: string;
  DISCORD_PUBLIC_KEY?: string;
  ADMIN_USER_IDS?: string;
}

export interface IncomingMessage {
  platform: string;
  messageId: string;
  chatId: string;
  chatType: "private" | "group";
  user: { id: string; name?: string };
  text: string;
  raw: unknown; // Original payload. Read by the owning adapter.
}

export interface OutgoingMessage {
  text: string;
}

export type ParseResult =
  | { kind: "message"; msg: IncomingMessage }
  | { kind: "respond"; response: Response } // For example, Discord PING
  | { kind: "ignore" };

export interface Adapter {
  name: string;
  isEnabled(env: Env): boolean;
  verify(rawBody: string, headers: Headers, env: Env): Promise<boolean>;
  parse(rawBody: string, env: Env): ParseResult;
  ack(msg: IncomingMessage): Response;
  reply(msg: IncomingMessage, out: OutgoingMessage, env: Env): Promise<void>;
}

export interface CommandDeps {
  env: Env;
  ctx: ExecutionContext;
  commands: readonly Command[];
}

export interface Command {
  name: string;
  description: string;
  permission?: "everyone" | "admin"; // Defaults to "everyone"
  run(msg: IncomingMessage, deps: CommandDeps): Promise<OutgoingMessage>;
}

export type Route =
  | { kind: "command"; command: Command }
  | { kind: "unknown" } // Starts with "/" but matches no command
  | { kind: "none" }; // Not a command

export interface ResponseMeta {
  timestamp: number; // Unix epoch seconds
}

export interface ValueResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: ResponseMeta;
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export interface ErrorBody {
  code: ErrorCode;
  details?: Record<string, string[]>;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error: ErrorBody;
  meta: ResponseMeta;
}
