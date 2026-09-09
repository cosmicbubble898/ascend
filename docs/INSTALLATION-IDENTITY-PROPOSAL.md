# First-run identity contract — OD-21

**Status:** Proposed 2026-09-05; awaiting founder approval before Task 7 implementation.

## User outcome and scope

Ascend creates a private local account without requiring sign-in. Restarting reuses the same account and installation identity. An incomplete or inconsistent setup stops with a clear local error instead of silently creating another account. This supports the habit/productivity, meeting-note, and connection features through one local foundation.

Approval covers this contract, its standard-library/Win32 implementation, synthetic tests, and Task 7 bootstrap against the already-approved schema. It adds no dependency, recording, tracking, integration, cloud account, or release permission. Encryption remains mandatory before real content.

## Exact paths and format

- Resolve the current user's `FOLDERID_LocalAppData` with `SHGetKnownFolderPath`; never take the root from a renderer, command parameter, provider, or imported content. Use the fixed subdirectory `Ascend\vault` on a local NTFS volume. The typical root is `%LOCALAPPDATA%\Ascend\vault`; the environment-variable spelling is documentation, not the resolution method.
- Identity file: `installation.json`. Database: `ascend.sqlite3`. Setup lock: `bootstrap.lock`. Staging file: `installation.pending`. These names are constants. Tests inject an isolated temporary root through internal test fixtures only.
- Keep this local vault separate from Electron's existing `%APPDATA%\Ascend` profile, the installation directory, and `ascend-updater`. Do not move, merge, or delete existing directories.
- The identity contains exactly `{"version":1,"device_id":"dev_<32 lowercase hexadecimal characters>"}` followed by LF. The placeholder represents 128 random bits from `secrets.token_hex(16)`, not a literal value. The file is exactly 65 ASCII/UTF-8 bytes with no BOM.
- Read at most 66 bytes and require exactly 65. Reject duplicate/extra keys, non-integer or unsupported versions, whitespace variants, noncanonical JSON, invalid prefix/hex/length, NUL bytes, and trailing content. Re-serialization must match the bytes exactly.
- Store no timestamp, Windows username, SID, email, hostname, hardware identifier, or credential in this JSON. The Windows token SID is used only to evaluate OS permissions; it never determines Ascend IDs.

## Filesystem boundary

- Use a narrow Windows adapter implemented with Python's existing `ctypes`, calling documented Win32 APIs. Keep it separate from the pure identity/bootstrap domain logic. Declare all function signatures and close handles deterministically; do not invoke PowerShell or shell commands from the engine.
- New `Ascend\vault` directories and the four named files use a protected, non-null DACL with exactly two explicit full-control allow entries: the current token user and LocalSystem. Directory entries are inheritable for files/subdirectories; files are individually protected. Owner must be the current token user. Never repair an existing unexpected owner or ACL automatically.
- Validate existing vault objects against this permission policy before reading identity bytes. Existing parent directories above the vault are inspected for local location and reparse points; their ACLs are not rewritten. Administrators and same-user malware remain outside this protection claim.
- Reject reparse points, junctions, symlinks, non-disk objects, remote paths, unsupported filesystems, and identity/staging/lock files with more than one hard link. Inspect metadata through handles opened with `FILE_FLAG_OPEN_REPARSE_POINT`; directory handles also use `FILE_FLAG_BACKUP_SEMANTICS`.
- Check each path component from the resolved local volume through the vault; retain directory handles without delete sharing while opening/using children so ancestors cannot be renamed during the operation. Reject any unresolved path, identity, ACL, or metadata mismatch. Do not rely only on `resolve()` or a pre-open path check.
- The application never asks for elevation to make this work. An unsupported redirected or permissive profile receives a visible failure. No fallback to another location occurs.

## Concurrency and publication

1. Open/create the zero-byte `bootstrap.lock` with `CreateFileW`, `OPEN_ALWAYS`, and no sharing. Validate its owner, ACL, attributes, and size. A competing process receives `bootstrap_busy` immediately; no polling loop or lock-file deletion is used. A crash releases the handle; the empty file can remain.
2. Keep this lock for identity validation, migration verification, and the entire bootstrap transaction. Inspect the known database state before creating an identity: missing identity plus any foundation row is `bootstrap_inconsistent`. Unknown/corrupt schema is a migration failure and cannot trigger identity generation.
3. If final identity exists, validate it and reuse it. Never replace, rotate, truncate, or regenerate a final identity during ordinary startup. If a staging file also exists, stop with `identity_incomplete`; never silently choose between files.
4. If final and staging files are absent and no foundation rows exist, generate the device ID. Create the fixed staging file with `CREATE_NEW`, no handle inheritance, and the protected ACL at creation. Write the complete payload, flush using `FlushFileBuffers`, and validate it before publishing.
5. Publish on the same volume with a rename that refuses an existing destination. Use `MoveFileExW` with `MOVEFILE_WRITE_THROUGH`, without `MOVEFILE_REPLACE_EXISTING` or `MOVEFILE_COPY_ALLOWED`. Reopen and verify the published file before starting database bootstrap. Never implement publication as copy/delete or write directly to the final file.
6. If a crash leaves only `installation.pending`, acquire the lock, validate its complete canonical bytes, ACL, and file identity, and require no foundation rows. Promote that same identity using the same non-replacing publication. A partial or invalid staging file fails with `identity_incomplete`; automatic cleanup/regeneration is prohibited.
7. If the database bootstrap fails after publication, retain the final identity for retry. Run all five foundation inserts in one `BEGIN IMMEDIATE` transaction. Repeated successful bootstrap returns the existing complete personal chain without changing timestamps or IDs. Partial/duplicate/non-active/cross-tenant/wrong-role chains fail as required by `DATA-MODEL.md`.

This design aims for atomic publication under the supported filesystem and explicit recovery states. Flush/rename are not a claim of protection against faulty hardware or every power-loss mode. A missing identity alongside existing foundation rows always fails closed.

## Failures, retention, and restore

- Public outcomes are a fixed allowlist: `bootstrap_busy`, `identity_invalid`, `identity_incomplete`, `identity_permissions`, `identity_path_unsafe`, `identity_io_failed`, `bootstrap_inconsistent`, and the existing migration failures. Logs contain only outcome and duration, never IDs, JSON, paths, SIDs, or raw OS error text.
- This module returns typed failures; Task 9/10 will connect them to visible engine/shell startup state. It must not claim successful startup after any failure.
- Uninstall and reinstall preserve the vault and identity. This task adds no delete/reset/export/backup operation and does not modify installer cleanup.
- Restore is a later explicit workflow. A complete, permission-valid matching database plus identity is reusable on the same account. A database-only restore, wrong identity, or permissions for a different Windows user stops without repair.
- A byte-for-byte copy of both identity and database cannot be distinguished from the original in a local-only application. Do not promise clone detection, sync safety, or automatic transfer to another machine/account.

## Small implementation tasks after approval

1. Test and implement strict identity serialization/validation and the pure first-run/retry state machine with a fake file adapter.
2. Test and implement the narrow Windows file/ACL adapter in temporary synthetic directories. Cover alternate user grants, wrong owner, inherited ACLs, symlink/junction/hard-link cases, rename races, and partial writes. Check actual Windows behavior as well as automated fake-adapter cases.
3. Test and implement transactional personal bootstrap and restart behavior using the approved schema. Inject failure between every insert; verify rollback, stable device ID on retry, and unchanged existing timestamps.

Run focused tests after each task, then the Python quality gate and relevant full checks. Do not add real vault startup wiring until these tests and the security review pass. Any API behavior that cannot satisfy this contract is an explicit failed proof requiring an amended proposal, not a silent weakening.

## Primary sources reviewed 2026-09-05

- [SHGetKnownFolderPath](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shgetknownfolderpath): current-user known-folder resolution.
- [CreateFileW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew): creation, security descriptors, sharing, and reparse-point flags.
- [MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw): rename flags and replacement behavior.
- [FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers): explicit flush and its limitations.
- [ACL inheritance](https://learn.microsoft.com/en-us/windows/win32/secauthz/automatic-propagation-of-inheritable-aces): protected DACL semantics.

## Approval requested

Approve this OD-21 contract and continue Task 7 in the three small synthetic-data slices above. Existing real-data, encryption, dependency, provider, and release gates remain unchanged.
