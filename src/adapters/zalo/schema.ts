import * as v from "valibot";

export const TextEventSchema = v.object({
  event_name: v.literal("message.text.received"),
  message: v.object({
    message_id: v.string(),
    chat: v.object({ id: v.string(), chat_type: v.literal("PRIVATE") }),
    from: v.object({ id: v.string(), display_name: v.optional(v.string()) }),
    text: v.string(),
  }),
});

export const ApiResponseSchema = v.object({
  ok: v.boolean(),
  error_code: v.optional(v.number()),
});
