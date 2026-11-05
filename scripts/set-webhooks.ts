import { setWebhooks } from "./lib/set-webhooks";

process.exitCode = (await setWebhooks(process.env, console.log)) ? 0 : 1;
