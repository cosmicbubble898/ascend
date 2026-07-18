const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function toManifestPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function buildFileManifest(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const rootStats = fs.lstatSync(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("Manifest root must be a real directory.");
  }

  const records = [];
  const pendingDirectories = [root];
  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    for (const entry of fs.readdirSync(currentDirectory, {
      withFileTypes: true,
    })) {
      const entryPath = path.join(currentDirectory, entry.name);
      const stats = fs.lstatSync(entryPath);
      if (stats.isSymbolicLink()) {
        throw new Error(
          `Symbolic links and junctions are not allowed: ${toManifestPath(root, entryPath)}`,
        );
      }
      if (stats.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }
      if (!stats.isFile()) {
        throw new Error(
          `Unsupported package input: ${toManifestPath(root, entryPath)}`,
        );
      }
      records.push({
        path: toManifestPath(root, entryPath),
        size: stats.size,
        sha256: hashFile(entryPath),
      });
    }
  }

  return records.sort((left, right) => left.path.localeCompare(right.path));
}

function compareFileManifests(before, after) {
  const beforeByPath = new Map(before.map((record) => [record.path, record]));
  const afterByPath = new Map(after.map((record) => [record.path, record]));
  const allPaths = [
    ...new Set([...beforeByPath.keys(), ...afterByPath.keys()]),
  ].sort((left, right) => left.localeCompare(right));
  const changes = [];

  for (const filePath of allPaths) {
    const beforeRecord = beforeByPath.get(filePath);
    const afterRecord = afterByPath.get(filePath);
    if (beforeRecord === undefined) {
      changes.push(`added: ${filePath}`);
    } else if (afterRecord === undefined) {
      changes.push(`removed: ${filePath}`);
    } else if (
      beforeRecord.size !== afterRecord.size ||
      beforeRecord.sha256 !== afterRecord.sha256
    ) {
      changes.push(`changed: ${filePath}`);
    }
  }

  return changes;
}

function writeManifest(rootDirectory, outputPath) {
  const records = buildFileManifest(rootDirectory);
  fs.writeFileSync(outputPath, `${JSON.stringify(records, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

function readManifest(manifestPath) {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Manifest must contain an array.");
  }
  return parsed;
}

function runCli(arguments_) {
  const [command, ...argumentsList] = arguments_;
  if (command === "create" && argumentsList.length === 2) {
    writeManifest(argumentsList[0], argumentsList[1]);
    return;
  }
  if (command === "compare" && argumentsList.length === 2) {
    const changes = compareFileManifests(
      readManifest(argumentsList[0]),
      readManifest(argumentsList[1]),
    );
    if (changes.length > 0) {
      throw new Error(`Package input changed:\n${changes.join("\n")}`);
    }
    return;
  }
  throw new Error(
    "Usage: package-manifest.cjs create <root> <output> | compare <before> <after>",
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
  buildFileManifest,
  compareFileManifests,
  runCli,
};
