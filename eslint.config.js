import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", ".wrangler/", "bundled/", "dist/"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // Exception: log.ts is the only logger, and scripts print to a terminal, not Workers Logs.
  {
    files: ["src/lib/log.ts", "scripts/**"],
    rules: { "no-console": "off" },
  },
  {
    files: ["src/commands/**"],
    ignores: ["src/commands/index.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: ".", message: "Read deps.commands instead." },
            { name: "./index", message: "Read deps.commands instead." },
          ],
          patterns: [
            { group: ["**/adapters", "**/adapters/**"], message: "Commands must not import adapters." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/adapters/*/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^\\.\\./[^.]", message: "Adapters must not import other adapters." },
            { regex: "^\\.\\./index", message: "Adapters must not import the registry." },
            { regex: "^\\.\\./\\.\\./(commands|core/(router|pipeline))", message: "Adapters must not import commands or the router." },
          ],
        },
      ],
    },
  },
);
