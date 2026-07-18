const path = require("node:path");

const { ELECTRON_FUSE_POLICY } = require("./scripts/electron-fuse-policy.cjs");
const { shouldIgnoreFromPackage } = require("./scripts/package-filter.cjs");

const APP_EXECUTABLE = "Ascend.exe";

async function hardenAndVerifyPackage(outputPath) {
  const {
    flipFuses,
    FuseState,
    FuseV1Options,
    FuseVersion,
    getCurrentFuseWire,
  } = await import("@electron/fuses");
  const executablePath = path.join(outputPath, APP_EXECUTABLE);
  const fuseSettings = {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: ELECTRON_FUSE_POLICY.RunAsNode,
    [FuseV1Options.EnableCookieEncryption]:
      ELECTRON_FUSE_POLICY.EnableCookieEncryption,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]:
      ELECTRON_FUSE_POLICY.EnableNodeOptionsEnvironmentVariable,
    [FuseV1Options.EnableNodeCliInspectArguments]:
      ELECTRON_FUSE_POLICY.EnableNodeCliInspectArguments,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:
      ELECTRON_FUSE_POLICY.EnableEmbeddedAsarIntegrityValidation,
    [FuseV1Options.OnlyLoadAppFromAsar]:
      ELECTRON_FUSE_POLICY.OnlyLoadAppFromAsar,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]:
      ELECTRON_FUSE_POLICY.LoadBrowserProcessSpecificV8Snapshot,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]:
      ELECTRON_FUSE_POLICY.GrantFileProtocolExtraPrivileges,
    [FuseV1Options.WasmTrapHandlers]: ELECTRON_FUSE_POLICY.WasmTrapHandlers,
    strictlyRequireAllFuses: true,
  };

  await flipFuses(executablePath, fuseSettings);
  const actualSettings = await getCurrentFuseWire(executablePath);

  for (const fuseOption of Object.values(FuseV1Options).filter(
    (value) => typeof value === "number",
  )) {
    const expectedState = fuseSettings[fuseOption]
      ? FuseState.ENABLE
      : FuseState.DISABLE;
    if (actualSettings[fuseOption] !== expectedState) {
      throw new Error(
        `Packaged fuse verification failed for ${FuseV1Options[fuseOption]}.`,
      );
    }
  }
}

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "Ascend",
    extraResource: [path.join(__dirname, "build", "engine", "ascend-engine")],
    ignore: shouldIgnoreFromPackage,
    overwrite: true,
    prune: true,
  },
  makers: [],
  hooks: {
    postPackage: async (_forgeConfig, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        await hardenAndVerifyPackage(outputPath);
      }
    },
  },
};
