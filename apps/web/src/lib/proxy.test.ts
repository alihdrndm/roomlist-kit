import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forwardUpload, getFromApi, maxRequestBytes } from "@/lib/proxy";

vi.mock("@/env", () => ({
  env: { API_BASE_URL: "http://api.test", API_KEY: "k" },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function upload(headers: Record<string, string>, body = "x"): Request {
  return new Request("http://web.test/api/validate", {
    method: "POST",
    headers,
    body,
  });
}

describe("forwardUpload", () => {
  it("VALIDATION_FAILED (422): rejects a request without content-length, with an errors entry", async () => {
    const response = await forwardUpload(
      upload({}),
      "/v1/rooming-lists/validate",
    );
    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      code: string;
      errors: { path: string }[];
    };
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors.map((error) => error.path)).toEqual(["content-length"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("FILE_TOO_LARGE (413): rejects an upload over the limit without reading it", async () => {
    const size = String(maxRequestBytes(1) + 1);
    const response = await forwardUpload(
      upload({ "content-length": size }),
      "/v1/rooming-lists/validate",
      1,
    );
    expect(response.status).toBe(413);
    expect(((await response.json()) as { code: string }).code).toBe(
      "FILE_TOO_LARGE",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows for a diff a size a single file would not get", async () => {
    const size = String(maxRequestBytes(1) + 1);
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const response = await forwardUpload(
      upload({ "content-length": size }),
      "/v1/rooming-lists/diff",
      2,
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("forwards with the API key and passes only allow-listed headers back", async () => {
    fetchMock.mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-disposition": 'attachment; filename="a.csv"',
          "retry-after": "30",
          "set-cookie": "a=b",
          server: "nginx",
        },
      }),
    );
    const response = await forwardUpload(
      upload({
        "content-length": "1",
        "content-type": "multipart/form-data; boundary=z",
        "x-forwarded-for": "1.2.3.4",
      }),
      "/v1/rooming-lists/validate",
    );

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("http://api.test/v1/rooming-lists/validate");
    expect(init.method).toBe("POST");
    const sent = new Headers(init.headers);
    expect(sent.get("x-api-key")).toBe("k");
    expect(sent.get("content-type")).toBe("multipart/form-data; boundary=z");
    expect(sent.get("x-forwarded-for")).toBe("1.2.3.4");

    expect(response.headers.get("content-type")).toBe("text/csv");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="a.csv"',
    );
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("server")).toBeNull();
  });

  it("API_UNAVAILABLE (502): answers when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const response = await forwardUpload(
      upload({ "content-length": "1" }),
      "/v1/rooming-lists/validate",
    );
    expect(response.status).toBe(502);
    expect(((await response.json()) as { code: string }).code).toBe(
      "API_UNAVAILABLE",
    );
  });
});

describe("getFromApi", () => {
  it("works without a request", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"targets":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await getFromApi("/v1/formats");
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("http://api.test/v1/formats");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("x-api-key")).toBe("k");
  });
});
