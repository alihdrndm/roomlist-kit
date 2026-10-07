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
});
