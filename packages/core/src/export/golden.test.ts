import { describe, expect, it } from "vitest";
import { exportRoomingList } from "./export.js";
import { readFixtureBytes, we1List } from "./test-helpers.js";

const golden = (name: string) => readFixtureBytes(`expected/${name}`);

describe("WE1 golden files (byte for byte)", () => {
  it("WE1: opera5-xml with default options matches we1.opera5.xml", async () => {
    const result = await exportRoomingList(await we1List(), "opera5-xml");
    expect(result.bytes).toEqual(golden("we1.opera5.xml"));
    expect(result.fileName).toBe("rooming-list-opera5.xml");
    expect(result.contentType).toBe("application/xml");
    expect(result.issues).toEqual([]);
  });

  it("WE1: maestro-csv with buildingCode MAIN matches we1.maestro.csv (CRLF endings)", async () => {
    const result = await exportRoomingList(await we1List(), "maestro-csv", {
      buildingCode: "MAIN",
    });
    expect(result.bytes).toEqual(golden("we1.maestro.csv"));
    expect(result.fileName).toBe("rooming-list-maestro.csv");
    expect(result.contentType).toBe("text/csv; charset=utf-8");
    const text = new TextDecoder().decode(result.bytes);
    expect(text.split("\r\n")).toHaveLength(5); // four rows and the empty piece after the final terminator
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });

  it("WE1: canonical-json matches we1.canonical.json", async () => {
    const result = await exportRoomingList(await we1List(), "canonical-json");
    expect(result.bytes).toEqual(golden("we1.canonical.json"));
    expect(result.fileName).toBe("rooming-list.json");
  });

  it("WE1: canonical-csv matches we1.canonical.csv (LF endings)", async () => {
    const result = await exportRoomingList(await we1List(), "canonical-csv");
    expect(result.bytes).toEqual(golden("we1.canonical.csv"));
    expect(new TextDecoder().decode(result.bytes)).not.toContain("\r");
  });

  it("WE1: the canonical-json summary equals the worked-example summary", async () => {
    const result = await exportRoomingList(await we1List(), "canonical-json");
    const json = JSON.parse(new TextDecoder().decode(result.bytes));
    expect(json.summary).toMatchObject({
      entries: 4,
      primaries: 3,
      sharers: 1,
      rooms: 3,
      people: 6,
      roomNights: 9,
    });
  });
});
