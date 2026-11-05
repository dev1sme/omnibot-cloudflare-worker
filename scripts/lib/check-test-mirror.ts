const EXEMPT_MARKER = /^\/\/ test-exempt: (\S.*)$/m;
const CROSS_LAYER_MARKER = /^\/\/ test-cross-layer: (\S.*)$/m;

export type SourceFiles = ReadonlyMap<string, string>;

function expectedTestPath(sourcePath: string): string {
  const relative = sourcePath.startsWith("src/") ? sourcePath.slice("src/".length) : sourcePath;
  return `test/${relative.replace(/\.ts$/, ".test.ts")}`;
}

function expectedSourcePaths(testPath: string): string[] {
  const relative = testPath.slice("test/".length).replace(/\.test\.ts$/, ".ts");
  return relative.startsWith("scripts/") ? [relative] : [`src/${relative}`];
}

// Every source file needs a mirrored test or a marked exemption with a reason.
export function checkTestMirror(sources: SourceFiles, tests: SourceFiles): string[] {
  const errors: string[] = [];

  for (const [path, content] of sources) {
    if (path.endsWith(".test.ts")) {
      errors.push(`${path}: move this test into test/`);
      continue;
    }

    const testPath = expectedTestPath(path);
    const exempt = EXEMPT_MARKER.test(content);
    if (tests.has(testPath) && exempt) {
      errors.push(`${path}: remove the test-exempt marker, because ${testPath} exists`);
    }
    if (!tests.has(testPath) && !exempt) {
      errors.push(`${path}: add ${testPath}, or a "// test-exempt: <reason>" comment`);
    }
  }

  for (const [path, content] of tests) {
    if (!path.endsWith(".test.ts")) continue;
    const hasSource = expectedSourcePaths(path).some((source) => sources.has(source));
    if (!hasSource && !CROSS_LAYER_MARKER.test(content)) {
      errors.push(`${path}: no matching source file. Add a "// test-cross-layer: <reason>" comment if intended`);
    }
  }

  return errors;
}
