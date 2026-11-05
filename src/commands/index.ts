import type { Command } from "../core/types";
import { help } from "./help";
import { ping } from "./ping";

export const commands: readonly Command[] = [ping, help];
