# Repository Agent Instructions

## First Read Rule

When a new Codex session starts and the user asks things like `了解项目`, `熟悉项目`, `review项目`, asks for current progress, or asks about project risk, read these files first before answering:

1. `README.md`
2. `docs/development/PROJECT_STATUS.md`
3. `docs/development/CODEX_PROGRESS_LOG.md`

Use those files as the primary source of truth for:

- project purpose and architecture
- current implementation status
- completed work
- known risks
- test and verification expectations
- next recommended tasks

Do not answer only from ad hoc code scanning if the status files already cover the latest state. Use the status files first, then inspect code as needed.

## Progress Logging Rule

After every meaningful completed step, update `docs/development/CODEX_PROGRESS_LOG.md`.

A meaningful completed step includes:

- finishing a bug fix
- finishing a gesture or interaction change
- finishing a UI/UX change
- finishing a review batch
- finishing a refactor
- restoring validation health
- adding or changing infrastructure/config
- updating project docs or workflow expectations
- identifying a new confirmed risk or blocker

Each log entry must include:

- date
- summary of what changed
- affected areas/files
- verification result
- remaining risk or next step

## Status Sync Rule

If the overall project state changes materially, also update `docs/development/PROJECT_STATUS.md`.

Examples:

- a major gesture behavior changes
- validation status changes from failing to passing
- key risks are added or removed
- workflow/tooling expectations change
- deployment assumptions change

## Testing Rule

Every code change should include verification that is proportional to the risk of the change.

Minimum checks:

- JavaScript changes: run `node --check app.js`.
- Any change before handoff: run `git diff --check`.
- Gesture changes: record whether browser camera testing was done or still needed.
- Fallback changes: record whether touch/mouse fallback was tested or still needed.
- Documentation-only changes: run `git diff --check`.

Do not claim real camera, mobile, or GitHub Pages validation unless it was actually performed.

## Remote Sync Rule

For any larger module change, feature batch, or multi-file workflow update, the preferred habit is:

1. Verify locally.
2. Update status/progress docs.
3. Commit with a focused message.
4. Push the branch to `origin`.
5. Report the commit SHA or push status.

Do not push secrets. Do not use credential-bearing remote URLs. If remote credentials appear in config or logs, sanitize the remote and ask the user to rotate the token.

## Response Expectation For `了解项目`

When the user asks to understand the project, the answer should summarize:

- product purpose
- frontend/runtime structure
- asset-generation tooling
- current code health
- latest completed work
- open risks
- recommended next actions
