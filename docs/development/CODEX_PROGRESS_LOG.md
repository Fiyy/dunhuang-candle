# Codex Progress Log

## 2026-04-26

### Summary

Updated the local background sequence and visible background names to match the new image asset names: `cave17`, `cave112`, then `cave3`.

### Affected Areas / Files

- `app.js`
- `index.html`
- `docs/progress.md`
- `docs/development/PROJECT_STATUS.md`
- `docs/development/CODEX_PROGRESS_LOG.md`
- `image/cave17.png`
- `image/cave112.png`
- `image/cave3.png`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Local image existence check: passing.

### Remaining Risk / Next Step

The new PNG files are local and committed, but may still need web-size optimization if deployment load time is too slow.

## 2026-04-26

### Summary

Removed gesture-based background switching. Background selection is now controlled only by the bottom dot buttons; `Victory` no longer triggers mural/background changes or suppresses candle movement.

### Affected Areas / Files

- `app.js`
- `index.html`
- `README.md`
- `docs/design.md`
- `docs/standards.md`
- `docs/progress.md`
- `docs/development/PROJECT_STATUS.md`
- `docs/development/CODEX_PROGRESS_LOG.md`
- `docs/development/TESTING.md`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Browser/manual validation: still required for dot switching and camera mode.

### Remaining Risk / Next Step

Verify on a touch device that bottom dots are easy to tap while the camera experience is active.

## 2026-04-26

### Summary

Improved candle-lit readability without brightening the fully unlit state. When the candle is actively held, the mural layer now enters a brighter `candle-active` visual state behind the dark overlay, and the candle cutout radius/core are stronger so details inside the flame area are clearer.

### Affected Areas / Files

- `app.js`
- `style.css`
- `docs/development/CODEX_PROGRESS_LOG.md`
- `docs/development/PROJECT_STATUS.md`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Browser visual validation: still required on target display/projector.

### Remaining Risk / Next Step

If the lit area is too broad on the exhibition display, tune `BASE_RADIUS` and `body.candle-active #mural-container` brightness together rather than raising global light.

## 2026-04-26

### Summary

Switched all three background/mural slots from the previous video/remote image sources to local PNG files in `image/`.

### Affected Areas / Files

- `app.js`
- `index.html`
- `README.md`
- `docs/progress.md`
- `docs/development/PROJECT_STATUS.md`
- `docs/development/CODEX_PROGRESS_LOG.md`
- `image/ChatGPT Image Apr 22, 2026, 10_29_11 PM.png`
- `image/ChatGPT Image Apr 22, 2026, 10_48_57 PM.png`
- `image/ChatGPT Image Apr 22, 2026, 11_03_19 PM.png`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Browser image loading validation: still required.

### Remaining Risk / Next Step

The PNG files are local and reliable for deployment, but may need web optimization if page load time is too high.

## 2026-04-26

### Summary

Researched heritage/immersive web atmosphere patterns and strengthened the dust implementation. The page now combines a subtle repeated dust texture with a small set of independently drifting foreground motes, making dust visible in the dark cave scene without adding per-frame JavaScript particle work.

### Research Notes

- Digital heritage examples emphasize immersive storytelling, guided exploration, and atmosphere instead of decorative effects detached from the site.
- Built-heritage research specifically treats lighting, animation, and environmental simulation as ways to recreate place atmosphere.
- Web animation guidance recommends restricting decorative motion to `transform` and `opacity`, testing performance on real devices, and respecting `prefers-reduced-motion`.

### Affected Areas / Files

- `app.js`
- `index.html`
- `style.css`
- `docs/development/CODEX_PROGRESS_LOG.md`
- `docs/development/PROJECT_STATUS.md`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Browser visual validation: still required on target display/projector.

### Remaining Risk / Next Step

Dust visibility is display-dependent. Tune `#atmosphere-layer` opacity and `.dust-mote` alpha values after checking the deployed page on the exhibition display.

## 2026-04-26

### Summary

Reworked candle activation from strict `Closed_Fist` classification to hybrid grip recognition. The app now accepts either a confident MediaPipe `Closed_Fist` result or a relaxed curled-finger landmark signal, with short confirmation/release hysteresis. Also lowered MediaPipe hand detection/presence/tracking thresholds to improve keypoint availability in difficult lighting.

### Research Notes

- MediaPipe Gesture Recognizer provides both canned gesture categories and 21 normalized hand landmarks.
- Canned `Closed_Fist` alone is fragile for natural holding poses because camera angle, occlusion, and lighting can lower the classifier score.
- A better candle interaction is a hybrid hold signal: landmark geometry for continuous holding, classifier labels for assist, and stable-frame hysteresis for visual calm.

### Affected Areas / Files

- `app.js`
- `index.html`
- `README.md`
- `docs/design.md`
- `docs/standards.md`
- `docs/progress.md`
- `docs/development/PROJECT_STATUS.md`
- `docs/development/CODEX_PROGRESS_LOG.md`
- `docs/development/TESTING.md`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Real camera validation: still required.

### Remaining Risk / Next Step

Test the relaxed grip on target devices and tune `FINGER_CURL_MIN_SCORE`, `FIST_CURL_MIN_AVERAGE`, and `FIST_MODEL_ASSIST_MIN_SCORE` if needed.

## 2026-04-26

### Summary

Darkened the unlit mural state and added a CSS-only floating dust layer for a stronger cave/history atmosphere.

### Affected Areas / Files

- `app.js`
- `index.html`
- `style.css`
- `docs/development/PROJECT_STATUS.md`
- `docs/development/CODEX_PROGRESS_LOG.md`

### Verification

- `node --check app.js`: passing.
- `git diff --check`: passing.
- Browser visual validation: still required.

### Remaining Risk / Next Step

Tune dust opacity and unlit darkness on the target display because projector, phone, and laptop brightness differ significantly.

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
