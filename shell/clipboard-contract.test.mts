import { describe, expect, it } from "vitest";

import { validClipboardHistoryCommand } from "./clipboard-contract.js";

describe("validClipboardHistoryCommand", () => {
  it("allows bounded clipboard history actions", () => {
    expect(validClipboardHistoryCommand({ action: "state" })).toBe(true);
    expect(
      validClipboardHistoryCommand({
        action: "copy",
        id: "12345678-1234-1234-1234-123456789abc",
      }),
    ).toBe(true);
    expect(
      validClipboardHistoryCommand({ action: "copyRecent", count: 5 }),
    ).toBe(true);
  });

  it("rejects unknown fields, unbounded counts, and malformed identifiers", () => {
    expect(validClipboardHistoryCommand({ action: "state", extra: true })).toBe(
      false,
    );
    expect(
      validClipboardHistoryCommand({ action: "copyRecent", count: 21 }),
    ).toBe(false);
    expect(validClipboardHistoryCommand({ action: "copy", id: "first" })).toBe(
      false,
    );
  });
});
