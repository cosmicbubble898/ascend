const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  EXPECTED_INSTALLER_POLICY,
  loadInstallerPolicyState,
  validateInstallerArtifactNames,
  validateInstallerInclude,
  validateInstallerPolicy,
} = require("./installer-policy.cjs");

const APPROVED_INSTALLER_INCLUDE = [
  "!macro customUnInstall",
  '  Delete "$LOCALAPPDATA\\ascend-updater\\installer.exe"',
  '  RMDir "$LOCALAPPDATA\\ascend-updater"',
  "!macroend",
  "",
].join("\n");

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
        include: "build/installer.nsh",
      },
    },
    buildScript: [
      "& $builderExecutable `",
      "  --prepackaged $proofInput `",
      "  --win nsis `",
      "  --x64 `",
      "  --publish never `",
      "  --config electron-builder.config.cjs",
      "if ($LASTEXITCODE -ne 0) {",
    ].join("\n"),
    mainSource: [
      'app.setAppUserModelId("com.ascend.desktop");',
      "void app.whenReady();",
    ].join("\n"),
    installerInclude: {
      relativePath: "build/installer.nsh",
      content: APPROVED_INSTALLER_INCLUDE,
      sha256:
        "6c3559730fce91e6756c2bb741075481de2f9b7ad2ee715f3400923b6c4aac52",
    },
  };
}

test("the exact non-recursive installer cleanup include is approved", () => {
  assert.deepEqual(validateInstallerInclude(APPROVED_INSTALLER_INCLUDE), []);
});

test("installer cleanup policy rejects every approved-boundary expansion", () => {
  const forbiddenMutations = new Map([
    ["recursive removal", ['  RMDir "', '  RMDir /r "']],
    ["reboot-delayed deletion", ['  Delete "', '  Delete /REBOOTOK "']],
    ["wildcard deletion", ["installer.exe", "*.exe"]],
    ["another NSIS variable", ["$LOCALAPPDATA", "$APPDATA"]],
    ["another cache path", ["ascend-updater", "other-cache"]],
    ["another macro", ["customUnInstall", "customInstall"]],
  ]);

  for (const [label, [approvedText, forbiddenText]] of forbiddenMutations) {
    const errors = validateInstallerInclude(
      APPROVED_INSTALLER_INCLUDE.replace(approvedText, forbiddenText),
    );
    assert.ok(errors.length > 0, `${label} must be rejected`);
  }
});

test("the approved installer policy accepts only the bounded NSIS proof", () => {
  assert.equal(EXPECTED_INSTALLER_POLICY.appId, "com.ascend.desktop");
  assert.deepEqual(validateInstallerPolicy(createApprovedState()), []);
});

test("installer policy rejects additional builder CLI overrides", () => {
  for (const unapprovedArgument of [
    "--config malicious.config.cjs",
    "--config.nsis.script malicious.nsh",
    "--win nsis-web",
  ]) {
    const state = createApprovedState();
    state.buildScript = state.buildScript.replace(
      "if ($LASTEXITCODE -ne 0) {",
      `${unapprovedArgument}\nif ($LASTEXITCODE -ne 0) {`,
    );

    assert.ok(
      validateInstallerPolicy(state).some((error) =>
        error.includes("approved arguments"),
      ),
      `${unapprovedArgument} must be rejected`,
    );
  }
});

test("the repository matches the approved installer policy", () => {
  const projectRoot = require("node:path").resolve(__dirname, "..");
  assert.deepEqual(
    validateInstallerPolicy(loadInstallerPolicyState(projectRoot)),
    [],
  );
});

test("installer build runs complete repository policy before packaging", () => {
  const projectRoot = require("node:path").resolve(__dirname, "..");
  const { buildScript } = loadInstallerPolicyState(projectRoot);
  const policyIndex = buildScript.indexOf(
    "& $nodeExecutable .\\scripts\\installer-policy.cjs repository $projectRoot",
  );
  const packageIndex = buildScript.indexOf("& npm run package");

  assert.ok(policyIndex >= 0, "repository policy preflight must be present");
  assert.ok(
    policyIndex < packageIndex,
    "repository policy preflight must run before packaging",
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
  assert.ok(errors.some((error) => error.includes("approved arguments")));
});

test("installer policy rejects any other include path or content hash", () => {
  const state = createApprovedState();
  state.builderConfig.nsis.include = "build/other.nsh";
  state.installerInclude.relativePath = "build/other.nsh";
  state.installerInclude.sha256 = "0".repeat(64);

  const errors = validateInstallerPolicy(state);

  assert.ok(
    errors.some((error) => error.includes("only approved NSIS include")),
  );
  assert.ok(errors.some((error) => error.includes("approved path")));
  assert.ok(errors.some((error) => error.includes("SHA-256")));
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
