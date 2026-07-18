const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  EXPECTED_INSTALLER_POLICY,
  loadInstallerPolicyState,
  validateInstallerArtifactNames,
  validateInstallerPolicy,
} = require("./installer-policy.cjs");

function createApprovedState() {
  return {
    packageJson: {
      private: true,
      devDependencies: {
        "electron-builder": "26.15.7",
      },
      scripts: {},
    },
    forgeConfig: { makers: [] },
    builderConfig: {
      appId: "com.ascend.desktop",
      productName: "Ascend",
      directories: { output: "out/nsis" },
      publish: null,
      win: {
        target: [{ target: "nsis", arch: ["x64"] }],
        executableName: "Ascend",
        requestedExecutionLevel: "asInvoker",
        signExecutable: false,
      },
      nsis: {
        oneClick: true,
        perMachine: false,
        packElevateHelper: false,
        createDesktopShortcut: false,
        createStartMenuShortcut: true,
        runAfterFinish: false,
        deleteAppDataOnUninstall: false,
        differentialPackage: false,
        unicode: true,
        warningsAsErrors: true,
        shortcutName: "Ascend",
        artifactName: "Ascend-Setup-${version}-${arch}.${ext}",
      },
    },
    buildScript: [
      "electron-builder.cmd",
      "--prepackaged",
      "proof-input",
      "--win",
      "nsis",
      "--x64",
      "--publish",
      "never",
      "--config",
      "electron-builder.config.cjs",
    ].join(" "),
    mainSource: [
      'app.setAppUserModelId("com.ascend.desktop");',
      "void app.whenReady();",
    ].join("\n"),
  };
}

test("the approved installer policy accepts only the bounded NSIS proof", () => {
  assert.equal(EXPECTED_INSTALLER_POLICY.appId, "com.ascend.desktop");
  assert.deepEqual(validateInstallerPolicy(createApprovedState()), []);
});

test("the repository matches the approved installer policy", () => {
  const projectRoot = require("node:path").resolve(__dirname, "..");
  assert.deepEqual(
    validateInstallerPolicy(loadInstallerPolicyState(projectRoot)),
    [],
  );
});

test("electron-builder 26.15.7 accepts every approved configuration option", async () => {
  const projectRoot = require("node:path").resolve(__dirname, "..");
  const {
    validateConfiguration,
  } = require("app-builder-lib/out/util/config/config");
  const { DebugLogger } = require("builder-util/out/DebugLogger");
  const state = loadInstallerPolicyState(projectRoot);

  await assert.doesNotReject(
    validateConfiguration(state.builderConfig, new DebugLogger(false)),
  );
});

test("installer policy rejects publishing, web installers, and custom scripts", () => {
  const state = createApprovedState();
  state.builderConfig.publish = [{ provider: "github" }];
  state.builderConfig.win.target = ["nsis-web"];
  state.builderConfig.nsis.script = "installer.nsi";
  state.buildScript = state.buildScript.replace(
    "--publish never",
    "--publish always",
  );

  const errors = validateInstallerPolicy(state);

  assert.ok(errors.some((error) => error.includes("publishing")));
  assert.ok(errors.some((error) => error.includes("NSIS Web")));
  assert.ok(errors.some((error) => error.includes("custom NSIS")));
  assert.ok(errors.some((error) => error.includes("--publish never")));
});

test("installer policy rejects elevation, app-data deletion, and updater dependencies", () => {
  const state = createApprovedState();
  state.builderConfig.nsis.perMachine = true;
  state.builderConfig.nsis.packElevateHelper = true;
  state.builderConfig.nsis.deleteAppDataOnUninstall = true;
  state.packageJson.devDependencies["electron-updater"] = "6.6.2";

  const errors = validateInstallerPolicy(state);

  assert.ok(errors.some((error) => error.includes("per-user")));
  assert.ok(errors.some((error) => error.includes("elevation helper")));
  assert.ok(errors.some((error) => error.includes("preserve app data")));
  assert.ok(errors.some((error) => error.includes("updater")));
});

test("installer policy rejects mutable dependencies and an AppUserModelID set too late", () => {
  const state = createApprovedState();
  state.packageJson.devDependencies["electron-builder"] = "^26.15.7";
  state.mainSource = [
    "void app.whenReady();",
    'app.setAppUserModelId("com.ascend.desktop");',
  ].join("\n");

  const errors = validateInstallerPolicy(state);

  assert.ok(errors.some((error) => error.includes("exact electron-builder")));
  assert.ok(errors.some((error) => error.includes("before app.whenReady")));
});

test("installer artifacts contain only the offline installer", () => {
  assert.deepEqual(
    validateInstallerArtifactNames(["Ascend-Setup-0.0.0-x64.exe"]),
    [],
  );
  assert.deepEqual(
    validateInstallerArtifactNames([
      "Ascend-Setup-0.0.0-x64.exe",
      "Ascend-Setup-0.0.0-x64.exe.blockmap",
      "latest.yml",
    ]),
    [
      "Unexpected installer artifact: Ascend-Setup-0.0.0-x64.exe.blockmap",
      "Unexpected installer artifact: latest.yml",
    ],
  );
});
