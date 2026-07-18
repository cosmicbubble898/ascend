# NSIS installer proof

**Status:** `no-go` for the standard electron-builder NSIS route under the approved uninstall criteria
**Executed:** 2026-07-19
**Environment:** Current development account, Windows build 26200 x64, medium-integrity token
**Scope:** Unsigned local-only proof; no publishing, updater dependency, credentials, real user data, outside distribution, or deployment

## Decision

The exact OD-14 proof successfully built, installed, launched, exited, uninstalled, and reinstalled Ascend. It is still a `no-go` because the standard electron-builder NSIS template copies the full installer to:

```text
%LOCALAPPDATA%\ascend-updater\installer.exe
```

That 103,486,925-byte unsigned executable remained after both silent uninstall cycles. Its SHA-256 matched the reviewed installer exactly:

```text
8DF62838C22FBF963FF919FBC0CF8CAD6E01F8A635D21FF719B064CA010F38AC
```

This violates the approved requirement that uninstall leave no executable/updater residue. The residue is retained locally as failure evidence. No other installed payload, shortcut, uninstall registry entry, process, service, scheduled task, startup entry, desktop shortcut, protocol, or file association remained.

Task 4 therefore has no passing installer route. Do not distribute this artifact or proceed to Task 5 until OD-16 is approved and its bounded proof passes.

## What passed

### Build and policy

- Exact `electron-builder@26.15.7` is a development dependency locked by `package-lock.json`.
- npm lifecycle scripts remained blocked by `.npmrc` and the explicit install command.
- The installed 26.15.7 schema accepted every approved config field.
- Forge remained the application packager with `makers: []`; electron-builder received only `--prepackaged` output.
- The stable Windows identity is `com.ascend.desktop`; the shell sets it before `app.whenReady()`.
- The proof was x64, offline NSIS, current-user, `asInvoker`, unsigned, and `--publish never`.
- `publish: null` stopped repository auto-detection. `differentialPackage: false` stopped blockmaps and update metadata.
- A fail-closed artifact check left exactly `Ascend-Setup-0.0.0-x64.exe` in `out/nsis`.
- The prepackaged input manifest was identical before and after wrapping. Both manifest files had SHA-256 `4F3509F63D80144DA1A8E1CD8BC06D0A8ADBA00CD4717B778CA3FED1D7096FF7`.
- Every installed application-payload file matched the prepackaged manifest by relative path, size, and SHA-256. The only installer-owned addition inside the install root was `Uninstall Ascend.exe`.
- The final project-scoped tool-cache manifest had SHA-256 `DA98A5EF7C1AFF51D67440E4D03F6F8A55DA9B2EAAA47DE9830C8086F2772039`.
- An offline repeat used the reviewed cache and showed no tool download. The debug proof explicitly logged cache hits for 7-Zip, NSIS resources, and NSIS.
- The final repository gate passed 2 pytest tests, 3 Vitest tests, 5 package-filter tests, 7 installer-policy tests, and 3 manifest tests, plus Ruff, strict mypy, Prettier, ESLint, TypeScript type-checking, and the shell build.

The first controlled build stopped because electron-builder's defaults generated a blockmap and inferred the GitHub repository despite `--publish never`; nothing was uploaded. Tests and configuration were tightened before continuing. No later build generated a blockmap, update file, or publish configuration.

### Install and launch

- Preflight found no conflicting NSIS install, process, shortcut, updater cache, or uninstall registry entry.
- The installer ran from a copied path containing spaces and non-ASCII characters.
- The parent process had a medium-integrity token; the silent current-user install completed without an elevation request.
- Payload installed under `%LOCALAPPDATA%\Programs\Ascend`, not `Program Files`.
- The Start Menu shortcut targeted the installed `Ascend.exe` directly, with no arguments or launcher stub.
- Launching through the real shortcut created a visible window twice.
- Native `WM_CLOSE` ended every Ascend Electron process after each launch; no force-kill was needed.
- The installed sidecar returned `Ascend engine 0.0.0`.
- No desktop shortcut, service, scheduled task, startup entry, protocol, or file association was created.

### Uninstall and retention

- The installed payload, uninstaller, Start Menu shortcut, and HKCU uninstall entry were removed.
- The install directory was removed after each uninstall.
- A clearly named synthetic profile marker remained after uninstall, proving `deleteAppDataOnUninstall: false`; the harness then removed only that marker.
- Reinstall succeeded, preserved the stable identity, and the second uninstall again removed the program files.
- **Failure:** `%LOCALAPPDATA%\ascend-updater\installer.exe` remained after uninstall.

### Defender and signing

Microsoft Defender was enabled with real-time protection, engine `1.1.26060.3008`, and security intelligence `1.455.200.0`. Custom scans with remediation disabled found no threats in:

- the installer copied to the spaces/non-ASCII path;
- the unpacked Forge package; and
- the installed tree, including its uninstaller.

The installer and retained installer copy both reported `NotSigned`, as required for this local proof. SmartScreen was not tested because the artifact is local, unsigned, and has no Mark-of-the-Web.

These are observations from one development machine, not clean-machine, managed-environment, SmartScreen, or outside-distribution evidence.

## Reproducibility observation

Two end-to-end builds differed only in PyInstaller's generated `ascend-engine.exe` and `base_library.zip` inside the prepackaged input. A separate control wrapped the exact same frozen prepackaged directory twice. Both installers were 103,486,925 bytes, but their SHA-256 values differed:

```text
8DF62838C22FBF963FF919FBC0CF8CAD6E01F8A635D21FF719B064CA010F38AC
B32670267CF9918B3DA8BE49E3A318260D5EB5642203D298CF36084B2DC607DC
```

There were 26,244 differing bytes. Therefore byte-for-byte reproducible NSIS output is not established. This does not explain or excuse the uninstall residue; release provenance and signing would still need a separately approved deterministic-input and artifact-attestation process.

## Supply-chain record

### npm resolution

- `electron-builder@26.15.7`: MIT, exact npm integrity `sha512-DBpaNzxsPs1BvEblzFoNriSbzsBqDCy/gseIngeEhYzQG1IxfB7Hvc2tBBVmpWE2BTQGP9J1RrAvDT+Vc/uAxg==`.
- 129 lockfile package entries were added.
- Added license declarations: MIT 90, ISC 13, BlueOak-1.0.0 13, BSD-3-Clause 4, Apache-2.0 3, BSD-2-Clause 2, Python-2.0 1, and four permissive WTFPL combinations.
- Registry verification passed for 705 packages; 112 packages had verified attestations.
- Runtime npm audit remained 0 vulnerabilities.
- The full development graph remained at the pre-existing Forge-toolchain baseline of 18 high and 3 low findings; adding electron-builder did not increase those counts.
- electron-builder resolved `app-builder-lib@26.15.7`, `@electron/rebuild@4.2.0`, and `tar@7.5.20`. The older vulnerable `tar` chain remains confined to the pre-existing Forge development path.

The resolved graph did not contain the proposal's previously observed `app-builder-bin` or `7zip-bin` packages. Instead, pinned electron-builder source downloaded three checksum-verified tool archives into the project-scoped cache:

| Archive | Source URL derived from pinned 26.15.7 source | SHA-256 |
| --- | --- | --- |
| `7zip-win-x64.tar.gz` | `https://github.com/electron-userland/electron-builder-binaries/releases/download/7zip@1.0.0/7zip-win-x64.tar.gz` | `be071f15bd6da2f78fe81c6ddef2009b0c4d8a51f36b780cb806c7e6df95e1b3` |
| `nsis-3.0.4.1.7z` | `https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z` | `9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa` |
| `nsis-resources-3.4.1.7z` | `https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-resources-3.4.1/nsis-resources-3.4.1.7z` | `593a9a92ef958321293ac6a2ee61e64bf1bd543142a5bd6b3d310709cc924103` |

The downloaded archive hashes matched the checksums embedded in the exact installed source.

### Blocked lifecycle script and vendored binaries

`electron-builder-squirrel-windows@26.15.7` brings `electron-winstaller@5.4.0` as an inactive peer dependency. It was the only added package with an npm lifecycle script. The blocked script merely selects a host-architecture 7-Zip pair by copying vendored files; it was never executed. The Squirrel target is not configured and no Squirrel/updater binary entered the Ascend application payload.

The inactive package nevertheless contributes binary files to development-only `node_modules`; their recorded hashes are:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `7z-arm64.dll` | 1,586,176 | `c167dbedd388718c70c921eeeac825492733f76107190dc1ba17801c79da879e` |
| `7z-arm64.exe` | 487,936 | `65d0dcc70753ff3efd4631ac784d35ea5c22df7bd6fe2265a04382a7043d1512` |
| `7z-x64.dll` | 1,609,216 | `9ed007aa82e440ceb39a6e105bb1d602a9bc59a4946267ba8de2f220aa15bc06` |
| `7z-x64.exe` | 446,976 | `c7245e21a7553d9e52d434002a401c77a7ca7d0f245f2311b0ddf16f8f946c6f` |
| `candle.exe` | 28,672 | `310584b7170f81e7c21733628e5d46f28f6a9b900f94368f1b943d6e4bbd3253` |
| `light.exe` | 32,768 | `6b441eb98b2771d6cb51de7d3e1b2eaf8c6cd045b4ef7bb1a26f297295d96100` |
| `Microsoft.Deployment.Resources.dll` | 45,056 | `71d85bb2863f61ca11625e8bee171114047d3f3e95792309e2040f3e139baae3` |
| `Microsoft.Deployment.WindowsInstaller.dll` | 176,128 | `ca420fef4909c10e2e95c8c899fa7d009892dddf0b2424870236f1d0676e9165` |
| `nuget.exe` | 1,664,000 | `61704f7dbe233980992f2a00ef9baacf64a8b157d688a4a4be6b7a2eaea02828` |
| `rcedit.exe` | 152,576 | `e2df7b664db830f159d0dc6b3da8a95442cca175b9577f2d19952646d37ac32f` |
| `Setup.exe` | 223,232 | `1e47eb606dad4c5c1568cfb8f4e970e1051ba5806aedb1ff3256284a8280d83b` |
| `signtool.exe` | 237,392 | `92a0afe94ccebcd877c3c7b05e80e8ad748f2c64959c431b88e7a7a1e5ce115f` |
| `Squirrel.com` | 7,680 | `597374496251a59a75a18159007097317275fd8944883863617a4f051ab8061a` |
| `Squirrel.exe` | 1,899,520 | `76359cd4b0349a83337b941332ad042c90351c2bb0a4628307740324c97984cc` |
| `Squirrel-Mono.exe` | 1,856,000 | `81591699f7f156dc15f4e188fd132e01369352043511e758513dba59b19ac920` |
| `StubExecutable.exe` | 288,768 | `d823e6d954f7e445fbbb5c04e40a39cf248a3621f9eccbafdf3f0f1e7acb11dd` |
| `SyncReleases.exe` | 1,892,864 | `c2a2c78e0912a6576517fc69ffd32793134f1a5b2b066279de3757c76c501548` |
| `wconsole.dll` | 20,480 | `490e29aa66c82487f79412df651c9e2a34d764fdf0b00b76944b63e9e6b780e3` |
| `winterop.dll` | 115,712 | `9dfae44e99488add680ae6f7801283d45898baf48a7486c2a1adf8c105f6941d` |
| `wix.dll` | 1,748,992 | `4b3cf980a840f3e36d98fef3b4d4c302313ac7e2ea3310f5d0d71722853975c7` |
| `WixNetFxExtension.dll` | 352,256 | `2edb4170c88c87547b8fb9bbce09e1ea202595331a06bedc3164326b3a84cdcb` |
| `WriteZipToSetup.exe` | 112,128 | `9278fe28ac434fde0be3a10788dc13ad92a28940ed70a52f86d9d69435599349` |

## Root cause from pinned source

In the exact installed `app-builder-lib@26.15.7` source:

1. `NsisTarget.configureDefinesForAllTypeOfInstaller` always defines `APP_INSTALLER_STORE_FILE` for the normal offline installer as `<sanitized-name>-updater\installer.exe`.
2. The standard `templates/nsis/include/installer.nsh` copies `$EXEPATH` to `$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}`.
3. The standard uninstaller has no corresponding removal of that updater-cache file.

This is intentional support for electron-builder's updater ecosystem, even though Ascend has no updater dependency and generated no update metadata. The behavior cannot be disabled through the approved standard NSIS configuration.

## Stop action and next decision

Per the approved fallback rules, no custom NSIS macro was added automatically. `docs/WINDOWS-INSTALLER-CLEANUP-PROPOSAL.md` defines the smallest reviewed next proof. OD-16 must be approved before that custom include is created or executed.

Clean Windows and managed-environment testing were not run because the development-machine proof already hit a defined stop condition. Signing, SmartScreen, outside testing, and distribution remain blocked.
