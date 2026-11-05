import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", ".wrangler/", "bundled/", "dist/"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
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
          patterns: [
            { group: ["**/adapters/**"], message: "Commands must not import adapters." },
            { group: ["./index", "./index.ts", "."], message: "Read deps.commands instead." },
          ],
        },
      ],
    },
  },
);
