# Foundation audit remediation review — 2026-08-10

**Status:** `go-local` for continued synthetic-data foundation work; release qualification remains open
**Scope:** Exact founder-approved `docs/AUDIT-REMEDIATION-PROPOSAL.md` only
**Environment:** Current development account, Windows build 26200 x64, medium-integrity token

## Result

R1–R6 passed without crossing a stop condition. The current local foundation uses Node `22.23.2`, npm `10.9.8`, Electron `43.3.0`, Forge `7.11.2`, electron-builder `26.15.7`, uv `0.11.29`, and Python `3.13.14`. The previous `20260805` installer proof remains unchanged historical evidence; the current artifact is bound to a new dated build and smoke run.

This result permits continued local synthetic-data work only. The installer is unsigned and unpublished. It is not clean-machine, managed-environment, SmartScreen, signing, outside-testing, real-data, or deployment evidence. It authorizes no updater, provider, credential, model, screenshot, agent, integration, or Task 6 implementation.

## Remediation evidence

- Node's official `node-v22.23.2-win-x64.zip` was verified against SHA-256 `1177B4137BA5ADAA56354AE40F1080C7450E8AE09CECB47DA459D1C52AC99F97`; the archive contains npm `10.9.8`.
- Electron is locked exactly at `43.3.0`. Forge remains exact `7.11.2`, and electron-builder remains exact `26.15.7`.
- Every resolved `tar` instance is `7.5.22` through the one approved root override. Clean `npm ci --ignore-scripts`, Forge packaging, fuse verification, ASAR inspection, electron-builder wrapping, install, and uninstall all passed with that override.
- The complete repository installer policy now runs before packaging. Tests reject extra `--config`, `--config.nsis.script`, and `--win` overrides and require one exact normalized builder invocation.
- The smoke harness resolves the unique proof whose artifact filename and SHA-256 match the installer under test. It validates the proof hash file and retains a full installed-tree manifest.
- The intended Unicode source directory is `source path Ünicode`; the character is U+00DC on disk. The prior mojibake path cannot satisfy the new assertion.
- The project-local uv archive was verified against SHA-256 `A047D55651BC3E0CA24595B25EC4CFCB10F9DCA9FB56514E661269B37D4FAE68`. The normal quality and engine-build commands select `.tools/uv-0.11.29/uv.exe` plus project-local Python, cache, and environment directories without a global uv or profile change.
- Privacy language now describes provider-aware best-effort screen-text filtering, exclusions, fail-closed unknown states, and residual secret-capture risk. OD-21 records the still-unresolved installation-identity file contract as a blocker for Task 7.

## Dependency and supply-chain result

- `npm audit --omit=dev`: 0 findings.
- Full development audit: 1 high and 4 low findings, 0 critical and 0 moderate.
- The residual findings aggregate one Forge interactive-editor chain: `@electron-forge/cli@7.11.2` → `@inquirer/prompts@6.0.1` → `@inquirer/editor@3.0.1` → `external-editor@3.1.0` → `tmp@0.0.33`. The approved non-interactive package command does not invoke the editor, and the ASAR contains no `node_modules`. npm's offered fix is a Forge downgrade, so no unrelated override or downgrade was added merely to reduce the count.
- Registry verification passed for 694 packages; 116 packages also had verified attestations.
- The exact 20-package PyPI lock query returned no OSV records. Python lock contents did not change during remediation.
- The credential-pattern scan found no credential-like value. npm lifecycle scripts remained blocked during dependency installation.

## Quality and package proof

The normal `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1` command passed after a clean lockfile install:

- Ruff format and lint, strict mypy, and 2 pytest tests;
- Prettier, ESLint, TypeScript type-check/build, and 3 Vitest tests;
- 31 Node policy/manifest/toolchain/documentation tests;
- all PowerShell files parsed successfully.

The package build produced a PyInstaller sidecar with SHA-256 `29670356444C79BAB704614A49E076FA94BC93EE60B374CDECD23D7544493B87`. The ASAR contains only the compiled shell, local renderer assets, and package metadata. Fuse readback showed RunAsNode, Node options, CLI inspect, browser-specific snapshot, and extra file privileges disabled; cookie encryption, embedded ASAR integrity, only-load-from-ASAR, and Wasm trap handlers enabled.

## Installer proof

| Item | Evidence |
| --- | --- |
| Artifact | `out/nsis/Ascend-Setup-0.0.0-x64.exe` |
| Bytes | `103580498` |
| SHA-256 | `22A4A2EF0C15D4EEE6E4DECF773A86B69E2B484374C73751FD898259F83D309A` |
| Authenticode | `NotSigned`, as required by the approved local-only scope |
| Build proof | `runtime/installer-proof/20260810T093643374Z` |
| Smoke proof | `runtime/installer-smoke/20260810T094031209Z` |

The smoke proof matched all 87 prepackaged files by path, size, and SHA-256. The installed tree contained 88 files; the sole extra was the narrowly allowlisted `Uninstall Ascend.exe`. The real Start Menu shortcut targeted installed `Ascend.exe` directly with no arguments. Two launches created a visible window, accepted `WM_CLOSE`, and left no Ascend process. The installed sidecar returned `Ascend engine 0.0.0`.

Normal uninstall removed the program tree, shortcut, uninstall entry, cached installer, and empty updater-cache directory while retaining the synthetic profile marker. Reinstall passed. With an unexpected synthetic updater-cache sentinel, uninstall removed only the exact cached installer, retained the sentinel, and left the non-empty directory; the harness then removed only its own synthetic sentinel and empty directory.

Microsoft Defender engine `1.1.26070.7` with signatures `1.457.91.0` found no threats in the installer, prepackaged tree, or installed tree.

## Remaining limits and gates

- The proof covers one current development account and the exact persistence surfaces implemented by the harness; it is not a universal absence claim.
- Clean standard-user Windows, representative managed environments, downloaded-artifact SmartScreen behavior, signing, outside testing, and release qualification remain unproven and unapproved.
- The default Electron icon remains; this is a product-polish gap, not a release-ready artifact.
- Plain local storage remains synthetic-only under OD-03. OD-21 must be resolved before Task 7, and the exact data-model specification still needs founder approval before Task 6.
- No commit or push was performed.

## Current official sources

- Node 22.23.2 archive and checksums: https://nodejs.org/en/download/archive/v22.23.2 and https://nodejs.org/dist/v22.23.2/SHASUMS256.txt
- Electron 43.3.0 release: https://releases.electronjs.org/release/v43.3.0
- Electron stable releases: https://releases.electronjs.org/?channel=stable
- Forge 7.11.2 release: https://github.com/electron/forge/releases/tag/v7.11.2
- electron-builder 26.15.7 release: https://github.com/electron-userland/electron-builder/releases/tag/electron-builder%4026.15.7
