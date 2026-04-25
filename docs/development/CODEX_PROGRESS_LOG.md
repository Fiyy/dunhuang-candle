# Codex Progress Log

## 2026-04-26

### Summary

Added project documentation and repository-level agent instructions based on the `gisprefabhouse` workflow pattern.
Sanitized the local `origin` remote URL to remove an embedded token.

### Affected Areas / Files

- `AGENTS.md`
- `README.md`
- `docs/design.md`
- `docs/standards.md`
- `docs/progress.md`
- `docs/development/PROJECT_STATUS.md`
- `docs/development/CODEX_PROGRESS_LOG.md`
- `docs/development/TESTING.md`
- `.gitignore`
- local Git remote config

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.

### Remaining Risk / Next Step

Commit and push after the user approves the current documentation and gesture behavior batch.

## 2026-04-26

### Summary

Changed candle activation so the candle lights only when MediaPipe recognizes `Closed_Fist`. Other hand poses now leave the candle dark. Kept `Victory` as the only discrete hand gesture for switching murals.

### Affected Areas / Files

- `app.js`
- `index.html`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Real camera validation: still required.

### Remaining Risk / Next Step

Tune closed-fist confidence threshold on target devices.

## 2026-04-26

### Summary

Added a start guide before camera permission, removed hand gesture control for global light mode, and documented that `Light On / Off` is button-only.

### Affected Areas / Files

- `app.js`
- `index.html`
- `style.css`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Browser visual validation: still required.

### Remaining Risk / Next Step

Confirm the start screen layout on mobile screen sizes.

## 2026-04-26

### Summary

Stabilized gesture detection with MediaPipe version pinning, GPU-to-CPU fallback, startup fallback, inference throttling, discrete gesture confirmation, coordinate smoothing, and zoom deadband.

### Affected Areas / Files

- `app.js`
- `index.html`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Real camera validation: still required.

### Remaining Risk / Next Step

Add a debug overlay or logging mode before final tuning.
