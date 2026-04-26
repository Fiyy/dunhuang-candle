# Project Progress

Last updated: 2026-04-26

## Current Status

The project is a static GitHub Pages app with a gesture-driven candle exploration experience. The latest local work focuses on hand gesture stability, explicit manual lighting control, a first-run gesture guide, and a candle-holding metaphor using hybrid grip detection.

Canonical status and work logs now live in:

- `docs/development/PROJECT_STATUS.md`
- `docs/development/CODEX_PROGRESS_LOG.md`
- `docs/development/TESTING.md`

## Completed

- Built static page structure for mural display, dark overlay canvas, top title, bottom controls, and version badge.
- Added candle-light reveal rendering with warm glow and animated flame.
- Added MediaPipe Gesture Recognizer integration.
- Added touch and mouse fallback when camera/model initialization fails.
- Added background switching through bottom dots.
- Added distance-based zoom and edge auto-pan.
- Pinned MediaPipe runtime version to reduce CDN drift.
- Added GPU-to-CPU fallback for gesture recognizer initialization.
- Added startup timeouts and real touch-mode fallback.
- Added inference throttling for better mobile performance.
- Added gesture stability logic for discrete gestures.
- Removed gesture control for global light mode.
- Removed gesture control for background switching.
- Added start guide before camera permission is requested.
- Changed candle activation so a relaxed curled-finger grip or `Closed_Fist` lights and controls the candle.
- Added project documentation set: design, standards, and progress.
- Added repository agent instructions and development status/log/testing documents.
- Sanitized the local `origin` remote URL so it no longer contains an embedded token.
- Switched the three background slots to local PNG files from `image/`.

## In Progress

- Gesture tuning for real devices.
- Refinement of grip curl thresholds and zoom sensitivity.
- Documentation maintenance as behavior stabilizes.

## Open Risks

- Grip recognition may still be inconsistent across webcams, phones, and lighting conditions.
- Distance-based zoom can drift because it estimates depth from hand landmark scale.
- MediaPipe and model assets are loaded from external CDNs and Google-hosted model storage.
- Background image reliability now depends on committed local `image/` assets instead of Wikimedia availability.
- The repository previously exposed a credential-bearing Git remote URL locally; verify credentials have been rotated and remote URL sanitized before sharing logs or environment details.

## Recommended Next Steps

1. Test relaxed grip, bottom-dot background switching, and fallback touch mode on target mobile hardware.
2. Tune grip curl thresholds, `CANDLE_HOLD_MIN_SCORE`, `ZOOM_DEADBAND`, and `ZOOM_SENSITIVITY` based on real testing.
3. Consider adding an optional debug overlay for gesture name, score, zoom, and mode during calibration.
4. Optimize local `image/` PNG assets for web delivery if load time becomes an issue.
5. Add a short browser test checklist to the repository once target devices are known.
6. Commit and push the current verified batch once ready.

## Verification Log

- 2026-04-26: `node --check app.js` passed.
- 2026-04-26: `git diff --check` passed.
