// test-exempt: only reads files and sets the exit code. The logic is in lib/check-test-mirror.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkTestMirror } from "./lib/check-test-mirror";

function readTree(directory: string): Map<string, string> {
  const files = readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((file) => join(directory, file))
    .filter((file) => file.endsWith(".ts"));
  return new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
}

const sources = new Map([...readTree("src"), ...readTree("scripts")]);
const errors = checkTestMirror(sources, readTree("test"));

errors.forEach((error) => console.error(error));
process.exitCode = errors.length > 0 ? 1 : 0;
