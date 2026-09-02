# People Group Browser

A small web app that lets a mission mobilizer explore ~200 unreached people groups and
walk away with a shortlist worth praying over — and send a colleague exactly what they
are looking at.

- **Live app:** https://fc-iota-sandy.vercel.app/
- **Repository:** https://github.com/Bennchr/FC

Built for the Frontier Commons Build Lane technical challenge, Option A.
`CLAUDE.md` holds the full spec, the authoritative rules and the correctness table.

---

1. ## Hours spent

**About 3-4 hours in total**

Rough breakdown of the build:
- _1hour_ - Figuring out how to use GitHub (creating a repository, etc.), planning with - Claude (_I would not consider this as part of the build - this was essentially me taking the time to play around with the tool with this dataset as a use case_)
- 2hours - Building with Claude Code (breakdown below), concurrently brainstorming how to make it actually accessible and useful to a technologically layperson missions mobilizer
- 1hour - Framing the project in a way that is presentable


| Building Phase | Time (2hrs) |
|---|---|
| Scaffold, `src/lib/data.js`, `scripts/check.mjs` | 30mins |
| List UI: filters, facet counts, search, shortlist, URL state | 30mins |
| At-a-glance overview by region and country | 15mins |
| Tabs, group detail page | 30mins |
| Needs categories, tagging, need filter | 15mins |

2. ## Hardest decision

I wouldn't say it was the hardest decision, but the trickiest and what needed the most thought was considering how to turn this into something that a missions mobilizer could effectively use. 

After creating the initial build, which was fairly simple as it was just fixing and streamlining the data, I realized halfway that I hadn't been clear about the goal in my plan. So I thought, what should the guiding principle be? 

I realized that a mobilizer isn't just going to be satisfied praying for a name and number, and would ideally want something more practical. I decided that it should be to help a mobilizer answer "If I have X resource, what can I do with them?", and created the at-a-glance overview, the tab split and the needs filter. After including some placeholder information about each people group (the resources and needs are supposed to be non-exhaustive), now, a mobilizer can look at the resources he has on hand and quickly find the place that needs them most, read about them and find ways to help this group with what they have. 

3. ## One thing I know is hacky

Given that I have little to no background in actual statistics or coding, I let Claude Code handle all the technical work. 

**The CSV is hand-parsed and baked into the JavaScript bundle.** Two shortcuts that
compound: `parseCsv` in `src/lib/data.js` is ~50 lines written by hand instead of a
library (it handles quoted fields, `""` escapes and CRLF, which is all this file needs,
but it is not a general-purpose CSV parser), and the whole dataset is imported as a
string at build time via Vite's `?raw` and parsed synchronously on page load. There is
no fetch, no loading state, and no way to change the data without a redeploy.

At 220 rows it costs nothing. Measured on the full pipeline (parse, clean, merge, tag):

| Rows | File size | Load time |
|---|---|---|
| 220 (today) | 19 KB | 16 ms |
| 11,000 | 0.9 MB | 353 ms |
| 44,000 | 3.7 MB | 462 ms |
| 110,000 | 9.2 MB | 1,697 ms |

*(Node 22 on a fast machine; a phone browser would be meaningfully slower.)*

**It breaks around 10,000 rows.** At that point the bundle carries roughly a megabyte
of data that every visitor downloads before anything renders, and a third of a second
of blocking work runs before first paint. Beyond that it degrades badly. In practice
the list would give out before the parser does — every matching group renders as a
card with no virtualisation, so a few thousand results would stall the browser first.

AI's suggestion on how to scale up without it breaking down: serve the CSV as a static file, fetch it, parse it off the main thread, and virtualise the list.

4. ## How I used AI

I used Claude Chat to help plan, and Claude Code for the implementation: I described the goal and the rules, and it wrote the data layer, the check script and the React UI, committing as it went. I kept the final decisions and the verifications which I did myself.

I set the guiding principle (help a mobilizer answer "I have X, where should I send them?"), intermittently adding functions like the at-a-glance overview, the tab split and the needs filter, and checked all 23 correctness cases against the brief myself. 

The clearest override principally would be intermittently playtesting and deciding what should be added, which Claude did not suggest itself (i.e. like the Overview and the needs filter). The clearest override technically would be when I realized that the needs filter shipped as OR, so I recognised that selecting two categories should mean groups needing **both**, and had it rebuilt as AND with the facet counts corrected to match.

---
## What it does

- **Overview tab** — headline figures, then a block per region with a row per country
  showing group count, known population, a Bible-status breakdown and average
  evangelical %. Clicking a country or region drills into the list.
- **"I have… where should they go?"** — pick what you have to send (church planters,
  translators, teachers) and jump straight to the groups tagged with that need.
- **Groups tab** — search plus seven filters, each option showing how many groups it
  would give you. Search is case-, diacritic- and alias-insensitive, so "uighur",
  "Uygur" and "Uyghur" all find the same group.
- **Shortlist tab** — add and remove groups, then share the link.
- **Everything lives in the URL.** Filters, search text, open group and shortlist are
  all in the query string, so pasting the address reproduces the exact view.
- **Merged records are visible.** A group built from duplicate rows carries a
  "merged from N records" badge and lists the source ids and original spellings.

## How to run it locally

```
npm install
node scripts/check.mjs   # correctness table: expected vs actual, PASS/FAIL
npm run dev              # local dev server
npm run build            # production build
```

## Known limitations

- **Needs tags are partly invented.** Where the data supports a tag it is rule-derived
  and the rule is shown; otherwise a placeholder tag is assigned by hashing the group
  id (deterministic, so shared links reproduce the same view). The UI labels these
  "placeholder". They must be replaced with researched content before anyone treats
  them as real.
- **The evangelical average is unweighted.** A 400-person group counts the same as a
  34-million-person one, because 39 groups have no population figure to weight by.
- **Population totals exclude unknowns.** 39 of 199 groups have no population; they are
  counted and shown separately rather than summed as zero.
- **Scope item 7 (copy shortlist as text) was not built.**

## Check cases failing

**None.** `node scripts/check.mjs` reports **35 passed, 0 failed**:

- 17/17 cases from the correctness table
- 6/6 facet counts (region facet with religion = Islam selected)
- 12/12 internal sanity rows — country and region summaries adding back up to the
  table's own figures, needs tags being deterministic, and the need filter behaving
  as AND

The script also logs 0 unrecognised region spellings, prints all 19 merged groups with
their source ids, and prints every row of a failing bucket if one ever fails.
