import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: false,
  read: vi.fn(),
  write: vi.fn(),
  mkdir: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  readFile: mocks.read,
  writeFile: mocks.write,
  mkdir: mocks.mkdir,
}));
vi.mock("electron", () => ({
  app: {
    commandLine: { hasSwitch: () => mocks.profile },
    isPackaged: false,
    getAppPath: () => "C:\\My Ascend",
    getPath: () => "C:\\Test profile",
    getLoginItemSettings: mocks.get,
    setLoginItemSettings: mocks.set,
  },
}));
import { configureLoginStartup, loginArguments } from "./login-startup.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile = false;
  mocks.read.mockRejectedValue(
    Object.assign(new Error("missing"), { code: "ENOENT" }),
  );
  mocks.get.mockReturnValue({
    openAtLogin: false,
    launchItems: [
      {
        name: "Ascend",
        scope: "user",
        enabled: true,
        path: process.execPath,
        args: ["C:\\My Ascend"],
      },
    ],
  });
});
it("passes paths as arguments for Electron to quote and omits checkout paths in packages", () => {
  expect(loginArguments(false, "C:\\My Ascend")).toEqual([
    "C:\\My Ascend",
    "--ascend-background",
  ]);
  expect(loginArguments(true, "ignored")).toEqual(["--ascend-background"]);
});
it("registers this user and verifies the exact target", async () => {
  const status = await configureLoginStartup();
  expect(mocks.set).toHaveBeenCalledWith({
    name: "Ascend",
    path: process.execPath,
    args: ["C:\\My Ascend", "--ascend-background"],
    openAtLogin: true,
    enabled: true,
  });
  expect(mocks.write).toHaveBeenCalledOnce();
  expect(status()).toContain("Starts automatically");
});
it("restores a disabled Windows startup entry after a manual Ascend launch", async () => {
  mocks.read.mockResolvedValue(
    JSON.stringify({
      path: process.execPath,
      args: loginArguments(false, "C:\\My Ascend"),
    }),
  );
  mocks.get.mockReturnValue({
    openAtLogin: true,
    launchItems: [
      {
        name: "Ascend",
        scope: "user",
        enabled: false,
        path: process.execPath,
        args: ["C:\\My Ascend"],
      },
    ],
  });
  mocks.set.mockImplementationOnce(() => {
    mocks.get.mockReturnValue({
      openAtLogin: true,
      launchItems: [
        {
          name: "Ascend",
          scope: "user",
          enabled: true,
          path: process.execPath,
          args: ["C:\\My Ascend"],
        },
      ],
    });
  });
  const status = await configureLoginStartup();
  expect(mocks.set).toHaveBeenCalledWith({
    name: "Ascend",
    path: process.execPath,
    args: ["C:\\My Ascend", "--ascend-background"],
    openAtLogin: true,
    enabled: true,
  });
  expect(status()).toContain("Starts automatically");
});
it("does not register test profiles or conceal a failed registration", async () => {
  mocks.profile = true;
  expect((await configureLoginStartup())()).toContain("isolated test profile");
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.read).not.toHaveBeenCalled();
  mocks.profile = false;
  mocks.set.mockImplementationOnce(() => {
    throw new Error("denied");
  });
  expect((await configureLoginStartup())()).toContain(
    "could not be configured",
  );
  expect(mocks.write).not.toHaveBeenCalled();
});
