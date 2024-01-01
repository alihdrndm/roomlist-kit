import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

describe("health endpoints (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /healthz returns {status: ok}", async () => {
    const res = await request(app.getHttpServer()).get("/healthz").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200 (no backing services)", async () => {
    await request(app.getHttpServer()).get("/readyz").expect(200);
  });
});
