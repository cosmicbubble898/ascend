const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function assertRegularFile(filePath, label) {
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file.`);
  }
}

function parseArtifactHashRecord(content) {
  const match = content.match(/^([0-9a-f]{64}) {2}([^\r\n]+)\r?\n?$/i);
  if (match === null || path.basename(match[2]) !== match[2]) {
    throw new Error("Artifact hash record is malformed.");
  }
  return { sha256: match[1].toLowerCase(), fileName: match[2] };
}

function resolveProofForArtifact(proofRoot, artifactPath) {
  const resolvedProofRoot = path.resolve(proofRoot);
  const resolvedArtifact = path.resolve(artifactPath);
  const proofStats = fs.lstatSync(resolvedProofRoot);
  if (!proofStats.isDirectory() || proofStats.isSymbolicLink()) {
    throw new Error("Proof root must be a real directory.");
  }
  assertRegularFile(resolvedArtifact, "Installer artifact");

  const artifactName = path.basename(resolvedArtifact);
  const artifactHash = sha256File(resolvedArtifact);
  const matches = [];

  for (const entry of fs.readdirSync(resolvedProofRoot, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const proofDirectory = path.join(resolvedProofRoot, entry.name);
    const proofDirectoryStats = fs.lstatSync(proofDirectory);
    if (proofDirectoryStats.isSymbolicLink()) {
      throw new Error(
        `Proof directory must not be a symbolic link: ${entry.name}`,
      );
    }
    const hashRecordPath = path.join(proofDirectory, "artifact-sha256.txt");
    if (!fs.existsSync(hashRecordPath)) {
      continue;
    }
    assertRegularFile(hashRecordPath, "Artifact hash record");
    const record = parseArtifactHashRecord(
      fs.readFileSync(hashRecordPath, "utf8"),
    );
    if (record.fileName === artifactName && record.sha256 === artifactHash) {
      const manifestPath = path.join(proofDirectory, "prepackaged-before.json");
      assertRegularFile(manifestPath, "Prepackaged manifest");
      matches.push(proofDirectory);
    }
  }

  if (matches.length === 0) {
    throw new Error("No proof run matches the installer artifact SHA-256.");
  }
  if (matches.length > 1) {
    throw new Error(
      "Multiple proof runs match the installer artifact SHA-256.",
    );
  }
  return matches[0];
}

function runCli(arguments_) {
  const [command, proofRoot, artifactPath] = arguments_;
  if (
    command !== "resolve-proof" ||
    proofRoot === undefined ||
    artifactPath === undefined ||
    arguments_.length !== 3
  ) {
    throw new Error(
      "Usage: installer-evidence.cjs resolve-proof <proof-root> <artifact>",
    );
  }
  process.stdout.write(`${resolveProofForArtifact(proofRoot, artifactPath)}\n`);
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
  parseArtifactHashRecord,
  resolveProofForArtifact,
  runCli,
};
