// test-exempt: only calls lib/set-webhooks.ts and sets the exit code.
import { setWebhooks } from "./lib/set-webhooks";

process.exitCode = (await setWebhooks(process.env, console.log)) ? 0 : 1;
