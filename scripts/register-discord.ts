import { commands } from "../src/commands";
import { registerDiscord } from "./lib/register-discord";

process.exitCode = (await registerDiscord(process.env, commands, console.log)) ? 0 : 1;
