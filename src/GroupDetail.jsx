// Full-page view of one group: every fact, the merge sources, and a clearly
// labelled placeholder "what this group needs" section. All content comes from
// the group record and needsHints() in src/lib/data.js.
import { displayName } from './lib/data.js';

function formatPopulation(group) {
  if (group.population === null) return 'Unknown';
  return group.population.toLocaleString('en-US');
}

// Needs tags as small chips. Placeholder tags are visually distinct and titled.
export function NeedChips({ tags }) {
  return (
    <div className="chips">
      {tags.map((t) => (
        <span
          key={t.category}
          className={t.placeholder ? 'chip chip-placeholder' : 'chip'}
          title={t.placeholder ? 'Placeholder tag, not from data' : t.why}
        >
          {t.category}
          {t.placeholder && <span className="chip-note"> · placeholder</span>}
        </span>
      ))}
    </div>
  );
}

export default function GroupDetail({ group, backLabel, onBack, inShortlist, onToggleShortlist }) {
  const mergedCount = group.mergedFrom.length;
  const tags = group.needsDetail;

  return (
    <article className="detail">
      <button type="button" className="btn btn-link" onClick={onBack}>
        ← {backLabel}
      </button>

      <div className="card-head">
        <div>
          <h2 className="detail-title">
            {displayName(group.name)}
            {/* RULE: surface the merge in the interface */}
            {mergedCount > 1 && <span className="badge">merged from {mergedCount} records</span>}
          </h2>
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

      <dl className="facts detail-facts">
        <dt>Population</dt>
        <dd>
          {formatPopulation(group)}
          {group.population !== null && <span className="muted"> ({group.populationBracket})</span>}
          {group.population !== null && group.populationRaw !== String(group.population) && (
            <span className="muted small"> · recorded as “{group.populationRaw}”</span>
          )}
        </dd>
        <dt>Languages</dt>
        <dd>{group.languages.join(', ') || '—'}</dd>
        <dt>Religion</dt>
        <dd>{group.primaryReligion}</dd>
        <dt>Evangelical</dt>
        <dd>{group.evangelicalPercent === null ? '—' : `${group.evangelicalPercent.toFixed(2)}%`}</dd>
        <dt>Bible status</dt>
        <dd>{group.bibleStatus}</dd>
        <dt>Record id</dt>
        <dd>
          <code>{group.id}</code>
        </dd>
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

      <section className="placeholder-box" aria-labelledby="needs-title">
        <h3 id="needs-title">What this group needs</h3>
        <NeedChips tags={tags} />
        <p className="placeholder-label">
          Test data. Tags marked placeholder are randomly assigned. Tags from the data show the rule used.
        </p>
        <ul className="needs-list">
          {tags.map((t) => (
            <li key={t.category}>
              <strong>{t.category}</strong>
              <span className="muted"> — {t.why}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
