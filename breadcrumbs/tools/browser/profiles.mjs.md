# tools/browser/profiles.mjs

## 2026-10-06 — The page table lives here

The suite's readiness URL in playwright.config.ts was still `/design/` after
the spec moved to `/fixtures/design/`, so `npm test` could not start: the
webServer never answered. The paths the suite, global-setup, the gallery and
Playwright's readiness check read are now one `pages` table here, beside the
viewports, so a moved fixture is one edit. The scheduled preview path is built
from `SCHEDULED_PREFIX` rather than restated. Node 26 strips types, so this
`.mjs` can import `schedule.ts` directly.
