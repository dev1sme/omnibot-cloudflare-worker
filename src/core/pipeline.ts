import { isAdmin } from "../lib/is-admin";
import { errorFields, log } from "../lib/log";
import { messages } from "../messages";
import { fail, ok } from "./response";
import { resolve } from "./router";
import type {
  Adapter,
  Command,
  CommandDeps,
  Env,
  IncomingMessage,
  OutgoingMessage,
  Route,
} from "./types";

export async function handleWebhook(
  req: Request,
  adapter: Adapter,
  commands: readonly Command[],
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!adapter.isEnabled(env)) return fail("NOT_FOUND");

  // The body can be read only once, so the pipeline owns this read.
  const rawBody = await req.text();

  if (!(await adapter.verify(rawBody, req.headers, env))) {
    log.warn("verify_failed", { platform: adapter.name });
    return fail("UNAUTHORIZED");
  }

  const parsed = adapter.parse(rawBody, env);
  if (parsed.kind === "respond") return parsed.response;
  if (parsed.kind === "ignore") return ok();

  const route = resolve(parsed.msg.text, commands);
  if (route.kind === "none") return ok();

  ctx.waitUntil(execute(route, parsed.msg, adapter, { env, ctx, commands }));
  return adapter.ack(parsed.msg);
}

// Runs after the response is returned, so it must never reject.
async function execute(
  route: Route,
  msg: IncomingMessage,
  adapter: Adapter,
  deps: CommandDeps,
): Promise<void> {
  const fields = {
    platform: msg.platform,
    command: route.kind === "command" ? route.command.name : undefined,
  };

  let out: OutgoingMessage;
  try {
    out = await runRoute(route, msg, deps);
    if (!out.text) throw new Error("Command returned empty text");
  } catch (error) {
    log.error("command_failed", { ...fields, ...errorFields(error) });
    out = { text: messages.commandFailed };
  }

  try {
    await adapter.reply(msg, out, deps.env);
  } catch (error) {
    log.error("reply_failed", { ...fields, ...errorFields(error) });
  }
}

async function runRoute(
  route: Route,
  msg: IncomingMessage,
  deps: CommandDeps,
): Promise<OutgoingMessage> {
  if (route.kind !== "command") return { text: messages.unknownCommand };

  const denied =
    route.command.permission === "admin" &&
    !isAdmin(msg.platform, msg.user.id, deps.env.ADMIN_USER_IDS);
  if (denied) return { text: messages.permissionDenied };

  return route.command.run(msg, deps);
}
