# Dunhuang Candle

An interactive Dunhuang mural explorer. The page uses local image backgrounds, a candle-light reveal effect, MediaPipe hand gesture recognition, and a touch fallback for devices without camera access.

## Current Interaction

- Start page explains the available controls before requesting camera access.
- Relaxed finger curl / closed fist holds and lights the candle.
- Moving the held grip moves the candle.
- Moving the held grip closer or farther controls mural zoom.
- Holding a victory gesture switches to the next mural.
- Light On / Off is controlled only by the on-screen button.
- If camera or model loading fails, the app falls back to touch mode.

## Project Docs

- [Agent Instructions](AGENTS.md)
- [Project Design](docs/design.md)
- [Project Standards](docs/standards.md)
- [Project Progress](docs/progress.md)
- [Current Project Status](docs/development/PROJECT_STATUS.md)
- [Codex Progress Log](docs/development/CODEX_PROGRESS_LOG.md)
- [Testing Guide](docs/development/TESTING.md)

## Run Locally

This is a static site. Serve the repository root with any local HTTP server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Camera access generally requires `https` in production or `localhost` during development.

## Deployment

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`. Pushing to `main` uploads the repository root as the Pages artifact.
