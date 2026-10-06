import { describe, expect, it } from "vitest";
import type { RoomingList } from "../model.js";
import { parseRoomingList } from "../parse/parse.js";
import { exportRoomingList } from "./export.js";
import { date, readFixtureBytes, tech26, we1List } from "./test-helpers.js";
import {
  ExportOptionsError,
  ExportPreconditionError,
  UnknownTargetError,
} from "./types.js";

async function refusal(
  promise: Promise<unknown>,
): Promise<ExportPreconditionError> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ExportPreconditionError))
    throw new Error(`expected ExportPreconditionError, got ${String(error)}`);
  return error;
}

describe("exportRoomingList", () => {
  it("refuses to export when validation reports an error, carrying only the errors", async () => {
    const list = await we1List();
    const first = list.entries[0];
    if (first === undefined) throw new Error("test setup");
    const broken: RoomingList = {
      ...list,
      entries: [
        { ...first, departureDate: first.arrivalDate },
        ...list.entries.slice(1),
      ],
    };
    const error = await refusal(exportRoomingList(broken, "canonical-json"));
    expect(error.issues.map((issue) => issue.ruleId)).toEqual(["R003"]);
    expect(error.message).toContain("1 problem");
  });

  it("returns validation warnings in ExportResult.issues without blocking", async () => {
    const list = await we1List();
    const withoutRoomType = {
      ...list,
      entries: list.entries.map(({ roomType: _drop, ...rest }) => rest),
    };
    const result = await exportRoomingList(withoutRoomType, "canonical-json");
    expect(new Set(result.issues.map((issue) => issue.ruleId))).toEqual(
      new Set(["W204"]),
    );
  });

  it("X001: an entry that validation cannot flag but lacks a required field is refused, not crashed on", async () => {
    // A date cell that failed to parse was reported by the parser as R002 and left empty.
    const parsed = await parseRoomingList(
      new TextEncoder().encode(
        "Last Name,Arrival,Departure\nOkafor,not a date,2026-11-12\n",
      ),
    );
    const error = await refusal(
      exportRoomingList({ entries: parsed.entries }, "canonical-csv"),
    );
    expect(error.issues[0]).toMatchObject({
      ruleId: "X001",
      code: "EXPORT_FIELD_REQUIRED",
      field: "arrivalDate",
      line: 1,
    });
  });

  it("throws UnknownTargetError for an unknown target id", async () => {
    await expect(
      exportRoomingList(await we1List(), "pms-9000"),
    ).rejects.toBeInstanceOf(UnknownTargetError);
  });

  it("throws ExportOptionsError carrying the Zod issues", async () => {
    const error = await exportRoomingList(await we1List(), "maestro-csv", {
      includeHeader: "yes",
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ExportOptionsError);
    expect(
      error instanceof ExportOptionsError && error.issues[0]?.path,
    ).toEqual(["includeHeader"]);
  });

  it("canonical targets accept no options", async () => {
    await expect(
      exportRoomingList(await we1List(), "canonical-json", { pretty: true }),
    ).rejects.toBeInstanceOf(ExportOptionsError);
  });

  it("writes every target for clean-40 with the tech26 block", async () => {
    const parsed = await parseRoomingList(
      readFixtureBytes("input/clean-40.csv"),
    );
    const list: RoomingList = { block: tech26(), entries: parsed.entries };
    const options: Record<string, unknown> = {
      "maestro-csv": { buildingCode: "MAIN" },
    };
    for (const id of [
      "opera5-xml",
      "opera-cloud-xlsx",
      "maestro-csv",
      "canonical-json",
      "canonical-csv",
    ]) {
      const result = await exportRoomingList(list, id, options[id]);
      expect(result.bytes.length, id).toBeGreaterThan(100);
      expect(result.issues, id).toEqual([]);
    }
  });

  it("maestro-csv writes a sharer after its primary even when the list is out of order", async () => {
    const list: RoomingList = {
      block: { groupReservationNumber: "1", shoulderDays: 0 },
      entries: [
        {
          line: 1,
          lastName: "B",
          firstName: "B",
          roomType: "K/K",
          sharesWithLine: 2,
          arrivalDate: date("2026-11-10"),
          departureDate: date("2026-11-11"),
          rooms: 1,
          adults: 1,
          children: 0,
          infants: 0,
        },
        {
          line: 2,
          lastName: "A",
          firstName: "A",
          roomType: "K/K",
          arrivalDate: date("2026-11-10"),
          departureDate: date("2026-11-11"),
          rooms: 1,
          adults: 1,
          children: 0,
          infants: 0,
        },
      ],
    };
    const csv = new TextDecoder().decode(
      (await exportRoomingList(list, "maestro-csv")).bytes,
    );
    expect(csv.split("\r\n").map((row) => row.split(",")[3])).toEqual([
      "A",
      "B",
      undefined,
    ]);
  });
});
