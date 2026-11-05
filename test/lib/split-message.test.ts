import { describe, expect, it } from "vitest";
import { splitMessage } from "../../src/lib/split-message";

describe("splitMessage", () => {
  it("keeps text at the exact limit", () => {
    expect(splitMessage("abcde", 5)).toEqual(["abcde"]);
  });

  it("splits text one unit over the limit", () => {
    expect(splitMessage("abcdef", 5)).toEqual(["abcde", "f"]);
  });

  it("prefers a newline, then a space", () => {
    expect(splitMessage("aa bb\ncc dd", 8)).toEqual(["aa bb", "cc dd"]);
    expect(splitMessage("aa bb cc", 6)).toEqual(["aa bb", "cc"]);
  });

  it("never splits a surrogate pair", () => {
    const chunks = splitMessage("😀😀😀", 3);
    expect(chunks).toEqual(["😀", "😀", "😀"]);
  });

  it("makes progress when the limit is smaller than a surrogate pair", () => {
    expect(splitMessage("😀", 1).join("")).toBe("😀");
  });

  it("never returns an empty chunk or exceeds the limit", () => {
    const chunks = splitMessage(`${"a".repeat(10)}\n\n\n   \n${"b".repeat(10)}`, 10);
    expect(chunks).toEqual(["a".repeat(10), "b".repeat(10)]);
    expect(splitMessage("   ", 2)).toEqual([]);
    expect(splitMessage("", 2)).toEqual([]);
  });
});
