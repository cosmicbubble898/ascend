const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const { _electron } = require(process.env.ASCEND_QA_PLAYWRIGHT);
const root = path.resolve(__dirname, "..");
const qa = path.join(root, "runtime", "productivity-qa");

(async () => {
  await fs.mkdir(qa, { recursive: true });
  const profile = await fs.mkdtemp(path.join(qa, "profile-"));
  execFileSync(
    path.join(root, "runtime/python-env-0.11.29/Scripts/python.exe"),
    [
      "-I",
      path.join(root, "scripts/seed-productivity-qa.py"),
      path.join(profile, "productivity/activity.vault"),
    ],
    { windowsHide: true, stdio: "pipe" },
  );
  const launch = () =>
    _electron.launch({
      executablePath: path.join(
        root,
        "node_modules/electron/dist/electron.exe",
      ),
      args: [root, `--user-data-dir=${profile}`],
      timeout: 45000,
    });
  let app = await launch();
  const errors = [];
  try {
    let page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page
      .getByRole("heading", { name: "A little more awareness." })
      .waitFor();
    await page.waitForFunction(
      () => document.getElementById("metric-active").textContent === "45m",
    );
    assert.equal(await page.locator("#metric-focus").textContent(), "45m");
    assert.equal(
      await page.locator("#tracking-toggle").textContent(),
      "Tracking settings",
    );
    await page.screenshot({
      path: path.join(qa, "productivity-overview.png"),
      fullPage: true,
    });
    const firstReview = page.getByRole("button", { name: "Review" }).first();
    await firstReview.waitFor();
    const [timelineBox, reviewBox] = await Promise.all([
      page.locator("#activity-timeline").boundingBox(),
      firstReview.boundingBox(),
    ]);
    assert.ok(timelineBox && reviewBox);
    assert.ok(reviewBox.width >= 60);
    assert.ok(
      reviewBox.x + reviewBox.width <= timelineBox.x + timelineBox.width,
    );
    await page
      .locator(".timeline-row")
      .filter({ hasText: "Ascend development" })
      .getByRole("button", { name: "Review" })
      .click();
    await page.locator("#block-category").selectOption("Personal");
    await page.locator("#block-project").fill("Synthetic project Δ");
    await page.locator("#correction-save").click();
    await page
      .locator("#activity-timeline")
      .getByText("Synthetic project Δ", { exact: true })
      .waitFor();
    assert.equal(await page.locator("#metric-focus").textContent(), "45m");
    await page.locator("#activity-settings").click();
    await page.locator("#excluded-apps").fill("chrome.exe\nwhatsapp.exe");
    await page.screenshot({ path: path.join(qa, "productivity-settings.png") });
    await page.locator("#settings-save").click();
    const displays = await app.evaluate(({ screen, BrowserWindow }) => {
      const all = screen.getAllDisplays();
      const window = BrowserWindow.getAllWindows()[0];
      const target = all[0].workArea;
      window.setBounds({
        x: target.x + 20,
        y: target.y + 20,
        width: 800,
        height: 700,
      });
      window.focus();
      return all.length;
    });
    await page.locator("#tracking-toggle").click();
    await page.locator("#resume-now").click();
    await page
      .locator("#tracking-toggle")
      .filter({ hasText: "Tracking settings" })
      .waitFor();
    const nativeStates = [];
    const readNativeState = () =>
      page.evaluate(async () => {
        const value = document.getElementById("activity-date").value;
        const start = new Date(value + "T00:00:00").getTime();
        const state = await window.productivity.request({
          action: "state",
          start,
          end: start + 86400000,
        });
        return {
          state: state.current.state,
          idle: state.current.idle,
          hasApp: Boolean(state.current.app),
          error: state.error,
        };
      });
    await page.waitForTimeout(4500);
    nativeStates.push(await readNativeState());
    if (displays > 1) {
      await app.evaluate(({ screen, BrowserWindow }) => {
        const target = screen.getAllDisplays()[1].workArea;
        const window = BrowserWindow.getAllWindows()[0];
        window.setBounds({
          x: target.x + 20,
          y: target.y + 20,
          width: 800,
          height: 700,
        });
        window.focus();
      });
      await page.waitForTimeout(4500);
      nativeStates.push(await readNativeState());
    }
    await page.locator("#tracking-toggle").click();
    await page.locator("#pause-hours").selectOption("4");
    await page.locator("#pause-apply").click();
    await page
      .getByRole("button", { name: "Resume tracking", exact: true })
      .waitFor();
    const capturedMonitors = await page.evaluate(async () => {
      const value = document.getElementById("activity-date").value;
      const start = new Date(value + "T00:00:00").getTime();
      const state = await window.productivity.request({
        action: "state",
        start,
        end: start + 86400000,
      });
      return [
        ...new Set(
          state.rows
            .filter(
              (row) => row.kind === "active" && row.monitor.includes("DISPLAY"),
            )
            .map((row) => row.monitor),
        ),
      ].length;
    });
    await page.locator("#tab-settings").click();
    await page
      .getByRole("heading", { name: "Settings & activity log." })
      .waitFor();
    assert.equal(await page.locator("#usage-screenshots").textContent(), "0");
    await page.locator("#profile-name").fill("Synthetic person");
    await page.locator("#profile-role").fill("Product builder");
    await page.locator("#profile-save").click();
    await page.getByText("Saved on this device.", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(qa, "settings-and-usage.png"),
      fullPage: true,
    });
    await page.locator("#tab-transcription").click();
    await page
      .getByRole("heading", { name: "Your words, kept here." })
      .waitFor();
    assert.equal(await page.locator("#choose").isEnabled(), true);
    await page.locator("#tab-productivity").click();
    const networkDenied = await page.evaluate(async () => {
      try {
        await fetch("https://example.com");
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(networkDenied, true);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page
      .locator("#activity-timeline")
      .getByText("Synthetic project Δ", { exact: true })
      .waitFor();
    assert.equal(
      await page.locator("#tracking-toggle").textContent(),
      "Resume tracking",
    );
    await page.locator("#tab-settings").click();
    assert.equal(
      await page.locator("#profile-name").inputValue(),
      "Synthetic person",
    );
    await page.locator("#tab-productivity").click();
    await page.locator("#activity-settings").click();
    assert.equal(
      await page.locator("#excluded-apps").inputValue(),
      "chrome.exe\nwhatsapp.exe",
    );
    await page.locator("#settings-cancel").click();
    await page
      .locator(".timeline-row")
      .filter({ hasText: "Synthetic project Δ" })
      .getByRole("button", { name: "Review" })
      .click();
    await page.locator("#correction-undo").click();
    await page.waitForFunction(
      () => document.getElementById("metric-focus").textContent === "45m",
    );
    await page.setViewportSize({ width: 800, height: 700 });
    await page.screenshot({
      path: path.join(qa, "productivity-compact.png"),
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page.locator("#delete-day").click();
    await page.locator("#delete-confirm").click();
    await page
      .getByRole("heading", { name: "Your day starts here." })
      .waitFor();
    await page.screenshot({
      path: path.join(qa, "productivity-empty.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: encrypted restart, totals, correct/undo, exclusions, start/pause controls, deletion, responsive UI, transcription access, renderer network denial",
    );
    console.log(`QA screenshots: ${qa}`);
    console.log(
      `Native monitor attribution: ${capturedMonitors} captured; ${displays} connected; states=${JSON.stringify(nativeStates)}`,
    );
    // Keep this independent hardware assertion strict. The UI checks above can
    // pass on an inactive desktop without proving live multi-monitor capture.
    assert.ok(
      capturedMonitors >= Math.min(2, displays),
      "Live hardware verification incomplete: native active capture must follow the QA window across displays in an active, unlocked desktop session",
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
