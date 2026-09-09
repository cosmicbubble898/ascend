const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const { _electron } = require(process.env.ASCEND_QA_PLAYWRIGHT);
const root = path.resolve(__dirname, "..");
const qa = path.join(root, "runtime", "productivity-qa");
const python = path.join(root, "runtime/python-env-0.11.29/Scripts/python.exe");

(async () => {
  await fs.mkdir(qa, { recursive: true });
  const profile = await fs.mkdtemp(path.join(qa, "expansion-"));
  const vault = path.join(profile, "productivity/activity.vault");
  const fixture = (script, extra = []) =>
    execFileSync(
      python,
      ["-I", path.join(root, "scripts", script), vault, ...extra],
      { windowsHide: true, stdio: "pipe" },
    );
  fixture("seed-productivity-qa.py");
  fixture("productivity-expansion-fixture.py");
  const requests = [];
  // Bind only when this port is free. Never redirect or replace an owner's model server.
  const model = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8000) req.destroy();
    });
    req.on("end", () => {
      requests.push({ url: req.url, body: JSON.parse(body) });
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          req.url === "/api/show"
            ? { model_info: { "general.architecture": "synthetic" } }
            : {
                message: {
                  content: JSON.stringify({
                    category: "Learning",
                    reason: "Synthetic classification contract result",
                  }),
                },
              },
        ),
      );
    });
  });
  await new Promise((resolve, reject) => {
    model.once("error", reject);
    model.listen(11434, "127.0.0.1", resolve);
  });
  const launch = () =>
    _electron.launch({
      executablePath: path.join(
        root,
        "node_modules/electron/dist/electron.exe",
      ),
      args: [root, "--user-data-dir=" + profile],
      timeout: 45000,
    });
  let app;
  const errors = [];
  try {
    app = await launch();
    let page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.locator("#metric-active").filter({ hasText: "47m" }).waitFor();
    const snapshot = () =>
      page.evaluate(async () => {
        const start = new Date(
          document.getElementById("activity-date").value + "T00:00:00",
        ).getTime();
        return window.productivity.request({
          action: "state",
          start,
          end: start + 86400000,
        });
      });
    assert.equal((await snapshot()).running, true);
    const notificationDelivery = await app.evaluate(
      ({ Notification }) =>
        new Promise((resolve) => {
          if (!Notification.isSupported()) {
            resolve("unsupported");
            return;
          }
          const notification = new Notification({
            title: "Ascend notification test",
            body: "Testing your productivity reminders.",
            silent: true,
          });
          let finished = false;
          const done = (value) => {
            if (!finished) {
              finished = true;
              resolve(value);
            }
          };
          notification.once("show", () =>
            done("Windows accepted the notification"),
          );
          notification.once("failed", () =>
            done("Windows rejected the notification"),
          );
          setTimeout(() => done("delivery unconfirmed"), 4000);
          notification.show();
        }),
    );
    console.log("Desktop notification smoke: " + notificationDelivery);
    assert.equal(await page.locator("#metric-focus").textContent(), "45m");
    await page.locator("#activity-settings").click();
    await page.locator("#pause-hours").selectOption("4");
    await page.locator("#pause-apply").click();
    await page.locator("#pause-banner").waitFor();
    assert.equal((await snapshot()).running, false);
    const pausedUntil = (await snapshot()).pausedUntil;
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.locator("#pause-banner").waitFor();
    assert.equal((await snapshot()).pausedUntil, pausedUntil);
    assert.equal((await snapshot()).running, false);
    await app.close();
    fixture("productivity-expansion-fixture.py", ["expire"]);
    app = await launch();
    page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.locator("#metric-active").filter({ hasText: "47m" }).waitFor();
    assert.equal((await snapshot()).running, true);
    assert.equal((await snapshot()).pausedUntil, 0);
    await page.locator("#show-plan").click();
    await page.locator("#plan-title").fill("Write a clear proposal");
    await page.locator("#plan-project").fill("Ascend Δ");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await page
      .locator(".task-row")
      .filter({ hasText: "Write a clear proposal" })
      .waitFor();
    const task = page
      .locator(".task-row")
      .filter({ hasText: "Write a clear proposal" });
    await task.getByRole("button", { name: "Done", exact: true }).click();
    await task.getByRole("button", { name: "Reopen", exact: true }).waitFor();
    await task.getByRole("button", { name: "Reopen", exact: true }).click();
    await task.getByRole("button", { name: "Focus", exact: true }).click();
    await page
      .locator("#timer-banner")
      .filter({ hasText: "Write a clear proposal" })
      .waitFor();
    assert.equal((await snapshot()).focus.phase, "focus");
    await page.screenshot({
      path: path.join(qa, "expansion-plan.png"),
      fullPage: true,
    });
    await page.locator("#focus-cancel").click();
    await page.locator("#break-start").click();
    await page.locator("#focus-clock").filter({ hasText: "Break" }).waitFor();
    await page.locator("#focus-cancel").click();
    await page.locator("#goal-minutes").fill("60");
    await page.locator("#goal-save").click();
    await page
      .locator("#goal-progress")
      .filter({ hasText: "60 minutes" })
      .waitFor();
    await page.locator("#show-review").click();
    await page
      .locator("#review-workflows")
      .getByText("This app sequence appeared 3 times in the selected period.")
      .waitFor();
    await page.locator("#review-range").selectOption("week");
    await page.waitForFunction(
      () => document.querySelectorAll("#review-days .review-line").length === 7,
    );
    await page.screenshot({
      path: path.join(qa, "expansion-review.png"),
      fullPage: true,
    });
    await page.locator("#activity-settings").click();
    await page.locator("#ai-model").fill("synthetic-local");
    await page.locator("#settings-save").click();
    await page.locator("#settings-dialog").waitFor({ state: "hidden" });
    await page.locator("#show-day").click();
    const original = page
      .locator(".timeline-row")
      .filter({ hasText: "Ascend development" });
    await original.getByRole("button", { name: "Review", exact: true }).click();
    await page.locator("#ask-local-ai").click();
    await page
      .locator("#ai-result")
      .filter({ hasText: "Synthetic classification contract result" })
      .waitFor({ timeout: 20000 });
    await page.locator("#apply-local-ai").click();
    await original
      .filter({ hasText: "Local AI suggestion accepted" })
      .waitFor();
    assert.deepEqual(
      requests.map((request) => request.url),
      ["/api/show", "/api/chat"],
    );
    const sent = JSON.parse(requests[1].body.messages[1].content);
    assert.deepEqual(sent, {
      app: "code.exe",
      window_title: "Ascend development",
    });
    await original.getByRole("button", { name: "Review", exact: true }).click();
    await page.locator("#correction-undo").click();
    await original.getByRole("button", { name: "Review", exact: true }).click();
    await page.locator("#block-category").selectOption("Learning");
    await page.locator("#block-project").fill("Ascend Δ");
    await page.locator("#block-task").fill("Read design notes");
    await page.locator("#block-planning").selectOption("planned");
    await page.locator("#context-pattern").fill("Ascend development");
    await page.locator("#remember-context").click();
    await page
      .locator(".timeline-row")
      .filter({ hasText: "Read design notes" })
      .filter({ hasText: "Your context rule" })
      .waitFor();
    await page.locator("#activity-settings").click();
    await page
      .locator("#context-rule-list")
      .getByRole("button", { name: "Forget rule" })
      .click();
    await page
      .locator("#context-rule-list")
      .getByText("Review a block to remember a window-context rule.")
      .waitFor();
    await page.locator("#settings-cancel").click();
    await page.setViewportSize({ width: 800, height: 700 });
    for (const name of ["day", "plan", "review"]) {
      await page.locator("#show-" + name).click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
    }
    await page.screenshot({
      path: path.join(qa, "expansion-compact.png"),
      fullPage: true,
    });
    await page.locator("#tab-transcription").click();
    await page
      .getByRole("heading", { name: "Your words, kept here." })
      .waitFor();
    assert.equal(await page.locator("#choose").isEnabled(), true);
    assert.equal(
      await page.evaluate(async () => {
        try {
          await fetch("https://example.com");
          return false;
        } catch {
          return true;
        }
      }),
      true,
    );
    await page.locator("#tab-productivity").click();
    await page.locator("#delete-day").click();
    await page.locator("#delete-confirm").click();
    await page.waitForFunction(
      () => document.getElementById("metric-active").textContent === "0m",
    );
    assert.equal((await snapshot()).plans.length, 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: automatic tracking, durable pause/expiry, task plan and completion, focus/break controls, goals, weekly review, workflow evidence, isolated local-AI contract, correction/rule review, deletion, responsive layout, transcription access, renderer network denial",
    );
    console.log("Synthetic screenshots: " + qa);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => model.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
