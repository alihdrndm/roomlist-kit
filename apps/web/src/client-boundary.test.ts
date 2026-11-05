import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A client component that imports env.ts or proxy.ts would put the API key in the
// browser bundle, so this guards the boundary.
const srcDir = fileURLToPath(new URL("./", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function isClientFile(text: string): boolean {
  const withoutComments = text.replace(
    /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/,
    "",
  );
  return /^["']use client["']/.test(withoutComments);
}

const FORBIDDEN =
  /(?:from\s+|import\s+|import\(\s*)["'](?:@\/env|@\/lib\/proxy|(?:\.{1,2}\/)+(?:[\w-]+\/)*(?:env|proxy))["']/;

// Client code may take types from core's main entry, but runtime code only from the
// pure subpaths (no dependencies): the main entry would bundle exceljs and friends.
const CORE_RUNTIME_IMPORT =
  /import\s+(?!type\b)[^;]*?from\s+["']@alihdrndm\/roomlist-core(\/[\w-]+)?["']/g;
const PURE_SUBPATHS = new Set(["/plain-date", "/rules", "/header-aliases"]);

describe("client boundary", () => {
  const clientFiles = sourceFiles(srcDir).filter((file) =>
    isClientFile(readFileSync(file, "utf8")),
  );

  it("finds the client components", () => {
    expect(clientFiles.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps env and proxy out of every client component", () => {
    for (const file of clientFiles) {
      expect(FORBIDDEN.test(readFileSync(file, "utf8")), file).toBe(false);
    }
  });

  // Every app file, not only "use client" ones: lib helpers end up in the browser through them.
  it("imports core at runtime only from its pure subpaths", () => {
    const appFiles = sourceFiles(srcDir).filter(
      (file) => !file.endsWith(".test.ts") && !file.includes("/test/"),
    );
    for (const file of appFiles) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(CORE_RUNTIME_IMPORT)) {
        expect(PURE_SUBPATHS.has(match[1] ?? ""), `${file}: ${match[0]}`).toBe(
          true,
        );
      }
    }
  });
});
