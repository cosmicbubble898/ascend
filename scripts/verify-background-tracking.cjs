// Isolated native Electron scenario. No startup registration or owner-vault access.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { _electron } = require(process.env.ASCEND_QA_PLAYWRIGHT);
const root = path.resolve(__dirname, "..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const profile = await fs.mkdtemp(
    path.join(root, "runtime/productivity-qa/background-"),
  );
  const vault = path.join(profile, "productivity/activity.vault");
  let app;
  const launch = async () => {
    app = await _electron.launch({
      executablePath: path.join(
        root,
        "node_modules/electron/dist/electron.exe",
      ),
      args: [root, "--user-data-dir=" + profile, "--ascend-background"],
      timeout: 45000,
    });
    const page = await app.firstWindow();
    await page.waitForFunction(() => Boolean(window.productivity), undefined, {
      polling: 100,
      timeout: 10000,
    });
    return page;
  };
  const request = (page, action = { action: "state" }) =>
    page.evaluate(async (action) => {
      const start = new Date().setHours(0, 0, 0, 0);
      return window.productivity.request({
        ...action,
        start,
        end: start + 86400000,
      });
    }, action);
  const childPid = async () => {
    const parent = await app.evaluate(() => process.pid);
    const value = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${parent} -and $_.Name -like 'python*' } | Select-Object -ExpandProperty ProcessId`,
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    assert.match(value, /^\d+$/);
    return value;
  };
  try {
    let page = await launch();
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
      false,
    );
    assert.equal((await request(page)).running, true);
    const originalChild = await childPid();
    assert.deepEqual(
      await page
        .locator("#pause-hours option")
        .evaluateAll((options) => options.map((option) => option.value)),
      ["4", "24", "48"],
    );
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      win.close();
    });
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
      false,
    );
    console.log("PASS: quiet startup and closing hides the live window");
    // No renderer polling for longer than the Python parent's 35-second lease.
    await delay(40000);
    assert.equal(await childPid(), originalChild);
    assert.equal((await request(page)).running, true);
    assert.ok((await fs.stat(vault)).size > 0);
    console.log(
      "PASS: main-process heartbeat keeps hidden tracking and checkpointing alive",
    );
    for (const hours of [4, 24, 48]) {
      const before = Date.now();
      const state = await request(page, { action: "pause", hours });
      assert.equal(state.running, false);
      assert.ok(Math.abs(state.pausedUntil - before - hours * 3600000) < 5000);
    }
    const deadline = (await request(page)).pausedUntil;
    const parent = await app.evaluate(() => process.pid);
    const child = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${parent} -and $_.Name -like 'python*' } | Select-Object -ExpandProperty ProcessId`,
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    assert.match(child, /^\d+$/);
    execFileSync("taskkill.exe", ["/PID", child, "/T", "/F"], {
      windowsHide: true,
      stdio: "pipe",
    });
    await delay(13000);
    const recovered = await request(page);
    assert.equal(recovered.running, false);
    assert.equal(recovered.pausedUntil, deadline);
    assert.ok(recovered.notices.some((notice) => notice.kind === "pause"));
    console.log(
      "PASS: all pause choices and automatic child recovery preserve the pause",
    );
    await app.close();
    app = undefined;
    page = await launch();
    assert.equal((await request(page)).pausedUntil, deadline);
    await app.close();
    app = undefined;
    execFileSync(
      path.join(root, "runtime/python-env-0.11.29/Scripts/python.exe"),
      [
        "-I",
        path.join(root, "scripts/productivity-expansion-fixture.py"),
        vault,
        "expire",
      ],
      { windowsHide: true, stdio: "pipe" },
    );
    page = await launch();
    const resumed = await request(page);
    assert.equal(resumed.running, true);
    assert.equal(resumed.pausedUntil, 0);
    await app.evaluate(({ app }) => app.emit("second-instance", {}, []));
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
      true,
    );
    console.log(
      "PASS: pause survives restart, expired pause resumes, and a manual launch reopens Ascend",
    );
  } finally {
    if (app) await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
