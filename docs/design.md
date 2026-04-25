# Project Design

Last updated: 2026-04-26

## Product Goal

Create an atmospheric browser-based Dunhuang mural experience where users explore hidden mural details through a candle-light metaphor. The interaction should feel quiet, direct, and physically understandable.

## Experience Principles

- The candle is only lit when the user appears to be holding it.
- Ambient exploration should be gesture-driven, but global state changes should remain explicit.
- Lighting state is controlled by UI, not by accidental gestures.
- The app must remain usable without camera access through touch and mouse fallback.
- Visual feedback should prioritize stability over raw responsiveness.

## Current User Flow

1. User opens the page and sees a start guide.
2. Guide explains the gesture vocabulary before any camera permission prompt.
3. User clicks `Start Exploring`.
4. App loads MediaPipe and requests camera access.
5. If hand mode starts successfully, the user explores with gestures.
6. If hand mode fails, the app switches to touch mode.

## Gesture Vocabulary

- `Closed_Fist`: hold and light the candle.
- Hand position while holding fist: move the candle.
- Hand distance while holding fist: zoom in and out.
- Edge position while zoomed: auto-pan the mural.
- `Victory`: switch to the next mural.

## Manual Controls

- `Light On / Off`: only the button controls global brightness.
- Mural dots: direct mural selection.
- Touch fallback: one finger moves the candle, two fingers zoom.
- Desktop fallback: mouse drag moves the candle, mouse wheel zooms.

## Architecture

- `index.html`: static document structure and interaction guide.
- `style.css`: visual system, loading/start screen, UI controls, responsive layout.
- `app.js`: mural state, MediaPipe initialization, gesture state machine, rendering loop, touch fallback.
- `murals/`: generated video/image assets used by the page.
- Python scripts: offline asset-generation utilities for parallax and layered mural videos.

## Key Design Decisions

- Camera/model loading starts only after explicit user action. This avoids premature permission prompts and makes the first screen educational.
- MediaPipe version is pinned instead of using `latest` to reduce deployment drift.
- Discrete gestures require stable frames and confidence thresholds to reduce false triggers.
- `Open_Palm` is not mapped to lighting because lighting must be a manual UI decision.
- Candle activation requires `Closed_Fist`, matching the metaphor of gripping a candle.

## Known UX Risks

- `Closed_Fist` recognition may vary by camera angle, hand size, lighting, and device.
- Distance-based zoom is an approximation based on visible palm geometry, not real depth.
- Victory gesture may be confused with similar hand poses on low-quality cameras.
- Users may need a short calibration period to understand fist distance zoom.
