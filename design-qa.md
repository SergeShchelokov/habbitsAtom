# Design QA — v0.1.0

final result: passed

## Current test iteration — independently clickable numbers

Result: passed. Scope: the new numbered-step interaction in branch `test`; the published `main` behavior is not promoted by this change.

Source visual: `docs/qa/steps-reference.png` (1101 × 819), the user's new screenshot. Exact icon source: `public/assets/icon-habbit.svg`, copied byte-for-byte from the supplied file; SHA-256 matches `6C86951A89A6DBE4C3FD012173432E987A28B6E2DA5919533CD391A703B26A09`.

Final implementation: `docs/qa/steps-desktop.png` (1467 × 728 pixels at CSS viewport 1467 × 728), `docs/qa/steps-mobile.png` (390 × 844 pixels at CSS viewport 390 × 844). Desktop state: four source-named habits, steps 1 and 2 selected in the first row, remaining rows unselected. The functional counter is 2 of 40; the reference's static 0 of 40 is intentionally corrected.

Full four-row comparison: `docs/qa/steps-overview-comparison.png` puts the source content region above the same implementation content region. The screenshot is an enlarged crop rather than a complete app frame, so its 1032 × 430 content region is normalized to 688 × 287 (about 2/3 scale, matching its roughly 70 px circles to the app's 47–48 px circles). The implementation region is cropped at native density to 688 × 287; surrounding existing sidebar/header/footer are checked separately in the complete app capture. Focused first-row comparison: `docs/qa/steps-comparison.png`, source above implementation. No mobile source is supplied; mobile remains the existing responsive adaptation.

Fidelity surfaces: existing Inter typography and row/column rhythm retained; dark surfaces and legible inactive numerals retained; selected circles use the supplied SVG's exact #FFCA58 rather than recoloring it. The new icon path is intentionally taken from the explicit SVG rather than approximated from the screenshot. Source placeholder repeated sixes remain sequential functional numbers. Copy now describes unlimited independent marks; the success text is exactly «Дело сделано!». Empty-screen coin, branding and unrelated form controls retain their prior assets.

P2 found during comparison: the native horizontal scrollbar raised the step row above its leading icon. Hid that scrollbar while preserving horizontal scrolling, keyboard focus and swipe; normalized top/bottom padding. Final DOM measurement reports both symbol and first-step center at y=144 CSS px. Post-fix full and focused captures were compared; no actionable P0/P1/P2 visual findings remain. Minor source-font/glyph differences remain accepted P3, as in the original implementation.

Browser checks: create; mark 1, 2 and 5 in the same day; preserve exact selected numbers after reload; undo only 5; toggle 8 with Enter/Space; finish a two-step goal in one day and reopen it by undo; mobile click/undo; repeated identical success messages; console errors checked (none). With the local server stopped, reload succeeds, a new numbered mark and its supplied SVG render, the mark survives another reload, and it can be undone. Mobile document width does not exceed its viewport. The preview remains open at http://127.0.0.1:4175/ with demonstration habits.

Data checks: all 13 domain/offline tests passed, including v1→v2 migration without write-on-read, preservation of legacy IDs/dates/outbox, exact step persistence, duplicate protection, unrestricted same-day marks, goal completion/undo and storage-failure atomicity. After the layout-only correction, the production build and generated-worker test passed again. Schema migration is one-way for the current test implementation; its separate local origin keeps it apart from the older main version. Cloud synchronization remains out of scope.

## Scoped update — empty-screen coin

User annotation requested replacing only the illustration above the empty-screen text with their supplied 3D coin. Source: `C:/Users/Admin/Desktop/04d1b9d1069ba52e75baea4d87d0860b0cb3b495.png`. The asset's transparent outer margins were trimmed for web packaging; the coin itself was preserved. Implemented asset: `public/assets/empty-coin.png`.

The illustration keeps its existing 90 × 90 CSS slot (78 × 78 on mobile). Existing typography, spacing, sidebar, copy, buttons and other lightning icons are retained. Removed the old decorative ring/background only from this illustration. Evidence: `docs/qa/empty-coin.png`, 1563 × 1244 normal browser capture, and focused context in `docs/qa/empty-coin-detail.png`. Browser verifies the image loads. Production build passes and includes this image in the offline precache. This visual-only change adds no domain tests.

Scoped result: passed. No actionable P0/P1/P2 differences in the requested region.

## Targets and evidence

- Source visual truth: `docs/qa/reference.png`, supplied habit-list screenshot, 1467 × 728 px.
- Final implementation: `docs/qa/desktop.png`, 1467 × 728 px; CSS viewport 1467 × 728. The browser capture was explicitly clipped to this viewport. No density rescaling.
- Same state: four habits from the source, all at 0 of 40, default theme, horizontal chains at their start. Test data was subsequently removed through the UI.
- Full-view comparison: `docs/qa/comparison.png`, source above implementation, both 1467 × 728.
- Focused comparison: `docs/qa/focus.png`, source left and implementation right, matching content region x=175..675, y=110..450. This verifies readable names, counts, circle size and row spacing.
- Additional implementation evidence: `docs/qa/mobile.png` (390 × 844 px at the same CSS viewport), `docs/qa/modal.png` (1467 × 973 capture of the creation dialog), `docs/qa/empty.png` (1563 × 1244 normal browser viewport), `docs/qa/offline.png` (1563 × 1244 capture during offline verification).
- Mobile has no supplied visual source: reviewed as an intentional responsive adaptation rather than a pixel match to the desktop source. Horizontal document overflow is absent; the chain itself scrolls horizontally.

## Required fidelity surfaces

- Fonts/typography: locally hosted Inter Variable closely follows the source's compact bold uppercase labels and muted counts. Exact source font was not provided. Minor glyph differences are accepted as P3. No clipped names or input labels observed; long titles wrap.
- Spacing/layout: desktop sidebar, 86 px add control, label column and 48 px check-in controls preserve source proportions. Rows use an 80 px rhythm, with a small text-height-dependent adjustment for the two-line title. First-row alignment was corrected by reducing the desktop header by 8 px. Mobile places progress below each label and keeps the add control visible at the top.
- Colors/tokens: dark background #1c1a1f, yellow #f7d362 and low-contrast dark circle surfaces follow the source. Step numerals are deliberately brighter than the reference for readability. The storage indicator and small footer are functional additions consistent with the approved MVP.
- Image/icon fidelity: the actual supplied 21 logo is cropped from the reference, rather than redrawn. Phosphor's filled lightning and plus-circle icons provide the action symbols. No generated imagery or placeholder assets. All assets and fonts are local.
- Copy/content: source habit names and progress anatomy retained. Repeated source placeholder sixes become the functional sequence 1..40. Empty, form, confirmation and success copy use the approved friendly Russian tone. No fictitious claim of cloud sync; the visible status says data is on this device.

## Findings and iteration history

1. P2 — first row sat 8 px too low in `docs/qa/desktop-before.png`. Reduced desktop header from 85 to 77 px. Final full-view and focused comparisons show the correction.
2. P2 — opening the creation dialog focused its close button. Focus now explicitly moves to the name input after `showModal()`. Browser check returned `habit-name`; creation-dialog capture shows the focused field. Keyboard focus remains inside the native dialog.
3. P2 — completed rows used `scrollIntoView`, which could move the whole mobile page on reload. Replaced it with horizontal scrolling on the chain container. Post-fix mobile capture starts with the header visible; DOM check recorded sidebar top=16 px, viewport width=390 and document scroll width=375 (the remaining width is the browser scrollbar).
4. P2 — the end fade masked part of the only step when target=1. Removed that mask. Full circle presentation is now preserved for short chains.
5. P2 — mobile delete target was too small. Increased it to 44 × 44 CSS px and kept it visible for touch users. Confirmed deletion and cancellation both work.

No actionable P0/P1/P2 visual issues remain in the inspected states.

## Functional validation

- Production build succeeds. All 10 domain/service-worker tests pass.
- Browser checked: empty screen, dialog opening/closing, focus, creation, daily mark, undo, reload persistence, target=1 completion, delete cancellation, confirmed deletion, desktop and mobile layouts.
- Browser console checked for errors; no application errors reported in the final run.
- Initial real offline check exposed `Vary: Origin` causing precached JS/CSS lookup misses. For explicitly precached same-origin public resources the worker now uses `ignoreVary: true`; the regression test models this case.
- Verified with the preview server stopped and a direct HTTP request failing: actual reload created a new document (different `data-boot-id`), application rendered, a daily mark was added and survived another reload. This is browser evidence, not merely a successful build or a simulated cache test.
- Service worker now serves the installed HTML shell and matching immutable assets together. Updates wait for existing app tabs to close.
- Source Figma was background context; the later user-supplied dark/yellow screenshot is the selected implementation reference.

## Remaining limits and P3 follow-up

- Actual Android hardware, Android packaging and physical touch/keyboard behavior were not tested; this release is responsive web/PWA.
- Exact source typeface can be substituted if the user supplies it.
- Supabase integration, cloud conflict resolution and hosting are planned subsequent milestones, not verified functionality of v0.1.

## Implementation checklist

- [x] Compare matching desktop source and implementation together.
- [x] Inspect the focused label/progress region.
- [x] Fix and recapture P2 issues.
- [x] Check mobile, dialog and empty states.
- [x] Check primary interactions, persistence and actual offline reload.
- [x] Remove visible test data and leave the local preview running.
