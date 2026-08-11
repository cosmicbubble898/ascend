const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { resolveProofForArtifact } = require("./installer-evidence.cjs");

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function writeProof(proofRoot, name, artifactName, artifactHash) {
  const proofDirectory = path.join(proofRoot, name);
  fs.mkdirSync(proofDirectory);
  fs.writeFileSync(
    path.join(proofDirectory, "artifact-sha256.txt"),
    `${artifactHash.toUpperCase()}  ${artifactName}\n`,
  );
  fs.writeFileSync(
    path.join(proofDirectory, "prepackaged-before.json"),
    "[]\n",
  );
  return proofDirectory;
}

test("artifact evidence resolves one matching proof instead of the latest proof", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ascend-evidence-"));
  try {
    const artifactName = "Ascend-Setup-0.0.0-x64.exe";
    const artifactPath = path.join(root, artifactName);
    fs.writeFileSync(artifactPath, "reviewed installer");
    const expectedHash = sha256("reviewed installer");
    const proofRoot = path.join(root, "proofs");
    fs.mkdirSync(proofRoot);
    writeProof(
      proofRoot,
      "99999999-latest-wrong",
      artifactName,
      "0".repeat(64),
    );
    const matchingProof = writeProof(
      proofRoot,
      "20260810-matching",
      artifactName,
      expectedHash,
    );

    assert.equal(
      resolveProofForArtifact(proofRoot, artifactPath),
      matchingProof,
    );

    writeProof(proofRoot, "20260810-duplicate", artifactName, expectedHash);
    assert.throws(
      () => resolveProofForArtifact(proofRoot, artifactPath),
      /multiple proof runs match/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
