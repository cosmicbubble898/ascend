# NSIS installer cache-cleanup proof

**Status:** `go-local` for foundation development; not approved for outside distribution
**Executed:** 2026-08-05
**Environment:** Current development account, Windows build 26200 x64, medium-integrity token
**Scope:** Exact OD-16 unsigned local-only proof; no signing spend, publishing, updater, credentials, real data, outside testing, or deployment

This document preserves the 2026-08-05 proof. It has not been rewritten as current package evidence. The patched 2026-08-10 rerun is recorded in `docs/reviews/AUDIT-REMEDIATION-2026-08-10.md`.

## Decision

The exact OD-16 non-recursive NSIS cleanup route passed its bounded current-machine proof. The custom uninstaller deletes only `%LOCALAPPDATA%\ascend-updater\installer.exe` and then attempts to remove `%LOCALAPPDATA%\ascend-updater` without recursion. Normal uninstall removed the cached installer and empty directory. When a synthetic unexpected sentinel was present, uninstall removed the exact installer, preserved the sentinel, and left the non-empty directory. The harness then removed only its own sentinel and the resulting empty directory.

This is a `go-local` result for continuing the synthetic-data foundation and preparing Task 5's exact data-model specification. It is not release evidence. Clean standard-user Windows, representative managed environments, downloaded-artifact SmartScreen behavior, signing, outside testing, publishing, and deployment remain blocked.

## Exact implementation boundary

- `build/installer.nsh` contains only `customUnInstall`, one exact-file `Delete`, one non-recursive `RMDir`, and `!macroend`.
- The include's SHA-256 is `6C3559730FCE91E6756C2BB741075481DE2F9B7AD2EE715F3400923B6C4AAC52`.
- `electron-builder.config.cjs` names only `build/installer.nsh`; a custom full script remains forbidden.
- The fail-closed policy requires that exact relative path, content, and SHA-256.
- Structural tests reject `RMDir /r`, `/REBOOTOK`, wildcards, another NSIS variable, another cache path, another macro, another include path, and another content hash.
- Publishing remains `null`/`--publish never`; the build remains x64, offline NSIS, per-user, `asInvoker`, unsigned, without an elevation helper, updater dependency, blockmap, or update metadata.

## Build and integrity evidence

The accepted build completed its own post-build checks and left exactly one artifact:

| Artifact                     |       Bytes | SHA-256                                                            | Authenticode |
| ---------------------------- | ----------: | ------------------------------------------------------------------ | ------------ |
| `Ascend-Setup-0.0.0-x64.exe` | 103,489,817 | `FF1B4CF8293B88D18F16239C6BEBBC6456C363AE89EF68CDFC56A9B85D4BC668` | Not signed   |

- Packaged engine smoke passed with SHA-256 `206A6D64F0A051684F97175911277B086C0E8C72859A5DB0F17DD8D13491E5BD` and output `Ascend engine 0.0.0`.
- The prepackaged before/after manifests were identical; both evidence files have SHA-256 `DE1BCAD3C98BF42B628A79EB006CEA5FD97901BFCB0C3077C14F56D14E380A8F`.
- The reviewed electron-builder cache manifest retained SHA-256 `DA98A5EF7C1AFF51D67440E4D03F6F8A55DA9B2EAAA47DE9830C8086F2772039`.
- Builder debug evidence has SHA-256 `54B9511528F43FDD1D353F1A71D98320DA25F17E61B2F29E1FD126DEF298D8A0` and references the exact approved include.
- A first packaging invocation exceeded the command wrapper timeout immediately before post-build cleanup and was rejected as evidence because it left an intermediate archive. No child process remained. The exact build was rerun with sufficient time and passed its own one-artifact and integrity checks.

## Install, launch, retention, and cleanup evidence

The accepted smoke run is `20260805T084620620Z`.

- Installation from a copied path containing spaces and non-ASCII characters completed as the current user without elevation.
- Every installed application payload file matched the accepted prepackaged manifest.
- The Start Menu shortcut targeted installed `Ascend.exe` directly with no arguments.
- Two shortcut launches produced a visible window; native `WM_CLOSE` ended every Ascend process without force-kill.
- The installed sidecar returned `Ascend engine 0.0.0`.
- Normal uninstall removed the install root, shortcut, uninstall registry entry, cached installer, and now-empty updater-cache directory.
- A synthetic profile marker survived uninstall, proving application data was preserved.
- Reinstall succeeded.
- With a synthetic sentinel in the updater-cache directory, uninstall removed only the exact cached installer; the sentinel and non-empty directory survived.
- The harness removed only its synthetic marker/sentinel after recording the result. Final checks found no Ascend install root, updater cache, Start Menu shortcut, uninstall entry, or running Ascend process.

An earlier smoke run, `20260805T084403678Z`, was rejected because the harness checked the shortcut before asynchronous uninstall cleanup completed and assumed every transient registry object exposed `InstallLocation`. Post-failure inspection showed the machine was already clean. The harness was corrected to wait for install-root, shortcut, and registry cleanup and to read optional registry fields safely; the accepted rerun passed.

## Defender and quality evidence

Microsoft Defender was enabled with real-time protection, engine `1.1.26070.7`, and security intelligence `1.457.1.0`. Custom scans with remediation disabled reported no threats for the installer copy, unpacked package, and installed tree.

The complete quality gate passed:

- Python 3.13.14: lock check, Ruff format/lint, strict mypy, and 2 pytest tests.
- Electron/TypeScript: Prettier, ESLint, type-check, 3 Vitest tests, and build.
- Packaging policy: 5 package-filter tests, 10 installer-policy tests, and 3 package-manifest tests.
- PowerShell parser and `git diff --check` passed for the smoke-harness change.

The machine's prior global `uv 0.11.14` and managed Python 3.13.14 installation were unsuitable: the approved tool version was absent and standard-library files were missing or corrupt. With separate founder approval, official x64 `uv 0.11.29` was downloaded to an ignored project-local directory. Its archive matched Astral's published SHA-256 `A047D55651BC3E0CA24595B25EC4CFCB10F9DCA9FB56514E661269B37D4FAE68`. A fresh Python 3.13.14 runtime, cache, and locked development environment were created only under ignored project-local directories. No global profile/PATH or application dependency changed.

## Remaining release gates

- The artifact is intentionally unsigned and uses the default Electron icon.
- SmartScreen was not tested because the local artifact has no representative downloaded-file reputation path.
- Clean standard-user Windows and representative managed-environment evidence remain absent.
- Outside testing, publishing, updating, deployment, signing spend, real credentials, and real data remain prohibited.
- Byte-for-byte reproducible installer output is not established.
- The custom deletion boundary requires another security review against the final release artifact and installer version before distribution.
