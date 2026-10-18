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
- The empty-screen illustration uses the user's supplied 3D yellow lightning coin (public/assets/empty-coin.png). This replacement applies only to that illustration; other lightning icons stay as they are.
- Free preview hosting target: GitHub Pages from main via .github/workflows/deploy-pages.yml. Keep asset URLs relative so the app works under /habbitsAtom/ and locally. A custom hosting/domain setup remains a later option.
- Branch policy: main is the published version; test holds new features and UX corrections. Work on test by default for the current iteration. Switch branches when the user asks (for example, "переключись на тест" or "переключись на main"). Only merge changes into main and publish them when the user explicitly requests publication or promotion. Preserve uncommitted work when switching; never reset or discard it.
- Test branch CI builds and tests the app without deployment. The deploy job must be guarded by github.ref == 'refs/heads/main', including manually dispatched runs.
