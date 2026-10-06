import { Writable } from "node:stream";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { defaultConfig } from "../src/config.js";
import { ProblemFilter } from "../src/problem.filter.js";
// A value import: Nest needs the class itself as the provider token to override.
import { RoomingListsService } from "../src/rooming-lists.service.js";
import { fixtureBytes } from "./helpers.js";

// One app in this file, so its log capture works (see the note on startApp).
describe("unexpected errors (e2e)", () => {
  let app: INestApplication;
  let raw = "";

  beforeAll(async () => {
    const logStream = new Writable({
      write(chunk, _encoding, done) {
        raw += String(chunk);
        done();
      },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppModule.register(defaultConfig({ NODE_ENV: "test" }), { logStream }),
      ],
    })
      .overrideProvider(RoomingListsService)
      .useValue({
        validate: () => {
          throw new Error("secret internal detail: password=hunter2");
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    // createApp does this; the testing module does not go through createApp.
    app.useGlobalFilters(app.get(ProblemFilter));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("INTERNAL: a thrown Error becomes a generic 500 with no leakage", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/rooming-lists/validate")
      .attach("file", fixtureBytes("input/we1.csv"), "we1.csv");
    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL");
    expect(res.body.detail).toBe(
      "Something went wrong on our side. Quote the request id when reporting it.",
    );
    expect(typeof res.body.instance).toBe("string");
    expect(res.body.instance.length).toBeGreaterThan(0);
    expect(res.text).not.toContain("hunter2");
    expect(res.text).not.toContain("secret internal detail");
    expect(res.text).not.toContain("stack");
  });

  it("INTERNAL: the server log names the error and where it happened, but never repeats its message", () => {
    // The message of a library error can hold cell text, which logs must never contain.
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("secret internal detail");
    const line = raw
      .split("\n")
      .filter((text) => text.includes("Unhandled error"))
      .map(
        (text) =>
          JSON.parse(text) as {
            level: number;
            errorName: string;
            requestId: string;
            at: string[];
          },
      )[0];
    expect(line).toBeDefined();
    expect(line?.level).toBe(50);
    expect(line?.errorName).toBe("Error");
    expect(line?.requestId.length).toBeGreaterThan(0);
    expect(line?.at.length).toBeGreaterThan(0);
    expect(line?.at.every((frame) => frame.startsWith("at "))).toBe(true);
  });
});
