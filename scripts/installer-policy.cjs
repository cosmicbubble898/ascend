const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_INSTALLER_POLICY = Object.freeze({
  appId: "com.ascend.desktop",
  electronBuilderVersion: "26.15.7",
  outputDirectory: "out/nsis",
});

const EXPECTED_NSIS = Object.freeze({
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
});

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value ?? {}, key);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateInstallerPolicy(state) {
  const errors = [];
  const packageJson = state.packageJson ?? {};
  const builderConfig = state.builderConfig ?? {};
  const nsis = builderConfig.nsis ?? {};
  const win = builderConfig.win ?? {};
  const allDependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  };

  if (
    packageJson.devDependencies?.["electron-builder"] !==
    EXPECTED_INSTALLER_POLICY.electronBuilderVersion
  ) {
    errors.push(
      "Use the exact electron-builder 26.15.7 development dependency.",
    );
  }
  if (hasOwn(allDependencies, "electron-updater")) {
    errors.push("An updater dependency is not approved for this proof.");
  }
  if (hasOwn(allDependencies, "@electron-forge/maker-squirrel")) {
    errors.push("The known-bad Squirrel route must remain disabled.");
  }
  if (packageJson.private !== true) {
    errors.push(
      "The proof project must remain private to prevent npm publishing.",
    );
  }
  if (
    !Array.isArray(state.forgeConfig?.makers) ||
    state.forgeConfig.makers.length !== 0
  ) {
    errors.push(
      "Forge makers must remain empty; NSIS wraps prepackaged output only.",
    );
  }

  if (builderConfig.appId !== EXPECTED_INSTALLER_POLICY.appId) {
    errors.push("The stable installer appId must be com.ascend.desktop.");
  }
  if (builderConfig.productName !== "Ascend") {
    errors.push("The installer productName must be Ascend.");
  }
  if (
    builderConfig.directories?.output !==
    EXPECTED_INSTALLER_POLICY.outputDirectory
  ) {
    errors.push("The installer output must remain under out/nsis.");
  }
  if (builderConfig.publish !== null) {
    errors.push("Installer publishing must be explicitly disabled with null.");
  }
  if (hasOwn(builderConfig, "nsisWeb")) {
    errors.push("NSIS Web configuration is not approved.");
  }
  if (
    stableJson(win.target) !== stableJson([{ target: "nsis", arch: ["x64"] }])
  ) {
    errors.push(
      "Only the offline x64 NSIS target is approved; NSIS Web is forbidden.",
    );
  }
  if (win.executableName !== "Ascend") {
    errors.push("The installed executable name must be Ascend.");
  }
  if (win.requestedExecutionLevel !== "asInvoker") {
    errors.push("The application must run asInvoker without elevation.");
  }
  if (win.signExecutable !== false) {
    errors.push("Executable signing must remain disabled for the local proof.");
  }
  if (hasOwn(nsis, "script") || hasOwn(nsis, "include")) {
    errors.push("A custom NSIS script or include is not approved.");
  }
  if (nsis.perMachine !== false) {
    errors.push("The proof must remain a per-user install.");
  }
  if (nsis.packElevateHelper !== false) {
    errors.push("The NSIS elevation helper must not be packaged.");
  }
  if (nsis.deleteAppDataOnUninstall !== false) {
    errors.push("Uninstall must preserve app data.");
  }
  if (stableJson(nsis) !== stableJson(EXPECTED_NSIS)) {
    errors.push(
      "NSIS options differ from the approved fail-closed configuration.",
    );
  }

  const requiredBuildTokens = [
    "--prepackaged",
    "--win nsis",
    "--x64",
    "--publish never",
    "--config electron-builder.config.cjs",
  ];
  for (const token of requiredBuildTokens) {
    if (!state.buildScript?.includes(token)) {
      errors.push(`Installer build script must include ${token}.`);
    }
  }
  if (/--publish\s+(?!never\b)\S+/i.test(state.buildScript ?? "")) {
    errors.push("Installer build script must use --publish never.");
  }

  const identityCall = `app.setAppUserModelId("${EXPECTED_INSTALLER_POLICY.appId}")`;
  const identityIndex = state.mainSource?.indexOf(identityCall) ?? -1;
  const readyIndex = state.mainSource?.search(/app\s*\.\s*whenReady/) ?? -1;
  if (identityIndex < 0 || readyIndex < 0 || identityIndex > readyIndex) {
    errors.push("Set the approved AppUserModelID before app.whenReady.");
  }

  return [...new Set(errors)];
}

function validateInstallerArtifactNames(fileNames) {
  const expectedName = "Ascend-Setup-0.0.0-x64.exe";
  const errors = [];
  for (const fileName of [...fileNames].sort((left, right) =>
    left.localeCompare(right),
  )) {
    if (fileName !== expectedName) {
      errors.push(`Unexpected installer artifact: ${fileName}`);
    }
  }
  if (!fileNames.includes(expectedName)) {
    errors.push(`Missing installer artifact: ${expectedName}`);
  }
  return errors;
}

function loadInstallerPolicyState(projectRoot) {
  return {
    packageJson: JSON.parse(
      fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
    ),
    forgeConfig: require(path.join(projectRoot, "forge.config.cjs")),
    builderConfig: require(
      path.join(projectRoot, "electron-builder.config.cjs"),
    ),
    buildScript: fs.readFileSync(
      path.join(projectRoot, "scripts", "build-installer.ps1"),
      "utf8",
    ),
    mainSource: fs.readFileSync(
      path.join(projectRoot, "shell", "main", "main.ts"),
      "utf8",
    ),
  };
}

function runCli(arguments_) {
  const [command, directory] = arguments_;
  if (command !== "artifacts" || directory === undefined) {
    throw new Error("Usage: installer-policy.cjs artifacts <output-directory>");
  }
  const artifactNames = fs.readdirSync(directory);
  const errors = validateInstallerArtifactNames(artifactNames);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  EXPECTED_INSTALLER_POLICY,
  loadInstallerPolicyState,
  validateInstallerArtifactNames,
  validateInstallerPolicy,
};
