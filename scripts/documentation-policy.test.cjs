const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("screen-text privacy language states a testable best-effort boundary", () => {
  const spec = readProjectFile("docs/SPEC.md");

  assert.doesNotMatch(
    spec,
    /private contexts, and password fields are blocked at the capture source before persistence/,
  );
  assert.match(spec, /provider-aware best-effort filtering/i);
  assert.match(spec, /capture fails closed/i);
  assert.match(
    spec,
    /cannot guarantee that every secret is impossible to capture/i,
  );
});

test("synthetic migration work is not incorrectly blocked on encryption", () => {
  const stack = readProjectFile("docs/STACK-VERSION-PROPOSAL.md");

  assert.doesNotMatch(
    stack,
    /Before Task 5, run an approval-gated Windows encryption spike/,
  );
  assert.match(stack, /Tasks 5 and 6 may proceed with synthetic data/i);
  assert.match(stack, /Before real data or outside testing/i);
});

test("identity terminology and Task 8 actor requirements are unambiguous", () => {
  const workflow = readProjectFile("JUNIOR_WORKFLOW.md");
  const todo = readProjectFile("tasks/todo.md");

  assert.doesNotMatch(workflow, /work-entity/);
  assert.doesNotMatch(todo, /work-entity/);
  assert.match(workflow, /memory entity\/context/);
  assert.doesNotMatch(todo, /actor\/client, tenant/);
  assert.match(todo, /acting actor, tenant, and workspace context/);
  assert.match(
    todo,
    /caller\/client provenance.*never substitutes for actor identity/i,
  );
});

test("current setup documentation uses the patched Node and Electron versions", () => {
  const spec = readProjectFile("docs/SPEC.md");
  const stack = readProjectFile("docs/STACK-VERSION-PROPOSAL.md");

  assert.doesNotMatch(spec, /22\.23\.1/);
  assert.match(spec, /node-v22\.23\.2-win-x64/);
  assert.doesNotMatch(spec, /^uv /m);
  assert.doesNotMatch(
    spec,
    /\.\\\.tools\\uv-0\.11\.29\\uv\.exe (?:sync|lock|run)/,
  );
  assert.match(spec, /scripts\\bootstrap-python\.ps1/);
  assert.match(spec, /runtime\\python-env-0\.11\.29\\Scripts\\python\.exe/);
  assert.doesNotMatch(stack, /43\.1\.1/);
  assert.match(stack, /\| `electron`\s+\|\s+43\.3\.0 \|/);
});

test("the installation identity contract remains a blocking Task 7 decision", () => {
  const dataModel = readProjectFile("docs/DATA-MODEL.md");
  const decisions = readProjectFile("docs/OPEN-DECISIONS.md");
  const combined = `${dataModel}\n${decisions}`;

  for (const term of [
    "filename",
    "path",
    "format",
    "ACL",
    "atomic write",
    "reparse",
  ]) {
    assert.match(combined, new RegExp(term, "i"));
  }
  assert.match(decisions, /OD-21/);
  assert.match(decisions, /Blocks.*Task 7/i);
});
