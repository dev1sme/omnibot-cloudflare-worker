import { Hono } from "hono";
import { adapters } from "./adapters";
import { commands } from "./commands";
import { handleWebhook } from "./core/pipeline";
import { fail } from "./core/response";
import type { Env } from "./core/types";
import { errorFields, log } from "./lib/log";

export const app = new Hono<{ Bindings: Env }>();

app.all("/webhook/:platform", (c) => {
  const adapter = adapters.find((a) => a.name === c.req.param("platform"));
  if (!adapter) return fail("NOT_FOUND");
  if (c.req.method !== "POST") return fail("METHOD_NOT_ALLOWED");
  // Hono declares a narrower context type than the Workers runtime object it holds.
  const ctx = c.executionCtx as ExecutionContext;
  return handleWebhook(c.req.raw, adapter, commands, c.env, ctx);
});

app.notFound(() => fail("NOT_FOUND"));

app.onError((error) => {
  log.error("unexpected_error", errorFields(error));
  return fail("INTERNAL_ERROR");
});
