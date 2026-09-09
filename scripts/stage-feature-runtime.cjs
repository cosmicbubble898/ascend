// Stage only installed code/assets. Never collect vaults, recordings, QA or logs.
const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { shouldIgnoreFromPackage } = require("./package-filter.cjs");
const root = path.resolve(__dirname, "..");
const target = path.join(root, "build", "ascend-runtime");
const directories = [
  "src/ascend_engine",
  "runtime/uv-python-0.11.29/cpython-3.13.14-windows-x86_64-none",
  "runtime/parakeet-env/Lib/site-packages",
  "runtime/parakeet-model",
];
const files = [
  "scripts/parakeet-sandbox.py",
  "scripts/parakeet-worker.py",
  "scripts/productivity-entry.py",
  "docs/proposals/parakeet-model-manifest.json",
  "docs/proposals/parakeet-worker-requirements.lock",
  "docs/PARAKEET-NOTICES.md",
];
async function copy(source, destination) {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink())
    throw new Error("Runtime staging rejects linked paths");
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    for (const name of await fs.readdir(source)) {
      if (name === "__pycache__" || name.endsWith(".pyc")) continue;
      await copy(path.join(source, name), path.join(destination, name));
    }
  } else {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  }
}
async function stage() {
  // Follow compiled local imports so newly shared contracts cannot disappear silently.
  const seen = new Set();
  async function verifyImports(relative) {
    if (seen.has(relative)) return;
    seen.add(relative);
    if (shouldIgnoreFromPackage(relative))
      throw new Error(`Required compiled module excluded: ${relative}`);
    const source = await fs.readFile(path.join(root, relative), "utf8");
    for (const match of source.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
      await verifyImports(
        path.normalize(path.join(path.dirname(relative), match[1] + ".js")),
      );
    }
  }
  for (const entry of [
    "dist/shell/main/main.js",
    "dist/shell/preload.js",
    "dist/shell/renderer/app.js",
    "dist/shell/renderer/clipboard.js",
    "dist/shell/renderer/productivity.js",
  ])
    await verifyImports(entry);
  // A fixed generated directory with a verified real parent; never follow a junction.
  const build = await fs.realpath(path.join(root, "build"));
  if (build !== path.join(root, "build"))
    throw new Error("Unsafe build directory");
  const existing = await fs.lstat(target).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (existing?.isSymbolicLink()) throw new Error("Unsafe staging directory");
  if (existing) await fs.rm(target, { recursive: true });
  for (const relative of [...directories, ...files]) {
    const source = path.join(root, relative);
    if ((await fs.realpath(source)) !== source)
      throw new Error("Unsafe runtime source");
    await copy(source, path.join(target, relative));
  }
  const manifest = JSON.parse(
    await fs.readFile(path.join(target, files[3]), "utf8"),
  );
  // The production worker also verifies these pinned assets before opening audio.
  const entries = Array.isArray(manifest.files)
    ? manifest.files
    : Object.values(manifest.files);
  for (const entry of entries) {
    const name = entry.name ?? entry.path;
    if (typeof name !== "string" || path.basename(name) !== name)
      throw new Error("Invalid model asset");
    const file = path.join(target, "runtime/parakeet-model", name);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    if (
      (await fs.stat(file)).size !== entry.bytes ||
      hash.digest("hex") !== entry.sha256
    )
      throw new Error("Model integrity failed");
  }
  console.log("Feature runtime staged and model hashes verified");
}
stage().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
