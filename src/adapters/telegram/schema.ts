// test-exempt: declarative schema. Behavior is covered by test/adapters/telegram/parse.test.ts.
import * as v from "valibot";

export const UpdateSchema = v.object({
  message: v.object({
    message_id: v.number(),
    chat: v.object({ id: v.number(), type: v.string() }),
    from: v.object({ id: v.number(), first_name: v.string() }),
    text: v.string(),
  }),
});
