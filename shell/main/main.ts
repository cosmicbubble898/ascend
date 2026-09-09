import path from "node:path";
import { readFile } from "node:fs/promises";

import { app, BrowserWindow, ipcMain, Menu, protocol, session } from "electron";

import { resolveApplicationResource } from "./application-resource";
import { createMainWindowOptions } from "./window-options";
import { TranscriptionSession, trustedSender } from "./transcription-session";
import { ProductivitySession } from "./productivity-session";
import { validProductivityCommand } from "./productivity-command";
import { configureLoginStartup } from "./login-startup";
import { createBackgroundTray } from "./background-tray";
import { ClipboardHistory } from "./clipboard-history";
import {
  validClipboardHistoryCommand,
  validClipboardItemId,
} from "../clipboard-contract";
import { validZoomAction, type ZoomAction } from "../window-contract";

const APPLICATION_URL = "ascend://app/";

function registerApplicationScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "ascend",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

function denyRendererPermissions(): void {
  const privateSession = session.fromPartition("ascend-private-session", {
    cache: false,
  });
  privateSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith("ascend://app/") });
  });
  privateSession.setPermissionCheckHandler(() => false);
  privateSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );
}

function registerApplicationProtocol(): void {
  const rendererRoot = path.join(app.getAppPath(), "shell", "renderer");

  session
    .fromPartition("ascend-private-session")
    .protocol.handle("ascend", async (request) => {
      const root = [
        "ascend://app/app.js",
        "ascend://app/clipboard.js",
        "ascend://app/productivity.js",
      ].includes(request.url)
        ? path.join(app.getAppPath(), "dist", "shell", "renderer")
        : rendererRoot;
      const resourcePath = resolveApplicationResource(request.url, root);
      if (resourcePath === undefined) {
        return new Response(null, { status: 404 });
      }

      const bytes = await readFile(resourcePath);
      const extension = path.extname(resourcePath);
      const mime =
        extension === ".js"
          ? "text/javascript"
          : extension === ".css"
            ? "text/css"
            : extension === ".png"
              ? "image/png"
              : "text/html";
      return new Response(bytes, {
        headers: {
          "Content-Type": `${mime}; charset=utf-8`,
          "Cache-Control": "no-store",
        },
      });
    });
}

async function createMainWindow(): Promise<void> {
  const runtimeRoot = app.isPackaged
    ? path.join(process.resourcesPath, "ascend-runtime")
    : app.getAppPath();
  const preloadPath = path.join(
    app.getAppPath(),
    "dist",
    "shell",
    "preload.js",
  );
  const appIconPath = path.join(
    app.getAppPath(),
    "shell",
    "renderer",
    "ascend-app-icon.png",
  );
  const mainWindow = new BrowserWindow(
    createMainWindowOptions(preloadPath, appIconPath),
  );
  const adjustZoom = (action: ZoomAction): number => {
    const current = mainWindow.webContents.getZoomFactor();
    const next =
      action === "reset"
        ? 1
        : Math.min(
            1.8,
            Math.max(0.6, current + (action === "in" ? 0.1 : -0.1)),
          );
    mainWindow.webContents.setZoomFactor(next);
    return Math.round(next * 100);
  };
  const transcription = new TranscriptionSession(mainWindow, runtimeRoot);
  const clipboardHistory = await ClipboardHistory.create(
    app.getPath("userData"),
  );
  const tray = createBackgroundTray(mainWindow, appIconPath);
  const startupStatus = await configureLoginStartup();
  const productivity = new ProductivitySession(
    mainWindow,
    runtimeRoot,
    tray.update,
    startupStatus,
  );
  void productivity.refreshBackground().catch(() => undefined);
  ipcMain.removeHandler("productivity:request");
  ipcMain.handle("productivity:request", (event, ...args: unknown[]) => {
    if (
      !trustedSender(event, mainWindow) ||
      args.length !== 1 ||
      !validProductivityCommand(args[0])
    ) {
      throw new Error("invalid_productivity_request");
    }
    return productivity.request(args[0]);
  });
  ipcMain.removeHandler("clipboard:request");
  ipcMain.handle("clipboard:request", (event, ...args: unknown[]) => {
    if (
      !trustedSender(event, mainWindow) ||
      args.length !== 1 ||
      !validClipboardHistoryCommand(args[0])
    ) {
      throw new Error("invalid_clipboard_request");
    }
    return clipboardHistory.request(args[0]);
  });
  ipcMain.removeHandler("clipboard:preview");
  ipcMain.handle("clipboard:preview", (event, ...args: unknown[]) => {
    if (
      !trustedSender(event, mainWindow) ||
      args.length !== 1 ||
      !validClipboardItemId(args[0])
    ) {
      throw new Error("invalid_clipboard_preview_request");
    }
    return clipboardHistory.preview(args[0]);
  });
  ipcMain.removeHandler("window:zoom");
  ipcMain.handle("window:zoom", (event, ...args: unknown[]) => {
    if (
      !trustedSender(event, mainWindow) ||
      args.length !== 1 ||
      !validZoomAction(args[0])
    ) {
      throw new Error("invalid_zoom_request");
    }
    return adjustZoom(args[0]);
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!input.control || input.type !== "keyDown") return;
    const action =
      input.key === "0"
        ? "reset"
        : input.key === "+" || input.key === "="
          ? "in"
          : input.key === "-" || input.key === "_"
            ? "out"
            : undefined;
    if (!action) return;
    event.preventDefault();
    adjustZoom(action);
  });
  for (const action of [
    "state",
    "choose",
    "start",
    "cancel",
    "clear",
    "save",
  ] as const) {
    const channel = `transcription:${action}`;
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (
        !trustedSender(event, mainWindow) ||
        args.length !== (action === "start" ? 1 : 0)
      )
        return undefined;
      if (action === "state") return transcription.state.snapshot();
      if (action === "start") {
        return transcription.start(args[0]);
      }
      return transcription[action]();
    });
  }
  let quitting = false;
  let cleanup: Promise<void> | undefined;
  const shutdown = (): Promise<void> => {
    quitting = true;
    cleanup ??= Promise.all([
      transcription.clear(),
      productivity.close(),
      clipboardHistory.close(),
    ]).then(() => undefined);
    return cleanup;
  };
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    void shutdown().finally(() => {
      app.quit();
    });
  });
  mainWindow.on("session-end", () => {
    // Do not prevent Windows shutdown or sign-out. Checkpoints bound abrupt-exit loss.
    void shutdown();
  });
  mainWindow.on("closed", () => {
    tray.destroy();
    void shutdown();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    if (navigationUrl !== APPLICATION_URL) {
      event.preventDefault();
    }
  });
  mainWindow.once("ready-to-show", () => {
    if (!app.commandLine.hasSwitch("ascend-background")) mainWindow.show();
  });

  await mainWindow.loadURL(APPLICATION_URL);
}

function exitAfterStartupFailure(): void {
  console.error("ascend_startup_failed");
  app.exit(1);
}

function startApplication(): void {
  registerApplicationScheme();
  app.enableSandbox();
  app.commandLine.appendSwitch("disable-http-cache");
  app.commandLine.appendSwitch("disable-background-networking");
  app.setAppUserModelId("com.ascend.desktop");

  void app
    .whenReady()
    .then(async () => {
      Menu.setApplicationMenu(null);
      denyRendererPermissions();
      registerApplicationProtocol();
      await createMainWindow();

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          void createMainWindow().catch(exitAfterStartupFailure);
        }
      });
    })
    .catch(exitAfterStartupFailure);

  app.on("window-all-closed", () => {
    app.quit();
  });
}

if (app.requestSingleInstanceLock()) {
  app.on("second-instance", (_event, args) => {
    if (args.includes("--ascend-background")) return;
    const window = BrowserWindow.getAllWindows()[0];
    if (window?.isMinimized()) window.restore();
    window?.show();
    window?.focus();
  });
  startApplication();
} else {
  app.quit();
}
