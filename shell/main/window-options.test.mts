import { describe, expect, it } from "vitest";

import { createMainWindowOptions } from "./window-options.js";

describe("createMainWindowOptions", () => {
  it("isolates and sandboxes the renderer without Node integration", () => {
    const preloadPath = "C:\\Ascend\\dist\\shell\\preload.js";

    const iconPath = "C:\\Ascend\\shell\\renderer\\ascend-app-icon.png";
    const options = createMainWindowOptions(preloadPath, iconPath);

    expect(options.icon).toBe(iconPath);

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
      webviewTag: false,
    });
  });
});
