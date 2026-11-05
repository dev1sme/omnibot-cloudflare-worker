import { describe, expect, it } from "vitest";
import { createCommand } from "../../test/helpers";
import { resolve } from "./router";

const hello = createCommand({ name: "hello" });

describe("resolve", () => {
  it("ignores text that is not a command", () => {
    expect(resolve("hello", [hello])).toEqual({ kind: "none" });
  });

  it.each(["/hello", "/hello world", "/HELLO", "/hello\nworld"])("matches %j", (text) => {
    expect(resolve(text, [hello])).toEqual({ kind: "command", command: hello });
  });

  it.each(["/missing", "/", "/hellox"])("reports %j as unknown", (text) => {
    expect(resolve(text, [hello])).toEqual({ kind: "unknown" });
  });
});
