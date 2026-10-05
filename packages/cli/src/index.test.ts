import { describe, expect, it } from "vitest";
import { banner } from "./index.js";

describe("roomlist-cli", () => {
  it("returns the placeholder banner", () => {
    expect(banner()).toBe("roomlist: not implemented yet");
  });
});
