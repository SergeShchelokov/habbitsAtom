# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product decisions (2026-10-19)

- Build web first, Android later. Preserve the domain/storage boundary.
- The user's dark screenshot in docs/qa/reference.png is the current visual source, ahead of the earlier purple Figma screens.
- Keep the MVP small: create, once-daily check-in, undo today, goal progress, confirmed deletion.
- Use a friendly, mildly teasing Russian tone. Missed days never reset progress.
- No icon picker or account screen in v0.1. Supabase sync is the next milestone; hosting/domain come last.
- Do not display cloud-save success before actual Supabase integration.
