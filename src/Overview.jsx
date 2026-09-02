// "At a glance" overview shown on the home page before any filter is applied:
// headline tiles, then one block per region with a row per country. All numbers
// come from src/lib/data.js summaries; this file only renders them. Bars are
// plain divs sized with CSS widths — no chart library.
import {
  countrySummaries,
  regionSummaries,
  overallSummary,
  BIBLE_STATUSES,
  NEED_CATEGORIES,
  NEED_DESCRIPTIONS,
} from './lib/data.js';

function fmt(n) {
  return n.toLocaleString('en-US');
}

// Short human-readable population: 71,528,517 → "71.5M", 305,406 → "305k".
function fmtShort(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

// Population cell text with an honest caveat when some groups are unknown.
function PopulationCell({ summary }) {
  const { knownPopulation, unknownPopulationCount, groupCount } = summary;
  if (unknownPopulationCount === groupCount) return <span className="muted">unknown</span>;
  return (
    <>
      <span title={fmt(knownPopulation)}>{fmtShort(knownPopulation)}</span>
      {unknownPopulationCount > 0 && (
        <span className="muted small"> · {unknownPopulationCount} of {groupCount} unknown</span>
      )}
    </>
  );
}

// Five-segment stacked bar; each segment's width is its share of the groups.
function BibleBar({ counts, total }) {
  const label = BIBLE_STATUSES.map((s) => `${s}: ${counts[s] ?? 0}`).join(', ');
  return (
    <div className="bible-bar" title={label} aria-label={label} role="img">
      {BIBLE_STATUSES.map((s) => {
        const n = counts[s] ?? 0;
        if (n === 0) return null;
        return (
          <div
            key={s}
            className={`bible-seg bible-${s.toLowerCase().replace(/\s+/g, '-')}`}
            style={{ width: `${(n / total) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

function StatTile({ value, label, caption }) {
  return (
    <div className="tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
      {caption && <div className="tile-caption">{caption}</div>}
    </div>
  );
}

export default function Overview({ groups, onPickCountry, onPickRegion, onPickNeed }) {
  const overall = overallSummary(groups);
  const regions = regionSummaries(groups);
  const countries = countrySummaries(groups);
  const maxGroups = Math.max(...countries.map((c) => c.groupCount));

  return (
    <section className="overview" aria-labelledby="overview-title">
      <h2 id="overview-title">At a glance</h2>

      <div className="tiles">
        <StatTile value={fmt(overall.groupCount)} label="people groups" caption="Distinct communities after merging duplicate records" />
        <StatTile value={fmt(overall.countryCount)} label="countries" />
        <StatTile
          value={fmtShort(overall.knownPopulation)}
          label="people (known)"
          caption={`${overall.unknownPopulationCount} groups have no population figure and are not counted`}
        />
        <StatTile
          value={fmt(overall.bibleStatusCounts.None)}
          label="groups with no Scripture"
          caption="No part of the Bible exists in their language"
        />
      </div>

      <section className="need-picker" aria-labelledby="need-picker-title">
        <h3 id="need-picker-title">I have… where should they go?</h3>
        <p className="muted small">Pick what you have to send. The list will show the groups tagged with that need.</p>
        <div className="need-buttons">
          {NEED_CATEGORIES.map((cat) => (
            <button key={cat} type="button" className="need-btn" onClick={() => onPickNeed(cat)}>
              <span className="need-btn-title">{cat}</span>
              <span className="need-btn-caption">{NEED_DESCRIPTIONS[cat]}</span>
            </button>
          ))}
        </div>
        <p className="muted small">
          Tags marked “placeholder” are randomly assigned for testing; each group's page shows which tags come from the data.
        </p>
      </section>

      <p className="how-to-read">
        A <strong>people group</strong> is a community that shares a language and identity.
        <strong> Evangelical %</strong> is the share of that group who are evangelical Christians.
        <strong> Bible status</strong> shows how much of the Bible exists in their language.
        Click a country or region to see its groups.
      </p>

      <div className="legend" aria-label="Bible status legend">
        {BIBLE_STATUSES.map((s) => (
          <span key={s} className="legend-item">
            <span className={`swatch bible-${s.toLowerCase().replace(/\s+/g, '-')}`} />
            {s}
          </span>
        ))}
      </div>

      {regions.map((r) => (
        <div key={r.region} className="region-block">
          <div className="region-head">
            <button type="button" className="link-btn region-name" onClick={() => onPickRegion(r.region)}>
              {r.region}
            </button>
            <span className="muted">
              {r.groupCount} groups · <PopulationCell summary={r} />
            </span>
          </div>
          <table className="country-table">
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">People groups</th>
                <th scope="col">People</th>
                <th scope="col">Bible status</th>
                <th scope="col" className="num">Avg. evangelical</th>
              </tr>
            </thead>
            <tbody>
              {countries
                .filter((c) => c.region === r.region)
                .map((c) => (
                  <tr key={c.country}>
                    <td>
                      <button type="button" className="link-btn" onClick={() => onPickCountry(c.country)}>
                        {c.country}
                      </button>
                    </td>
                    <td>
                      <div className="count-bar-wrap">
                        <div className="count-bar" style={{ width: `${(c.groupCount / maxGroups) * 100}%` }} />
                        <span className="count-num">{c.groupCount}</span>
                      </div>
                    </td>
                    <td>
                      <PopulationCell summary={c} />
                    </td>
                    <td>
                      <BibleBar counts={c.bibleStatusCounts} total={c.groupCount} />
                    </td>
                    <td className="num">
                      {c.avgEvangelicalPercent === null ? '—' : `${c.avgEvangelicalPercent.toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
