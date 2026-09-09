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
    "/dist/shell/main/login-startup.js",
    "/dist/shell/main/background-tray.js",
    "/dist/shell/main/clipboard-history.js",
    "/dist/shell/main/window-options.js",
    "/dist/shell/main/transcription-session.js",
    "/dist/shell/main/transcription-state.js",
    "/dist/shell/main/transcription-files.js",
    "/dist/shell/main/worker-retirement.js",
    "/dist/shell/main/productivity-session.js",
    "/dist/shell/main/productivity-command.js",
    "/dist/shell/main/productivity-extra-command.js",
    "/dist/shell/renderer",
    "/dist/shell/renderer/app.js",
    "/dist/shell/renderer/clipboard.js",
    "/dist/shell/renderer/productivity.js",
    "/dist/shell/clipboard-contract.js",
    "/dist/shell/window-contract.js",
    "/dist/shell/preload.js",
    "/dist/shell/productivity-contract.js",
    "/package.json",
    "/shell",
    "/shell/renderer",
    "/shell/renderer/index.html",
    "/shell/renderer/ascend-logo-mark.png",
    "/shell/renderer/ascend-app-icon.png",
    "/shell/renderer/ascend-app-icon.ico",
    "/shell/renderer/styles.css",
  ]);

  return !allowedPaths.has(normalizedPath);
}

module.exports = { shouldIgnoreFromPackage };
