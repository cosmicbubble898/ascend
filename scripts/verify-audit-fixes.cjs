// Regression checks for the 2026-09-06 audit. Synthetic isolated profile only.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const { _electron } = require(process.env.ASCEND_QA_PLAYWRIGHT);
const root = path.resolve(__dirname, "..");
const results = [];

(async () => {
  const profile = await fs.mkdtemp(
    path.join(root, "runtime/productivity-qa", "audit-edges-"),
  );
  execFileSync(
    path.join(root, "runtime/python-env-0.11.29/Scripts/python.exe"),
    [
      "-I",
      path.join(root, "scripts/seed-productivity-qa.py"),
      path.join(profile, "productivity/activity.vault"),
    ],
    { windowsHide: true, stdio: "pipe" },
  );
  const app = await _electron.launch({
    executablePath: path.join(root, "node_modules/electron/dist/electron.exe"),
    args: [root, "--user-data-dir=" + profile],
    timeout: 45000,
  });
  try {
    const page = await app.firstWindow();
    await page.locator("#metric-active").filter({ hasText: "45m" }).waitFor();
    const today = await page.locator("#activity-date").inputValue();
    const state = (date = today) =>
      page.evaluate(async (date) => {
        const start = new Date(date + "T00:00:00").getTime();
        return window.productivity.request({
          action: "state",
          start,
          end: start + 86400000,
        });
      }, date);
    await page.locator("#show-plan").click();
    await page.locator("#plan-title").fill("Audit original task");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    const task = page
      .locator(".task-row")
      .filter({ hasText: "Audit original task" });
    await task.getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator("#previous-day").click();
    await page
      .getByText("Choose one task to start your plan.", { exact: true })
      .waitFor();
    const yesterday = await page.locator("#activity-date").inputValue();
    assert.equal(await page.locator("#plan-title").inputValue(), "");
    await page.locator("#plan-title").fill("Audit changed after navigating");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await page.waitForFunction(
      () => document.getElementById("plan-title").value === "",
    );
    const originalDay = await state();
    const selectedDay = await state(yesterday);
    assert.ok(originalDay.plans.some((p) => p.title === "Audit original task"));
    assert.ok(
      selectedDay.plans.some(
        (p) => p.title === "Audit changed after navigating",
      ),
    );
    results.push({
      finding: "Editing a task then changing day edits the original day",
      reproduced:
        originalDay.plans.some(
          (p) => p.title === "Audit changed after navigating",
        ) && selectedDay.plans.length === 0,
    });
    await page.locator("#today").click();
    await page.locator("#show-day").click();
    const rows = (await state()).rows.filter(
      (row) => row.app === "code.exe" && !row.live,
    );
    assert.ok(rows.length);
    await page.evaluate(
      async ({ date, ids }) => {
        const start = new Date(date + "T00:00:00").getTime();
        return window.productivity.request({
          action: "correct",
          start,
          end: start + 86400000,
          ids,
          category: "Work",
          project: "",
          task: "Audit task needle",
          planning: "planned",
        });
      },
      { date: today, ids: rows[0].ids },
    );
    await page
      .locator("#activity-timeline")
      .getByText("Audit task needle", { exact: true })
      .waitFor();
    await page.locator("#activity-search").fill("Audit task needle");
    results.push({
      finding: "Timeline search omits the visible task label",
      reproduced: await page
        .getByRole("heading", { name: "No matching activity" })
        .isVisible(),
    });
    await page.locator("#activity-search").fill("");
    await page.locator("#delete-day").click();
    await page
      .getByRole("heading", {
        name: "Delete this day's activity and plans?",
        exact: true,
      })
      .waitFor();
    await page.locator("#delete-cancel").click();
    assert.equal((await state()).running, true);
    console.log(JSON.stringify(results));
    const parent = await app.evaluate(() => process.pid);
    assert.ok(Number.isSafeInteger(parent) && parent > 0);
    const found = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${parent} -and $_.Name -like 'python*' } | Select-Object -ExpandProperty ProcessId`,
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    assert.match(found, /^\d+$/);
    // The PID above is a verified direct child of this isolated QA Electron app.
    execFileSync("taskkill.exe", ["/PID", found, "/T", "/F"], {
      windowsHide: true,
      stdio: "pipe",
    });
    await page
      .locator("#tracking-toggle")
      .filter({ hasText: "Retry tracking" })
      .waitFor();
    await page.locator("#tracking-toggle").click();
    const retryOpenedSettings = await page
      .locator("#settings-dialog")
      .isVisible();
    let engineStillUnavailable = false;
    try {
      await state();
    } catch {
      engineStillUnavailable = true;
    }
    results.push({
      finding:
        "Retry tracking opens settings without restarting a crashed engine",
      reproduced: retryOpenedSettings && engineStillUnavailable,
    });
    assert.equal(retryOpenedSettings, false);
    assert.equal(engineStillUnavailable, false);
    await page
      .locator("#tracking-toggle")
      .filter({ hasText: "Tracking settings" })
      .waitFor();
    assert.equal((await state()).running, true);
    results.push({
      check: "Retry tracking restarts the engine directly",
      passed: true,
    });
  } finally {
    await app.close();
  }
  const { shouldIgnoreFromPackage } = require(
    path.join(root, "scripts/package-filter.cjs"),
  );
  const required = [
    "dist/shell/main/transcription-session.js",
    "dist/shell/main/productivity-session.js",
    "dist/shell/main/productivity-command.js",
    "dist/shell/renderer/app.js",
    "dist/shell/renderer/productivity.js",
  ];
  results.push({
    finding: "Packaging drops imported feature modules and renderer scripts",
    excluded: required.filter(shouldIgnoreFromPackage),
  });
  await fs.writeFile(
    path.join(root, "runtime/productivity-qa", "audit-edge-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  for (const result of results) {
    if ("reproduced" in result)
      assert.equal(result.reproduced, false, result.finding);
    if ("excluded" in result)
      assert.deepEqual(result.excluded, [], result.finding);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
