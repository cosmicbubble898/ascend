module.exports = {
  appId: "com.ascend.desktop",
  productName: "Ascend",
  directories: {
    output: "out/nsis",
  },
  publish: null,
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    executableName: "Ascend",
    requestedExecutionLevel: "asInvoker",
    signExecutable: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    packElevateHelper: false,
    createDesktopShortcut: false,
    createStartMenuShortcut: true,
    runAfterFinish: false,
    deleteAppDataOnUninstall: false,
    differentialPackage: false,
    unicode: true,
    warningsAsErrors: true,
    shortcutName: "Ascend",
    artifactName: "Ascend-Setup-${version}-${arch}.${ext}",
  },
};
