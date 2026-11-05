import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const core = (path: string) =>
  fileURLToPath(new URL(`../../packages/core/src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Run against core's source so tests work before core is built. Exact matches
    // first: a plain string alias would also rewrite the subpath imports.
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      { find: /^@alihdrndm\/roomlist-core$/, replacement: core("index.ts") },
      {
        find: /^@alihdrndm\/roomlist-core\/plain-date$/,
        replacement: core("plain-date.ts"),
      },
      {
        find: /^@alihdrndm\/roomlist-core\/rules$/,
        replacement: core("issues.ts"),
      },
      {
        find: /^@alihdrndm\/roomlist-core\/header-aliases$/,
        replacement: core("parse/header-aliases.ts"),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
