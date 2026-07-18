import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveApplicationResource } from "./application-resource.js";

describe("resolveApplicationResource", () => {
  const rendererRoot = "C:\\Ascend\\shell\\renderer";

  it("maps only known Ascend application resources", () => {
    expect(resolveApplicationResource("ascend://app/", rendererRoot)).toBe(
      path.join(rendererRoot, "index.html"),
    );
    expect(
      resolveApplicationResource("ascend://app/styles.css", rendererRoot),
    ).toBe(path.join(rendererRoot, "styles.css"));
  });

  it("rejects unknown hosts, paths, and query strings", () => {
    expect(
      resolveApplicationResource("ascend://other/", rendererRoot),
    ).toBeUndefined();
    expect(
      resolveApplicationResource("ascend://app/../package.json", rendererRoot),
    ).toBeUndefined();
    expect(
      resolveApplicationResource("ascend://app/unknown.js", rendererRoot),
    ).toBeUndefined();
    expect(
      resolveApplicationResource(
        "ascend://app/?redirect=https://example.com",
        rendererRoot,
      ),
    ).toBeUndefined();
  });
});
