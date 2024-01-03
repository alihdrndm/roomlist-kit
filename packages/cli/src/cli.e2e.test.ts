import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// These tests run the built binary (the package "test" script builds first).
const BIN = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const CLI_DIR = fileURLToPath(new URL("..", import.meta.url));
const fixture = (path: string): string =>
  fileURLToPath(new URL(`../../../fixtures/${path}`, import.meta.url));

const WE1 = fixture("input/we1.csv");
const BLOCK = fixture("blocks/tech26.json");
const ALL_RULES = fixture("input/all-rules.csv");

async function roomlist(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
) {
  return execa("node", [BIN, ...args], {
    reject: false,
    cwd: options.cwd ?? CLI_DIR,
    env: { NO_COLOR: "1", ...options.env },
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

let tmp: string;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "roomlist-cli-"));
});
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** A fresh empty directory per test, so output files never collide. */
async function workDir(): Promise<string> {
  return mkdtemp(join(tmp, "work-"));
}

describe("validate", () => {
  it("exit 0: a clean list with a block prints the summary", async () => {
    const result = await roomlist(["validate", WE1, "--block", BLOCK]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Room nights\s+9/);
    expect(result.stdout).toContain("Rooms per night");
  });

  it("exit 0: warnings alone do not fail the run", async () => {
    const result = await roomlist([
      "validate",
      fixture("input/messy-headers.csv"),
    ]);
    expect(result.stdout).toContain("UNMAPPED_COLUMN");
    expect(result.stdout).toContain("warning");
    expect(result.exitCode).toBe(0);
  });

  it("exit 1: validation errors still print the report to stdout", async () => {
    const result = await roomlist(["validate", ALL_RULES, "--block", BLOCK]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("error");
    expect(result.stdout).toContain("DATE_INVALID");
  });

  it("exit 1: a file-level error (F001 for an empty file)", async () => {
    const dir = await workDir();
    const empty = join(dir, "empty.csv");
    await writeFile(empty, "");
    const result = await roomlist(["validate", empty]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("FILE_EMPTY");
  });

  it("exit 2: the file does not exist", async () => {
    const result = await roomlist(["validate", join(tmp, "missing.csv")]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Cannot read");
  });

  it("exit 2: the file is larger than 5 MB", async () => {
    const dir = await workDir();
    const big = join(dir, "big.csv");
    await writeFile(big, Buffer.alloc(5 * 1024 * 1024 + 1));
    const result = await roomlist(["validate", big]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("limit is 5 MB");
  });

  it("exit 2: --date-order has a value outside MDY|DMY", async () => {
    const result = await roomlist(["validate", WE1, "--date-order", "YMD"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("YMD");
  });

  it("exit 2: --block is not valid JSON", async () => {
    const dir = await workDir();
    const block = join(dir, "block.json");
    await writeFile(block, "{not json");
    const result = await roomlist(["validate", WE1, "--block", block]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("not valid JSON");
  });

  it("exit 2: --block fails the block schema", async () => {
    const dir = await workDir();
    const block = join(dir, "block.json");
    await writeFile(block, JSON.stringify({ startDate: "not a date" }));
    const result = await roomlist(["validate", WE1, "--block", block]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("not a valid block");
  });

  it("exit 0: --json prints ok, format, and the summary", async () => {
    const result = await roomlist([
      "validate",
      WE1,
      "--block",
      BLOCK,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(true);
    expect(report.format).toBe("csv");
    expect(report.summary.roomNights).toBe(9);
    expect(Array.isArray(report.issues)).toBe(true);
    expect(Array.isArray(report.entries)).toBe(true);
    expect(Array.isArray(report.columns)).toBe(true);
    expect(typeof report.rowCount).toBe("number");
  });

  it("exit 1: --json reports ok false for an invalid list", async () => {
    const result = await roomlist(["validate", ALL_RULES, "--json"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).ok).toBe(false);
  });
});

describe("convert", () => {
  it("exit 0: WE1 to Maestro matches the golden file byte for byte", async () => {
    const dir = await workDir();
    const out = join(dir, "out.csv");
    const result = await roomlist([
      "convert",
      WE1,
      "--block",
      BLOCK,
      "--to",
      "maestro-csv",
      "--options",
      '{"buildingCode":"MAIN"}',
      "-o",
      out,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Wrote ${out}`);
    const written = await readFile(out);
    const golden = await readFile(fixture("expected/we1.maestro.csv"));
    expect(written.equals(golden)).toBe(true);
  });

  it("exit 0: without -o the target's default file name is written in the current directory", async () => {
    const dir = await workDir();
    const result = await roomlist(
      ["convert", WE1, "--block", BLOCK, "--to", "opera5-xml"],
      { cwd: dir },
    );
    expect(result.exitCode).toBe(0);
    expect(await exists(join(dir, "rooming-list-opera5.xml"))).toBe(true);
  });

  it("exit 0: warnings go to stderr, not stdout", async () => {
    const dir = await workDir();
    const result = await roomlist(
      ["convert", fixture("input/messy-headers.csv"), "--to", "canonical-json"],
      { cwd: dir },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("warning");
    expect(result.stdout).not.toContain("warning");
    expect(result.stdout).toContain("Wrote ");
  });

  it("exit 1: validation errors write no file", async () => {
    const dir = await workDir();
    const result = await roomlist(
      ["convert", ALL_RULES, "--block", BLOCK, "--to", "canonical-json"],
      { cwd: dir },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("error");
    expect(await exists(join(dir, "rooming-list.json"))).toBe(false);
  });

  it("exit 1: a missing maestro buildingCode (X001) writes no file", async () => {
    const dir = await workDir();
    const result = await roomlist(
      ["convert", WE1, "--block", BLOCK, "--to", "maestro-csv"],
      { cwd: dir },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("EXPORT_FIELD_REQUIRED");
    expect(await exists(join(dir, "rooming-list-maestro.csv"))).toBe(false);
  });

  it("exit 2: unknown --to lists the valid ids", async () => {
    const result = await roomlist(["convert", WE1, "--to", "pdf"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("opera5-xml");
    expect(result.stderr).toContain("maestro-csv");
  });

  it("exit 2: --options is not JSON", async () => {
    const result = await roomlist([
      "convert",
      WE1,
      "--to",
      "maestro-csv",
      "--options",
      "{nope",
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("not valid JSON");
  });

  it("exit 2: --options fails the target's schema", async () => {
    const dir = await workDir();
    const result = await roomlist(
      [
        "convert",
        WE1,
        "--block",
        BLOCK,
        "--to",
        "maestro-csv",
        "--options",
        '{"buildingCode":"MAIN","includeHeader":"yes"}',
      ],
      { cwd: dir },
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid export options");
  });

  it("exit 2: the output file exists and --force is not given", async () => {
    const dir = await workDir();
    const out = join(dir, "out.json");
    await writeFile(out, "keep me");
    const result = await roomlist([
      "convert",
      WE1,
      "--to",
      "canonical-json",
      "-o",
      out,
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("already exists; use --force to overwrite");
    expect(await readFile(out, "utf8")).toBe("keep me");
  });

  it("exit 0: --force overwrites an existing output file", async () => {
    const dir = await workDir();
    const out = join(dir, "out.json");
    await writeFile(out, "old");
    const result = await roomlist([
      "convert",
      WE1,
      "--to",
      "canonical-json",
      "-o",
      out,
      "--force",
    ]);
    expect(result.exitCode).toBe(0);
    expect(await readFile(out, "utf8")).toContain('"entries"');
  });

  it("exit 2: --to is required", async () => {
    const result = await roomlist(["convert", WE1]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--to");
  });
});

describe("diff", () => {
  const v1 = fixture("input/list-v1.csv");
  const v2 = fixture("input/list-v2.csv");

  it("exit 0: shows counts and the signed room-night change", async () => {
    const result = await roomlist(["diff", v1, v2]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Added\s+3/);
    expect(result.stdout).toMatch(/Removed\s+2/);
    expect(result.stdout).toMatch(/Changed\s+4/);
    expect(result.stdout).toContain("+4");
    expect(result.stdout).toContain("Added (3)");
    expect(result.stdout).toContain("Removed (2)");
    expect(result.stdout).toContain("Changed (4)");
  });

  it("exit 0: --json summary equals the golden diff summary", async () => {
    const result = await roomlist(["diff", v1, v2, "--json"]);
    expect(result.exitCode).toBe(0);
    const golden = JSON.parse(
      await readFile(fixture("expected/diff-v1-v2.json"), "utf8"),
    );
    expect(JSON.parse(result.stdout).summary).toEqual(golden);
  });

  it("exit 1: an invalid list is named in stderr and nothing is diffed", async () => {
    const result = await roomlist(["diff", v1, ALL_RULES]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("after:");
    expect(result.stdout).toBe("");
  });

  it("exit 2: a file is missing", async () => {
    const result = await roomlist(["diff", v1, join(tmp, "missing.csv")]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Cannot read");
  });
});

describe("formats", () => {
  const ids = [
    "opera5-xml",
    "opera-cloud-xlsx",
    "maestro-csv",
    "canonical-json",
    "canonical-csv",
  ];

  it("exit 0: lists all five targets with verified and assumed items", async () => {
    const result = await roomlist(["formats"]);
    expect(result.exitCode).toBe(0);
    for (const id of ids) expect(result.stdout).toContain(id);
    expect(result.stdout).toContain("verified");
    expect(result.stdout).toContain("assumed");
  });

  it("exit 0: --json has five targets with provenance", async () => {
    const result = await roomlist(["formats", "--json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.targets).toHaveLength(5);
    for (const target of parsed.targets) {
      expect(Array.isArray(target.provenance)).toBe(true);
    }
    const maestro = parsed.targets.find(
      (target: { id: string }) => target.id === "maestro-csv",
    );
    expect(maestro.provenance.length).toBeGreaterThan(0);
  });

  it("exit 2: an unknown option is a usage error", async () => {
    const result = await roomlist(["formats", "--nope"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--nope");
  });
});

describe("general", () => {
  it("exit 2: an unknown command is a usage error", async () => {
    const result = await roomlist(["frobnicate"]);
    expect(result.exitCode).toBe(2);
  });

  it("exit 0: --help prints usage", async () => {
    const result = await roomlist(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("roomlist");
  });

  it("exit 1: NO_COLOR output has no escape codes", async () => {
    const result = await roomlist(["validate", ALL_RULES, "--block", BLOCK]);
    expect(result.stdout).not.toContain("\u001b[");
    expect(result.stderr).not.toContain("\u001b[");
  });
});

describe("convert refuses on parser-only errors (M3 carry-forward)", () => {
  it("exit 1: a Rooms cell that is not a number (R006, found only by the parser) writes no file", async () => {
    const dir = await workDir();
    const input = join(dir, "rooms.csv");
    await writeFile(
      input,
      "Last Name,First Name,Arrival,Departure,Room Type,Rooms\nOkafor,Ada,2026-11-10,2026-11-12,KING,abc\n",
    );
    const out = join(dir, "out.json");
    const result = await roomlist([
      "convert",
      input,
      "--to",
      "canonical-json",
      "-o",
      out,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ROOMS_INVALID");
    expect(await exists(out)).toBe(false);
  });
});

describe("colour in the built binary", () => {
  // Spawned with a pipe, stdout is never a TTY here. Remove NO_COLOR and add
  // FORCE_COLOR to prove the non-TTY rule holds on its own.
  it("exit 0: piped stdout has no escape codes even with FORCE_COLOR and no NO_COLOR", async () => {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && key !== "NO_COLOR") env[key] = value;
    }
    env.FORCE_COLOR = "1";
    const result = await execa("node", [BIN, "validate", WE1], {
      reject: false,
      cwd: CLI_DIR,
      env,
      extendEnv: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("\u001b[");
  });
});
