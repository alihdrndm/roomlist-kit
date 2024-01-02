import { describe, expect, it } from "vitest";
import type { RoomingList } from "../model.js";
import { exportRoomingList } from "./export.js";
import { date, we1List } from "./test-helpers.js";
import { ExportOptionsError } from "./types.js";

const text = async (list: RoomingList, options?: unknown) =>
  new TextDecoder().decode(
    (await exportRoomingList(list, "opera5-xml", options)).bytes,
  );

describe("opera5-xml", () => {
  it("opera5-xml: renumbers records in output order and writes the sharer after its primary", async () => {
    // Line 1 is a sharer of line 3; it must still come after line 3 and point at its new number.
    const list: RoomingList = {
      entries: [
        {
          line: 1,
          lastName: "Sharer",
          sharesWithLine: 3,
          arrivalDate: date("2026-11-10"),
          departureDate: date("2026-11-12"),
          rooms: 2,
          adults: 1,
          children: 0,
          infants: 0,
        },
        {
          line: 2,
          lastName: "Solo",
          arrivalDate: date("2026-11-10"),
          departureDate: date("2026-11-12"),
          rooms: 1,
          adults: 1,
          children: 0,
          infants: 0,
        },
        {
          line: 3,
          lastName: "Primary",
          arrivalDate: date("2026-11-10"),
          departureDate: date("2026-11-12"),
          rooms: 2,
          adults: 1,
          children: 0,
          infants: 0,
        },
      ],
    };
    const xml = await text(list);
    const names = [...xml.matchAll(/<guestLastName>(.*?)</g)].map(
      (match) => match[1],
    );
    expect(names).toEqual(["Solo", "Primary", "Sharer"]);
    expect(xml).toContain("<shareRecordNumber>2</shareRecordNumber>");
    // A3: the sharer is written with numberRooms 1 although its entry says 2.
    const sharerRecord = xml.slice(xml.indexOf("<recordNumber>3<"));
    expect(sharerRecord).toContain("<numberRooms>1</numberRooms>");
    expect(xml.match(/<shareRecordNumber>/g)).toHaveLength(1);
  });

  it("opera5-xml: writes optional fields in spec order and omits absent ones", async () => {
    const list: RoomingList = {
      block: { propertyCode: "DEMO", shoulderDays: 0 },
      entries: [
        {
          line: 1,
          lastName: "Okafor",
          firstName: "Ada",
          title: "Dr",
          arrivalDate: date("2026-01-05"),
          departureDate: date("2026-01-09"),
          roomType: "KING",
          rooms: 1,
          adults: 2,
          children: 1,
          infants: 0,
          travelAgentLocator: "TA1",
          dateOfBirth: date("1990-03-04"),
          language: "EN",
          nationality: "NG",
          passport: "X123",
        },
      ],
    };
    const xml = await text(list);
    const tags = [...xml.matchAll(/<(\w+)>/g)]
      .map((match) => match[1])
      .filter((tag) => tag !== "RoomingListImport" && tag !== "Reservation");
    expect(tags).toEqual([
      "recordNumber",
      "resortId",
      "guestLastName",
      "guestFirstName",
      "guestTitle",
      "arrivalDate",
      "departureDate",
      "roomType",
      "numberRooms",
      "numberAdults",
      "numberChildren",
      "ta_Record_Locator",
      "date_of_Birth",
      "language_Code",
      "nationality_Code",
      "passport",
    ]);
    expect(xml).toContain("<arrivalDate>01/05/2026</arrivalDate>");
    expect(xml).toContain("<date_of_Birth>03/04/1990</date_of_Birth>");
    expect(xml).not.toContain("blockCode");
  });

  it("opera5-xml: escapes XML special characters in names", async () => {
    const list = await we1List();
    const first = list.entries[0];
    if (first === undefined) throw new Error("test setup");
    const xml = await text({
      ...list,
      entries: [{ ...first, lastName: "O'Brien & <Sons>" }],
    });
    expect(xml).toContain(
      "<guestLastName>O'Brien &amp; &lt;Sons&gt;</guestLastName>",
    );
  });

  it("opera5-xml: rootElement and recordElement options (A1) change the envelope", async () => {
    const xml = await text(await we1List(), {
      rootElement: "Import",
      recordElement: "Guest",
    });
    expect(xml).toContain("<Import>");
    expect(xml).toContain("<Guest>");
    expect(xml).not.toContain("Reservation");
    expect(xml.endsWith("</Import>\n")).toBe(true);
  });

  it("opera5-xml: element names must be valid XML names", async () => {
    for (const bad of [
      "Has Space",
      "1starts-with-digit",
      "a<b",
      "",
      "ns:name",
    ]) {
      await expect(
        exportRoomingList(await we1List(), "opera5-xml", { rootElement: bad }),
      ).rejects.toBeInstanceOf(ExportOptionsError);
    }
  });

  it("opera5-xml: rejects unknown options", async () => {
    await expect(
      exportRoomingList(await we1List(), "opera5-xml", { nope: true }),
    ).rejects.toBeInstanceOf(ExportOptionsError);
  });
});
