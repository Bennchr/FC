// Correctness table runner. Loads data/people_groups.csv, runs the same
// src/lib/data.js functions the UI uses, and prints expected vs actual with
// PASS/FAIL for every case in CLAUDE.md's CORRECTNESS TABLE. On a failure it
// prints the rows in the bucket so a human can decide — it never adjusts data.
//
// Usage: node scripts/check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  loadData,
  applyFilters,
  emptyFilters,
  facetCounts,
} from '../src/lib/data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(here, '..', 'data', 'people_groups.csv');
const { rawRows, groups, warnings } = loadData(readFileSync(csvPath, 'utf8'));

// Helper: filter groups by a partial filter object and optional search text.
function query(partial = {}, search = '') {
  return applyFilters(groups, { ...emptyFilters(), ...partial }, search);
}

function describe(g) {
  const merged = g.mergedFrom.length > 1 ? ` [merged from ${g.mergedFrom.map((m) => m.id).join(', ')}]` : '';
  return `${g.id} | ${g.name} (${g.canonicalName}) | ${g.country} | ${g.region} | ${g.primaryReligion} | pop=${g.populationRaw || '(blank)'}→${g.population ?? 'Unknown'} (${g.populationBracket}) | bible=${g.bibleStatus} | lang=${g.languages.join('; ')}${merged}`;
}

const dupGroups = groups.filter((g) => g.mergedFrom.length > 1);

const cases = [
  { n: 1, name: 'Total rows in the raw file', expected: 220, rows: rawRows, actual: rawRows.length },
  { n: 2, name: 'Distinct groups after merging duplicate spellings', expected: 199, rows: groups, actual: groups.length },
  { n: 3, name: 'Groups that had at least one duplicate record', expected: 19, rows: dupGroups },
  { n: 4, name: 'Region = South Asia', expected: 40, rows: query({ region: ['South Asia'] }) },
  { n: 5, name: 'Region = Middle East & North Africa', expected: 39, rows: query({ region: ['Middle East & North Africa'] }) },
  { n: 6, name: 'Region = Central Asia OR East Asia', expected: 40, rows: query({ region: ['Central Asia', 'East Asia'] }) },
  { n: 7, name: 'Religion = Islam', expected: 134, rows: query({ religion: ['Islam'] }) },
  { n: 8, name: 'Religion = Islam AND Region = Sub-Saharan Africa', expected: 33, rows: query({ religion: ['Islam'], region: ['Sub-Saharan Africa'] }) },
  { n: 9, name: 'Religion = Buddhism OR Hinduism, AND Region = South Asia', expected: 23, rows: query({ religion: ['Buddhism', 'Hinduism'], region: ['South Asia'] }) },
  { n: 10, name: 'Population bracket = 1M+', expected: 73, rows: query({ bracket: ['1M+'] }) },
  { n: 11, name: 'Population bracket = <10k', expected: 9, rows: query({ bracket: ['<10k'] }) },
  { n: 12, name: 'Population bracket = Unknown', expected: 39, rows: query({ bracket: ['Unknown'] }) },
  { n: 13, name: 'Bible status = None', expected: 36, rows: query({ bible: ['None'] }) },
  { n: 14, name: 'Language list includes Arabic', expected: 26, rows: query({ language: ['Arabic'] }) },
  { n: 15, name: "Search 'uyghur' (alias- and diacritic-insensitive)", expected: 2, rows: query({}, 'uyghur') },
  { n: 16, name: "Search 'hmong' (alias- and diacritic-insensitive)", expected: 2, rows: query({}, 'hmong') },
  { n: 17, name: 'Region = South Asia AND bracket = 1M+ AND religion = Islam', expected: 5, rows: query({ region: ['South Asia'], bracket: ['1M+'], religion: ['Islam'] }) },
];

// Facet counts for the region facet with religion = Islam selected.
const islamFacets = facetCounts(groups, { ...emptyFilters(), religion: ['Islam'] });
const facetExpected = {
  'Central Asia': 19,
  'East Asia': 4,
  'Middle East & North Africa': 39,
  'South Asia': 13,
  'Southeast Asia': 26,
  'Sub-Saharan Africa': 33,
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

let pass = 0;
let fail = 0;
const failures = [];

console.log('CORRECTNESS TABLE (counts over merged groups unless stated)\n');
console.log(`${pad('#', 3)} ${pad('Case', 62)} ${pad('Expected', 9)} ${pad('Actual', 7)} Result`);
console.log('-'.repeat(92));
for (const c of cases) {
  const actual = c.actual ?? c.rows.length;
  const ok = actual === c.expected;
  ok ? pass++ : fail++;
  if (!ok) failures.push({ label: `#${c.n} ${c.name}`, rows: c.rows });
  console.log(`${pad(c.n, 3)} ${pad(c.name, 62)} ${pad(c.expected, 9)} ${pad(actual, 7)} ${ok ? 'PASS' : 'FAIL'}`);
}

console.log('\nFACET COUNTS: region facet with religion = Islam selected (self-excluding)\n');
console.log(`${pad('Region', 30)} ${pad('Expected', 9)} ${pad('Actual', 7)} Result`);
console.log('-'.repeat(56));
for (const [region, expected] of Object.entries(facetExpected)) {
  const actual = islamFacets.region[region] ?? 0;
  const ok = actual === expected;
  ok ? pass++ : fail++;
  if (!ok) {
    failures.push({
      label: `Facet region=${region} with religion=Islam`,
      rows: query({ region: [region], religion: ['Islam'] }),
    });
  }
  console.log(`${pad(region, 30)} ${pad(expected, 9)} ${pad(actual, 7)} ${ok ? 'PASS' : 'FAIL'}`);
}

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);

if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  for (const w of warnings) console.log(`  ${w}`);
}

// Always show the merged groups so a human can eyeball the merge decisions.
console.log(`\nMERGED GROUPS (${dupGroups.length}):`);
for (const g of dupGroups) {
  console.log(`  ${g.canonicalName} / ${g.country}: ${g.mergedFrom.map((m) => `${m.id} "${m.name}"`).join(', ')}`);
}

// On failure, print every row in the failing bucket. Never "fix" the numbers.
if (failures.length) {
  console.log('\nFAILING BUCKETS — rows involved (for a human to decide):');
  for (const f of failures) {
    console.log(`\n== ${f.label} (${f.rows.length} rows) ==`);
    for (const r of f.rows) console.log(`  ${r.canonicalName !== undefined ? describe(r) : JSON.stringify(r)}`);
  }
}

process.exit(fail === 0 ? 0 : 1);
