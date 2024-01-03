import type request from "supertest";

/** A supertest `.parse()` callback that collects the response body into a Buffer. */
export function binaryParser(
  res: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: string | Buffer) => chunks.push(Buffer.from(chunk)));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
  res.on("error", (error: Error) => callback(error, Buffer.alloc(0)));
}
