import { z } from "zod";
import { canonicalCsv } from "./canonical-csv.js";
import { canonicalJson } from "./canonical-json.js";
import { maestroCsv } from "./maestro-csv.js";
import { operaCloudXlsx } from "./opera-cloud-xlsx.js";
import { opera5Xml } from "./opera5-xml.js";
import {
  type Provenance,
  TARGET_IDS,
  type Target,
  type TargetId,
  UnknownTargetError,
} from "./types.js";

const noOptions = z.strictObject({});

// Our own formats have no vendor document to check against, so no provenance entries.
const canonicalJsonTarget: Target = {
  id: "canonical-json",
  label: "Canonical JSON",
  fileExtension: "json",
  fileName: "rooming-list.json",
  contentType: "application/json",
  optionsSchema: noOptions,
  provenance: [],
  preconditions: () => [],
  async build(input) {
    return {
      bytes: new TextEncoder().encode(canonicalJson(input)),
      issues: [],
    };
  },
};

const canonicalCsvTarget: Target = {
  id: "canonical-csv",
  label: "Canonical CSV",
  fileExtension: "csv",
  fileName: "rooming-list.csv",
  contentType: "text/csv; charset=utf-8",
  optionsSchema: noOptions,
  provenance: [],
  preconditions: () => [],
  async build(input) {
    return { bytes: new TextEncoder().encode(canonicalCsv(input)), issues: [] };
  },
};

const TARGETS: Record<TargetId, Target> = {
  "opera5-xml": opera5Xml,
  "opera-cloud-xlsx": operaCloudXlsx,
  "maestro-csv": maestroCsv,
  "canonical-json": canonicalJsonTarget,
  "canonical-csv": canonicalCsvTarget,
};

export function isTargetId(id: string): id is TargetId {
  return (TARGET_IDS as readonly string[]).includes(id);
}

/** The target for an id, or UnknownTargetError (the API turns that into a 422). */
export function getTarget(id: string): Target {
  if (!isTargetId(id)) throw new UnknownTargetError(id);
  return TARGETS[id];
}

export type TargetInfo = {
  id: TargetId;
  label: string;
  fileExtension: string;
  contentType: string;
  /** JSON Schema of the target's options, for forms and API docs. */
  optionsSchema: Record<string, unknown>;
  provenance: Provenance[];
};

/** What /v1/formats and the web page show: every target and what is verified about it. */
export function listTargets(): TargetInfo[] {
  return TARGET_IDS.map((id) => {
    const target = TARGETS[id];
    return {
      id,
      label: target.label,
      fileExtension: target.fileExtension,
      contentType: target.contentType,
      optionsSchema: z.toJSONSchema(target.optionsSchema, { io: "input" }),
      provenance: target.provenance,
    };
  });
}
