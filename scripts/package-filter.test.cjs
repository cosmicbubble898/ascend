const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { shouldIgnoreFromPackage } = require("./package-filter.cjs");
const { ELECTRON_FUSE_POLICY } = require("./electron-fuse-policy.cjs");

test("package filter accepts relative and rooted build paths", () => {
  for (const file of [
    "dist/shell/main/transcription-session.js",
    "dist/shell/main/login-startup.js",
    "dist/shell/main/background-tray.js",
    "dist/shell/main/clipboard-history.js",
    "dist/shell/main/transcription-state.js",
    "dist/shell/main/transcription-files.js",
    "dist/shell/main/worker-retirement.js",
    "dist/shell/main/productivity-session.js",
    "dist/shell/main/productivity-command.js",
    "dist/shell/main/productivity-extra-command.js",
    "dist/shell/productivity-contract.js",
    "dist/shell/clipboard-contract.js",
    "dist/shell/window-contract.js",
    "dist/shell/renderer",
    "dist/shell/renderer/app.js",
    "dist/shell/renderer/clipboard.js",
    "dist/shell/renderer/productivity.js",
  ])
    assert.equal(shouldIgnoreFromPackage(file), false, file);
  assert.equal(shouldIgnoreFromPackage("dist/shell/main/main.js"), false);
  assert.equal(shouldIgnoreFromPackage("/dist/shell/main/main.js"), false);
  assert.equal(shouldIgnoreFromPackage("dist/shell/main/"), false);
  assert.equal(shouldIgnoreFromPackage("shell/renderer/index.html"), false);
  assert.equal(shouldIgnoreFromPackage("/shell/renderer/styles.css"), false);
});

test("package filter excludes source, source maps, and unrelated files", () => {
  assert.equal(shouldIgnoreFromPackage("shell/main/main.ts"), true);
  assert.equal(shouldIgnoreFromPackage("shell/preload.ts"), true);
  assert.equal(shouldIgnoreFromPackage("dist/shell/main.js.map"), true);
  assert.equal(shouldIgnoreFromPackage("dist/shell/main/stale.js"), true);
  assert.equal(shouldIgnoreFromPackage("docs/SPEC.md"), true);
  assert.equal(shouldIgnoreFromPackage(".env"), true);
});

test("package main matches the TypeScript build output", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
  const buildConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "tsconfig.build.json"), "utf8"),
  );
  const sourceEntry = path.join("shell", "main", "main.ts");
  const emittedEntry = path
    .join(
      buildConfig.compilerOptions.outDir,
      path.relative(buildConfig.compilerOptions.rootDir, sourceEntry),
    )
    .replace(/\.ts$/, ".js")
    .replaceAll("\\", "/");

  assert.equal(packageJson.main, emittedEntry);
});

test("fuse policy keeps the unsupported browser-specific snapshot disabled", () => {
  assert.deepEqual(Object.keys(ELECTRON_FUSE_POLICY).sort(), [
    "EnableCookieEncryption",
    "EnableEmbeddedAsarIntegrityValidation",
    "EnableNodeCliInspectArguments",
    "EnableNodeOptionsEnvironmentVariable",
    "GrantFileProtocolExtraPrivileges",
    "LoadBrowserProcessSpecificV8Snapshot",
    "OnlyLoadAppFromAsar",
    "RunAsNode",
    "WasmTrapHandlers",
  ]);
  assert.equal(
    ELECTRON_FUSE_POLICY.LoadBrowserProcessSpecificV8Snapshot,
    false,
  );
});

test("the known-bad Squirrel route is not active", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const forgeConfig = require(path.join(projectRoot, "forge.config.cjs"));
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );

  assert.equal(
    packageJson.devDependencies["@electron-forge/maker-squirrel"],
    undefined,
  );
  assert.equal(packageJson.scripts.make, undefined);
  assert.equal(packageJson.scripts["prepare:squirrel"], undefined);
  assert.deepEqual(forgeConfig.makers, []);
  assert.deepEqual(forgeConfig.packagerConfig.extraResource, [
    path.join(projectRoot, "build", "engine", "ascend-engine"),
    path.join(projectRoot, "build", "ascend-runtime"),
  ]);
});
