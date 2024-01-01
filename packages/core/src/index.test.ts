import { describe, expect, it } from "vitest";
import { PACKAGE_NAME, version } from "./index.js";

describe("roomlist-core", () => {
  it("exposes its package name and version", () => {
    expect(PACKAGE_NAME).toBe("@alihdrndm/roomlist-core");
    expect(version()).toBe("0.1.0");
  });
});
