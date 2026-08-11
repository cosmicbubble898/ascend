const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Node and Electron versions match the approved patched toolchain", () => {
  const packageJson = JSON.parse(readProjectFile("package.json"));

  assert.equal(packageJson.engines.node, "22.23.2");
  assert.equal(packageJson.packageManager, "npm@10.9.8");
  assert.equal(packageJson.devDependencies.electron, "43.3.0");
  assert.equal(packageJson.devDependencies["@electron-forge/cli"], "7.11.2");
  assert.equal(packageJson.devDependencies["electron-builder"], "26.15.7");
  assert.deepEqual(packageJson.overrides, { tar: "7.5.22" });
});

test("every Node entry script requires the same project-local version", () => {
  const scripts = [
    "scripts/bootstrap-node.ps1",
    "scripts/check.ps1",
    "scripts/build-installer.ps1",
    "scripts/test-installer.ps1",
  ];

  for (const relativePath of scripts) {
    const script = readProjectFile(relativePath);
    assert.match(script, /22\.23\.2/);
    assert.doesNotMatch(script, /22\.23\.1/);
  }

  const bootstrap = readProjectFile("scripts/bootstrap-node.ps1");
  assert.match(
    bootstrap,
    /1177B4137BA5ADAA56354AE40F1080C7450E8AE09CECB47DA459D1C52AC99F97/,
  );
  const hashVerificationIndex = bootstrap.indexOf("$actualHash =");
  const extractionDecisionIndex = bootstrap.indexOf(
    "if (-not (Test-Path -LiteralPath $nodeExecutable",
  );
  assert.ok(
    hashVerificationIndex >= 0 &&
      extractionDecisionIndex >= 0 &&
      hashVerificationIndex < extractionDecisionIndex,
    "the archive hash must be verified before deciding whether extraction is needed",
  );
});
