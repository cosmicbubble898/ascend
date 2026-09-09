import type { BrowserWindowConstructorOptions } from "electron";

export function createMainWindowOptions(
  preloadPath: string,
  iconPath?: string,
): BrowserWindowConstructorOptions {
  return {
    width: 1120,
    height: 820,
    minWidth: 800,
    minHeight: 700,
    show: false,
    backgroundColor: "#f7f8f5",
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
      webviewTag: false,
      partition: "ascend-private-session",
    },
  };
}
