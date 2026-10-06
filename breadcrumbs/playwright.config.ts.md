# playwright.config.ts

## 2026-10-06 — INCLUDE_FIXTURES goes through `env`

The webServer used to run `npm run build:fixtures`, whose `INCLUDE_FIXTURES=1
astro build` npm hands to cmd.exe on Windows, which reads it as a command
named `INCLUDE_FIXTURES`. Playwright's `env` sets it on every platform.
