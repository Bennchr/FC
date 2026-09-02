# FC — People Group Browser

Public Repository for Build Lane Technical Challenge Option A.
See `CLAUDE.md` for the spec, rules and correctness table.

## Commands

- `npm install`
- `node scripts/check.mjs` — correctness table (expected vs actual, PASS/FAIL)
- `npm run dev` — local dev server
- `npm run build` — production build

## Running log

**Hours spent:** ~0.5h (scaffold, `src/lib/data.js`, `scripts/check.mjs`). No UI yet.

**Hardest decision:** the region rule row `SSA, Sub-Saharan Africa, Africa, Sub-Saharan`
is ambiguous: it could list two spellings (`Africa` and `Sub-Saharan`) or one
(`Africa, Sub-Saharan`). The CSV contains the literal quoted value `"Africa, Sub-Saharan"`
in 8 rows, so the code maps all three spellings to Sub-Saharan Africa. Recorded under
Interpretation notes in `CLAUDE.md`.

**One hacky thing:** the CSV parser is hand-rolled (~50 lines) instead of a library, to
keep dependencies at zero. It handles quoted fields, `""` escapes and CRLF, which is all
this file needs, but it is not a general-purpose CSV parser.

**Check cases failing:** none. 17/17 table cases and 6/6 facet counts pass
(`node scripts/check.mjs`, 23 passed, 0 failed). Region warnings logged: 0.
