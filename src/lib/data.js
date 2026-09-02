// All parsing, canonicalisation, merging, filtering and facet logic for the
// People Group Browser. Pure functions only — no React, no DOM, no I/O — so the
// same code runs in the browser and in scripts/check.mjs.
//
// Every place a RULE from CLAUDE.md is applied is marked with "RULE:".

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

// Parse CSV text into an array of plain objects keyed by the header row.
// Handles double-quoted fields (commas inside quotes, "" escapes) and CRLF
// line endings. Every field is trimmed. Blank lines are skipped.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // CRLF: ignore the \r, the following \n ends the row.
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((f) => f.trim() !== ''));
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    header.forEach((key, idx) => {
      obj[key] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

// ---------------------------------------------------------------------------
// Region canonicalisation
// ---------------------------------------------------------------------------

// RULE: region canonicalisation table (A_Rules). Keys are lower-cased accepted
// spellings. "Africa, Sub-Saharan" appears literally in the CSV (quoted); the
// rules row "SSA, Sub-Saharan Africa, Africa, Sub-Saharan" is read as covering
// "Africa", "Sub-Saharan" and the combined "Africa, Sub-Saharan" — all three
// clearly mean Sub-Saharan Africa. See Interpretation notes in CLAUDE.md.
const REGION_ALIASES = {
  's. asia': 'South Asia',
  'south asia': 'South Asia',
  'southern asia': 'South Asia',
  'se asia': 'Southeast Asia',
  'southeast asia': 'Southeast Asia',
  'south-east asia': 'Southeast Asia',
  'c. asia': 'Central Asia',
  'central asia': 'Central Asia',
  'e. asia': 'East Asia',
  'east asia': 'East Asia',
  'mena': 'Middle East & North Africa',
  'middle east': 'Middle East & North Africa',
  'n. africa & middle east': 'Middle East & North Africa',
  'middle east & north africa': 'Middle East & North Africa',
  'ssa': 'Sub-Saharan Africa',
  'sub-saharan africa': 'Sub-Saharan Africa',
  'africa': 'Sub-Saharan Africa',
  'sub-saharan': 'Sub-Saharan Africa',
  'africa, sub-saharan': 'Sub-Saharan Africa',
};

export const REGIONS = [
  'South Asia',
  'Southeast Asia',
  'Central Asia',
  'East Asia',
  'Middle East & North Africa',
  'Sub-Saharan Africa',
];

// Returns { region, warning }. RULE: unknown spellings are kept as-is and a
// warning is returned (the caller logs it); the row is never dropped.
export function canonicalRegion(raw) {
  const key = (raw ?? '').trim().toLowerCase();
  if (key in REGION_ALIASES) return { region: REGION_ALIASES[key], warning: null };
  return { region: (raw ?? '').trim(), warning: `Unrecognised region spelling: "${raw}"` };
}

// ---------------------------------------------------------------------------
// Population parsing and brackets
// ---------------------------------------------------------------------------

// RULE: population parsing. Returns an integer, or null for Unknown.
export function parsePopulation(raw) {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === '' || s === 'unknown') return null; // blank or "unknown" → Unknown
  if (s === '<1000') return 999; // RULE: "<1000" → 999

  const range = s.match(/^([\d,]+)\s*-\s*([\d,]+)$/);
  if (range) {
    // RULE: range → midpoint, rounded down
    const lo = parseInt(range[1].replace(/,/g, ''), 10);
    const hi = parseInt(range[2].replace(/,/g, ''), 10);
    if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
    return Math.floor((lo + hi) / 2);
  }

  const plain = s.match(/^[\d,]+$/);
  if (plain) {
    // RULE: "1,200,000" or "1200000" → the integer
    const n = parseInt(s.replace(/,/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  }

  return null; // anything else could not be parsed → Unknown
}

export const BRACKETS = ['<10k', '10k-100k', '100k-1M', '1M+', 'Unknown'];

// Bible status values in display order (best access first). RULE: "None" is a
// real category and is listed as such.
export const BIBLE_STATUSES = ['Complete Bible', 'New Testament', 'Portions', 'None', 'Unknown'];

// RULE: population brackets. Boundaries: exactly 10,000 → "10k-100k",
// exactly 1,000,000 → "1M+" (Interpretation notes).
export function populationBracket(pop) {
  if (pop === null || pop === undefined) return 'Unknown';
  if (pop < 10000) return '<10k';
  if (pop < 100000) return '10k-100k';
  if (pop < 1000000) return '100k-1M';
  return '1M+';
}

// ---------------------------------------------------------------------------
// Language list
// ---------------------------------------------------------------------------

// RULE: languages are semicolon separated; treat as a list, trim each item.
export function parseLanguages(raw) {
  return (raw ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

// ---------------------------------------------------------------------------
// Names: diacritics, aliases, canonical form
// ---------------------------------------------------------------------------

// RULE (Interpretation notes): NFD normalise, then remove combining marks
// U+0300–U+036F. Same function is applied to names and to the search query.
export function stripDiacritics(s) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// RULE: name alias table (A_Rules). Keys are alias words after diacritic
// stripping and case folding; values are the canonical word.
const NAME_ALIASES = {
  uighur: 'Uyghur',
  uygur: 'Uyghur',
  hmong: 'Hmong', // "Hmông" strips to "hmong"; listed so the canonical case is fixed
  "h'mong": 'Hmong',
  baluch: 'Baloch',
  balochi: 'Baloch',
  fulbe: 'Fulani',
  fula: 'Fulani',
  zazaki: 'Zaza',
  nuristani: 'Nuristani', // "Nûristani" strips to "nuristani"
  kurdish: 'Kurd',
};

// RULE: canonical name = strip diacritics, fold case, then replace each whole
// word via the alias table, keeping word order. Result is lower-cased so that
// identity comparison is case-insensitive.
export function canonicalName(name) {
  return stripDiacritics(name)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== '')
    .map((w) => (w in NAME_ALIASES ? NAME_ALIASES[w].toLowerCase() : w))
    .join(' ');
}

// Human-readable version of the canonical name (Title Case per word) for display.
export function displayName(name) {
  return canonicalName(name)
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Row cleaning and merging
// ---------------------------------------------------------------------------

// Turn one raw CSV row into a cleaned record. Returns { record, warnings }.
export function cleanRow(raw) {
  const warnings = [];
  const { region, warning } = canonicalRegion(raw.region);
  if (warning) warnings.push(`${raw.id}: ${warning}`);

  const population = parsePopulation(raw.population);
  const evangelical = parseFloat(raw.evangelical_percent);

  const record = {
    id: raw.id,
    name: raw.name, // original spelling, kept for display
    canonicalName: canonicalName(raw.name),
    country: raw.country,
    region,
    regionRaw: raw.region,
    primaryReligion: raw.primary_religion,
    population,
    populationRaw: raw.population,
    populationBracket: populationBracket(population),
    languages: parseLanguages(raw.language),
    evangelicalPercent: Number.isNaN(evangelical) ? null : evangelical, // display only
    // RULE: "None" is a real bible_status category, not a null. Kept verbatim.
    bibleStatus: raw.bible_status,
  };
  return { record, warnings };
}

// RULE: identity = canonical name + country, both case-insensitive.
export function groupKey(record) {
  return `${record.canonicalName}|${record.country.trim().toLowerCase()}`;
}

// RULE: merge duplicates. Keep the first record in file order; only record the
// later duplicates' ids and original spellings for display.
export function mergeRecords(records) {
  const byKey = new Map();
  for (const rec of records) {
    const key = groupKey(rec);
    if (byKey.has(key)) {
      byKey.get(key).mergedFrom.push({ id: rec.id, name: rec.name });
    } else {
      byKey.set(key, { ...rec, mergedFrom: [{ id: rec.id, name: rec.name }] });
    }
  }
  return Array.from(byKey.values());
}

// Full pipeline: CSV text → { rawRows, records, groups, warnings }.
export function loadData(csvText) {
  const rawRows = parseCsv(csvText);
  const warnings = [];
  const records = rawRows.map((r) => {
    const { record, warnings: w } = cleanRow(r);
    warnings.push(...w);
    return record;
  });
  const groups = mergeRecords(records);
  return { rawRows, records, groups, warnings };
}

// ---------------------------------------------------------------------------
// Search and filtering
// ---------------------------------------------------------------------------

// RULE: search is case-, diacritic- and alias-insensitive substring match on
// the canonical name. The query is canonicalised with the same function.
export function matchesSearch(group, query) {
  const q = canonicalName(query);
  if (q === '') return true;
  return group.canonicalName.includes(q);
}

// Filter shape: { region: [], religion: [], bracket: [], bible: [], language: [], country: [] }
// Each value is an array of selected options. Empty array = not filtered.
// "country" was added for the overview drill-down; it matches group.country exactly.
export const FILTER_DIMENSIONS = ['region', 'religion', 'bracket', 'bible', 'language', 'country'];

export function emptyFilters() {
  return { region: [], religion: [], bracket: [], bible: [], language: [], country: [] };
}

// Does one group satisfy one dimension's selection? RULE: within a dimension
// options are OR'd; for language, any of the group's languages may match.
function matchesDimension(group, dim, selected) {
  if (!selected || selected.length === 0) return true;
  switch (dim) {
    case 'region':
      return selected.includes(group.region);
    case 'religion':
      return selected.includes(group.primaryReligion);
    case 'bracket':
      return selected.includes(group.populationBracket);
    case 'bible':
      return selected.includes(group.bibleStatus);
    case 'language':
      return group.languages.some((l) => selected.includes(l));
    case 'country':
      return selected.includes(group.country);
    default:
      return true;
  }
}

// RULE: across dimensions filters are AND'd. `ignoreDim` lets facet counting
// skip one dimension (self-excluding facets).
export function matchesFilters(group, filters, ignoreDim = null) {
  return FILTER_DIMENSIONS.every(
    (dim) => dim === ignoreDim || matchesDimension(group, dim, filters[dim]),
  );
}

export function applyFilters(groups, filters, query = '') {
  return groups.filter((g) => matchesFilters(g, filters) && matchesSearch(g, query));
}

// Value(s) a group contributes to a facet dimension.
function facetValues(group, dim) {
  switch (dim) {
    case 'region':
      return [group.region];
    case 'religion':
      return [group.primaryReligion];
    case 'bracket':
      return [group.populationBracket];
    case 'bible':
      return [group.bibleStatus];
    case 'language':
      return group.languages;
    case 'country':
      return [group.country];
    default:
      return [];
  }
}

// RULE (Interpretation notes): facet counts are over the filtered set, except
// the facet's own dimension is counted as if it were not filtered.
// Returns { region: {value: n}, religion: {...}, ... }.
export function facetCounts(groups, filters, query = '') {
  const counts = {};
  for (const dim of FILTER_DIMENSIONS) {
    const tally = {};
    for (const g of groups) {
      if (!matchesSearch(g, query)) continue;
      if (!matchesFilters(g, filters, dim)) continue;
      for (const v of facetValues(g, dim)) tally[v] = (tally[v] ?? 0) + 1;
    }
    counts[dim] = tally;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Overview summaries (per country and per region), over merged groups
// ---------------------------------------------------------------------------

// Fold a list of groups into one summary. Interpretation notes:
// - knownPopulation sums only groups whose population parsed; Unknown groups
//   are counted separately in unknownPopulationCount and never summed as 0.
// - avgEvangelicalPercent is an unweighted mean over groups that have a value,
//   or null when none do. It is NOT population-weighted.
function summarise(list) {
  const bibleStatusCounts = {};
  for (const s of BIBLE_STATUSES) bibleStatusCounts[s] = 0;
  let knownPopulation = 0;
  let unknownPopulationCount = 0;
  let evSum = 0;
  let evCount = 0;
  let mergedCount = 0;
  for (const g of list) {
    if (g.population === null) unknownPopulationCount++;
    else knownPopulation += g.population;
    if (g.evangelicalPercent !== null) {
      evSum += g.evangelicalPercent;
      evCount++;
    }
    bibleStatusCounts[g.bibleStatus] = (bibleStatusCounts[g.bibleStatus] ?? 0) + 1;
    if (g.mergedFrom && g.mergedFrom.length > 1) mergedCount++;
  }
  return {
    groupCount: list.length,
    knownPopulation,
    unknownPopulationCount,
    bibleStatusCounts,
    avgEvangelicalPercent: evCount ? evSum / evCount : null,
    mergedCount,
  };
}

// Order helper: canonical regions first in REGIONS order, any unrecognised
// region spelling (kept as-is per the region rule) after them alphabetically.
function regionRank(region) {
  const i = REGIONS.indexOf(region);
  return i === -1 ? REGIONS.length : i;
}

// One summary per country, sorted by region (REGIONS order) then by group
// count descending, then country name.
export function countrySummaries(groups) {
  const byCountry = new Map();
  for (const g of groups) {
    if (!byCountry.has(g.country)) byCountry.set(g.country, { region: g.region, list: [] });
    byCountry.get(g.country).list.push(g);
  }
  return Array.from(byCountry, ([country, { region, list }]) => ({
    country,
    region,
    ...summarise(list),
  })).sort(
    (a, b) =>
      regionRank(a.region) - regionRank(b.region) ||
      a.region.localeCompare(b.region) ||
      b.groupCount - a.groupCount ||
      a.country.localeCompare(b.country),
  );
}

// One summary per region, in REGIONS order (unrecognised regions last).
export function regionSummaries(groups) {
  const byRegion = new Map();
  for (const g of groups) {
    if (!byRegion.has(g.region)) byRegion.set(g.region, []);
    byRegion.get(g.region).push(g);
  }
  return Array.from(byRegion, ([region, list]) => ({ region, ...summarise(list) })).sort(
    (a, b) => regionRank(a.region) - regionRank(b.region) || a.region.localeCompare(b.region),
  );
}

// Whole-dataset summary for the headline tiles.
export function overallSummary(groups) {
  return { ...summarise(groups), countryCount: new Set(groups.map((g) => g.country)).size };
}
