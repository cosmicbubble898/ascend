# Windows installer cache-cleanup proof proposal

**Status:** Proposed for founder approval; not implemented
**Prepared:** 2026-07-19
**Decision:** OD-16
**Predecessor evidence:** `docs/reviews/NSIS-INSTALLER-PROOF.md`

## Recommendation

Approve one more bounded, unsigned, local-only NSIS proof that retains the exact OD-14 toolchain and adds one narrowly allowlisted custom uninstall macro. The macro may delete only electron-builder's exact cached installer file and then remove its directory only if empty:

```nsh
!macro customUnInstall
  Delete "$LOCALAPPDATA\ascend-updater\installer.exe"
  RMDir "$LOCALAPPDATA\ascend-updater"
!macroend
```

Do not use `RMDir /r`, wildcards, shell commands, plug-ins, downloads, registry deletion, services, tasks, elevation, or any other custom macro. The normal standard template continues to remove the application payload, shortcut, and uninstall entry.

This is the smallest change that addresses the sole local NSIS failure. It does not authorize acceptance of residue, signing spend, publishing, an updater, real credentials/data, outside testing, deployment, or a general custom-installer framework.

## Why a second proof is justified

The standard NSIS route passed every tested application and install lifecycle gate except one behavior that the pinned electron-builder template makes unconditional: copying the installer to `%LOCALAPPDATA%\ascend-updater\installer.exe` without removing it during uninstall.

The alternatives remain materially larger:

- Accepting a 99 MiB unsigned executable after uninstall violates the approved cleanup and user-trust requirements.
- MSIX needs an approved signing/Store strategy for representative distribution testing.
- WiX MSI adds another toolchain and may reintroduce launcher-stub/Squirrel-derived behavior.
- An independent installer implementation replaces more reviewed code than the three-command macro above.

The custom include is acceptable only as a separately approved proof because custom uninstall code is a data-deletion boundary.

## Exact implementation boundary

After approval:

1. Add one tracked `build/installer.nsh` containing only the macro shown above.
2. Add `include: build/installer.nsh` to the NSIS config explicitly; do not rely on implicit auto-discovery.
3. Change the installer-policy test from rejecting every include to allowing only this exact relative path and exact file SHA-256.
4. Add structural tests that reject `RMDir /r`, `/REBOOTOK`, wildcards, variables other than `$LOCALAPPDATA`, any path other than `ascend-updater\installer.exe`, and any macro other than `customUnInstall`.
5. Retain `publish: null`, `differentialPackage: false`, `--publish never`, `signExecutable: false`, `packElevateHelper: false`, `perMachine: false`, and the one-artifact output rule.
6. Re-run the full dependency, quality, package-integrity, cache-only build, installed-file, launch/WM_CLOSE, Defender, uninstall, retention, and reinstall proof.

No new npm dependency, downloaded toolset, provider, credential, cloud resource, or cost is permitted.

## Security and deletion rules

The proof must demonstrate both normal cleanup and conservative behavior when the cache directory contains unexpected content:

- Normal case: delete the exact cached `installer.exe`, then remove the now-empty `ascend-updater` directory.
- Sentinel case: if another file exists in `ascend-updater`, delete only the exact installer and leave the sentinel plus non-empty directory intact.
- Never recurse through the cache directory.
- Never delete the parent `%LOCALAPPDATA%` directory or any user profile/application data.
- Never follow a broader computed path, wildcard, or registry-provided path.
- Preserve `%APPDATA%\Ascend` and synthetic user data.

The same-user attacker risk cannot be eliminated by an installer: malware running as the user could replace paths or files. The non-recursive, exact-file deletion keeps this proof's authority as narrow as practical. A release security review must revisit the behavior before outside distribution.

## Acceptance criteria

The proof is `go-local` only if all OD-14 criteria still pass and:

- the exact cached installer is removed after uninstall;
- the cache directory is removed only when empty;
- an unexpected sentinel file survives and prevents directory removal;
- the application payload, uninstaller, shortcuts, and uninstall entry leave no residue;
- synthetic profile data remains;
- reinstall and second uninstall pass;
- no update metadata, updater dependency, publisher lookup, custom action, or broader deletion appears;
- Defender scans find no threat in the final local artifact and installed tree; and
- code-quality and security review find no unresolved blocking issue.

Even a passing local result does not authorize release. The unchanged clean-Windows standard-user, representative managed-environment, signing, downloaded-artifact, SmartScreen, and outside-testing gates remain mandatory.

## Stop rules

Stop and return to the installer comparison if:

- any file other than the exact cached installer is deleted;
- the sentinel directory is removed recursively;
- the custom include needs another macro, plug-in, executable, elevation, or new dependency;
- clean uninstall still leaves an executable/DLL/helper or unexpected empty directory;
- the standard payload, shortcut, launch, retention, or reinstall behavior regresses; or
- clean-machine behavior later differs materially from the development proof.

## Approval requested

Recommended approval text:

> Approved: `WINDOWS-INSTALLER-CLEANUP-PROPOSAL`. Proceed with the exact unsigned, local-only non-recursive NSIS cache-cleanup proof. No signing spend, publishing, updater, real credentials/data, outside testing, or deployment.

Until approval is recorded, do not create `build/installer.nsh`, loosen the current policy test, or execute a custom NSIS include.

## Sources

- Exact local `app-builder-lib@26.15.7` source at `out/targets/nsis/NsisTarget.js`, `templates/nsis/include/installer.nsh`, and `templates/nsis/uninstaller.nsh`.
- Official electron-builder custom NSIS documentation: https://www.electron.build/docs/nsis/
- Exact proof evidence: `docs/reviews/NSIS-INSTALLER-PROOF.md`.
