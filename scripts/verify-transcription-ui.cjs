const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const { _electron } = require(process.env.ASCEND_QA_PLAYWRIGHT);
const root = path.resolve(__dirname, "..");
const qa = path.join(root, "runtime", "parakeet-qa");

(async () => {
  // Isolate the single-instance lock and profile from the owner's open session.
  const profile = await fs.mkdtemp(path.join(qa, "electron-session-"));
  const app = await _electron.launch({
    executablePath: path.join(root, "node_modules/electron/dist/electron.exe"),
    args: [root, `--user-data-dir=${profile}`],
    timeout: 45000,
  });
  try {
    const page = await app.firstWindow();
    await page
      .getByRole("button", { name: "Transcription", exact: true })
      .click();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByText("Your words, kept here.").waitFor();
    assert.equal(await page.locator("#start").isDisabled(), true);
    await page.screenshot({ path: path.join(qa, "ascend-empty.png") });
    const started = Date.now();
    const fixture = path.join(
      qa,
      process.env.ASCEND_QA_LONG
        ? "two-hours.wav"
        : process.env.ASCEND_QA_MP4
          ? path.join("Telegram Desktop", "jfk.mp4")
          : "jfk.flac",
    );
    await app.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async (_window, options) => {
        if (
          !options.filters.some((filter) => filter.extensions.includes("mp4"))
        )
          throw new Error("MP4 must be visible in the native chooser");
        return { canceled: false, filePaths: [selected] };
      };
    }, fixture);
    await page.locator("#choose").click();
    await page.waitForFunction(
      () => !document.getElementById("start").disabled,
    );
    await page.evaluate(() => window.ascend.start("C:\\unapproved.wav"));
    assert.equal(
      await page.locator("#result-badge").innerText(),
      "Ready to transcribe",
    );
    await page.locator("#start").click();
    await page.waitForFunction(
      () => document.getElementById("result-badge").textContent === "Complete",
      undefined,
      { timeout: 180000 },
    );
    const transcript = await page.locator("#transcript").innerText();
    assert.match(transcript, /ask not what your country can do for you/i);
    assert.equal(await page.locator("#save").isDisabled(), false);
    console.log(
      "Completed audio",
      process.env.ASCEND_QA_LONG ? 7200 : 11,
      "seconds; wall time",
      (Date.now() - started) / 1000,
    );
    if (process.env.ASCEND_QA_LONG) {
      assert.match(await page.locator("#elapsed").innerText(), /2:00:00/);
      const paragraphs = transcript.split("\n\n");
      assert.ok(paragraphs.length > 50 && paragraphs.length < 400);
      assert.ok(
        paragraphs.slice(0, -1).every((part) => /[.!?]["')\]]*$/.test(part)),
      );
      assert.equal((transcript.match(/\bfellow\b/gi) || []).length, 655);
      assert.equal((transcript.match(/\bcountry\b/gi) || []).length, 1309);
      assert.equal(
        await page
          .locator("#transcript")
          .evaluate((node) => getComputedStyle(node).whiteSpace),
        "pre-wrap",
      );
      console.log(
        "Sentence-aligned paragraphs",
        paragraphs.length,
        "; repeated words preserved",
      );
    }
    await page.screenshot({ path: path.join(qa, "ascend-complete.png") });
    const target = path.join(qa, "public-ui-export.txt");
    await app.evaluate(({ dialog }, selected) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: selected,
      });
    }, target);
    await page.locator("#save").click();
    await page.getByText("Transcript saved", { exact: true }).waitFor();
    assert.equal(await fs.readFile(target, "utf8"), transcript + "\n");
    await page.locator("#clear").click();
    await page.waitForFunction(
      () => document.getElementById("transcript").textContent === "",
    );
    assert.equal(await page.locator("#save").isDisabled(), true);
    await page.locator("#choose").click();
    await page.locator("#start").click();
    const cancelStarted = Date.now();
    await page.locator("#cancel").click();
    await page.waitForFunction(
      () =>
        document
          .getElementById("result-badge")
          .textContent.startsWith("Canceled"),
      undefined,
      { timeout: 7000 },
    );
    assert.ok(Date.now() - cancelStarted < 6500);
    console.log(
      "Cancel during model loading",
      Date.now() - cancelStarted,
      "ms",
    );
    console.log(
      "Post-cancel stage",
      await page.evaluate(async () => {
        const state = await window.ascend.state();
        return {
          stage: state.stage,
          error: state.error,
          hasFile: Boolean(state.file),
          hidden: document.getElementById("start").hidden,
          tabHidden: document.getElementById("transcription-page").hidden,
        };
      }),
    );
    await page.locator("#start").click();
    await page.waitForFunction(
      () =>
        document.getElementById("transcript").textContent.length > 0 ||
        document.getElementById("result-badge").textContent ===
          "Needs attention",
      undefined,
      { timeout: process.env.ASCEND_QA_LONG ? 180000 : 45000 },
    );
    const restarted = await page.evaluate(async () => {
      const state = await window.ascend.state();
      return {
        stage: state.stage,
        error: state.error,
        hasText: Boolean(state.text),
      };
    });
    console.log("Restart outcome", restarted);
    assert.equal(restarted.hasText, true);
    if (process.env.ASCEND_QA_LONG) {
      await page.locator("#cancel").click();
      await page.waitForFunction(
        () =>
          document
            .getElementById("result-badge")
            .textContent.startsWith("Canceled"),
        undefined,
        { timeout: 7000 },
      );
      assert.match(await page.locator("#save").innerText(), /partial/);
      assert.equal(await page.locator("#save").isDisabled(), false);
      console.log(
        "PASS: cancellation during inference preserves explicitly partial text",
      );
    }
    await page.locator("#clear").click();
    const networkBlocked = await page.evaluate(async () => {
      try {
        await fetch("https://example.com");
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(networkBlocked, true);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real Electron choose, CUDA transcription, progress, export, clear, no renderer errors",
    );
  } catch (error) {
    const page = await app.firstWindow();
    console.log(
      "Failure state",
      await page.evaluate(async () => {
        const state = await window.ascend.state();
        return {
          stage: state.stage,
          error: state.error,
          hasText: Boolean(state.text),
          hidden: document.getElementById("start").hidden,
          tabHidden: document.getElementById("transcription-page").hidden,
        };
      }),
    );
    await page.screenshot({
      path: path.join(qa, "transcription-regression-failure.png"),
    });
    throw error;
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
