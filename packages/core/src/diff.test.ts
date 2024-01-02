import { describe, expect, it } from "vitest";
import { diffRoomingLists } from "./diff.js";
import type { ParsedEntry, RoomingList } from "./model.js";
import { type IsoDate, parseIsoDate } from "./plain-date.js";

const d = (text: string): IsoDate => {
  const date = parseIsoDate(text);
  if (date === undefined) throw new Error(`bad test date ${text}`);
  return date;
};

type EntryInput = Partial<
  Omit<ParsedEntry, "arrivalDate" | "departureDate">
> & {
  line: number;
  arrivalDate?: string;
  departureDate?: string;
};

const entry = ({
  arrivalDate,
  departureDate,
  ...rest
}: EntryInput): ParsedEntry => ({
  lastName: "Okafor",
  firstName: "Ada",
  roomType: "KING",
  rooms: 1,
  adults: 1,
  children: 0,
  infants: 0,
  ...rest,
  arrivalDate: d(arrivalDate ?? "2026-11-10"),
  departureDate: d(departureDate ?? "2026-11-12"),
});

const list = (...entries: EntryInput[]): RoomingList => ({
  entries: entries.map(entry),
});

describe("diffRoomingLists", () => {
  it("identical lists: everything unchanged", () => {
    const v1 = list(
      { line: 1 },
      { line: 2, lastName: "Tanaka", firstName: "Hiro" },
    );
    const report = diffRoomingLists(v1, v1);
    expect(report.summary).toEqual({
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 2,
      roomNightsBefore: 4,
      roomNightsAfter: 4,
      roomNightsDelta: 0,
    });
  });

  it("step 1: same confirmation number pairs entries even when the name was corrected", () => {
    const report = diffRoomingLists(
      list({
        line: 1,
        lastName: "Jonson",
        firstName: "Erik",
        confirmationNumber: "cnf-7",
      }),
      list({
        line: 9,
        lastName: "Johnson",
        firstName: "Erik",
        confirmationNumber: " CNF-7 ",
      }),
    );
    expect(report.summary).toMatchObject({
      added: 0,
      removed: 0,
      unchanged: 1,
    });
  });

  it("step 1: confirmation beats name — a swapped booking is matched by number", () => {
    // Same name on both sides, but the confirmation numbers say which booking is which.
    const report = diffRoomingLists(
      list(
        {
          line: 1,
          confirmationNumber: "A",
          arrivalDate: "2026-11-10",
          departureDate: "2026-11-12",
        },
        {
          line: 2,
          confirmationNumber: "B",
          arrivalDate: "2026-11-13",
          departureDate: "2026-11-14",
        },
      ),
      list(
        {
          line: 1,
          confirmationNumber: "B",
          arrivalDate: "2026-11-13",
          departureDate: "2026-11-14",
        },
        {
          line: 2,
          confirmationNumber: "A",
          arrivalDate: "2026-11-10",
          departureDate: "2026-11-12",
        },
      ),
    );
    expect(report.summary).toMatchObject({ changed: 0, unchanged: 2 });
  });

  it("step 1: a confirmation number repeated on one side pairs in line order, the rest fall to step 2", () => {
    const report = diffRoomingLists(
      list({ line: 1, confirmationNumber: "X" }),
      list(
        { line: 1, confirmationNumber: "X" },
        { line: 2, confirmationNumber: "X", lastName: "Other" },
      ),
    );
    expect(report.summary).toMatchObject({ unchanged: 1, added: 1 });
    expect(report.added[0]?.lastName).toBe("Other");
  });

  it("step 2: entries without confirmation numbers match by name key, ignoring accents, case and punctuation", () => {
    const report = diffRoomingLists(
      list({ line: 1, lastName: "Müller-Lüdenscheidt", firstName: "José" }),
      list({ line: 4, lastName: "MULLER LUDENSCHEIDT", firstName: "jose" }),
    );
    // "Müller-Lüdenscheidt" → "mullerludenscheidt" but "MULLER LUDENSCHEIDT" → "muller ludenscheidt":
    // the hyphen is removed, the space is kept, so these are different keys.
    expect(report.summary).toMatchObject({ added: 1, removed: 1 });
    const same = diffRoomingLists(
      list({ line: 1, lastName: "Müller", firstName: "José" }),
      list({ line: 4, lastName: "MULLER", firstName: "jose" }),
    );
    expect(same.summary).toMatchObject({ unchanged: 1 });
  });

  it("step 2: two guests with the same name are paired by arrival date, not by file position", () => {
    const report = diffRoomingLists(
      list(
        {
          line: 1,
          lastName: "Smith",
          firstName: "John",
          arrivalDate: "2026-11-10",
          departureDate: "2026-11-11",
        },
        {
          line: 2,
          lastName: "Smith",
          firstName: "John",
          arrivalDate: "2026-11-12",
          departureDate: "2026-11-13",
        },
      ),
      // In the new file the later Smith comes first and his departure moved.
      list(
        {
          line: 1,
          lastName: "Smith",
          firstName: "John",
          arrivalDate: "2026-11-12",
          departureDate: "2026-11-14",
        },
        {
          line: 2,
          lastName: "Smith",
          firstName: "John",
          arrivalDate: "2026-11-10",
          departureDate: "2026-11-11",
        },
      ),
    );
    expect(report.summary).toMatchObject({
      changed: 1,
      unchanged: 1,
      added: 0,
      removed: 0,
    });
    expect(report.changed[0]?.before.line).toBe(2);
    expect(report.changed[0]?.changes).toEqual([
      { field: "departureDate", before: "2026-11-13", after: "2026-11-14" },
    ]);
  });

  it("step 2: three same-name guests before, two after — the latest arrival is removed", () => {
    const report = diffRoomingLists(
      list(
        { line: 1, lastName: "Lee", arrivalDate: "2026-11-10" },
        { line: 2, lastName: "Lee", arrivalDate: "2026-11-11" },
        { line: 3, lastName: "Lee", arrivalDate: "2026-11-09" },
      ),
      list(
        { line: 1, lastName: "Lee", arrivalDate: "2026-11-09" },
        { line: 2, lastName: "Lee", arrivalDate: "2026-11-10" },
      ),
    );
    expect(report.removed.map((e) => e.line)).toEqual([2]);
  });

  it("step 2: a missing arrival date sorts before every date", () => {
    const { arrivalDate: _drop, ...noArrival } = entry({
      line: 2,
      lastName: "Lee",
    });
    const before: RoomingList = {
      entries: [
        entry({ line: 1, lastName: "Lee", arrivalDate: "2026-11-10" }),
        noArrival,
      ],
    };
    const after: RoomingList = { entries: [noArrival] };
    expect(diffRoomingLists(before, after).removed.map((e) => e.line)).toEqual([
      1,
    ]);
  });

  it("step 3: unpaired entries are removed (before) or added (after), sorted by their own line", () => {
    const report = diffRoomingLists(
      list(
        { line: 5, lastName: "Gone" },
        { line: 2, lastName: "Alsogone" },
        { line: 1 },
      ),
      list(
        { line: 1 },
        { line: 9, lastName: "New" },
        { line: 3, lastName: "Newer" },
      ),
    );
    expect(report.removed.map((e) => e.line)).toEqual([2, 5]);
    expect(report.added.map((e) => e.line)).toEqual([3, 9]);
  });

  it("step 4: every compared field is detected, values as strings, absent as null", () => {
    const report = diffRoomingLists(
      list({
        line: 1,
        email: "ada@example.com",
        specialRequests: "Quiet room",
      }),
      list({
        line: 1,
        arrivalDate: "2026-11-09",
        departureDate: "2026-11-13",
        roomType: "QQ",
        rooms: 2,
        adults: 2,
        children: 1,
        infants: 1,
        phone: "555-0100",
        specialRequests: "High floor",
      }),
    );
    expect(report.changed[0]?.changes).toEqual([
      { field: "arrivalDate", before: "2026-11-10", after: "2026-11-09" },
      { field: "departureDate", before: "2026-11-12", after: "2026-11-13" },
      { field: "roomType", before: "KING", after: "QQ" },
      { field: "rooms", before: "1", after: "2" },
      { field: "adults", before: "1", after: "2" },
      { field: "children", before: "0", after: "1" },
      { field: "infants", before: "0", after: "1" },
      { field: "email", before: "ada@example.com", after: null },
      { field: "phone", before: null, after: "555-0100" },
      { field: "specialRequests", before: "Quiet room", after: "High floor" },
    ]);
  });

  it("step 4: fields that are not compared (title, passport, gender, line) never make a change", () => {
    const report = diffRoomingLists(
      list({ line: 1, title: "Dr", passport: "X1", gender: "F" }),
      list({ line: 7, title: "Prof", passport: "Y2", gender: "U" }),
    );
    expect(report.summary).toMatchObject({ changed: 0, unchanged: 1 });
  });

  it("step 4 sharesWith: re-linking a sharer to another primary is a change shown by name", () => {
    const report = diffRoomingLists(
      list(
        { line: 1, lastName: "Okafor", firstName: "Ada" },
        { line: 2, lastName: "Tanaka", firstName: "Hiro" },
        { line: 3, lastName: "Sharer", sharesWithLine: 1 },
      ),
      list(
        { line: 1, lastName: "Okafor", firstName: "Ada" },
        { line: 2, lastName: "Tanaka", firstName: "Hiro" },
        { line: 3, lastName: "Sharer", sharesWithLine: 2 },
      ),
    );
    expect(report.changed).toHaveLength(1);
    expect(report.changed[0]?.changes).toEqual([
      { field: "sharesWith", before: "Okafor, Ada", after: "Tanaka, Hiro" },
    ]);
  });

  it("step 4 sharesWith: renumbering lines without changing who shares with whom is not a change", () => {
    const report = diffRoomingLists(
      list(
        { line: 1, lastName: "Okafor" },
        { line: 2, lastName: "Sharer", sharesWithLine: 1 },
      ),
      list(
        { line: 10, lastName: "Okafor" },
        { line: 11, lastName: "Sharer", sharesWithLine: 10 },
      ),
    );
    expect(report.summary).toMatchObject({ changed: 0, unchanged: 2 });
  });

  it("step 4 sharesWith: starting or stopping sharing shows null on the side with no primary", () => {
    const report = diffRoomingLists(
      list(
        { line: 1, lastName: "Okafor", firstName: undefined },
        { line: 2, lastName: "Sharer" },
      ),
      list(
        { line: 1, lastName: "Okafor", firstName: undefined },
        { line: 2, lastName: "Sharer", sharesWithLine: 1 },
      ),
    );
    expect(report.changed[0]?.changes).toEqual([
      { field: "sharesWith", before: null, after: "Okafor" },
    ]);
  });

  it("step 4 sharesWith: a pointer to a missing line is reported, not crashed on", () => {
    const report = diffRoomingLists(
      list({ line: 1, sharesWithLine: 9 }),
      list({ line: 1 }),
    );
    expect(report.changed[0]?.changes[0]).toEqual({
      field: "sharesWith",
      before: "line 9 (not in the list)",
      after: null,
    });
  });

  it("changed is sorted by the after line; room-night delta uses non-sharers only", () => {
    const report = diffRoomingLists(
      list(
        { line: 1, lastName: "A", roomType: "QQ" },
        { line: 2, lastName: "B", roomType: "QQ" },
      ),
      list(
        { line: 8, lastName: "A" },
        { line: 3, lastName: "B" },
        {
          line: 4,
          lastName: "C",
          sharesWithLine: 3,
          departureDate: "2026-11-14",
        },
      ),
    );
    expect(report.changed.map((pair) => pair.after.line)).toEqual([3, 8]);
    expect(report.summary).toMatchObject({
      roomNightsBefore: 4,
      roomNightsAfter: 4,
      roomNightsDelta: 0,
      added: 1,
    });
  });
});

describe("diffRoomingLists step 1 fall-through", () => {
  it("step 1: a confirmation number on one side only, or different numbers, falls through to name matching", () => {
    const oneSided = diffRoomingLists(
      list({ line: 1, confirmationNumber: "A1" }),
      list({ line: 1 }),
    );
    expect(oneSided.summary).toMatchObject({
      unchanged: 1,
      added: 0,
      removed: 0,
    });
    const different = diffRoomingLists(
      list({ line: 1, confirmationNumber: "A1" }),
      list({ line: 1, confirmationNumber: "B2" }),
    );
    expect(different.summary).toMatchObject({
      unchanged: 1,
      added: 0,
      removed: 0,
    });
  });

  it("step 2: an entry with no arrival date sorts first and takes the first pairing", () => {
    const { arrivalDate: _drop, ...noArrival } = entry({
      line: 1,
      lastName: "Lee",
    });
    const before: RoomingList = {
      entries: [
        noArrival,
        entry({ line: 2, lastName: "Lee", arrivalDate: "2026-11-10" }),
      ],
    };
    const after: RoomingList = {
      entries: [entry({ line: 5, lastName: "Lee", arrivalDate: "2026-11-10" })],
    };
    // The undated "Lee" sorts first, so it takes the first (only) pairing; line 2 is left over.
    const report = diffRoomingLists(before, after);
    expect(report.removed.map((e) => e.line)).toEqual([2]);
  });
});
