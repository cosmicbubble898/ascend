const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Python commands use the pinned project-local uv toolchain", () => {
  const helper = readProjectFile("scripts/python-toolchain.ps1");
  const check = readProjectFile("scripts/check.ps1");
  const checkPython = readProjectFile("scripts/check-python.ps1");
  const buildEngine = readProjectFile("scripts/build-engine.ps1");

  assert.match(helper, /\.tools\\uv-0\.11\.29\\uv\.exe/);
  assert.match(helper, /runtime\\uv-python-0\.11\.29/);
  assert.match(helper, /runtime\\uv-cache-0\.11\.29/);
  assert.match(helper, /runtime\\python-env-0\.11\.29/);
  assert.match(helper, /Expected uv 0\.11\.29/);
  assert.match(check, /python-toolchain\.ps1/);
  assert.match(check, /Initialize-AscendPythonToolchain/);

  for (const script of [checkPython, buildEngine]) {
    assert.match(script, /python-toolchain\.ps1/);
    assert.match(script, /Initialize-AscendPythonToolchain/);
    assert.match(script, /& \$uvExecutable/);
    assert.doesNotMatch(script, /& uv(?:\s|`)/);
  }
});

test("Python bootstrap pins and verifies the approved uv archive", () => {
  const bootstrap = readProjectFile("scripts/bootstrap-python.ps1");

  assert.match(
    bootstrap,
    /https:\/\/github\.com\/astral-sh\/uv\/releases\/download\/0\.11\.29\/uv-x86_64-pc-windows-msvc\.zip/,
  );
  assert.match(
    bootstrap,
    /A047D55651BC3E0CA24595B25EC4CFCB10F9DCA9FB56514E661269B37D4FAE68/,
  );
  assert.match(bootstrap, /& \$uvExecutable python install 3\.13\.14/);
  assert.match(bootstrap, /& \$uvExecutable sync --locked/);
  assert.doesNotMatch(bootstrap, /\$PROFILE/);
  assert.doesNotMatch(bootstrap, /SetEnvironmentVariable/);
});
