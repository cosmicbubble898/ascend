import { describe, expect, it } from "vitest";

import { validZoomAction } from "./window-contract.js";

describe("validZoomAction", () => {
  it("accepts only the three bounded zoom operations", () => {
    expect(validZoomAction("in")).toBe(true);
    expect(validZoomAction("out")).toBe(true);
    expect(validZoomAction("reset")).toBe(true);
    expect(validZoomAction("200%")).toBe(false);
  });
});
