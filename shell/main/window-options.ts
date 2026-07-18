import type { BrowserWindowConstructorOptions } from "electron";

export function createMainWindowOptions(
  preloadPath: string,
): BrowserWindowConstructorOptions {
  return {
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
      webviewTag: false,
    },
  };
}
