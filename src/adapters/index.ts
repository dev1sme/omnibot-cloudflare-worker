import type { Adapter } from "../core/types";
import { telegram } from "./telegram";
import { zalo } from "./zalo";

export const adapters: readonly Adapter[] = [zalo, telegram];
