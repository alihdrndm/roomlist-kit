// Generates the synthetic fixtures in fixtures/input. Deterministic: seeded faker, no clock, no Math.random.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { faker } from "@faker-js/faker";
import ExcelJS from "exceljs";

type RoomType = "KING" | "QQ";

interface Entry {
  line: number;
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  arrival: string;
  departure: string;
  roomType: RoomType;
  rooms: number;
  adults: number;
  children: number;
  sharesWith: number | undefined;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const inputDir = join(root, "fixtures", "input");
const FIXED_DATE = new Date("2026-01-01T00:00:00Z");
const ENTRY_COUNT = 40;
// 1-based Line numbers of the primaries; the sharer is the next line.
const PRIMARY_LINES = new Set([3, 9, 15, 22, 28, 35]);
const ROOM_TYPES: RoomType[] = ["KING", "QQ"];

faker.seed(42);

const isoDay = (day: number): string =>
  `2026-11-${String(day).padStart(2, "0")}`;
const dmyDay = (day: number): string =>
  `${String(day).padStart(2, "0")}/11/2026`;
const lettersOnly = (text: string): string =>
  text.toLowerCase().replace(/[^a-z]/g, "");
const hasForbiddenChar = (text: string): boolean => /[,;"]/.test(text);

const usedNames = new Set<string>();
function drawName(): { lastName: string; firstName: string } {
  for (;;) {
    const lastName = faker.person.lastName();
    const firstName = faker.person.firstName();
    if (hasForbiddenChar(lastName) || hasForbiddenChar(firstName)) continue;
    if (lettersOnly(lastName) === "" || lettersOnly(firstName) === "") continue;
    const key = `${lastName.toLowerCase()}|${firstName.toLowerCase()}`;
    if (usedNames.has(key)) continue;
    usedNames.add(key);
    return { lastName, firstName };
  }
}

function buildEntries(): Entry[] {
  const entries: Entry[] = [];
  for (let line = 1; line <= ENTRY_COUNT; line++) {
    const previous = entries[entries.length - 1];
    const { lastName, firstName } = drawName();
    const isPrimary = PRIMARY_LINES.has(line);
    const phone = `555-01${String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0")}`;
    const email = `${lettersOnly(firstName)}.${lettersOnly(lastName)}@example.com`;
    // A few deterministic gaps so empty-cell handling is exercised.
    const entryPhone = line % 7 === 0 ? "" : phone;
    const entryEmail = line % 11 === 0 ? "" : email;

    if (previous !== undefined && PRIMARY_LINES.has(previous.line)) {
      entries.push({
        line,
        lastName,
        firstName,
        email: entryEmail,
        phone: entryPhone,
        arrival: previous.arrival,
        departure: previous.departure,
        roomType: previous.roomType,
        rooms: 1,
        adults: 1,
        children: 0,
        sharesWith: previous.line,
      });
      continue;
    }

    const arrivalDay = faker.number.int({ min: 10, max: 13 });
    const departureDay = faker.number.int({ min: arrivalDay + 1, max: 14 });
    const roomType = faker.helpers.arrayElement(ROOM_TYPES);
    let adults = 1;
    let children = 0;
    if (!isPrimary) {
      const maxPeople = roomType === "KING" ? 3 : 4;
      adults = faker.number.int({ min: 1, max: 2 });
      children = faker.number.int({ min: 0, max: 1 });
      if (adults + children > maxPeople) children = 0;
    }
    entries.push({
      line,
      lastName,
      firstName,
      email: entryEmail,
      phone: entryPhone,
      arrival: isoDay(arrivalDay),
      departure: isoDay(departureDay),
      roomType,
      rooms: 1,
      adults,
      children,
      sharesWith: undefined,
    });
  }
  return entries;
}

function write(name: string, content: string | Uint8Array): void {
  writeFileSync(join(inputDir, name), content);
}

const cleanHeader = [
  "Line",
  "Last Name",
  "First Name",
  "Email",
  "Phone",
  "Arrival",
  "Departure",
  "Room Type",
  "Rooms",
  "Adults",
  "Children",
  "Shares With",
];

function buildCleanCsv(entries: Entry[]): string {
  const rows = entries.map((e) =>
    [
      e.line,
      e.lastName,
      e.firstName,
      e.email,
      e.phone,
      e.arrival,
      e.departure,
      e.roomType,
      e.rooms,
      e.adults,
      e.children,
      e.sharesWith ?? "",
    ].join(","),
  );
  return `${[cleanHeader.join(","), ...rows].join("\n")}\n`;
}

async function buildCleanXlsx(entries: Entry[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = FIXED_DATE;
  workbook.modified = FIXED_DATE;
  workbook.lastPrinted = FIXED_DATE;
  const sheet = workbook.addWorksheet("Rooming List");
  sheet.addRow(cleanHeader);
  for (const e of entries) {
    const row = sheet.addRow([
      e.line,
      e.lastName,
      e.firstName,
      e.email === "" ? null : e.email,
      e.phone === "" ? null : e.phone,
      new Date(`${e.arrival}T00:00:00Z`),
      new Date(`${e.departure}T00:00:00Z`),
      e.roomType,
      e.rooms,
      e.adults,
      e.children,
      e.sharesWith ?? null,
    ]);
    row.getCell(6).numFmt = "yyyy-mm-dd";
    row.getCell(7).numFmt = "yyyy-mm-dd";
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

function buildMessyCsv(entries: Entry[]): string {
  const lines: string[] = [
    // Padded to 9 cells the way Excel exports a merged title row.
    "TECH26 rooming list (synthetic);;;;;;;;",
    "",
    "Guest Name;Check-In;Check Out;Room;# Adults;Kids;Roommate Line;E-mail;VIP Code",
  ];
  entries.forEach((e, index) => {
    lines.push(
      [
        `${e.lastName}, ${e.firstName}`,
        e.arrival,
        e.departure,
        e.roomType,
        e.adults,
        e.children,
        e.sharesWith ?? "",
        e.email,
        index % 5 === 0 ? `V${index / 5 + 1}` : "",
      ].join(";"),
    );
    if (e.line === 20) lines.push("");
  });
  return `﻿${lines.join("\n")}\n`;
}

function buildDmyCsv(): string {
  const rows: string[] = [
    "Line,Last Name,First Name,Arrival,Departure,Room Type",
  ];
  for (let line = 1; line <= 10; line++) {
    const { lastName, firstName } = drawName();
    let arrivalDay: number;
    let departureDay: number;
    if (line <= 4) {
      arrivalDay = faker.number.int({ min: 10, max: 11 });
      departureDay = 12;
    } else if (line <= 8) {
      arrivalDay = faker.number.int({ min: 10, max: 11 });
      departureDay = faker.number.int({ min: 13, max: 14 });
    } else {
      arrivalDay = 13;
      departureDay = 14;
    }
    const roomType = faker.helpers.arrayElement(ROOM_TYPES);
    rows.push(
      [
        line,
        lastName,
        firstName,
        dmyDay(arrivalDay),
        dmyDay(departureDay),
        roomType,
      ].join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}

mkdirSync(inputDir, { recursive: true });
const entries = buildEntries();
write("clean-40.csv", buildCleanCsv(entries));
write("clean-40.xlsx", await buildCleanXlsx(entries));
write("messy-headers.csv", buildMessyCsv(entries));
write("dmy-dates.csv", buildDmyCsv());

const pairs = entries
  .filter((e) => e.sharesWith !== undefined)
  .map((e) => `${e.sharesWith}->${e.line}`)
  .join(", ");
console.log(`fixtures written; sharer pairs (primary->sharer): ${pairs}`);
