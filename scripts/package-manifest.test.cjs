const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  buildFileManifest,
  compareFileManifests,
} = require("./package-manifest.cjs");

test("package manifest is sorted and records relative path, size, and SHA-256", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ascend-manifest-"));
  try {
    fs.mkdirSync(path.join(root, "nested"));
    fs.writeFileSync(path.join(root, "z.txt"), "z");
    fs.writeFileSync(path.join(root, "nested", "a.txt"), "ascend");

    assert.deepEqual(buildFileManifest(root), [
      {
        path: "nested/a.txt",
        size: 6,
        sha256:
          "2ea802eeb4485cf32398e8fa1c85d0be431cfa53e21c8cae1e413c628eef2c0c",
      },
      {
        path: "z.txt",
        size: 1,
        sha256:
          "594e519ae499312b29433b7dd8a97ff068defcba9755b6d5d00e84c524d67b06",
      },
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("package manifest comparison detects added, removed, and changed files", () => {
  const before = [
    { path: "changed.exe", size: 10, sha256: "before" },
    { path: "removed.dll", size: 20, sha256: "same" },
  ];
  const after = [
    { path: "added.exe", size: 30, sha256: "new" },
    { path: "changed.exe", size: 11, sha256: "after" },
  ];

  assert.deepEqual(compareFileManifests(before, after), [
    "added: added.exe",
    "changed: changed.exe",
    "removed: removed.dll",
  ]);
  assert.deepEqual(compareFileManifests(before, before), []);
});

test("package manifest rejects symbolic-link inputs", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ascend-manifest-"));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "ascend-target-"));
  try {
    fs.writeFileSync(path.join(target, "outside.txt"), "outside");
    try {
      fs.symlinkSync(target, path.join(root, "linked"), "junction");
    } catch (error) {
      if (error && error.code === "EPERM") {
        context.skip("Creating a junction is not permitted on this machine.");
        return;
      }
      throw error;
    }

    assert.throws(
      () => buildFileManifest(root),
      /symbolic links and junctions are not allowed/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});
