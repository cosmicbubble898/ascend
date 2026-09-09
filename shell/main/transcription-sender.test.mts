import { expect, it } from "vitest";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { trustedSender } from "./transcription-session.js";

it("allows only this window's exact main frame, never subframes or external URLs", () => {
  const frame = { url: "ascend://app/" };
  const sender = { mainFrame: frame };
  const window = { webContents: sender } as unknown as BrowserWindow;
  const event = { sender, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  expect(trustedSender(event, window)).toBe(true);
  for (const senderFrame of [
    null,
    { url: "ascend://app/" },
    { url: "https://example.com" },
  ]) {
    expect(
      trustedSender({ ...event, senderFrame } as IpcMainInvokeEvent, window),
    ).toBe(false);
  }
  expect(
    trustedSender({ ...event, sender: {} } as IpcMainInvokeEvent, window),
  ).toBe(false);
});
