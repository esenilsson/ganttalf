---
name: ganttalf
description: Create or adjust a Gantt chart with Ganttalf, a thinkcell-style Gantt chart maker. Use when the user asks for a gantt chart, project plan, project timeline, or roadmap with dated activities, or when they refer to an existing chart (a share link or .xlsx) and want it changed — it produces an .xlsx plus a share link that opens the chart pre-loaded in the app.
---

# Ganttalf — generate a Gantt chart

Produces two deliverables from a list of activities: a re-importable `.xlsx` and a
share link that opens the chart ready to edit.

**Target instance.** Links point at `$GANTTALF_URL`, defaulting to the hosted
app at `https://ganttalf.app`. Set the env var to target another deployment:

```sh
export GANTTALF_URL=http://localhost:5173
```

## Steps

1. **Collect the activities** from the user's request or the surrounding context. Each row:
   - `activity` (required) — the task name
   - `group` (optional) — consecutive rows with the same group render as a section with a label and breaker line (e.g. Quality, Conversion, KPI)
   - `start`, `end` (yyyy-mm-dd) — the solid bar
   - `tentativeStart`, `tentativeEnd` (optional) — dashed outline extensions before start / after end
   - `milestone` (optional date) — a ▲ marker; a row with *only* a milestone (no start/end) is a pure milestone row (e.g. "Final delivery")
   - `responsible` (optional) — small label right of the bar
   - `dependsOn` (optional) — the exact `activity` name of a predecessor (or 1-based row
     number; comma-separated for several) — draws a dependency arrow from the predecessor's
     bar end into this row's bar start. Display-only; it never shifts dates.

   If the user gave only rough info (e.g. "3 weeks of dev then 1 week review starting in March"), lay out sensible dates yourself and say so. Don't ask for every date.

2. **Write the rows as JSON** (array of the objects above) to a scratch file.

3. **Generate** with the `make-gantt.mjs` script that sits in this skill's directory
   (run `npm install` there first if `node_modules` is missing):
   ```sh
   node <skill-dir>/make-gantt.mjs rows.json <name>.xlsx
   ```
   It writes the Excel file and prints a `Share URL` (`#g=` fragment containing the whole
   chart, client-side only — nothing is uploaded).

4. **Deliver both**: give the user the `.xlsx` file and the Share URL as a clickable link.
   Mention that the link opens the chart ready to edit — drag bars, edges and milestones,
   toggle Month/Week scale — and exports to Excel, PNG, SVG or native PowerPoint from there.

## Adjusting an existing chart

When the user refers to a chart they already have, read it back into rows, edit the
JSON, and regenerate. The round trip is lossless, so the new link and `.xlsx` carry
every field the original had.

```sh
node <skill-dir>/make-gantt.mjs --read <source> rows.json
# edit rows.json
node <skill-dir>/make-gantt.mjs rows.json <name>.xlsx
```

`<source>` is any of:

- a **snapshot link** (`https://ganttalf.app/#g=…`) or the bare `#g=` token — decoded
  offline, no account or network needed
- an **.xlsx** exported from the app, or any spreadsheet with an `Activity` column

Omit the output path to print the rows to stdout instead.

**Saved-chart and live-share links cannot be read.** A `/c/<id>` or `/s/<token>` URL
points at a row in the database behind the owner's sign-in, so there is nothing to
decode locally. Ask the user to open it and use *Export → Excel*, then read that file.
The script says as much if it is handed one.

## Notes

- The `.xlsx` is the durable, re-importable format; the URL is for instant viewing and editing. Both contain the same data.
- Dates must be ISO `yyyy-mm-dd` in the JSON; the script validates and fails loudly on bad dates.
- Typical chart span is weeks-to-months; the app auto-scales the time axis and draws a today-line automatically.
- The `#g=` codec must stay byte-compatible with `src/lib/share.js`, and the spreadsheet header handling with `src/lib/excel.js`. Change both or neither.
- Sign-in is **not** required for anything this skill produces. Snapshot links and `.xlsx` files work anonymously; an account is only needed to save charts server-side or mint a live `/s/` link.

## Installing

Claude Code picks the skill up automatically inside this repo. To install it anywhere
else — no local Ganttalf needed, it targets the hosted app:

```
/plugin marketplace add esenilsson/ganttalf
/plugin install ganttalf@ganttalf
```

Dependencies are fetched as part of that. If `xlsx` is ever missing the script still
prints the share link and names the one command that fixes the spreadsheet output.
