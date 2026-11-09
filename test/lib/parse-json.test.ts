import { describe, expect, it } from "vitest";
import { parseJson } from "../../src/lib/parse-json";

describe("parseJson", () => {
  it("parses valid JSON and returns undefined otherwise", () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson("{")).toBeUndefined();
  });
});
