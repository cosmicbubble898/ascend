function normalizePackagePath(candidatePath) {
  const slashSeparatedPath = candidatePath.replaceAll("\\", "/");
  if (slashSeparatedPath === "") {
    return "";
  }

  return `/${slashSeparatedPath.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function shouldIgnoreFromPackage(candidatePath) {
  const normalizedPath = normalizePackagePath(candidatePath);
  const allowedPaths = new Set([
    "",
    "/dist",
    "/dist/shell",
    "/dist/shell/main",
    "/dist/shell/main/application-resource.js",
    "/dist/shell/main/main.js",
    "/dist/shell/main/window-options.js",
    "/dist/shell/preload.js",
    "/package.json",
    "/shell",
    "/shell/renderer",
    "/shell/renderer/index.html",
    "/shell/renderer/styles.css",
  ]);

  return !allowedPaths.has(normalizedPath);
}

module.exports = { shouldIgnoreFromPackage };
