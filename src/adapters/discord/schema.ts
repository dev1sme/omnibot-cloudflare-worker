// test-exempt: declarative schema. Behavior is covered by test/adapters/discord/parse.test.ts.
import * as v from "valibot";

const UserSchema = v.object({
  id: v.string(),
  username: v.string(),
  global_name: v.nullish(v.string()),
});

export const PingSchema = v.object({ type: v.literal(1) });

export const CommandSchema = v.object({
  type: v.literal(2),
  id: v.string(),
  token: v.string(),
  channel_id: v.string(),
  guild_id: v.optional(v.string()),
  member: v.optional(v.object({ user: UserSchema })),
  user: v.optional(UserSchema),
  data: v.object({ name: v.string() }),
});

export const ReplyTokenSchema = v.object({ token: v.string() });

export const RateLimitSchema = v.object({ retry_after: v.number() });

export const ErrorCodeSchema = v.object({ code: v.number() });
