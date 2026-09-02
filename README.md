# FC — People Group Browser

Public Repository for Build Lane Technical Challenge Option A.
See `CLAUDE.md` for the spec, rules and correctness table.

## Commands

- `npm install`
- `node scripts/check.mjs` — correctness table (expected vs actual, PASS/FAIL)
- `npm run dev` — local dev server
- `npm run build` — production build

## Running log

**Hours spent:** ~3.5h. +0.75h for needs categories, tagging, the need filter and the
"I have… where should they go?" picker (scope item 10). +0.75h for tabs (Overview / Groups / Shortlist), the group detail
page and the placeholder needs section (scope item 9). +0.75h for the at-a-glance overview (scope item 8: country filter,
summary functions, `src/Overview.jsx`, six overview sanity rows in the check script).
Earlier: 0.5h scaffold + `src/lib/data.js` + `scripts/check.mjs`; 0.75h UI
(`src/App.jsx`, `src/App.css`): list, five facets with self-excluding counts, search,
shortlist panel, URL-encoded state, merged-record badges. Scope items 1–6 done; item 7
(copy shortlist as text) not built.

**Hardest decision:** the region rule row `SSA, Sub-Saharan Africa, Africa, Sub-Saharan`
is ambiguous: it could list two spellings (`Africa` and `Sub-Saharan`) or one
(`Africa, Sub-Saharan`). The CSV contains the literal quoted value `"Africa, Sub-Saharan"`
in 8 rows, so the code maps all three spellings to Sub-Saharan Africa. Recorded under
Interpretation notes in `CLAUDE.md`.

**One hacky thing (placeholder content):** needs tags are partly rule-derived and partly
placeholders picked by hashing the group id. The UI labels placeholder tags. They must be
replaced with researched content before anyone treats them as real.

**One hacky thing (UI):** the CSV is bundled into the JS at build time via Vite's `?raw`
import and parsed on page load, so there is no fetch and no loading state. Fine for 220
rows; would not scale to a large file.

**One hacky thing (data):** the CSV parser is hand-rolled (~50 lines) instead of a library, to
keep dependencies at zero. It handles quoted fields, `""` escapes and CRLF, which is all
this file needs, but it is not a general-purpose CSV parser.

**Check cases failing:** none. 17/17 table cases, 6/6 facet counts and 9/9 overview and
tagging sanity rows pass (`node scripts/check.mjs`, 32 passed, 0 failed). Region warnings logged: 0.
