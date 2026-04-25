# Project Status

Last updated: 2026-04-26

## Summary

Dunhuang Candle is a static browser experience for exploring Dunhuang mural imagery through a candle-light reveal effect. The runtime uses plain HTML, CSS, JavaScript, MediaPipe hand gesture recognition, and a touch/mouse fallback.

## Current Implementation

- Static app entry: `index.html`.
- Styling and responsive UI: `style.css`.
- Runtime interaction and rendering: `app.js`.
- Offline media tooling: `gen_parallax.py`, `segment_mural.py`, `segment_mural_v2.py`, `segment_mural_v3.py`.
- Deployment: GitHub Pages workflow uploads the repository root on pushes to `main`.

## Current Interaction Model

- User sees a start guide before camera access is requested.
- User clicks `Start Exploring` to start camera/model initialization.
- `Closed_Fist` lights and controls the candle.
- Releasing the fist or using another hand pose turns the candle off.
- Hand distance while holding fist controls zoom.
- Edge position while zoomed auto-pans the mural.
- Holding `Victory` switches to the next mural.
- Global `Light On / Off` is controlled only by the button.
- Touch fallback supports one-finger candle movement and two-finger zoom.
- Desktop fallback supports mouse drag and mouse wheel zoom.

## Validation Status

- `node --check app.js`: passing as of 2026-04-26.
- `git diff --check`: passing as of 2026-04-26.
- Real camera gesture testing: still required on target devices.
- Mobile touch fallback testing: still required on target devices.
- GitHub Pages deployment validation after latest changes: still required.

## Current Risks

- `Closed_Fist` recognition may vary by device, light, skin tone, camera angle, and distance.
- Distance-based zoom is an approximation based on hand landmark scale, not true depth.
- The app depends on external MediaPipe CDN/model hosting and remote Wikimedia mural images.
- No automated browser test suite exists yet.
- Git remote previously contained a credential-bearing URL in local config. The remote has been sanitized locally, but the exposed token should be considered compromised and rotated.

## Next Recommended Tasks

1. Test gesture mode on the actual target phone/tablet/laptop cameras.
2. Tune `CANDLE_HOLD_MIN_SCORE`, `ZOOM_DEADBAND`, and `ZOOM_SENSITIVITY`.
3. Add a temporary debug overlay for gesture name, score, mode, and zoom during calibration.
4. Validate the GitHub Pages deployment after committing and pushing the current batch.
5. Consider localizing all user-facing copy if the exhibition audience is Chinese.
