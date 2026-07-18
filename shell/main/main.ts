import path from "node:path";
import { pathToFileURL } from "node:url";

import { app, BrowserWindow, net, protocol, session } from "electron";

import { resolveApplicationResource } from "./application-resource";
import { createMainWindowOptions } from "./window-options";

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
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );
}

function registerApplicationProtocol(): void {
  const rendererRoot = path.join(app.getAppPath(), "shell", "renderer");

  protocol.handle("ascend", (request) => {
    const resourcePath = resolveApplicationResource(request.url, rendererRoot);
    if (resourcePath === undefined) {
      return new Response(null, { status: 404 });
    }

    return net.fetch(pathToFileURL(resourcePath).toString());
  });
}

async function createMainWindow(): Promise<void> {
  const preloadPath = path.join(
    app.getAppPath(),
    "dist",
    "shell",
    "preload.js",
  );
  const mainWindow = new BrowserWindow(createMainWindowOptions(preloadPath));

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    if (navigationUrl !== APPLICATION_URL) {
      event.preventDefault();
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  await mainWindow.loadURL(APPLICATION_URL);
}

function exitAfterStartupFailure(error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Unknown startup failure";
  console.error(`Ascend failed to start: ${message}`);
  app.exit(1);
}

function startApplication(): void {
  registerApplicationScheme();
  app.enableSandbox();

  void app
    .whenReady()
    .then(async () => {
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

startApplication();
