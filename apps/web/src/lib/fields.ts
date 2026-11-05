import type { BlockContext, CanonicalField } from "@alihdrndm/roomlist-core";

// Planner-facing names for the data fields the API reports in camelCase. Typed as a
// Record over core's field union, so a field added in core fails the web typecheck
// until it has a label here.

export const CANONICAL_FIELD_LABELS: Record<CanonicalField, string> = {
  line: "Line",
  lastName: "Last name",
  firstName: "First name",
  fullName: "Full name (split for you)",
  title: "Title",
  email: "Email",
  phone: "Phone",
  arrivalDate: "Arrival",
  departureDate: "Departure",
  roomType: "Room type",
  rooms: "Rooms",
  adults: "Adults",
  children: "Children",
  infants: "Infants",
  sharesWithLine: "Shares with (line)",
  confirmationNumber: "Confirmation number",
  gender: "Gender",
  dateOfBirth: "Date of birth",
  nationality: "Nationality",
  language: "Language",
  passport: "Passport",
  specialRequests: "Special requests",
  travelAgentLocator: "Travel agent locator",
};

/** Canonical fields in the order a planner thinks of them (the mapping select lists them so). */
export const CANONICAL_FIELDS = Object.keys(
  CANONICAL_FIELD_LABELS,
) as CanonicalField[];

export const BLOCK_FIELD_LABELS: Record<keyof BlockContext, string> = {
  propertyCode: "Property code",
  blockCode: "Block code",
  groupReservationNumber: "Group reservation number",
  startDate: "Start date",
  endDate: "End date",
  shoulderDays: "Shoulder days",
  roomTypes: "Room types",
  maxOccupancy: "Max guests per room",
};

/** Other names that appear in issues and diffs. */
const OTHER_LABELS: Record<string, string> = {
  sharesWith: "Shares with",
  buildingCode: "Building code",
  entry: "Entry",
};

/** "departureDate" → "Departure"; unknown names are turned from camelCase into words. */
export function fieldLabel(name: string): string {
  if (Object.hasOwn(CANONICAL_FIELD_LABELS, name))
    return CANONICAL_FIELD_LABELS[name as CanonicalField];
  if (Object.hasOwn(BLOCK_FIELD_LABELS, name))
    return BLOCK_FIELD_LABELS[name as keyof BlockContext];
  const other = OTHER_LABELS[name];
  if (other !== undefined) return other;
  return labelFor(name);
}

/** "buildingCode" → "Building code". Used for export option names, which come from each target's JSON Schema. */
export function labelFor(name: string): string {
  const words = name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
