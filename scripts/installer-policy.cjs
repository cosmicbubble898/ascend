const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_INSTALLER_POLICY = Object.freeze({
  appId: "com.ascend.desktop",
  electronBuilderVersion: "26.15.7",
  installerIncludePath: "build/installer.nsh",
  installerIncludeSha256:
    "6c3559730fce91e6756c2bb741075481de2f9b7ad2ee715f3400923b6c4aac52",
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
  include: EXPECTED_INSTALLER_POLICY.installerIncludePath,
});

const EXPECTED_INSTALLER_INCLUDE_CONTENT = [
  "!macro customUnInstall",
  '  Delete "$LOCALAPPDATA\\ascend-updater\\installer.exe"',
  '  RMDir "$LOCALAPPDATA\\ascend-updater"',
  "!macroend",
  "",
].join("\n");

const EXPECTED_BUILDER_ARGUMENTS = Object.freeze([
  "--prepackaged",
  "$proofInput",
  "--win",
  "nsis",
  "--x64",
  "--publish",
  "never",
  "--config",
  "electron-builder.config.cjs",
]);

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

function validateInstallerInclude(content) {
  if (content !== EXPECTED_INSTALLER_INCLUDE_CONTENT) {
    return [
      "The installer include must exactly match the approved non-recursive cleanup macro.",
    ];
  }
  return [];
}

function extractBuilderArguments(buildScript) {
  const source = buildScript ?? "";
  const invocationCount = (source.match(/&\s+\$builderExecutable\b/g) ?? [])
    .length;
  if (invocationCount !== 1) {
    return undefined;
  }

  const invocation = source.match(
    /&\s+\$builderExecutable\s*`?\r?\n([\s\S]*?)\r?\n\s*if\s*\(\$LASTEXITCODE\b/,
  );
  if (invocation === null) {
    return undefined;
  }

  return invocation[1]
    .replace(/`\r?\n/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token !== "`");
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
  if (hasOwn(nsis, "script")) {
    errors.push("A custom NSIS script is not approved.");
  }
  if (nsis.include !== EXPECTED_INSTALLER_POLICY.installerIncludePath) {
    errors.push(
      `The only approved NSIS include is ${EXPECTED_INSTALLER_POLICY.installerIncludePath}.`,
    );
  }

  const installerInclude = state.installerInclude ?? {};
  if (
    installerInclude.relativePath !==
    EXPECTED_INSTALLER_POLICY.installerIncludePath
  ) {
    errors.push("The installer include was not loaded from the approved path.");
  }
  if (
    installerInclude.sha256 !== EXPECTED_INSTALLER_POLICY.installerIncludeSha256
  ) {
    errors.push("The installer include SHA-256 is not approved.");
  }
  if (typeof installerInclude.content !== "string") {
    errors.push("The approved installer include content is unavailable.");
  } else {
    const calculatedSha256 = crypto
      .createHash("sha256")
      .update(installerInclude.content, "utf8")
      .digest("hex");
    if (calculatedSha256 !== installerInclude.sha256) {
      errors.push("The installer include content does not match its SHA-256.");
    }
    errors.push(...validateInstallerInclude(installerInclude.content));
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

  if (
    stableJson(extractBuilderArguments(state.buildScript)) !==
    stableJson(EXPECTED_BUILDER_ARGUMENTS)
  ) {
    errors.push(
      "Installer build must use exactly the approved arguments without additional overrides.",
    );
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
  const installerIncludePath = path.join(
    projectRoot,
    ...EXPECTED_INSTALLER_POLICY.installerIncludePath.split("/"),
  );
  const installerIncludeStat = fs.lstatSync(installerIncludePath);
  if (!installerIncludeStat.isFile() || installerIncludeStat.isSymbolicLink()) {
    throw new Error("The approved installer include must be a regular file.");
  }
  const installerIncludeContent = fs.readFileSync(installerIncludePath, "utf8");

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
    installerInclude: {
      relativePath: EXPECTED_INSTALLER_POLICY.installerIncludePath,
      content: installerIncludeContent,
      sha256: crypto
        .createHash("sha256")
        .update(installerIncludeContent, "utf8")
        .digest("hex"),
    },
  };
}

function runCli(arguments_) {
  const [command, directory] = arguments_;
  if (command === "repository" && directory !== undefined) {
    const errors = validateInstallerPolicy(
      loadInstallerPolicyState(path.resolve(directory)),
    );
    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }
    return;
  }
  if (command === "artifacts" && directory !== undefined) {
    const artifactNames = fs.readdirSync(directory);
    const errors = validateInstallerArtifactNames(artifactNames);
    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }
    return;
  }
  throw new Error(
    "Usage: installer-policy.cjs repository <project-root> | artifacts <output-directory>",
  );
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
  EXPECTED_INSTALLER_INCLUDE_CONTENT,
  EXPECTED_INSTALLER_POLICY,
  loadInstallerPolicyState,
  validateInstallerArtifactNames,
  validateInstallerInclude,
  validateInstallerPolicy,
};
