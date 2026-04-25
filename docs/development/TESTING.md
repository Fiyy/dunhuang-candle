# Testing Guide

Last updated: 2026-04-26

## Baseline Checks

Run these before handing off any change:

```bash
node --check app.js
git diff --check
```

For documentation-only changes, `git diff --check` is enough unless the docs reference changed runtime behavior.

## Local Browser Smoke Test

Serve the app locally:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` and verify:

- Start guide appears before camera permission.
- `Start Exploring` starts model/camera initialization.
- Loading screen hides after the first camera result or fallback.
- Bottom `Light On / Off` button controls global brightness.
- Mural dot buttons switch murals.

## Gesture Test Checklist

Use this checklist for any gesture behavior change:

- Closed fist lights the candle.
- Open hand does not light the candle.
- Releasing the fist turns the candle off.
- Moving a closed fist moves the candle smoothly.
- Moving a closed fist closer/farther changes zoom.
- Holding victory switches to the next mural once, not repeatedly.
- Moving to screen edges while zoomed pans the mural.
- No hand present leaves the candle off.

Record the tested device, browser, and lighting condition in `CODEX_PROGRESS_LOG.md` when real camera testing is performed.

## Touch / Mouse Fallback Checklist

Use this checklist after fallback or startup changes:

- Denying camera permission enters Touch Mode.
- Model/camera timeout enters Touch Mode.
- One-finger touch moves and lights the candle.
- Two-finger touch zooms the mural.
- Mouse drag moves and lights the candle on desktop.
- Mouse wheel zooms the mural on desktop.
- Bottom controls remain clickable.

## Deployment Validation

After pushing a meaningful batch:

- Confirm GitHub Actions Pages workflow completes.
- Open the deployed Pages URL.
- Verify static assets load.
- Run at least the browser smoke test on the deployed URL.

## Push Habit

For larger module changes, do not leave the work only in the local tree. After verification and documentation updates:

```bash
git status --short
git add <changed-files>
git commit -m "<focused message>"
git push origin <branch>
```

If push fails because credentials are missing, report that explicitly and keep the local commit intact.
