import { execFileSync } from "node:child_process";

// Vercel's Ignored Build Step uses 0 to skip and 1 to continue building.
// Unknown history or input must always continue the build.
const rootDocuments = new Set(["README.md", "AGENTS.md", "CLAUDE.md", "HANDOFF.md"]);
const commitSha = /^[0-9a-f]{40}$/i;

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function isDocumentation(path) {
  // Keep catalog changes on the normal build/commerce-validation path.
  if (path === "docs/COMMERCE_CATALOG.md") return false;
  return rootDocuments.has(path) || (path.startsWith("docs/") && path.endsWith(".md"));
}

function canSkipBuild() {
  // This is the previous SUCCESSFUL deployment, not HEAD^: a failed code
  // deployment followed by a documentation commit must still rebuild the code.
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA ?? "";
  const current = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!commitSha.test(previous) || !commitSha.test(current)) return false;
  if (previous.toLowerCase() === current.toLowerCase()) return false;
  if (git("rev-parse", "HEAD").trim().toLowerCase() !== current.toLowerCase()) return false;

  // Shallow history and unrelated/rebased history are handled conservatively.
  git("merge-base", "--is-ancestor", previous, current);
  // Disable rename detection so moving source code into docs still counts as
  // deleting source code. NUL delimiters also preserve spaces/newlines in paths.
  const paths = git("diff", "--name-only", "--no-renames", "-z", previous, current, "--")
    .split("\0")
    .filter(Boolean);
  return paths.length > 0 && paths.every(isDocumentation);
}

try {
  const skip = canSkipBuild();
  console.log(skip ? "Documentation-only change: skipping build." : "Continuing normal build.");
  process.exitCode = skip ? 0 : 1;
} catch {
  console.log("Could not safely identify a documentation-only change: continuing normal build.");
  process.exitCode = 1;
}
