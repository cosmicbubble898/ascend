# Installer, Signing, SmartScreen, and AV Spike

**Status:** `no-go` for Squirrel.Windows and standard electron-builder NSIS; Task 4 blocked at OD-16
**Evidence date:** 2026-07-18
**Owner task:** Task 4 in `tasks/todo.md`

## Decision

Do not distribute the current Squirrel installer, even for an outside beta. The package builds, installs, and the
versioned Electron/Python executables run, but the user-facing Squirrel execution stub crashes with access violation
`0xc0000005`. Uninstall also leaves executable residue. These failures are release blockers independent of signing.

No signing service or certificate was purchased. SmartScreen was not claimed as tested. Task 5 must not start until an
installer fallback passes this spike in clean Windows environments and OD-03 is resolved.

After recording the failure, the Squirrel maker dependency, default `make` command, updater-launch code, and vendor
preparation hook were removed from the active foundation. `npm run package` continues to produce only the hardened
unpacked Electron/Python package. The hashes and Squirrel controls below describe the preserved spike evidence, not an
active distribution route.

Final cleanup verification passed: 2 pytest tests, 3 Vitest tests, 5 Node packaging-policy tests, Ruff, strict mypy,
Prettier, ESLint, TypeScript, the PyInstaller sidecar build, the Forge package, fuse readback, and a hidden-window
runtime smoke. The final packaged engine printed `Ascend engine 0.0.0`; the shell created a window titled `Ascend`,
accepted `WM_CLOSE`, and left zero processes. The active ASAR contains no Squirrel file or stale build output. The
active dependency graph has 0 runtime audit findings, 575 verified registry signatures, 85 attestations, and the
existing development-only 18 high/3 low Forge toolchain findings.

## Scope and environment

- Windows 11 x64, build `10.0.26200`
- Node.js `22.23.1`, npm `10.9.8`, Electron `43.1.1`, Forge `7.11.2`
- `@electron-forge/maker-squirrel` `7.11.2`, resolving `electron-winstaller` `5.4.4`
- CPython `3.13.14`, PyInstaller `6.21.0`, one-directory sidecar
- Synthetic shell and version-only engine behavior; no credentials, database, recording, or real user data
- Current-user install only; no elevation, deployment, publishing, or outside distribution

This is one development machine, not a clean-machine matrix. Windows 11 clean standard-user and representative
enterprise-policy environments remain mandatory for a later passing result.

## Implemented packaging controls

- Squirrel install/update/uninstall events are handled before normal application startup.
- Only exact Squirrel flags in `argv[1]` are accepted.
- `Update.exe` is derived from the installed executable path and spawned with `shell: false`, hidden stdio, and a
  bounded quit timer.
- The shell uses `com.squirrel.Ascend.Ascend` as its App User Model ID.
- The Python engine is built with PyInstaller `onedir`, not `onefile`, and its packaged `--version` command is checked.
- The engine folder is copied into Electron resources; it is not started by the shell before Task 10.
- The Squirrel maker is explicitly unsigned and produces no MSI.
- npm lifecycle scripts remain blocked.

### Blocked install-script recovery

The first make failed because `electron-winstaller` normally runs an install script that copies architecture-specific
7-Zip files to `vendor/7z.exe` and `vendor/7z.dll`. Blocking lifecycle scripts correctly prevented this hidden
mutation. `scripts/prepare-squirrel.cjs` now performs only those two copies after verifying the installed package is
exactly `5.4.4` and that the source files match these reviewed SHA-256 values:

| Source       | SHA-256                                                            |
| ------------ | ------------------------------------------------------------------ |
| `7z-x64.exe` | `C7245E21A7553D9E52D434002A401C77A7CA7D0F245F2311B0DDF16F8F946C6F` |
| `7z-x64.dll` | `9ED007AA82E440CEB39A6E105BB1D602A9BC59A4946267BA8DE2F220AA15BC06` |

A focused test proves a wrong source hash is rejected before copying and the reviewed hash produces an identical
destination.

## Build and artifact evidence

`npm run make` completed after the verified 7-Zip preparation step.

| Artifact                  |       Bytes | SHA-256                                                            | Authenticode   |
| ------------------------- | ----------: | ------------------------------------------------------------------ | -------------- |
| `Ascend-Setup.exe`        | 146,827,264 | `8253ED9E59733B3115DBBDEDF77B024E8B47C92B601709E5B39A90F0CF0EA836` | Not signed     |
| `Ascend-0.0.0-full.nupkg` | 146,098,822 | `D0DDBFD0D1A6AAE4EB90AC855539DD3E14C17F0012764692C5590430E07D03D7` | Not applicable |
| `RELEASES`                |          77 | `B23E8AB590CC41BBFF53F70BFA25039AE72D2BE9B5054CADA5090ACFE0D8B79C` | Not applicable |

The unpacked application contains 87 files and 382,790,967 bytes. The NuGet package contains 22 PE/native executable
or loadable files when `.exe`, `.dll`, `.node`, and `.pyd` are counted:

- 19 are unsigned, including the Electron executable, Squirrel execution stub/updater, Python executable/runtime,
  OpenSSL, Chromium libraries, and Python extension modules.
- 3 carry valid Microsoft Windows signatures: `d3dcompiler_47.dll`, `dxil.dll`, and `VCRUNTIME140.dll`.
- A future signed build must sign every Ascend/Squirrel/Python executable and signable helper after final packaging,
  then verify the complete installed set. Signing only `Setup.exe` is insufficient.

The packaged ASAR contains only:

```text
dist/shell/main/application-resource.js
dist/shell/main/main.js
dist/shell/main/squirrel-startup.js
dist/shell/main/window-options.js
dist/shell/preload.js
package.json
shell/renderer/index.html
shell/renderer/styles.css
```

PyInstaller reported only expected platform-conditional imports such as `grp`, `pwd`, `posix`, `resource`, and
`fcntl`; the packaged engine version smoke exited `0` with `Ascend engine 0.0.0`.

## Supply-chain and quality evidence

- The combined Python/Node gate passed after the changes.
- Python: Ruff format/lint, strict mypy, and 2 pytest tests passed.
- At the spike point, shell checks included 12 Vitest tests and 6 Node packaging-policy tests. The final active
  foundation removes the Squirrel-specific tests/code and adds a fail-closed test that the maker and `make` command are
  absent.
- `npm audit --omit=dev --audit-level=high`: 0 runtime vulnerabilities.
- `npm audit signatures`: 584 verified registry signatures and 87 verified attestations.
- Full development audit: 19 high and 3 low findings in the Forge/rebuild/editor toolchain. High findings are the
  previously recorded vulnerable `tar` extraction chain and `tmp` editor chain; npm reports no fix. These packages
  are not runtime dependencies, no native modules are rebuilt, and untrusted archives are not accepted, but the
  result is still a release-tooling residual risk.
- Python dependencies are exact and hash-locked in `uv.lock`.

## Local install/start/exit/uninstall result

### What passed

- `Ascend-Setup.exe --silent` exited `0` without elevation or auto-launch.
- Squirrel installed to `%LOCALAPPDATA%\Ascend` and created the expected current-user uninstall registry entry.
- It created Start Menu and OneDrive Desktop shortcuts targeting `%LOCALAPPDATA%\Ascend\Ascend.exe`.
- The installed versioned Electron executable created a hidden top-level window titled `Ascend`.
- A native `WM_CLOSE` caused the main and all renderer/helper processes to exit; no Ascend process remained.
- Relaunching the versioned executable against the same isolated synthetic profile also started normally.
- The installed Python sidecar exited `0` with `Ascend engine 0.0.0`.
- A test profile whose path contains spaces and `Å` worked for the Electron user-data directory.

### Release-blocking failures

1. The installed execution stub `%LOCALAPPDATA%\Ascend\Ascend.exe`, which is the actual shortcut target, crashes
   before it can launch the versioned app. Windows recorded Application Error 1000 and Windows Error Reporting 1001,
   with exception `0xc0000005` at offset `0x000049a3`. The faulting module is the stub itself. Three scoped crash
   dumps were generated in `%LOCALAPPDATA%\CrashDumps` during confirmation.
2. The first silent uninstall returned `0` and removed the registry entry and both shortcuts, but left `.dead`,
   `Update.exe`, `app-0.0.0\squirrel.exe`, and initially `v8_context_snapshot.bin`. A second uninstall attempt returned
   `-1`; some executable residue remains under `%LOCALAPPDATA%\Ascend`.
3. The current machine is not a clean Windows environment, and environment-variable overrides did not redirect
   Squirrel's known-folder install root. Clean user/VM evidence is still absent.

The remaining install directory and crash dumps are retained as failure evidence. Do not treat registry/shortcut
cleanup as a passing uninstall when executable residue remains.

## Microsoft Defender and SmartScreen

Microsoft Defender was enabled with real-time protection and security intelligence `1.455.200.0`, updated
2026-07-18 06:09:38. `MpCmdRun.exe` custom scans with remediation disabled returned exit `0` and “found no threats”
for:

- `Ascend-Setup.exe`
- the unpacked `Ascend-win32-x64` package
- the installed `%LOCALAPPDATA%\Ascend` directory before uninstall

This is one Defender version on one machine, not representative antivirus coverage.

SmartScreen was not exercised. The locally generated installer has no `Zone.Identifier`/Mark-of-the-Web stream, so a
local launch cannot establish downloaded-file SmartScreen behavior or reputation. A later test must use a clean,
downloaded, final signed artifact in representative Windows policy environments.

## Current signing options

### Microsoft Artifact Signing

- Basic: approximately USD 9.99/month for 5,000 signatures.
- Premium: approximately USD 99.99/month for 100,000 signatures; published overage is USD 0.005/signature.
- Billing is monthly and not prorated.
- Public Trust requires Azure subscription, Microsoft Entra tenant, identity validation, and eligibility by publishing
  entity/location. Current public eligibility covers organizations in the US, Canada, EU, and UK, plus individual
  developers in the US and Canada. Ascend's legal publishing entity must be checked; timezone is not proof of
  eligibility.
- Identity validation must be renewed before expiry. Microsoft holds the signing certificate and integrates with
  SignTool, PowerShell, and GitHub Actions.

### Commercial hardware-backed certificate example

DigiCert's official comparison page currently lists annual prices beginning at USD 696 for OV with the publisher's
own compliant token/HSM, USD 840 with a USB token, and USD 996 with KeyLocker. EV options begin at USD 972 and rise by
custody method. Prices can change. CA/B Forum requirements place code-signing private keys in approved hardware-backed
cryptographic modules; current DigiCert validity is at most 459 days.

Microsoft now states that even valid OV/EV signed files can warn until reputation develops, and EV no longer receives
automatic positive SmartScreen reputation. Do not buy EV solely to bypass SmartScreen.

### Required signing verification

Use SHA-256 file digests and an RFC 3161 timestamp. Verify with current SignTool policy, including `/pa`, `/all`, and
timestamp warning checks such as `/tw`. Ascend's build needs a complete post-package binary manifest and must fail if
an expected signable file is missing, unsigned, has the wrong publisher, lacks an accepted timestamp, or changes after
signing.

## Fallback assessment and OD-14

The official-source comparison is complete in `docs/WINDOWS-INSTALLER-FALLBACK-PROPOSAL.md`. No fallback dependency
was silently installed:

- Forge WiX MSI is supported but requires a separately pinned WiX Toolset 3 installation, has a less consumer-friendly
  install path, and its upstream toolkit also uses a Squirrel-derived execution-stub/update design that must be proven
  not to reproduce this crash.
- Forge MSIX is experimental, requires the Windows SDK, and a practical install/distribution test requires a signing
  identity or Microsoft Store path.
- Standard offline NSIS through exact `electron-builder@26.15.7` is the recommended bounded proof because it can wrap
  the unchanged hardened Forge package through `--prepackaged`, supports current-user installation, and does not use
  the failed Squirrel launcher. The proposal defines dependency, binary-cache, licensing, security, no-updater, and
  input-integrity gates before its first build.

OD-14 was approved by the founder on 2026-07-19. It authorizes only the exact unsigned, local-only NSIS proof;
signing spend, publishing, an updater, real data, and outside distribution remain prohibited.

The OD-14 proof has now been executed. Standard NSIS passed build, install, direct-shortcut launch, WM_CLOSE, installed-payload integrity, program-file cleanup, synthetic profile retention, reinstall, and Defender checks. It failed because uninstall left the complete unsigned installer at `%LOCALAPPDATA%\ascend-updater\installer.exe`. The exact evidence and supply-chain record are in `docs/reviews/NSIS-INSTALLER-PROOF.md`.

Task 4 remains blocked. `docs/WINDOWS-INSTALLER-CLEANUP-PROPOSAL.md` defines the separately approval-gated OD-16 proof; no custom NSIS macro has been added.

## Five-axis review

- **Correctness:** Focused red/green tests covered the sidecar version entry point and stale-package rejection. The
  complete gate, package, fuse readback, engine smoke, hidden shell window, and clean `WM_CLOSE` all passed. The
  Squirrel shortcut path and uninstall did not pass and are explicitly blocking.
- **Security:** The active package uses an exact file allowlist, clears only its validated `dist` directory before
  compiling, contains no Squirrel updater-launch code, and has no credential literals or privileged IPC. Runtime npm
  audit is clear; development-only Forge audit findings remain documented.
- **Maintainability:** Build scripts have one responsibility, exact paths, strict error propagation, and version/hash
  checks. Known-bad maker wiring was removed instead of left as an attractive default.
- **Performance:** No service, polling loop, database, or background process was added. The engine remains a packaged
  but dormant sidecar until its supervised lifecycle is specified in Tasks 9-10.
- **Compatibility:** Windows x64 package and current-machine runtime are proven. Clean Windows, policy-managed devices,
  signing, SmartScreen, fallback installer behavior, and any updater remain unproven.

No active-code blocking finding remains inside the unpacked foundation. Task 4 itself remains blocked because no
installer route has passed.

## Official sources reviewed

- Forge Squirrel maker: https://www.electronforge.io/config/makers/squirrel.windows
- Forge WiX MSI maker: https://www.electronforge.io/config/makers/wix-msi
- Forge MSIX maker: https://www.electronforge.io/config/makers/msix
- Electron Windows installer events/signing: https://github.com/electron/windows-installer
- Microsoft SmartScreen reputation: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- Microsoft Defender command line: https://learn.microsoft.com/en-us/defender-endpoint/command-line-arguments-microsoft-defender-antivirus
- SignTool: https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool
- Artifact Signing: https://azure.microsoft.com/en-us/products/artifact-signing
- Artifact Signing pricing: https://azure.microsoft.com/en-us/pricing/details/trusted-signing/
- Artifact Signing quickstart/eligibility: https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart
- Artifact Signing trust models: https://learn.microsoft.com/en-us/azure/artifact-signing/concept-trust-models
- Artifact Signing FAQ: https://learn.microsoft.com/en-us/azure/artifact-signing/faq
- DigiCert code-signing comparison: https://www.digicert.com/signing/compare-code-signing-certificates
- DigiCert request requirements: https://docs.digicert.com/en/certcentral/order-and-manage-certificates/request-certificates/request-a-code-signing-or-ev-code-signing-certificate/request-code-signing-certificate.html
- CA/B Forum code-signing requirements: https://cabforum.org/working-groups/code-signing/requirements/
