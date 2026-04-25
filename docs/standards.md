# Project Standards

Last updated: 2026-04-26

## Scope

This project is a static browser application with optional offline Python asset-generation scripts. Keep runtime code simple, dependency-light, and easy to deploy on GitHub Pages.

## Runtime Code Standards

- Keep the app build-free unless there is a clear need for a build pipeline.
- Avoid adding package managers or bundlers for small changes.
- Prefer plain HTML, CSS, and JavaScript for runtime features.
- Keep external CDN dependencies pinned to explicit versions.
- Treat camera access as optional and always preserve fallback behavior.
- Do not map destructive or global actions to ambiguous gestures.

## Gesture Standards

- Continuous gestures may control continuous effects such as position, zoom, and pan.
- Discrete gestures must use confidence thresholds and stable-frame confirmation.
- Discrete gestures must have release logic to prevent repeated triggers while held.
- If a gesture can easily be misdetected, prefer manual UI control.
- Gesture copy in the UI must match the implemented behavior.

## UI Standards

- Preserve the Dunhuang-inspired visual language: dark cave atmosphere, warm amber light, gold accents.
- Keep the first-run guide concise and action-oriented.
- Maintain mobile usability first; the page is full-screen and touch-first.
- Avoid UI controls that require fine pointer precision on mobile.
- Text should be readable over dark mural backgrounds.

## File Organization

- `index.html`: document structure only.
- `style.css`: visual presentation and responsive behavior.
- `app.js`: interaction logic and rendering.
- `docs/design.md`: product, interaction, and architecture decisions.
- `docs/standards.md`: engineering and UX conventions.
- `docs/progress.md`: status, completed work, open risks, next tasks.
- `murals/`: generated runtime media assets.
- `segment_mural*.py` and `gen_parallax.py`: offline asset tooling.

## Documentation Standards

- Treat `README.md`, `docs/development/PROJECT_STATUS.md`, and `docs/development/CODEX_PROGRESS_LOG.md` as the first-read project context.
- Update `docs/progress.md` whenever a meaningful feature, behavior change, or risk is introduced.
- Update `docs/development/CODEX_PROGRESS_LOG.md` after every meaningful completed step.
- Update `docs/development/PROJECT_STATUS.md` whenever the overall project state changes materially.
- Update `docs/design.md` when interaction vocabulary or product behavior changes.
- Update `docs/standards.md` when the project adopts or rejects a recurring engineering practice.
- Keep docs factual and implementation-aligned.
- Prefer dated progress entries over vague status notes.

## Verification Standards

- Run `node --check app.js` after JavaScript changes.
- Run `git diff --check` before handing off changes.
- Manually test camera mode in a browser when gesture behavior changes.
- Manually test touch fallback when camera initialization or fallback code changes.
- For deployment changes, verify `.github/workflows/deploy.yml` remains compatible with GitHub Pages.
- For larger module changes, commit and push the verified branch to `origin` after updating status/progress docs.
- Record any skipped or impossible verification explicitly in `docs/development/CODEX_PROGRESS_LOG.md`.

## Security And Privacy

- Do not commit secrets, tokens, or credential-bearing remote URLs.
- Camera frames should stay local in the browser.
- Avoid analytics or network calls that are not essential to the experience.
- Prefer public, stable, CORS-compatible asset sources.
