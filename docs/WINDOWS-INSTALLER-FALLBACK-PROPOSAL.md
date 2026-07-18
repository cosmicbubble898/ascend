# Windows Installer Fallback Proposal

**Status:** Proposed for founder approval; no fallback dependency is installed
**Prepared:** 2026-07-18
**Decision:** OD-14
**Predecessor evidence:** `docs/reviews/INSTALLER-SPIKE.md`

## Recommendation

Approve a bounded, unsigned, local-only proof using the standard offline NSIS target from
`electron-builder@26.15.7`. Run electron-builder only as the distribution wrapper around the already hardened Forge
package:

```text
npm run package
    -> out/Ascend-win32-x64 (Forge package, hardened fuses, exact application allowlist, Python sidecar)
    -> immutable input manifest and SHA-256 hashes
    -> electron-builder --prepackaged out/Ascend-win32-x64 --win nsis --x64 --publish never
    -> unsigned local proof installer
```

Do not migrate Ascend's application packaging from Forge to electron-builder. Do not add an updater, web installer,
custom NSIS script, signing credentials, publishing configuration, or deployment. The proof exists only to determine
whether NSIS fixes the install/start/uninstall failures observed with Squirrel.Windows.

If approved, this authorizes one exact development dependency and the local proof work below. It does not authorize
signing spend, a downloaded public build, outside testing, publishing, deployment, or an update system. Those remain
separately gated by OD-11 and the Task 4 release checks.

## Why this route

Ascend is initially a consumer-style, individual Windows app. The electron-builder target guide identifies NSIS as
the normal consumer installer and supports per-user installation without administrator privileges. Its
`--prepackaged` option accepts an existing packaged application and creates a distributable from it. This lets Ascend
retain the package, fuses, ASAR policy, and Python sidecar that already passed the quality and runtime gates.

The NSIS route is sufficiently different from the failed Squirrel route:

- The installed shortcut targets the application executable, not Squirrel's crashing root execution stub.
- A standard offline NSIS installer does not download the application payload during user installation.
- Current-user installation can avoid elevation.
- Shortcut behavior, auto-run, app-data removal, warning policy, and elevation-helper inclusion are explicit choices.
- No runtime updater is required merely to use NSIS.

This is a recommendation for a proof, not a passing installer decision. Only observed clean install/start/uninstall
evidence can turn it into the selected distribution route.

## Candidate comparison

| Route                                                    | Fit for initial Ascend release    | Main benefit                                                                    | Blocking concern                                                                                                                                                                                    | Decision                                                        |
| -------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Standard offline NSIS through `electron-builder@26.15.7` | Strongest                         | Consumer-oriented, current-user installation, wraps existing prepackaged output | New build tool and downloaded/cached toolsets require supply-chain review                                                                                                                           | **Approve for bounded proof**                                   |
| Forge WiX MSI                                            | Weak for initial consumer release | Familiar enterprise MSI deployment                                              | Requires separately installed and pinned WiX Toolset v3; Forge describes MSI as a worse consumer experience; upstream `electron-wix-msi` creates a launcher stub and can integrate Squirrel.Windows | Defer; reconsider for future organization/enterprise deployment |
| Forge MSIX                                               | Promising later                   | Store/MDM distribution, managed install/update/uninstall                        | Forge support is experimental and requires the Windows SDK; trusted signing is needed for normal sideload distribution, while unsigned executable testing usually requires administrator PowerShell | Defer until Store/signing strategy is approved                  |
| NSIS Web                                                 | Poor for this proof               | Smaller bootstrap installer                                                     | Adds network and remote-payload behavior during install                                                                                                                                             | Reject for initial proof                                        |
| Portable executable                                      | Poor as primary route             | No installer/elevation                                                          | No normal installed-app lifecycle, shortcuts, or managed uninstall proof                                                                                                                            | Keep only as a possible diagnostic artifact                     |

WiX MSI may be useful when Ascend later targets managed organizations using Intune, Group Policy, or similar
enterprise deployment. MSIX may become attractive through the Microsoft Store or an approved enterprise signing path.
Neither is the smallest reliable proof for the individual-first release.

## Proposed exact dependency

Add only after approval:

| Package            | Exact version | Registry evidence observed 2026-07-18                                                                                                                                     |
| ------------------ | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `electron-builder` |     `26.15.7` | MIT; Node `>=14`; immutable GitHub release marked latest; npm integrity `sha512-DBpaNzxsPs1BvEblzFoNriSbzsBqDCy/gseIngeEhYzQG1IxfB7Hvc2tBBVmpWE2BTQGP9J1RrAvDT+Vc/uAxg==` |

The release pins `app-builder-lib@26.15.7`; its current registry metadata resolves a newer `tar` line than the
development-only vulnerable Forge rebuild chain already documented. This does not establish safety. The complete
resolved lock graph, install/build hooks, vendored binaries, licenses, signatures, attestations, and audit results must
still pass the pre-install gate below.

Observed binary-bearing transitive packages include `app-builder-bin@4.2.0` and `7zip-bin@5.2.0`. Neither advertised
an npm lifecycle script in the registry metadata checked for this proposal. electron-builder also downloads build
toolsets on first use and stores them in `ELECTRON_BUILDER_CACHE`; those downloads are part of the supply chain and
must be inventoried rather than treated as invisible cache state.

## Proposed proof configuration

Keep the exact configuration in a dedicated electron-builder config file rather than mixing it into Forge's package
configuration.

```yaml
appId: com.ascend.desktop
productName: Ascend
directories:
  output: out/nsis
win:
  target:
    - target: nsis
      arch:
        - x64
  executableName: Ascend
  requestedExecutionLevel: asInvoker
  signExecutable: false
nsis:
  oneClick: true
  perMachine: false
  packElevateHelper: false
  createDesktopShortcut: false
  createStartMenuShortcut: true
  runAfterFinish: false
  deleteAppDataOnUninstall: false
  unicode: true
  warningsAsErrors: true
  shortcutName: Ascend
  artifactName: Ascend-Setup-${version}-${arch}.${ext}
```

The stable `appId` is more important than an explicit installer GUID: electron-builder derives a deterministic GUID
from `appId`, and changing the ID later breaks silent upgrades. Approval of this proposal approves
`com.ascend.desktop` as the Windows application identity for this proof and intended release line. The shell must set
the same value as its Windows App User Model ID before opening windows.

Configuration rationale:

- `oneClick: true` plus `perMachine: false` forces a simple current-user install rather than presenting an
  install-scope choice or requiring all-user elevation.
- `requestedExecutionLevel: asInvoker` keeps the application at the user's privilege level.
- `packElevateHelper: false` removes an unused elevation helper because this proof has no per-machine updater.
- Start Menu shortcut is enabled; desktop shortcut is disabled to avoid modifying the desktop without a choice.
- `runAfterFinish: false` makes start evidence explicit and repeatable. Product UX may revisit this after the proof.
- `deleteAppDataOnUninstall: false` preserves the user's local profile. The proof must separately verify that program
  files are removed and synthetic profile data remains.
- Unicode and warnings-as-errors are stated explicitly even though they are current defaults.
- `signExecutable: false` makes the unsigned proof fail-safe even if signing-related environment variables exist.
- No custom script/include, web target, publisher, updater, protocol handler, file association, or launch-on-login
  behavior is permitted.

Before implementation, confirm from the installed 26.15.7 schema that every option above is accepted. If actual tool
behavior differs from the documentation, stop and update this proposal rather than relaxing the test.

## Supply-chain gate before the first proof build

The dependency may be added only after proposal approval. Then complete these checks before executing its build path:

1. Resolve `electron-builder@26.15.7` exactly with npm lifecycle scripts still blocked and review the lockfile diff.
2. Confirm every direct dependency is exact in `package.json`; require `package-lock.json` to hold exact transitive
   tarball URLs and integrity values.
3. Inventory packages with lifecycle scripts, native files, archives, or vendored executables. Do not enable a
   package-wide lifecycle-script bypass.
4. Record npm license, audit, registry-signature, and attestation results for runtime and full development graphs.
5. Record hashes for `app-builder-bin`, `7zip-bin`, and every executable/archive they contribute.
6. Use a project-scoped `ELECTRON_BUILDER_CACHE`. Capture download URLs and SHA-256 values for every first-build
   toolset, then prove a second build can use only the reviewed cache.
7. Run the existing full quality gate before and after the dependency/configuration change.
8. Add a fail-closed packaging-policy test that rejects Squirrel, NSIS Web, publishing, an updater dependency, custom
   NSIS scripts, per-machine mode, elevation helpers, app-data deletion, or a mutable dependency range.

Any unreviewed install hook, unverifiable binary download, unexpected publisher behavior, or new runtime audit finding
is a stop condition.

## Prepackaged-input integrity gate

The NSIS builder must wrap, not silently replace or mutate, the existing hardened Forge package:

1. Run `npm run package` and the existing fuse/ASAR/runtime verification first.
2. Create a sorted manifest of every file in `out/Ascend-win32-x64` with relative path, size, and SHA-256.
3. Copy that directory to a dedicated proof input and make the proof operate only on the copy.
4. Invoke electron-builder with `--prepackaged` and `--publish never`; do not allow it to run a second Electron
   packaging pipeline.
5. Recompute the proof-input manifest after the build. Any changed, added, or removed input file fails the proof.
6. Inspect the installed application and prove its files match the prepackaged input, except for explicitly inventoried
   installer-owned metadata/uninstaller files outside the application payload.
7. Read back every installed Electron fuse and list every ASAR/resource file again.

The package manifest and installer manifest are separate evidence. A valid installer hash does not prove the embedded
application is the reviewed package.

## Proof acceptance criteria

The proof is `go` only if every applicable item passes.

### Build and artifact

- Exact dependency/lock and toolset-cache review passes.
- Existing Python, Node, package-policy, lint, type, test, build, fuse, ASAR, sidecar, and hidden-window gates pass.
- Prepackaged input is byte-for-byte unchanged by the NSIS build.
- The installer target is x64, offline, unsigned, not published, and contains no updater or elevation helper.
- Installer, embedded payload, installed files, and uninstaller receive size/SHA-256/signature manifests.
- Repeating the build with identical inputs is compared; any nondeterminism is explained and scoped.

### Install and launch

- Preflight proves no conflicting NSIS Ascend install, process, shortcut, or uninstall registry entry exists.
- Current-user silent install succeeds without a UAC/elevation event.
- Installed paths remain under the current user's profile, not `Program Files` or an all-users registry scope.
- Start Menu shortcut points directly to the installed Ascend application, not a launcher/update stub.
- No desktop shortcut, auto-launch, service, scheduled task, startup item, protocol, or file association is created.
- Launch through the real Start Menu target creates the Ascend window; native `WM_CLOSE` and relaunch both leave no
  orphan shell, renderer, or Python processes.
- The installed sidecar prints the exact expected version.
- Paths with spaces and non-ASCII characters work.

### Uninstall and retention

- Silent uninstall returns success and removes the application payload, uninstaller, shortcuts, and uninstall registry
  entry after all processes are closed.
- No executable, DLL, updater/elevation helper, scheduled task, service, startup entry, or empty install directory
  remains after a bounded wait/reboot check.
- A clearly marked synthetic user-data file remains because `deleteAppDataOnUninstall` is false.
- Reinstall after uninstall succeeds and uses the same stable application identity.

### Environment and security

- Repeat on a clean Windows 11 x64 standard-user environment, not only the development account.
- Repeat on at least one representative managed/enterprise-policy environment before outside testing.
- Run current Microsoft Defender scans on the installer, extracted payload, installed tree, and uninstaller; record the
  engine/signature versions and results.
- Do not claim SmartScreen behavior from a local file without Mark-of-the-Web. SmartScreen testing waits for the final,
  signed, downloaded artifact after OD-11 is resolved.
- No real credentials, user data, database, recording, provider account, cloud resource, or external recipient is used.

## Stop and fallback rules

Stop the NSIS proof and return to OD-14 if any of these occurs:

- The real shortcut/launcher crashes or requires a helper not in the reviewed manifest.
- Current-user installation elevates, writes all-user state, or creates unapproved persistence.
- Uninstall leaves executable/support residue after the documented bounded cleanup/reboot test.
- electron-builder mutates the prepackaged input or invokes a second application-packaging pipeline.
- The first-build toolsets cannot be pinned, hashed, cached, and reviewed.
- The dependency adds an unresolved critical/high runtime vulnerability or unacceptable license/build hook.
- Clean-machine behavior differs materially from development-machine behavior.

If NSIS fails, do not try custom NSIS macros as the automatic next step. Re-open the comparison and choose between a
minimal independent installer implementation, MSIX with an approved signing/Store plan, or a traditional enterprise
MSI path. Every new dependency or custom installer script requires another approved specification.

## Signing and updates remain separate

This proof intentionally disables signing and publishing. A later release build must apply the Task 4 signing
requirements to the complete signable-binary manifest and validate the final downloaded artifact. Signing only the
outer installer is insufficient.

NSIS capability does not authorize `electron-updater`. Update channel, manifest authenticity, rollback, partial
download behavior, staged rollout, downgrade protection, and failure recovery require a separate written
specification and approval. The first passing installer may ship with manual updates if that later product decision is
explicit.

## Approval requested

Recommended approval text:

> Approved: `WINDOWS-INSTALLER-FALLBACK-PROPOSAL`. Proceed with an unsigned, local-only
> `electron-builder@26.15.7` NSIS proof using the existing prepackaged Forge output. No signing spend, publishing,
> updater, real credentials, or user data.

Until that approval is recorded, `electron-builder` must not be installed and the active Forge configuration must
retain `makers: []`.

## Official sources reviewed

- electron-builder 26.15.7 immutable latest release:
  https://github.com/electron-userland/electron-builder/releases/tag/electron-builder%4026.15.7
- electron-builder CLI and `--prepackaged`:
  https://www.electron.build/docs/cli/
- electron-builder target selection:
  https://www.electron.build/docs/targets/
- electron-builder NSIS configuration:
  https://www.electron.build/docs/nsis/
- electron-builder Windows execution/signing controls:
  https://www.electron.build/docs/win/
- electron-builder toolset cache behavior:
  https://www.electron.build/docs/troubleshooting/
- Forge WiX MSI maker:
  https://www.electronforge.io/config/makers/wix-msi
- `electron-wix-msi` launcher/updater design:
  https://github.com/electron-userland/electron-wix-msi
- Forge MSIX maker and experimental status:
  https://www.electronforge.io/config/makers/msix
- Microsoft unsigned MSIX test limitation:
  https://learn.microsoft.com/en-us/windows/msix/package/unsigned-package
