// Pure helpers behind the forms: no React, no fetch, so they are easy to test.

/** The "Block details" form, as typed text, plus what a loaded sample carried that the form does not show. */
export type BlockForm = {
  propertyCode: string;
  blockCode: string;
  groupReservationNumber: string;
  startDate: string;
  endDate: string;
  shoulderDays: string;
  /** Comma-separated room type codes. */
  roomTypes: string;
  /** Not a form field; kept from a loaded block file so its checks still apply. */
  maxOccupancy?: Record<string, number>;
};

export const EMPTY_BLOCK: BlockForm = {
  propertyCode: "",
  blockCode: "",
  groupReservationNumber: "",
  startDate: "",
  endDate: "",
  shoulderDays: "",
  roomTypes: "",
};

/**
 * The block to send to the API, or undefined when nothing was filled in. Blank
 * fields are left out entirely (the API rejects "" for most of them). A shoulder
 * days value that is not a whole number is sent as typed so the API can say why.
 */
export function buildBlock(
  form: BlockForm,
): Record<string, unknown> | undefined {
  const block: Record<string, unknown> = {};
  for (const key of [
    "propertyCode",
    "blockCode",
    "groupReservationNumber",
    "startDate",
    "endDate",
  ] as const) {
    const value = form[key].trim();
    if (value !== "") block[key] = value;
  }
  const shoulder = form.shoulderDays.trim();
  if (shoulder !== "")
    block.shoulderDays = /^\d+$/.test(shoulder) ? Number(shoulder) : shoulder;
  const roomTypes = form.roomTypes
    .split(",")
    .map((type) => type.trim())
    .filter((type) => type !== "");
  if (roomTypes.length > 0) block.roomTypes = roomTypes;
  if (form.maxOccupancy !== undefined && Object.keys(block).length > 0)
    block.maxOccupancy = form.maxOccupancy;
  return Object.keys(block).length === 0 ? undefined : block;
}

/** Fills the form from a block JSON file (the "Load sample" button uses tech26.json). */
export function blockFormFrom(json: unknown): BlockForm {
  const source =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>)
      : {};
  const text = (value: unknown) =>
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const form: BlockForm = {
    propertyCode: text(source.propertyCode),
    blockCode: text(source.blockCode),
    groupReservationNumber: text(source.groupReservationNumber),
    startDate: text(source.startDate),
    endDate: text(source.endDate),
    shoulderDays: text(source.shoulderDays),
    roomTypes: Array.isArray(source.roomTypes)
      ? source.roomTypes.filter((type) => typeof type === "string").join(", ")
      : "",
  };
  if (typeof source.maxOccupancy === "object" && source.maxOccupancy !== null) {
    form.maxOccupancy = source.maxOccupancy as Record<string, number>;
  }
  return form;
}

/** One input for a target option, read from the option's JSON Schema. */
export type OptionField =
  | {
      name: string;
      kind: "select";
      choices: string[];
      defaultValue: string;
      required: boolean;
    }
  | { name: string; kind: "checkbox"; defaultValue: boolean; required: boolean }
  | { name: string; kind: "text"; defaultValue: string; required: boolean };

/**
 * The inputs for a target's options, read from the JSON Schema that /v1/formats
 * publishes: a list of choices becomes a select, a boolean a checkbox, anything
 * else a text box. The UI therefore never hard-codes option names.
 */
export function optionFields(schema: Record<string, unknown>): OptionField[] {
  const properties = schema.properties;
  if (typeof properties !== "object" || properties === null) return [];
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((name) => typeof name === "string")
      : [],
  );
  return Object.entries(
    properties as Record<string, Record<string, unknown>>,
  ).map(([name, property]): OptionField => {
    const isRequired = required.has(name) && property.default === undefined;
    if (Array.isArray(property.enum)) {
      const choices = property.enum.filter(
        (choice): choice is string => typeof choice === "string",
      );
      const fallback = choices[0] ?? "";
      return {
        name,
        kind: "select",
        choices,
        defaultValue:
          typeof property.default === "string" ? property.default : fallback,
        required: isRequired,
      };
    }
    if (property.type === "boolean") {
      return {
        name,
        kind: "checkbox",
        defaultValue: property.default === true,
        required: isRequired,
      };
    }
    return {
      name,
      kind: "text",
      defaultValue:
        typeof property.default === "string" ? property.default : "",
      required: isRequired,
    };
  });
}

/** The targetOptions JSON from the values typed in: empty text boxes are left out. */
export function buildTargetOptions(
  fields: OptionField[],
  values: Record<string, string | boolean>,
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name] ?? field.defaultValue;
    if (field.kind === "checkbox") options[field.name] = value === true;
    else if (typeof value === "string" && value.trim() !== "")
      options[field.name] = value.trim();
  }
  return options;
}

/** "Earlier list" sizes: 812 B, 14.2 KB, 3.1 MB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "+4", "-2", "0": a change always shows its sign. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** The file name from a Content-Disposition header, or a fallback. */
export function fileNameFrom(
  contentDisposition: string | null,
  fallback: string,
): string {
  const match = contentDisposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

/** Largest file the pages accept, the same as the API (5 MB). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
