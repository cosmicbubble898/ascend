// Public audio and isolated profile; main/preload/worker restart stress without foreground dependence.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { _electron } = require(process.env.ASCEND_QA_PLAYWRIGHT);
const root = path.resolve(__dirname, "..");
(async () => {
  const profile = await fs.mkdtemp(
    path.join(root, "runtime/parakeet-qa/restarts-"),
  );
  const app = await _electron.launch({
    executablePath: path.join(root, "node_modules/electron/dist/electron.exe"),
    args: [root, "--user-data-dir=" + profile],
    timeout: 45000,
  });
  try {
    const page = await app.firstWindow();
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
      },
      path.join(root, "runtime/parakeet-qa/jfk.flac"),
    );
    await page.evaluate(() => window.ascend.choose());
    for (let cycle = 1; cycle <= 3; cycle++) {
      await page.evaluate(async () => {
        const state = await window.ascend.state();
        await window.ascend.start(state.file.token);
        await window.ascend.cancel();
      });
      const canceledDeadline = Date.now() + 12000;
      let state;
      do {
        state = await page.evaluate(() => window.ascend.state());
        if (state.stage === "canceled") break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } while (Date.now() < canceledDeadline);
      assert.equal(state.stage, "canceled");
      await page.evaluate(async () => {
        const state = await window.ascend.state();
        await window.ascend.start(state.file.token);
      });
      const completeDeadline = Date.now() + 180000;
      do {
        state = await page.evaluate(() => window.ascend.state());
        if (["complete", "error"].includes(state.stage)) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      } while (Date.now() < completeDeadline);
      assert.equal(state.stage, "complete", state.error ?? state.stage);
      assert.match(state.text, /ask not what your country can do for you/i);
      console.log(`PASS restart cycle ${cycle}: complete public transcript`);
    }
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
