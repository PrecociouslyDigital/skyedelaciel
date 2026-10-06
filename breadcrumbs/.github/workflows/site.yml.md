# `.github/workflows/site.yml`

## 2026-10-05 — the daily build, and keeping it alive

The cron is 08:15 UTC: 00:15 PST, 01:15 PDT. Any fixed UTC time fires once per
UTC day, but it only fires once per *LA* day if it lands on the same LA date
as its UTC date under both offsets. A time between 07:00 and 08:00 UTC would
skip or repeat an LA day at each clock change. `tests/unit/schedule.test.ts`
reads the cron from this file and checks five years of days.

Scheduled runs skip `check`. They build `release`, which was checked when it
was pushed, so the daily publish is a build and a deploy only.

GitHub disables schedules in a public repository after 60 days without
activity, which would stop publishing silently. The scheduled run enables its
own workflow again, which is meant to count as activity. If it turns out not
to, the fallback is a Workers cron that sends `workflow_dispatch`.

Schedules only run from the repository's default branch, so this file has to
be on whichever branch that is.
