// Smoke the hardened binary without changing its fuses or the owner's login entry.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
(async () => {
  const profile = await fs.mkdtemp(
    path.join(root, "runtime/productivity-qa/background-package-"),
  );
  const child = spawn(
    path.join(root, "out/Ascend-win32-x64/Ascend.exe"),
    ["--user-data-dir=" + profile, "--ascend-background"],
    { windowsHide: true, stdio: "ignore" },
  );
  let spawnError;
  child.on("error", (error) => {
    spawnError = error;
  });
  try {
    const deadline = Date.now() + 60000;
    let saved = false;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      assert.equal(child.exitCode, null, "Packaged app exited unexpectedly");
      const stat = await fs
        .stat(path.join(profile, "productivity/activity.vault"))
        .catch(() => undefined);
      if (stat?.size > 0) {
        saved = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.equal(
      saved,
      true,
      "Packaged background engine did not save its isolated vault",
    );
    assert.equal(
      await fs.stat(path.join(profile, "login-startup-v1.json")).then(
        () => true,
        () => false,
      ),
      false,
    );
    console.log(
      "PASS: hardened packaged app starts quietly, runs its bundled engine, saves an isolated vault and skips login registration",
    );
  } finally {
    if (child.pid && child.exitCode === null)
      execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "pipe",
      });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
