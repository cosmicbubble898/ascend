import { describe, expect, it } from "vitest";

import { createMainWindowOptions } from "./window-options.js";

describe("createMainWindowOptions", () => {
  it("isolates and sandboxes the renderer without Node integration", () => {
    const preloadPath = "C:\\Ascend\\dist\\shell\\preload.js";

    const options = createMainWindowOptions(preloadPath);

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
      webviewTag: false,
    });
  });
});
