// The whole UI: a tab bar (Overview / Groups / Shortlist) and, when a group is
// selected, a detail page. All data logic comes from src/lib/data.js; this file
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
import Overview from './Overview.jsx';
import GroupDetail, { NeedChips } from './GroupDetail.jsx';
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
  country: 'Country',
  need: 'Need',
};

// Fixed option order for the facets that have a natural order; the rest are
// sorted alphabetically from the data.
const FIXED_ORDER = { region: REGIONS, bracket: BRACKETS };

const VIEWS = ['overview', 'groups', 'shortlist'];

// ---------------------------------------------------------------------------
// URL <-> state. Query keys: view (overview|groups|shortlist; absent =
// overview), group (id of the group whose detail page is open), q (search),
// one key per filter dimension (repeated), and shortlist (comma-separated ids).
// Pasting the URL reproduces the exact view.
// ---------------------------------------------------------------------------

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const filters = emptyFilters();
  for (const dim of FILTER_DIMENSIONS) filters[dim] = params.getAll(dim);
  const shortlist = (params.get('shortlist') ?? '').split(',').filter(Boolean);
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'overview';
  return { view, group: params.get('group') ?? '', query: params.get('q') ?? '', filters, shortlist };
}

function writeStateToUrl({ view, group, query, filters, shortlist }) {
  const params = new URLSearchParams();
  if (view !== 'overview') params.set('view', view);
  if (group) params.set('group', group);
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
      <div className="facet-options">
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
      </div>
    </fieldset>
  );
}

function GroupCard({ group, inShortlist, onToggleShortlist, onOpen }) {
  const mergedCount = group.mergedFrom.length;
  return (
    <li className="card">
      <div className="card-head">
        <div>
          <h3>
            <button type="button" className="link-btn" onClick={() => onOpen(group.id)}>
              {displayName(group.name)}
            </button>
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
          {formatPopulation(group)}
          {group.population !== null && <span className="muted"> ({group.populationBracket})</span>}
        </dd>
        <dt>Languages</dt>
        <dd>{group.languages.join(', ') || '—'}</dd>
        <dt>Evangelical</dt>
        <dd>{formatEvangelical(group)}</dd>
        <dt>Bible status</dt>
        <dd>{group.bibleStatus}</dd>
      </dl>
      <NeedChips tags={group.needsDetail} />
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

function ShortlistView({ shortlisted, onOpen, onRemove }) {
  if (shortlisted.length === 0) {
    return (
      <p className="muted">
        Your shortlist is empty. Open the Groups tab and click “Add to shortlist”. The shortlist is
        saved in the page address, so copy the address bar to share it.
      </p>
    );
  }
  return (
    <ul className="shortlist-rows">
      {shortlisted.map((g) => (
        <li key={g.id} className="card shortlist-row">
          <div>
            <button type="button" className="link-btn shortlist-name" onClick={() => onOpen(g.id)}>
              {displayName(g.name)}
            </button>
            <div className="muted">
              {g.country} · {g.region} · Bible: {g.bibleStatus} · Population: {formatPopulation(g)}
            </div>
          </div>
          <button type="button" className="btn btn-small" onClick={() => onRemove(g.id)}>
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const [state, setState] = useState(readStateFromUrl);
  const { view, group: groupId, query, filters, shortlist } = state;

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

  const shortlisted = shortlist.map((id) => groups.find((g) => g.id === id)).filter(Boolean);
  const openGroup = groupId ? groups.find((g) => g.id === groupId) : null;

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

  // Overview drill-down: jump to the Groups tab with a single-value filter.
  function pickOnly(dim, value) {
    setState((s) => ({
      ...s,
      view: 'groups',
      group: '',
      query: '',
      filters: { ...emptyFilters(), [dim]: [value] },
    }));
  }

  function switchView(next) {
    setState((s) => ({ ...s, view: next, group: '' }));
  }

  function openDetail(id) {
    setState((s) => ({ ...s, group: id }));
  }

  function closeDetail() {
    setState((s) => ({ ...s, group: '' }));
  }

  const anyFilter = query !== '' || FILTER_DIMENSIONS.some((d) => filters[d].length > 0);

  // Friendlier results heading when exactly one country or region is selected.
  const onlyDim = (dim) =>
    filters[dim].length === 1 && !query && FILTER_DIMENSIONS.every((d) => d === dim || filters[d].length === 0);
  let heading = `Showing ${visible.length} of ${groups.length} groups`;
  if (onlyDim('need')) heading = `Showing ${visible.length} groups that need ${filters.need[0]}`;
  else if (onlyDim('country')) heading = `Showing ${visible.length} groups in ${filters.country[0]}`;
  else if (onlyDim('region')) heading = `Showing ${visible.length} groups in ${filters.region[0]}`;

  const backLabel = view === 'shortlist' ? 'Back to shortlist' : view === 'groups' ? 'Back to groups' : 'Back to overview';

  return (
    <div className="page">
      <header className="topbar">
        <h1>People Group Browser</h1>
        <nav className="tabs" aria-label="Sections">
          <button type="button" role="tab" className="tab" aria-selected={view === 'overview'} onClick={() => switchView('overview')}>
            Overview
          </button>
          <button type="button" role="tab" className="tab" aria-selected={view === 'groups'} onClick={() => switchView('groups')}>
            Groups
            {anyFilter && <span className="tab-badge">{visible.length} shown</span>}
          </button>
          <button type="button" role="tab" className="tab" aria-selected={view === 'shortlist'} onClick={() => switchView('shortlist')}>
            Shortlist
            <span className="tab-badge">{shortlisted.length}</span>
          </button>
        </nav>
      </header>

      {openGroup ? (
        <div className="layout-single">
          <GroupDetail
            group={openGroup}
            backLabel={backLabel}
            onBack={closeDetail}
            inShortlist={shortlist.includes(openGroup.id)}
            onToggleShortlist={toggleShortlist}
          />
        </div>
      ) : groupId ? (
        <div className="layout-single">
          <button type="button" className="btn btn-link" onClick={closeDetail}>
            ← {backLabel}
          </button>
          <p className="muted">No group with id “{groupId}”.</p>
        </div>
      ) : view === 'overview' ? (
        <div className="layout-single">
          <Overview
            groups={groups}
            onPickCountry={(c) => pickOnly('country', c)}
            onPickRegion={(r) => pickOnly('region', r)}
            onPickNeed={(n) => pickOnly('need', n)}
          />
        </div>
      ) : view === 'shortlist' ? (
        <div className="layout-single">
          <h2>Shortlist ({shortlisted.length})</h2>
          <ShortlistView shortlisted={shortlisted} onOpen={openDetail} onRemove={toggleShortlist} />
        </div>
      ) : (
        <div className="layout-groups">
          <aside className="sidebar">
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
            <p className="summary">{heading}</p>
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
                    onOpen={openDetail}
                  />
                ))}
              </ul>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
