# People Group Browser — Frontier Commons Build Lane (Option A)

Read this file fully before writing any code. The RULES section is authoritative.
Where a rule could be read two ways, follow the rule as written, even if you would
have chosen differently.

## What we are building

A small web app that lets a mission mobilizer explore ~200 unreached people groups
and walk away with a shortlist worth praying over. They must be able to send a
colleague exactly what they are looking at (filters, search, and shortlist encoded
in the URL).

This is a two-hour challenge. A small thing that works beats a large thing that is
half-finished. Do not add features that are not listed under SCOPE.

## Guiding principle (from the owner; applies to every change)

The app exists to help a mission mobilizer achieve something in the most efficient way
possible. Their question is: "I have X (e.g. trained church planters ready to go). Where
should I send them?" Weigh every feature by whether it shortens the path from that
question to a shortlist. If a feature does not serve that path, it probably does not
belong.

## Hard constraints

- Single static front-end app. No backend, no database, no auth, no external API.
- Tech: Vite + React + plain CSS (or Tailwind if already set up). No UI component
  library, no state-management library. Keep dependencies minimal.
- Data source: `data/people_groups.csv`, exported unchanged from the `A_Data` tab.
  Never hand-edit the CSV. All cleaning happens in code, at load time.
- All parsing, canonicalisation, merging, and filtering logic lives in
  `src/lib/data.js` (pure functions, no React). The UI only calls these functions.
- `scripts/check.mjs` loads the CSV, runs the same `src/lib/data.js` functions, and
  prints every case in the CORRECTNESS TABLE with expected vs actual and PASS/FAIL.
  This script must exist and run (`node scripts/check.mjs`) before any UI is built.
- Deploy target: Vercel (or Netlify). Must build with `npm run build`.
- Every file must be explainable in one sentence by the owner. Prefer boring,
  readable code over clever code. Add a short comment wherever a RULE is applied.

## Scope (in priority order — stop when time runs out)

1. Load + clean data; `scripts/check.mjs` passes as many cases as possible.
2. List view of merged groups with filters: region, religion, population bracket,
   bible status, language. Facet counts shown next to each option.
3. Search box (case-, diacritic-, and alias-insensitive substring on canonical name).
4. Shortlist: add/remove groups; shortlist panel shows the selected groups.
5. Shareable URL: filters, search text, and shortlist IDs all live in the query
   string, so pasting the URL reproduces the exact view.
6. Merged records are visible: a group formed from duplicates shows a
   "merged from N records" badge and lists the source ids and original spellings.
7. Nice-to-have only if 1–6 are done: copy-shortlist-as-text button.
8. (Added after the challenge, by the owner) At-a-glance overview on the home page:
   headline tiles, then per-region blocks with a row per country showing group
   count, known population, bible-status breakdown and average evangelical %.
   Clicking a country or region filters the list. Adds `country` as a filter
   dimension. Hidden whenever any filter or search is active.
9. (Added after the challenge, by the owner) Three tabs: Overview, Groups (search,
   filters, list) and Shortlist, tracked in the URL as `view=`. Clicking a group opens
   a full detail page (`group=<id>` in the URL) with every fact, the merge sources and
   a clearly labelled PLACEHOLDER "What this group needs" section.
10. (Added after the challenge, by the owner) Needs categories (`NEED_CATEGORIES` in
   `src/lib/data.js`). Every group is tagged with 2–4 categories: rule-derived where the
   data supports it, otherwise deterministic placeholders seeded by the group id. `need`
   is a filter dimension (listed first). The Overview has an "I have… where should they
   go?" picker that jumps to the Groups tab with that need selected.

## Data file

Columns in `A_Data` (220 rows):
`id, name, country, region, primary_religion, population, language, evangelical_percent, bible_status`

Known quirks found by inspecting the file (handle all of these in code):
- `region` uses 17 different spellings. Map every one with the table below.
- `population` contains: plain integers, comma-separated integers (`368,943`),
  ranges (`50000-75000`), the string `<1000`, the string `unknown`, and blanks.
- `language` is sometimes a semicolon-separated list (`Afar; French`). Trim each item.
- `name` contains diacritics (`Nûristani`, `Hmông Njua`) and alias spellings
  (`Uighur`, `Uygur`, `Baluch`, `Fulbe`, `Zazaki`, `Kurdish`).
- `evangelical_percent` is a string like `0.72`. Parse as a number. Display only.
- `bible_status` values: `Complete Bible`, `New Testament`, `Portions`, `None`, `Unknown`.
  Note that `None` is a real category, not a null. Do not treat it as missing.
- `primary_religion` values: `Islam`, `Buddhism`, `Ethnic Religion`, `Hinduism`, `Non-religious`.
- Ids are unique in the raw file. Duplicates are by name+country, not by id.

## RULES (verbatim from the A_Rules tab — authoritative)

### Region canonicalisation
| Canonical | Accepted spellings |
|---|---|
| South Asia | S. Asia, South Asia, Southern Asia |
| Southeast Asia | SE Asia, Southeast Asia, South-East Asia |
| Central Asia | C. Asia, Central Asia |
| East Asia | E. Asia, East Asia |
| Middle East & North Africa | MENA, Middle East, N. Africa & Middle East, Middle East & North Africa |
| Sub-Saharan Africa | SSA, Sub-Saharan Africa, Africa, Sub-Saharan |

If a region value is not in this table, keep it as-is and log a warning; do not drop the row.

### Population parsing
- `1,200,000` or `1200000` → read as the integer.
- `50000-75000` → use the midpoint, rounded down.
- `<1000` → use 999.
- blank or `unknown` → Unknown. Excluded from every numeric bracket.

### Population brackets
- `<10k` = under 10,000
- `10k-100k` = 10,000 to 99,999
- `100k-1M` = 100,000 to 999,999
- `1M+` = 1,000,000 and above
- `Unknown` = population could not be parsed

### Name aliases (same group, different spelling)
| Canonical | Aliases |
|---|---|
| Uyghur | Uighur, Uygur |
| Hmong | Hmông, H'Mong |
| Baloch | Baluch, Balochi |
| Fulani | Fulbe, Fula |
| Zaza | Zazaki |
| Nuristani | Nûristani |
| Kurd | Kurdish |

### Identity and merging
- Same group: canonical name and country both match, case-insensitive.
- Canonical name: apply the alias table to every word in the name, keeping word order.
- On merge: keep the first record in file order. Surface the merge in the interface.

### Language field
- Multiple languages are semicolon separated. Treat as a list.
- A group matches a language filter if any of its languages match.

### Search
- Case-insensitive, diacritic-insensitive, and alias-aware.
- Substring match on the canonical name.

## Interpretation notes (decisions we have made; keep them consistent)

- Alias replacement is per whole word, after diacritics are stripped and case is
  folded. `Uyghur Central` and `Uyghur` are DIFFERENT groups (canonical names differ).
- Diacritic stripping: Unicode NFD normalisation, then remove combining marks
  (U+0300–U+036F). Apply the same function to the search query and to names.
- Facet counts are computed over the currently filtered set, except that a facet's
  own dimension is counted as if that dimension were not filtered (standard
  "self-excluding" facet behaviour). This is what the check table's "Facet counts
  with religion = Islam selected" section expects.
- Filters within one dimension are OR; across dimensions are AND. EXCEPTION: the
  `need` dimension is AND within itself — selecting two categories returns only the
  groups tagged with both, because the mobilizer has several things to send at once.
- The `need` facet is therefore NOT self-excluding: each count is "what you would get
  if you added this option to the current selection". Options that would yield zero are
  disabled in the UI. Every other facet keeps the self-excluding behaviour the check
  table expects.
- When merging, keep the first record's field values. Do not try to "combine" fields
  from later duplicates, except to record their ids and original names for display.
- Population bracket boundaries: a group with exactly 10,000 is `10k-100k`;
  exactly 1,000,000 is `1M+`.
- Region rule row `SSA, Sub-Saharan Africa, Africa, Sub-Saharan`: the CSV contains the
  literal value `Africa, Sub-Saharan` (quoted, 8 rows). We map `Africa`, `Sub-Saharan`
  and `Africa, Sub-Saharan` all to Sub-Saharan Africa.
- The CSV has CRLF line endings; the parser strips `\r` and trims every field.
- Overview population totals sum only groups whose population parsed; Unknown groups
  are counted and displayed separately ("N of M unknown"), never summed as 0.
- Overview evangelical % is an unweighted mean over groups that have a value. It is
  not population-weighted, because 39 groups have no population figure.
- The "What this group needs" hints are illustrative rules over fields already on the
  record (bible status, evangelical %, population, languages). They are a placeholder,
  labelled as unverified in the UI, and are not sourced content.
- Needs tags: rule-derived tags (bible status → Bible translation / Discipleship
  materials; evangelical % → Church planters / Theology teachers) carry the rule as their
  reason. Filler tags are placeholders chosen by an FNV-1a hash of the id, never
  `Math.random`, so shared URLs reproduce the same view. The UI labels them "placeholder".

## CORRECTNESS TABLE (from A_Check_Answers — counts are over merged groups unless stated)

| # | Case | Expected |
|---|---|---|
| 1 | Total rows in the raw file | 220 |
| 2 | Distinct groups after merging duplicate spellings | 199 |
| 3 | Groups that had at least one duplicate record | 19 |
| 4 | Region = South Asia | 40 |
| 5 | Region = Middle East & North Africa | 39 |
| 6 | Region = Central Asia OR East Asia | 40 |
| 7 | Religion = Islam | 134 |
| 8 | Religion = Islam AND Region = Sub-Saharan Africa | 33 |
| 9 | Religion = Buddhism OR Hinduism, AND Region = South Asia | 23 |
| 10 | Population bracket = 1M+ | 73 |
| 11 | Population bracket = <10k | 9 |
| 12 | Population bracket = Unknown | 39 |
| 13 | Bible status = None | 36 |
| 14 | Language list includes Arabic | 26 |
| 15 | Search 'uyghur' (alias- and diacritic-insensitive), name match | 2 |
| 16 | Search 'hmong' (alias- and diacritic-insensitive), name match | 2 |
| 17 | Region = South Asia AND bracket = 1M+ AND religion = Islam | 5 |

Facet counts with religion = Islam selected (region facet, counted as the region
facet itself should count them):

| Region | Expected |
|---|---|
| Central Asia | 19 |
| East Asia | 4 |
| Middle East & North Africa | 39 |
| South Asia | 13 |
| Southeast Asia | 26 |
| Sub-Saharan Africa | 33 |

We do not need to pass every case. We DO need to know which ones we fail, and why.
Never adjust the data or add special cases to make a number match. If a case fails,
print the rows involved so a human can decide.

## Working agreement

- Before changing any logic in `src/lib/data.js`, run `node scripts/check.mjs` and
  paste the before/after results.
- When a check fails, first show me the specific rows in the failing bucket. Do not
  guess at a fix.
- If a rule is ambiguous, stop and ask, then record the decision under
  "Interpretation notes" above.
- Keep a running list in `README.md` of: hours spent, hardest decision, one hacky
  thing, and which check cases fail. Update it as we go, not at the end.
- Do not install packages without saying why.

## Commands

- `npm install`
- `npm run dev` — local dev server
- `node scripts/check.mjs` — correctness table
- `npm run build` — production build (must succeed before deploy)
