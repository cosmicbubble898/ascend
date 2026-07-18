# Task 3 Review: Electron Shell and Quality Gate

**Status:** Passed on 2026-07-18
**Scope:** Minimal secure Electron/TypeScript shell, exact Node dependency lock, combined quality gate, package proof, and packaged runtime smoke. No product behavior, database, provider, credential, cloud, installer, signing, or deployment work.

## Implemented boundary

- Project-local, checksum-pinned Node 22.23.1/npm 10.9.8 bootstrap; the machine-wide Node 24 installation was not changed.
- One authoritative `package-lock.json`, exact direct versions, effective `ignore-scripts=true`, and script-blocked clean installation.
- Static local renderer served only through the `ascend://app/` custom protocol.
- Explicit `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webviewTag: false`, denied permissions, denied new windows, bounded navigation, and a strict CSP.
- A preload bridge that exposes only immutable shell version metadata and no IPC or privileged operation.
- ASAR package allowlist, exact fuse policy, post-package fuse flip, and readback of every fuse with `strictlyRequireAllFuses: true`.
- `scripts/check.ps1` enforcing both Python and TypeScript checks with nonzero-exit propagation.

## Test-driven evidence

1. `window-options.test.mts` failed because `window-options` did not exist, then passed after the minimal secure policy was added.
2. `application-resource.test.mts` failed because the resolver did not exist, then passed after an exact resource allowlist was added.
3. The first package run exposed an entry-point mismatch. A configuration test then failed with actual `dist/shell/main.js` versus emitted `dist/shell/main/main.js`; correcting `package.json` made it pass.
4. The first hardened runtime aborted because the browser-specific V8 snapshot fuse required a file absent from the official package. A fuse-policy regression test was added, that unsupported fuse was disabled, and the packaged runtime then created an `Ascend` window and exited all processes after a clean close.

Final automated result: two Vitest files with three passing behaviors, four passing Node package-policy tests, strict TypeScript, typed ESLint, Prettier, build, and all Python checks passed through `scripts/check.ps1`. A deliberate frozen-install exit code of 7 made the combined gate terminate nonzero at that step.

## Package and security evidence

- Forge packaged the Windows x64 application successfully under Node 22.23.1.
- The ASAR contains only compiled shell JavaScript, `package.json`, and the two static renderer assets. It contains no TypeScript source, source maps, docs, tests, secrets, or runtime data.
- Fuse readback: RunAsNode off; Node options off; CLI inspect off; embedded ASAR integrity on; only-load-from-ASAR on; file-protocol extra privileges off; cookie encryption on; normal WASM trap handlers on; unsupported browser-specific snapshot off.
- `npm audit --omit=dev --audit-level=high`: zero runtime vulnerabilities. The packaged application has no runtime npm dependency.
- `npm audit signatures`: 575 registry signatures verified; 85 packages also had verified attestations.
- Full development-graph audit: 18 high and 3 low advisories remain in Forge's development-only CLI/rebuild chain, principally `@electron/rebuild` -> pinned `@electron/node-gyp` -> `tar`, plus interactive-editor `tmp`. This scaffold has no native module, runtime dependency, untrusted archive input, or interactive editor path. Do not treat this as release clearance: refresh Forge and repeat reachability review before outside distribution.

## Five-axis review

- **Correctness:** Tests, build, package, fuse readback, and runtime start/render/exit match Task 3.
- **Readability:** Files are small and responsibility-specific; no unnecessary framework or renderer bundle exists.
- **Architecture:** The shell remains thin; no Python/product/data behavior moved into Electron.
- **Security:** No blocking finding. Local allowlists and deny-by-default browser settings match the documented trust boundary.
- **Performance:** No loop, network, background work, or renderer framework was introduced. The unpacked Electron runtime is expectedly large; installer size is Task 4 evidence.

## Residual items handed to Task 4

- The package is unsigned and is not an installer. It must not be distributed outside controlled testing.
- Clean-machine install/start/exit/uninstall, SmartScreen, and antivirus evidence remain unproven.
- The runtime smoke created `%APPDATA%\Ascend` between 20:55 and 20:56. Removal was blocked by the host execution policy despite exact-path validation, so the directory remains and must not be represented as user data. Future smokes must use an isolated profile path.

## Official implementation sources

- https://nodejs.org/en/download/archive/v22.23.1
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/tutorial/context-isolation
- https://www.electronjs.org/docs/latest/api/protocol
- https://www.electronjs.org/docs/latest/tutorial/fuses
- https://www.electronforge.io/config/hooks
- https://typescript-eslint.io/getting-started/typed-linting/
- https://vitest.dev/guide/learn/writing-tests
