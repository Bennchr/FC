// The whole UI: filters + search on the left, group list in the middle,
// shortlist on the right. All data logic comes from src/lib/data.js; this file
// only renders and keeps the view state in the URL query string.
import { useEffect, useMemo, useState } from 'react';
import csvText from '../data/people_groups.csv?raw';
import {
  loadData,
  applyFilters,
  facetCounts,
  emptyFilters,
  displayName,
  FILTER_DIMENSIONS,
  REGIONS,
  BRACKETS,
} from './lib/data.js';
import './App.css';

// Parsed once at module load. RULE: all cleaning happens in code at load time.
const { groups, warnings } = loadData(csvText);
if (warnings.length) console.warn('Data warnings:', warnings);

const DIMENSION_LABELS = {
  region: 'Region',
  religion: 'Religion',
  bracket: 'Population',
  bible: 'Bible status',
  language: 'Language',
};

// Fixed option order for the facets that have a natural order; the rest are
// sorted alphabetically from the data.
const FIXED_ORDER = { region: REGIONS, bracket: BRACKETS };

// ---------------------------------------------------------------------------
// URL <-> state. Query keys: q (search), one key per filter dimension
// (repeated, e.g. ?region=South+Asia&region=East+Asia), and shortlist
// (comma-separated group ids). Pasting the URL reproduces the exact view.
// ---------------------------------------------------------------------------

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const filters = emptyFilters();
  for (const dim of FILTER_DIMENSIONS) filters[dim] = params.getAll(dim);
  const shortlist = (params.get('shortlist') ?? '').split(',').filter(Boolean);
  return { query: params.get('q') ?? '', filters, shortlist };
}

function writeStateToUrl({ query, filters, shortlist }) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  for (const dim of FILTER_DIMENSIONS) for (const v of filters[dim]) params.append(dim, v);
  if (shortlist.length) params.set('shortlist', shortlist.join(','));
  const search = params.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ''}`;
  window.history.replaceState(null, '', url);
}

// ---------------------------------------------------------------------------
// Small display helpers
// ---------------------------------------------------------------------------

function formatPopulation(group) {
  if (group.population === null) return 'Unknown';
  return group.population.toLocaleString('en-US');
}

function formatEvangelical(group) {
  if (group.evangelicalPercent === null) return '—';
  return `${group.evangelicalPercent.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function FacetGroup({ dim, options, counts, selected, onToggle }) {
  return (
    <fieldset className="facet">
      <legend>{DIMENSION_LABELS[dim]}</legend>
      {options.map((opt) => (
        <label key={opt} className="facet-option">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => onToggle(dim, opt)}
          />
          <span className="facet-label">{opt}</span>
          <span className="facet-count">{counts[opt] ?? 0}</span>
        </label>
      ))}
    </fieldset>
  );
}

function GroupCard({ group, inShortlist, onToggleShortlist }) {
  const mergedCount = group.mergedFrom.length;
  return (
    <li className="card">
      <div className="card-head">
        <div>
          <h3>
            {displayName(group.name)}
            {/* RULE: surface the merge in the interface */}
            {mergedCount > 1 && (
              <span className="badge" title="This group was formed from duplicate rows">
                merged from {mergedCount} records
              </span>
            )}
          </h3>
          <p className="muted">
            {group.country} · {group.region} · {group.primaryReligion}
          </p>
        </div>
        <button
          type="button"
          className={inShortlist ? 'btn btn-remove' : 'btn'}
          onClick={() => onToggleShortlist(group.id)}
        >
          {inShortlist ? 'Remove from shortlist' : 'Add to shortlist'}
        </button>
      </div>
      <dl className="facts">
        <dt>Population</dt>
        <dd>
          {formatPopulation(group)} <span className="muted">({group.populationBracket})</span>
        </dd>
        <dt>Languages</dt>
        <dd>{group.languages.join(', ') || '—'}</dd>
        <dt>Evangelical</dt>
        <dd>{formatEvangelical(group)}</dd>
        <dt>Bible status</dt>
        <dd>{group.bibleStatus}</dd>
      </dl>
      {mergedCount > 1 && (
        <p className="merged-list">
          Source records:{' '}
          {group.mergedFrom.map((m, i) => (
            <span key={m.id}>
              {i > 0 && ', '}
              <code>{m.id}</code> “{m.name}”
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

export default function App() {
  const [state, setState] = useState(readStateFromUrl);
  const { query, filters, shortlist } = state;

  // Keep the URL in sync with state, and state in sync with back/forward.
  useEffect(() => writeStateToUrl(state), [state]);
  useEffect(() => {
    const onPop = () => setState(readStateFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const visible = useMemo(() => applyFilters(groups, filters, query), [filters, query]);
  const counts = useMemo(() => facetCounts(groups, filters, query), [filters, query]);

  // Options per dimension: fixed order where one exists, else every value
  // seen in the full data set, alphabetically.
  const options = useMemo(() => {
    const all = facetCounts(groups, emptyFilters(), '');
    const out = {};
    for (const dim of FILTER_DIMENSIONS) {
      out[dim] = FIXED_ORDER[dim] ?? Object.keys(all[dim]).sort();
    }
    return out;
  }, []);

  const shortlisted = shortlist
    .map((id) => groups.find((g) => g.id === id))
    .filter(Boolean);

  function toggleFilter(dim, value) {
    setState((s) => {
      const current = s.filters[dim];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...s, filters: { ...s.filters, [dim]: next } };
    });
  }

  function toggleShortlist(id) {
    setState((s) => ({
      ...s,
      shortlist: s.shortlist.includes(id)
        ? s.shortlist.filter((x) => x !== id)
        : [...s.shortlist, id],
    }));
  }

  function clearFilters() {
    setState((s) => ({ ...s, query: '', filters: emptyFilters() }));
  }

  const anyFilter = query !== '' || FILTER_DIMENSIONS.some((d) => filters[d].length > 0);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>People Group Browser</h1>
        <label className="search">
          <span>Search by name</span>
          <input
            type="search"
            value={query}
            placeholder="e.g. uyghur, hmong"
            onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
          />
        </label>
        {anyFilter && (
          <button type="button" className="btn btn-link" onClick={clearFilters}>
            Clear search and filters
          </button>
        )}
        {FILTER_DIMENSIONS.map((dim) => (
          <FacetGroup
            key={dim}
            dim={dim}
            options={options[dim]}
            counts={counts[dim]}
            selected={filters[dim]}
            onToggle={toggleFilter}
          />
        ))}
      </aside>

      <main className="results">
        <p className="summary">
          Showing {visible.length} of {groups.length} groups
        </p>
        {visible.length === 0 ? (
          <p className="muted">No groups match. Try clearing a filter.</p>
        ) : (
          <ul className="cards">
            {visible.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                inShortlist={shortlist.includes(g.id)}
                onToggleShortlist={toggleShortlist}
              />
            ))}
          </ul>
        )}
      </main>

      <aside className="shortlist">
        <h2>Shortlist ({shortlisted.length})</h2>
        {shortlisted.length === 0 ? (
          <p className="muted">Add groups from the list. The shortlist is saved in the URL, so copy the address bar to share it.</p>
        ) : (
          <ul>
            {shortlisted.map((g) => (
              <li key={g.id}>
                <div>
                  <strong>{displayName(g.name)}</strong>
                  <div className="muted">{g.country}</div>
                </div>
                <button type="button" className="btn btn-small" onClick={() => toggleShortlist(g.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
