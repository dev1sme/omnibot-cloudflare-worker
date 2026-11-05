import { describe, expect, it } from "vitest";
import { checkTestMirror } from "../../../scripts/lib/check-test-mirror";

const files = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe("checkTestMirror", () => {
  it("accepts mirrored tests from src and scripts", () => {
    const sources = files({ "src/core/router.ts": "", "scripts/lib/a.ts": "" });
    const tests = files({ "test/core/router.test.ts": "", "test/scripts/lib/a.test.ts": "" });
    expect(checkTestMirror(sources, tests)).toEqual([]);
  });

  it("reports a source file with no test and no marker", () => {
    const errors = checkTestMirror(files({ "src/lib/a.ts": "" }), files({}));
    expect(errors).toEqual([expect.stringContaining("test/lib/a.test.ts")]);
  });

  it("accepts an exemption with a reason", () => {
    const sources = files({ "src/lib/a.ts": "// test-exempt: types only\n" });
    expect(checkTestMirror(sources, files({}))).toEqual([]);
  });

  it("rejects an exemption with no reason", () => {
    const sources = files({ "src/lib/a.ts": "// test-exempt: \n" });
    expect(checkTestMirror(sources, files({}))).toHaveLength(1);
  });

  it("rejects an exemption on a file that has a test", () => {
    const sources = files({ "src/lib/a.ts": "// test-exempt: types only\n" });
    const errors = checkTestMirror(sources, files({ "test/lib/a.test.ts": "" }));
    expect(errors).toEqual([expect.stringContaining("remove the test-exempt marker")]);
  });

  it("reports a test file inside src", () => {
    const errors = checkTestMirror(files({ "src/lib/a.test.ts": "" }), files({}));
    expect(errors).toEqual([expect.stringContaining("move this test")]);
  });

  it("reports a test with no source file", () => {
    const errors = checkTestMirror(files({}), files({ "test/lib/gone.test.ts": "" }));
    expect(errors).toEqual([expect.stringContaining("no matching source file")]);
  });

  it("accepts a cross-layer test with a reason, and ignores helpers", () => {
    const tests = files({
      "test/worker.test.ts": "// test-cross-layer: full flow\n",
      "test/helpers.ts": "",
    });
    expect(checkTestMirror(files({}), tests)).toEqual([]);
  });

  it("rejects a cross-layer marker with no reason", () => {
    expect(checkTestMirror(files({}), files({ "test/worker.test.ts": "// test-cross-layer: \n" }))).toHaveLength(1);
  });
});
