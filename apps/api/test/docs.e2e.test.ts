import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startApp, type TestApp } from "./helpers.js";

type Operation = {
  responses: Record<
    string,
    { content?: Record<string, unknown>; headers?: Record<string, unknown> }
  >;
  requestBody?: {
    content: Record<
      string,
      { schema: { required?: string[]; properties: Record<string, unknown> } }
    >;
  };
  security?: unknown[];
};
type Doc = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
};

const EXPECTED_PATHS = [
  "/healthz",
  "/readyz",
  "/v1/rooming-lists/validate",
  "/v1/rooming-lists/convert",
  "/v1/rooming-lists/diff",
  "/v1/formats",
];

const EXPECTED_STATUSES: Record<string, string[]> = {
  "/v1/rooming-lists/validate": [
    "200",
    "400",
    "401",
    "413",
    "422",
    "429",
    "500",
  ],
  "/v1/rooming-lists/convert": [
    "200",
    "400",
    "401",
    "413",
    "422",
    "429",
    "500",
  ],
  "/v1/rooming-lists/diff": ["200", "400", "401", "413", "422", "429", "500"],
  "/v1/formats": ["200", "401", "429", "500"],
};

describe("docs: OpenAPI document and Swagger UI (e2e)", () => {
  let api: TestApp;
  let doc: Doc;

  beforeAll(async () => {
    api = await startApp();
    const res = await request(api.app.getHttpServer())
      .get("/docs-json")
      .expect(200);
    doc = res.body as Doc;
  });

  afterAll(async () => {
    await api.close();
  });

  const operation = (path: string): Operation => {
    const found = Object.values(doc.paths[path] ?? {})[0];
    if (found === undefined) throw new Error(`no operation for ${path}`);
    return found;
  };

  it("docs: /docs-json lists exactly the six paths", () => {
    expect(Object.keys(doc.paths).sort()).toEqual([...EXPECTED_PATHS].sort());
  });

  it("docs: every endpoint documents every status it can return", () => {
    for (const [path, statuses] of Object.entries(EXPECTED_STATUSES)) {
      expect(Object.keys(operation(path).responses).sort(), path).toEqual(
        [...statuses].sort(),
      );
    }
    expect(Object.keys(operation("/healthz").responses)).toEqual(["200"]);
    expect(Object.keys(operation("/readyz").responses)).toEqual(["200"]);
  });

  it("docs: every non-2xx response is application/problem+json", () => {
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const op of Object.values(item)) {
        for (const [status, response] of Object.entries(op.responses)) {
          if (status.startsWith("2")) continue;
          expect(
            Object.keys(response.content ?? {}),
            `${path} ${status}`,
          ).toContain("application/problem+json");
        }
      }
    }
  });

  it("docs: v1 endpoints need the API key, health endpoints do not", () => {
    for (const path of Object.keys(EXPECTED_STATUSES)) {
      expect(operation(path).security, path).toEqual([{ "x-api-key": [] }]);
    }
    expect(operation("/healthz").security).toBeUndefined();
    expect(operation("/readyz").security).toBeUndefined();
  });

  it("docs: multipart request bodies list the right parts", () => {
    const parts = (path: string) => {
      const schema =
        operation(path).requestBody?.content["multipart/form-data"]?.schema;
      return {
        names: Object.keys(schema?.properties ?? {}).sort(),
        required: [...(schema?.required ?? [])].sort(),
      };
    };
    expect(parts("/v1/rooming-lists/validate")).toEqual({
      names: ["block", "file", "options"],
      required: ["file"],
    });
    expect(parts("/v1/rooming-lists/convert")).toEqual({
      names: ["block", "file", "options", "target", "targetOptions"],
      required: ["file", "target"],
    });
    expect(parts("/v1/rooming-lists/diff")).toEqual({
      names: ["after", "before", "options"],
      required: ["after", "before"],
    });
  });

  it("docs: convert documents its headers and file content types", () => {
    const ok = operation("/v1/rooming-lists/convert").responses["200"];
    expect(Object.keys(ok?.headers ?? {}).sort()).toEqual([
      "Content-Disposition",
      "x-roomlist-warnings",
    ]);
    expect(Object.keys(ok?.content ?? {})).toContain("application/xml");
  });

  it("docs: BlockContext, ParseOptions and Problem are components", () => {
    for (const name of [
      "BlockContext",
      "ParseOptions",
      "Problem",
      "ValidateReport",
      "DiffReport",
      "TargetsResponse",
    ]) {
      expect(doc.components.schemas[name], name).toBeDefined();
    }
  });

  it("docs: no schema mentions zod", () => {
    expect(JSON.stringify(doc.components.schemas).toLowerCase()).not.toContain(
      "zod",
    );
    expect(JSON.stringify(doc.paths).toLowerCase()).not.toContain("zod");
  });

  it("docs: /docs serves Swagger UI HTML and its assets", async () => {
    const res = await request(api.app.getHttpServer()).get("/docs").expect(200);
    expect(res.headers["content-type"]).toContain("text/html");
    const html = res.text;
    const assets = [
      ...html.matchAll(/(?:src|href)="([^"]*swagger-ui[^"]*)"/g),
    ].map((match) => match[1] ?? "");
    expect(assets.length).toBeGreaterThan(0);
    const first = assets[0] ?? "";
    await request(api.app.getHttpServer())
      .get(new URL(first, "http://localhost/docs").pathname)
      .expect(200);
  });

  it("docs: Swagger UI page has no inline script that the helmet CSP would block", async () => {
    const res = await request(api.app.getHttpServer()).get("/docs").expect(200);
    const inline = [
      ...res.text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
    ]
      .map((match) => (match[1] ?? "").trim())
      .filter((body) => body !== "");
    // Reported (not asserted away): see the milestone report if this is non-empty.
    expect(inline).toEqual([]);
  });
});
