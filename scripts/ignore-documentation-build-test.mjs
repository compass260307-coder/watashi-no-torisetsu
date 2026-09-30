import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./ignore-documentation-build.mjs", import.meta.url));

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), "watashi-build-ignore-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--initial-branch=main");
  git("config", "user.name", "Build ignore test");
  git("config", "user.email", "build-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  function commit(files) {
    for (const [path, content] of Object.entries(files)) {
      const target = join(cwd, path);
      mkdirSync(dirname(target), { recursive: true });
      if (content === null) rmSync(target);
      else writeFileSync(target, content);
    }
    git("add", "--", ...Object.keys(files));
    git("commit", "--allow-empty", "-m", "Fixture commit");
    return git("rev-parse", "HEAD");
  }
  function run(previous, current, directory = cwd) {
    const result = spawnSync(process.execPath, [script], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previous, VERCEL_GIT_COMMIT_SHA: current },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    return result.status;
  }
  const base = commit({ "src/app.ts": "export const value = 1;\n", "README.md": "Read me\n" });
  return { cwd, git, commit, run, base };
}

test("skips only allowed Markdown documentation, including nested and unusual names", (t) => {
  const r = repository(t);
  const current = r.commit({ "README.md": "Updated\n", "AGENTS.md": "Guidance\n", "CLAUDE.md": "Guidance\n", "HANDOFF.md": "Notes\n", "docs/nested/a note\nwith newline.md": "Notes\n" });
  assert.equal(r.run(r.base, current), 0);
});

for (const path of ["src/app.ts", "package-lock.json", "next.config.ts", "vercel.json", "docs/example.ts", "docs/design.html", "docs/COMMERCE_CATALOG.md", "public/report.pdf", "apps/mobile/app.ts", "scripts/build.mjs", ".github/workflows/check.yml", "unknown.md"]) {
  test(`builds when ${path} changes along with documentation`, (t) => {
    const r = repository(t);
    const current = r.commit({ "README.md": "Updated\n", [path]: "Changed\n" });
    assert.equal(r.run(r.base, current), 1);
  });
}

test("builds cumulative code changes even when the latest commit is documentation-only", (t) => {
  const r = repository(t);
  r.commit({ "src/app.ts": "export const value = 2;\n" });
  const current = r.commit({ "docs/latest.md": "Notes\n" });
  assert.equal(r.run(r.base, current), 1);
});

test("moving source into docs still builds (rename detection cannot hide a deletion)", (t) => {
  const r = repository(t);
  const current = r.commit({ "src/app.ts": null, "docs/moved.md": "export const value = 1;\n" });
  assert.equal(r.run(r.base, current), 1);
});

test("deleting documentation alone can skip", (t) => {
  const r = repository(t);
  assert.equal(r.run(r.base, r.commit({ "README.md": null })), 0);
});

test("first deployments, missing/invalid SHAs, same-SHA redeploys and empty diffs build", (t) => {
  const r = repository(t);
  const current = r.commit({ "docs/new.md": "Notes\n" });
  for (const [previous, head] of [["", current], [r.base, ""], ["HEAD^", current], [r.base, "main"], ["f".repeat(40), current], [current, current]]) {
    assert.equal(r.run(previous, head), 1);
  }
  assert.equal(r.run(current, r.commit({})), 1);
});

test("a checkout that does not match the deployment SHA builds", (t) => {
  const r = repository(t);
  const current = r.commit({ "docs/new.md": "Notes\n" });
  r.commit({ "src/app.ts": "export const value = 2;\n" });
  assert.equal(r.run(r.base, current), 1);
});

test("diverged history builds even if the trees differ only in documentation", (t) => {
  const r = repository(t);
  const previous = r.commit({ "docs/previous.md": "Previous branch\n" });
  r.git("checkout", "-b", "replacement", r.base);
  const current = r.commit({ "docs/current.md": "Replacement branch\n" });
  assert.equal(r.run(previous, current), 1);
});

test("missing shallow history and git errors continue building", (t) => {
  const r = repository(t);
  const current = r.commit({ "docs/current.md": "Notes\n" });
  const shallow = join(r.cwd, "shallow");
  r.git("clone", "--depth=1", `file://${r.cwd}`, shallow);
  assert.equal(r.run(r.base, current, shallow), 1);
  const noGit = mkdtempSync(join(tmpdir(), "watashi-no-git-"));
  t.after(() => rmSync(noGit, { recursive: true, force: true }));
  assert.equal(r.run(r.base, current, noGit), 1);
});
