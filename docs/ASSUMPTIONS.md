# Assumptions: what was not verified against a real system

Every item here was inferred from public documentation, not checked against a running hotel system. The IDs match `HANDOFF.md` and the `provenance` list returned by `GET /v1/formats` (and shown on the web page `/formats`). Each item says how to check it and what to change if it is wrong.

What **was** verified from vendor documentation is listed per target in the same provenance list, with a link to the page.

## Oracle OPERA 5 (`opera5-xml`)

### A1: XML envelope
- **Assumed:** the file starts with `<?xml version="1.0" encoding="UTF-8"?>`, the root element is `RoomingListImport`, each guest is a `Reservation` element, each field is a child element, and indentation is 2 spaces.
- **Why unverified:** Oracle's template (`RoomingListImport.1.0.xml`) ships only on OPERA application servers and is not public. The help page confirms the field names and that the import accepts only XML.
- **How to check:** compare the output with your property's template file.
- **If wrong:** set the `rootElement` and `recordElement` options. Anything else (extra wrapper elements, attributes, a namespace) needs a code change in `packages/core/src/export/opera5-xml.ts`.

### A2: date of birth format
- **Assumed:** `date_of_Birth` is written as `MM/DD/YYYY`, like arrival and departure.
- **Why unverified:** the help page states the format only for arrival and departure.
- **How to check:** import a file with one guest that has a date of birth.
- **If wrong:** change the one line that writes `date_of_Birth` in `opera5-xml.ts`.

### A3: sharer room count
- **Assumed:** a sharer is written with `numberRooms` = 1.
- **Why unverified:** OPERA requires a minimum of 1 room; the help page does not say what a sharer should carry.
- **How to check:** import a file with one sharer pair and look at the room count of the resulting reservations.
- **If wrong:** change the `numberRooms` line in `opera5-xml.ts`.

## Oracle OPERA Cloud (`opera-cloud-xlsx`)

### A4: heading labels
- **Assumed:** the exact headings `Line`, `Sharer`, `Last Name`, `First Name`, `Title`, `Arrival`, `Departure`, `Room Type`, `Rooms`, `Adults`, `Children`, `Email`, `Email Type`, `Phone`, `Nationality`, `Language`, `Date of Birth`, `Notes`.
- **Why unverified:** the user guide names some columns but not every heading. OPERA Cloud lets the user map any heading to a field by hand, so a wrong label slows the import but does not break it.
- **How to check:** start a Room List Import with the file and see which columns OPERA Cloud maps by itself.
- **If wrong:** edit `OPERA_CLOUD_HEADINGS` in `opera-cloud-xlsx.ts`.

### A5: dates as text
- **Assumed:** dates are written as text cells in `MM/DD/YYYY`.
- **Why unverified:** the guide does not state a date format or cell type.
- **How to check:** import a file and look at the arrival dates of the new reservations.
- **If wrong:** use the `dateFormat` option (`MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`, `DD-MM-YYYY`).

### A6: email type code
- **Assumed:** the code `EMAIL` is a valid email type.
- **Why unverified:** email type codes are configured per property.
- **How to check:** look up the email types in your property's OPERA Cloud configuration.
- **If wrong:** use the `emailType` option.

## Maestro PMS (`maestro-csv`)

### A7: column order and header row
- **Assumed:** the columns are in the order the Quick Reference Guide lists the fields (Suffix No., Group Res., First Name, Last Name, Sharer_Suffix, Building/Room Type, Arrival Date, Departure Date, #Adults, #Children, #Infants, Gender), and the file has no header row by default.
- **Why unverified:** the guide lists the fields but does not show a sample file.
- **How to check:** import a two-row file into a test group.
- **If wrong:** try the `includeHeader` option; a different column order needs a code change in `maestro-csv.ts`.

### A8: gender code `c`
- **Assumed:** gender code `c` (mixed) is never written; anything other than M or F is written as `u`.
- **Why unverified:** the guide lists `c` for mixed groups; a single guest in a rooming list has no mixed gender, so it cannot arise here.
- **How to check:** not needed unless a list row can describe more than one person.
- **If wrong:** change `genderCode` in `maestro-csv.ts`.
