import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "web/public/vendor/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // stdio transport reserves stdout for JSON-RPC: only the MCP server itself
    // must never use console.log.
    files: ["src/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  {
    files: ["web/public/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        document: "readonly",
        fetch: "readonly",
        window: "readonly",
        marked: "readonly",
        DOMPurify: "readonly",
        FileReader: "readonly",
      },
    },
  },
  {
    files: ["web/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
);
