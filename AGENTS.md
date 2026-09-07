<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Workspace and release guardrails

- Work only in `/Volumes/WATASHI-SSD/WATASHI_WORKSPACE/projects/watashi-no-torisetsu`. Treat any old Desktop copy as read-only backup material. Before work, verify both `pwd` and `git rev-parse --show-toplevel`; do not rename the SSD or workspace directories, and do not disconnect the SSD while work is running.
- Allow only one writing task in this repository at a time. Other concurrent tasks must remain read-only. Do not overlap Git operations, dependency updates, or build generation with another running task.
- Preserve all pre-existing tracked and untracked changes. Never use `git add -A`; stage explicit paths or selected hunks, keep commits scoped by feature, and check `git status` plus `git diff --cached --check` before committing. Push only with explicit user authorization; a non-`main` push can start a Vercel Preview deployment.
- Before code changes, read this file and the relevant Next.js 16.2.6 local documentation. Normally run ESLint, TypeScript, and a production build; use an isolated parent-HEAD-plus-target-diff build for large commits, with dedicated checks for images, PDFs, and migrations.
- Do not commit local outputs or secrets, including `.codex_tmp/`, `supabase/.temp/`, `node_modules/`, `.next/`, `.env.local`, API keys, or tokens. Never expose secret values in chat, logs, or screenshots, and never place secrets in `NEXT_PUBLIC_*`.
- Supabase migrations must use unique `YYYYMMDDHHMMSS_name.sql` names. Check applied history and remote schema before changes; never run `db push` or `migration repair` without explicit authorization.
- Do not push, apply database changes, send to external services, deploy, promote, or alter Vercel configuration unless explicitly authorized. Follow [`docs/WORKSPACE_RELEASE_POLICY.md`](docs/WORKSPACE_RELEASE_POLICY.md) for the complete policy.
