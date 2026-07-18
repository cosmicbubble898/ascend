# Junior-Safe Development Workflow

This workflow applies to every Ascend feature and meaningful behavior change.

## 1. Orient

- Read `PROJECT-CHARTER.md` and `AGENTS.md`.
- Read only the specification, ADR, source files, tests, and historical references relevant to the current task.
- Check the working tree before editing. Existing changes belong to the user unless proven otherwise.
- State assumptions and surface conflicting requirements.

## 2. Specify

- Write or update the relevant section of `docs/SPEC.md`.
- Define user-visible behavior, acceptance criteria, failure behavior, privacy boundaries, and organization-readiness effects.
- List unresolved choices in `docs/OPEN-DECISIONS.md`.
- Stop and obtain human approval before significant implementation.

## 3. Plan

- Update `tasks/plan.md` with dependency order, risks, and checkpoints.
- Add one-session tasks to `tasks/todo.md`.
- Each task must identify acceptance criteria, verification, dependencies, and likely files.
- Do not start a task that depends on an unresolved blocking decision.

## 4. Verify external choices

Before adding or changing a framework, library, SDK, model, cloud provider, or external API:

- Check current official documentation.
- Record the chosen version and reason in the spec or an ADR.
- Ask before installing the dependency.

## 5. Implement with TDD

For each production behavior:

1. Write one small behavioral test.
2. Run it and confirm it fails for the expected missing-behavior reason.
3. Write the minimum implementation needed to pass.
4. Rerun the focused test.
5. Run relevant surrounding tests.
6. Refactor only while tests remain green.

Do not write a large batch of tests or implementation before running feedback.

## 6. Check the safety boundaries

For identity, permissions, user data, databases, secrets, recordings, file access, integrations, or cloud communication, review:

- Workspace and owner scope
- Tenant-account versus work-entity meaning
- Authorization below the UI
- Private-by-default behavior
- Input validation and path safety
- Audit actor and source information
- Secret and content redaction in logs
- Deletion, retention, export, and organization-leaving behavior
- Protection against employee ranking, hidden monitoring, and manager exposure of private activity
- LLM/import prompt-injection resistance and strict output validation
- Resource limits for files, requests, tokens, retries, queues, and background jobs

## 7. Verify completion

Run the task's focused test plus every relevant available check:

- Python tests, lint, formatting, and type checks
- TypeScript tests, lint, formatting, type checks, and build
- Appropriate Windows runtime checks for audio, clipboard, hotkeys, tray, and installer behavior

Manual testing is supplementary evidence, not a substitute for automated checks.

## 8. Review and hand off

- Review the diff for correctness, clarity, security, regressions, and unnecessary complexity.
- Update the spec, ADR, plan, task checklist, and session notes when reality changed the design.
- Explain what changed, why the test proves it, and what risk remains.
- Do not commit, push, or deploy unless the user requested it.
