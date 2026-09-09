import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { app } from "electron";

const NAME = "Ascend";
export function loginArguments(packaged: boolean, root: string): string[] {
  return packaged ? ["--ascend-background"] : [root, "--ascend-background"];
}

interface Target {
  path: string;
  args: string[];
}

function registeredItem(target: Target) {
  // openAtLogin queries Electron's default AppUserModelId entry. We own a named
  // "Ascend" entry. On this pinned Windows build launchItems.args contains
  // positional arguments only; switches are verified separately in native QA.
  const positionals = target.args.filter(
    (argument) => !argument.startsWith("--"),
  );
  return app
    .getLoginItemSettings(target)
    .launchItems.find(
      (item) =>
        item.name === NAME &&
        item.scope === "user" &&
        item.path.toLowerCase() === target.path.toLowerCase() &&
        item.args.length === positionals.length &&
        item.args.every((argument, index) => argument === positionals[index]),
    );
}

export async function configureLoginStartup(): Promise<() => string> {
  if (app.commandLine.hasSwitch("user-data-dir"))
    return () =>
      "Startup registration is disabled for this isolated test profile.";
  if (process.platform !== "win32")
    return () => "Automatic sign-in startup is supported on Windows.";
  const target: Target = {
    path: process.execPath,
    args: loginArguments(app.isPackaged, app.getAppPath()),
  };
  const marker = path.join(app.getPath("userData"), "login-startup-v1.json");
  try {
    let previous: Target | undefined;
    try {
      const value: unknown = JSON.parse(await readFile(marker, "utf8"));
      if (
        typeof value !== "object" ||
        value === null ||
        !("path" in value) ||
        typeof value.path !== "string" ||
        !("args" in value) ||
        !Array.isArray(value.args) ||
        !value.args.every((item: unknown) => typeof item === "string")
      )
        throw new Error("invalid_startup_record");
      previous = value as Target;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    // A manual Ascend launch restores its owner-requested always-on sign-in entry.
    if (
      JSON.stringify(previous) !== JSON.stringify(target) ||
      !registeredItem(target)?.enabled
    ) {
      app.setLoginItemSettings({
        ...target,
        name: NAME,
        openAtLogin: true,
        enabled: true,
      });
      if (!registeredItem(target)) throw new Error("startup_not_registered");
      await mkdir(path.dirname(marker), { recursive: true });
      await writeFile(marker, JSON.stringify(target), "utf8");
    }
    return () => {
      try {
        return registeredItem(target)?.enabled
          ? "Starts automatically when you sign into Windows. Closing the window keeps Ascend in the tray."
          : "Windows startup is disabled or unavailable. Enable Ascend in Windows Settings → Apps → Startup.";
      } catch {
        return "Windows startup status could not be checked.";
      }
    };
  } catch {
    return () =>
      "Automatic startup could not be configured. Ascend will keep running in the tray for this session.";
  }
}
