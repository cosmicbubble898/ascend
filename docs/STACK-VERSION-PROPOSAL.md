# Ascend Development Stack and Version Proposal

**Status:** Approved by founder on 2026-07-18; Tasks 2 and 3 complete; Task 4 Squirrel route `no-go`; NSIS fallback proof proposed at OD-14
**Prepared:** 2026-07-18
**Installation state:** Task 2 installed the exact Python quality toolchain through `uv.lock`. Task 3 installed the approved project-local Node 22.23.1/npm 10.9.8 toolchain and exact Electron/TypeScript dependencies through `package-lock.json`. Task 4 installed PyInstaller 6.21.0 and temporarily installed Forge's Squirrel maker 7.11.2 for the approved spike. The Squirrel route failed its installed launcher/uninstall acceptance checks, so its maker and active build wiring were removed.

## Recommendation

Use a minimal Windows-first foundation: Node.js 22 LTS as the build host, the current supported Electron stable, TypeScript 6 for ecosystem compatibility, a manually configured Electron Forge package without a renderer framework or bundler, and a Python 3.13 engine managed by uv. Pin every direct dependency exactly and commit both lockfiles.

This is a version/tooling decision only. It does not authorize application behavior, provider apps, a connection service, real credentials, sensitive data, deployment, or production changes.

## Proposed platform and runtimes

| Layer              | Proposed version/choice                 | Rationale                                                                                                                                                                                                 |
| ------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release target     | Windows 11 x64 first                    | Smallest support and packaging surface. Record Windows 10 observations, but do not promise an OS that is outside normal Microsoft support without a later decision.                                       |
| Build-host Node.js | 22.23.1 LTS                             | Supported LTS and compatible with the selected quality tools. It avoids the current open Electron Forge packaging hang reported on Node 24.16+ and 26.                                                    |
| npm                | 10.9.8 bundled with Node 22.23.1        | Keeps the Node/npm pair reproducible. Use one `package-lock.json` and `npm ci`.                                                                                                                           |
| Electron runtime   | 43.1.1 exact                            | Current stable on 2026-07-18; includes Chromium 150 and Node 24.18.0. Electron's embedded Node is distinct from the Node version used to run build tools.                                                 |
| TypeScript         | 6.0.3 exact                             | TypeScript 7.0 does not yet ship a programmatic API, while typescript-eslint officially supports TypeScript below 6.1. Re-evaluate when TypeScript 7.1 and the surrounding toolchain are stable together. |
| Python             | CPython 3.13.14 x64, standard GIL build | Maintained bugfix line with broad Windows/native-package compatibility. Python 3.14 is newer, but 3.13 is the lower-risk packaging baseline for an audio/native-heavy desktop product.                    |

## Proposed JavaScript and Electron toolchain

| Direct dependency/tool | Exact version | Purpose                                                            |
| ---------------------- | ------------: | ------------------------------------------------------------------ |
| `electron`             |        43.1.1 | Desktop runtime                                                    |
| `@electron-forge/cli`  |        7.11.2 | Reproducible packaging pipeline                                    |
| `@electron/fuses`      |         2.1.3 | Package-time hardening and fuse verification through a Forge hook  |
| `typescript`           |         6.0.3 | Shell compiler and type checker                                    |
| `@types/node`          |       22.20.1 | Limit shared/build-time code to the Node 22 API surface            |
| `vitest`               |        4.1.10 | Focused TypeScript unit tests                                      |
| `eslint`               |        10.7.0 | JavaScript/TypeScript lint runner                                  |
| `typescript-eslint`    |        8.64.0 | Type-aware TypeScript parser, plugin, and rules                    |
| `prettier`             |         3.9.4 | Deterministic TypeScript, JSON, Markdown, CSS, and HTML formatting |

### Shell build choice

Do not introduce React, another UI framework, Webpack, or Vite during Milestone 0. Compile the main and preload TypeScript with `tsc`; use a static local HTML/CSS renderer for the skeleton; package the compiled output and static assets with Electron Forge.

Reasons:

- The first skeleton needs process supervision and security boundaries, not a UI framework.
- Electron Forge marks its Vite integration experimental and allows breaking changes in minor releases.
- The Forge 7.11.2 TypeScript/Webpack template still carries old TypeScript and ESLint ranges, so generating it blindly would conflict with the reviewed toolchain.
- Avoiding an unnecessary bundler reduces install scripts, transitive packages, configuration, and renderer privilege surface.

A production UI framework and renderer bundler, if needed, will be selected from current official sources in the first UI feature specification.

### Electron security defaults required in Task 3

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- no `<webview>` and no remote-content navigation
- narrow typed preload API only; never expose raw `ipcRenderer`
- sender and payload validation on every privileged IPC handler
- strict Content Security Policy and a local custom protocol rather than privileged `file://` behavior
- ASAR enabled; embedded ASAR integrity validation and only-load-from-ASAR enabled
- disable RunAsNode, Node options, CLI inspect, and unnecessary file-protocol privileges
- set `strictlyRequireAllFuses: true` so a new Electron fuse fails the package build until reviewed
- exact Electron pin and a supported-major/security review before every release

The direct `@electron/fuses` hook is intentional: Forge 7.11.2's fuses plugin declares a peer range for the older `@electron/fuses` 1.x line, while 2.1.3 is the current official fuses package. Task 3 must prove the chosen hook and read back every packaged fuse.

## Proposed Python engine toolchain

| Direct dependency/tool |                Exact version | Purpose                                                             |
| ---------------------- | ---------------------------: | ------------------------------------------------------------------- |
| `uv`                   |                      0.11.29 | Python/runtime management and universal lockfile                    |
| `uv_build`             |                      0.11.29 | Build backend for the `src`-layout engine package                   |
| `fastapi`              |                      0.139.2 | Typed loopback-only engine surface when Task 9 begins               |
| `uvicorn`              |                       0.51.0 | Minimal ASGI server; install without the `standard` extra initially |
| `pytest`               |                        9.1.1 | Behavioral Python tests                                             |
| `ruff`                 |                      0.15.22 | Python linting and formatting                                       |
| `mypy`                 |                        2.3.0 | Strict static type checking                                         |
| `pyinstaller`          |                       6.21.0 | Windows engine-sidecar packaging spike                              |
| `sqlite3`              | Python 3.13 standard library | Synthetic-only local development database until OD-03 is approved   |

FastAPI and Uvicorn are approved choices for the later authenticated loopback surface; they do not need to be installed in the empty Task 2 package unless the task uses them. Avoid `fastapi[standard]` and `uvicorn[standard]` until a measured requirement justifies their extra packages and install surface.

Use a packaged `src/ascend_engine` layout with `uv_build`, `pyproject.toml`, `.python-version`, and committed `uv.lock`. Use `uv run --locked` and `uv lock --check` in quality scripts. Do not modify system Python or install project packages globally.

## Python sidecar packaging

Start with PyInstaller `onedir`, not `onefile`:

- `onedir` is easier to inspect and debug during the early installer/AV spike.
- `onefile` extracts to a temporary directory at runtime and adds startup and security/AV complexity.
- Build the Windows sidecar on Windows; PyInstaller is not a cross-compiler.
- Package the engine as an Electron extra resource and run it as the current user, never elevated.
- Record hashes, versions, bundled DLLs, startup time, shutdown behavior, and AV/SmartScreen observations.

Task 4 may change the distribution form only with written evidence and an approved update.

## SQLite and encryption decision

No Python SQLCipher wrapper is approved in this proposal. Current official evidence establishes viable database engines—SQLCipher 4.17.0 and SQLite SEE—but does not establish a current first-party Python binding that is proven with CPython 3.13, Windows packaging, key custody, migrations, backups, and PyInstaller.

Therefore:

1. Task 2 and Task 3 may use no database or standard-library SQLite with synthetic data only.
2. OD-03 continues to block migration 0001, real user data, recordings, outside testing, and privacy claims.
3. Before Task 5, run an approval-gated Windows encryption spike comparing official SQLCipher and SQLite SEE.
4. The spike must prove the maintained binding/build path, x64 packaging, key generation and DPAPI custody, journal/WAL protection, wrong-key behavior, migration and rekey behavior, backup/restore, crash recovery, performance, licensing, cost, and PyInstaller compatibility.
5. Select the engine and binding in a separate ADR. Do not adopt an abandoned community wrapper merely to remove the gate.

This prevents an untested encryption choice from becoming the permanent storage foundation.

## Reproducibility and supply-chain rules

### Node/Electron

- Put exact versions in `package.json`; no `^`, `~`, `latest`, Git URL, or unpinned alias.
- Set `engines.node` to `22.23.1` and `packageManager` to `npm@10.9.8`.
- Create one authoritative `package-lock.json` with npm 10.9.8.
- Resolve the lockfile with scripts disabled, inspect all packages that declare install scripts, then permit only the reviewed scripts required for Electron/Forge packaging.
- Use `npm ci` from the committed lockfile; never use a global Electron or Forge install.
- Record license and vulnerability-review results. A scanner result informs review but cannot replace it.

### Python

- Put exact `==` versions in approved dependency groups and commit `uv.lock`.
- Pin `.python-version` to 3.13.14 and the uv tool to 0.11.29.
- Use `uv sync --locked` and `uv run --locked`; do not fall back to unconstrained `pip install`.
- Inspect wheels, source builds, licenses, native DLLs, and install/build hooks before packaging.
- Record `python --version`, `sqlite3.sqlite_version`, lockfile state, and Windows architecture in build evidence.

### Updates

- Check Electron support/security status before every release because supported majors move quickly.
- Review dependency updates at least monthly and immediately for relevant security advisories.
- Upgrade one logical group at a time, regenerate the relevant lockfile, run the full gate, package, and smoke-test Windows behavior.
- Revisit Node 24 only after the Forge packaging issue is fixed and a local packaging smoke passes.
- Revisit TypeScript 7 at 7.1 or later when typescript-eslint and any compiler-API consumers officially support the same route.

## Compatibility assessment

| Check                                                         | Research result                                                  | Required proof after approval                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Node 22 with ESLint 10                                        | Supported by ESLint's declared Node range                        | Install and run lint                                           |
| TypeScript 6 with typescript-eslint                           | Officially inside `>=4.8.4 <6.1.0`                               | Type-aware lint and `tsc --noEmit`                             |
| Electron 43 on Windows x64                                    | Current stable package and supported major                       | Start, render local page, exit                                 |
| Forge 7.11.2 on Node 22                                       | Meets Forge's Node floor and avoids the reported Node 24/26 hang | Package smoke; this is not considered proven by metadata alone |
| Python 3.13 with FastAPI/Uvicorn/pytest/Ruff/mypy/PyInstaller | Package metadata supports the runtime/Windows where applicable   | Locked sync, imports, checks, and sidecar build                |
| SQLite encryption path                                        | Not yet proven                                                   | Separate OD-03 spike before migration or real data             |

Metadata-level compatibility is enough for this proposal, not for a completion claim. Task 2 and Task 3 must produce real install, test, lint, format, type-check, build, package, and runtime evidence as applicable.

## Planned quality gate after approval

The exact scripts will be created and tested incrementally, but the target gate is:

```text
Python: uv lock --check
        -> ruff format --check
        -> ruff check
        -> mypy
        -> pytest

Shell:  npm lock/version checks
        -> prettier --check
        -> eslint
        -> tsc --noEmit
        -> vitest run
        -> tsc build

Top:    scripts/check.ps1 runs both groups and propagates every failure
```

Packaging is a separate early spike because success on a development machine is not proof of a clean Windows package.

## Official sources reviewed

### Runtimes and desktop

- Node.js release policy and supported lines: https://nodejs.org/en/about/previous-releases
- Node.js 22.23.1 release: https://nodejs.org/en/blog/release/v22.23.1/
- npm bundled in Node 22.23.1 source: https://raw.githubusercontent.com/nodejs/node/v22.23.1/deps/npm/package.json
- Electron 43.1.1 release: https://releases.electronjs.org/release/v43.1.1
- Electron release schedule: https://releases.electronjs.org/schedule
- Electron security checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Electron fuses: https://www.electronjs.org/docs/latest/tutorial/fuses
- Electron packaging recommendation: https://www.electronjs.org/docs/latest/tutorial/application-distribution
- Electron Forge 7.11.2: https://github.com/electron/forge/releases/tag/v7.11.2
- Forge Node 24/26 packaging issue: https://github.com/electron/forge/issues/4277
- Forge Vite experimental status: https://www.electronforge.io/templates/vite-%2B-typescript
- Forge 7.11.2 TypeScript/Webpack template metadata: https://raw.githubusercontent.com/electron/forge/v7.11.2/packages/template/webpack-typescript/tmpl/package.json

### TypeScript quality tools

- TypeScript 7 transition and missing 7.0 API: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- TypeScript package/version history: https://www.npmjs.com/package/typescript
- typescript-eslint compatibility range: https://typescript-eslint.io/users/dependency-versions/
- ESLint package and Node range: https://www.npmjs.com/package/eslint
- Vitest package versions: https://www.npmjs.com/package/vitest
- Prettier 3.9 release and exact-pin guidance: https://prettier.io/blog/2026/06/27/3.9.0
- Prettier current configuration examples: https://prettier.io/docs/sharing-configurations

### Python

- Python 3.13.14 release: https://www.python.org/downloads/release/python-31314/
- Python version support: https://devguide.python.org/versions/
- uv project/lockfile behavior: https://docs.astral.sh/uv/concepts/projects/layout/ and https://docs.astral.sh/uv/concepts/projects/sync/
- FastAPI releases and version policy: https://fastapi.tiangolo.com/release-notes/ and https://fastapi.tiangolo.com/deployment/versions/
- Uvicorn package metadata: https://pypi.org/project/uvicorn/
- pytest changelog: https://docs.pytest.org/en/latest/changelog.html
- Ruff versioning: https://docs.astral.sh/ruff/versioning/
- mypy releases: https://mypy-lang.org/news.html
- PyInstaller operation and packaging: https://pyinstaller.org/en/latest/operating-mode.html

### Storage

- Python 3.13 `sqlite3`: https://docs.python.org/3.13/library/sqlite3.html
- SQLite SEE: https://sqlite.org/see/doc/release/www/readme.wiki
- SQLCipher documentation and Windows package: https://www.zetetic.net/sqlcipher/documentation/ and https://www.zetetic.net/sqlcipher/sqlcipher-windows/
- SQLCipher 4.17.0 release: https://discuss.zetetic.net/t/sqlcipher-4-17-0-release/7238

## Approval record

The founder approved this proposal on 2026-07-18 and authorized Task 2 only: create the Python package and its quality skeleton with the approved versions needed by that task. Task 2 must still be test-driven and verified. This does not authorize Task 3 automatically, provider work, sensitive data, cloud resources, credentials, signing spend, or deployment.

Recorded approval text:

> Approved: `docs/STACK-VERSION-PROPOSAL.md`. Proceed with Task 2 under the recorded gates.
