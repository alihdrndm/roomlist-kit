import type { CanonicalField } from "../model.js";

// The spec's alias table: normalised header text (lower case, a–z and 0–9 only)
// for each canonical field. Each canonical name is accepted as written too (see
// headers.ts). It lives in its own module with no runtime imports so the web app
// can show it (the /guide page) without bundling the parser.
export const HEADER_ALIASES: Readonly<
  Record<CanonicalField, readonly string[]>
> = {
  line: [
    "line",
    "lineno",
    "linenumber",
    "no",
    "number",
    "record",
    "recordnumber",
    "suffix",
    "suffixno",
    "rowid",
  ],
  lastName: ["lastname", "last", "surname", "familyname", "guestlastname"],
  firstName: ["firstname", "first", "givenname", "forename", "guestfirstname"],
  fullName: ["name", "fullname", "guestname", "guest"],
  title: ["title", "salutation", "prefix", "guesttitle"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "mobile", "cell", "telephone", "tel"],
  arrivalDate: [
    "arrival",
    "arrivaldate",
    "checkin",
    "checkindate",
    "arrive",
    "datein",
  ],
  departureDate: [
    "departure",
    "departuredate",
    "checkout",
    "checkoutdate",
    "depart",
    "dateout",
  ],
  roomType: [
    "roomtype",
    "room",
    "roomcategory",
    "roomcode",
    "buildingroomtype",
  ],
  rooms: ["rooms", "numberofrooms", "numberrooms", "noofrooms", "roomcount"],
  adults: ["adults", "adult", "numberadults", "numberofadults"],
  children: ["children", "child", "numberchildren", "numberofchildren", "kids"],
  infants: ["infants", "infant", "numberofinfants"],
  sharesWithLine: [
    "shareswith",
    "sharewith",
    "sharer",
    "shareline",
    "sharerecordnumber",
    "sharersuffix",
  ],
  confirmationNumber: [
    "confirmation",
    "confirmationnumber",
    "confirmationno",
    "conf",
    "confno",
    "bookingreference",
    "reservationnumber",
  ],
  gender: ["gender", "sex"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate"],
  nationality: ["nationality", "nationalitycode"],
  language: ["language", "languagecode"],
  passport: ["passport", "passportnumber", "passportno"],
  specialRequests: [
    "specialrequests",
    "requests",
    "notes",
    "comments",
    "remarks",
  ],
  travelAgentLocator: ["tarecordlocator", "recordlocator", "talocator"],
};
