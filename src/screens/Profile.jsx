/*
 * Profile — communication profile + MY COMMUNICATION PATTERNS.
 */

import { Btn, Eyebrow } from '../components/ui.jsx';
import { SKILLS, CATEGORIES, communicationLevel, strongestSkill, weakestSkill } from '../lib/skills.js';
import { WEAKNESS_LIBRARY } from '../lib/analysis.js';
import { getProfile, weaknessPatternsSorted, completedAttempts } from '../lib/store.js';

export default function Profile({ onDrill }) {
  const profile = getProfile();
  const scores = profile?.skill_scores || {};
  const patterns = weaknessPatternsSorted();
  const attempts = completedAttempts();
  const level = communicationLevel(scores);

  const recurringWeak = patterns.filter((p) => p.times_observed >= 2);
  const improving = patterns.filter((p) => p.times_improved >= 1);
  const onceSeen = patterns.filter((p) => p.times_observed === 1);
  const strong = strongestSkill(scores);
  const weak = weakestSkill(scores);

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>My communication profile</Eyebrow>
        <h1 className="display section-title">How you communicate, so far.</h1>
        <p className="faint" style={{ marginBottom: 20 }}>
          Training indicators built from {attempts.length} recorded attempt{attempts.length === 1 ? '' : 's'} — measured,
          never invented. Unmeasured skills stay blank until evidence exists.
        </p>

        <div className="stat-strip">
          <div className="stat-cell">
            <div className="stat-k">Current level</div>
            <div className="stat-v">{level.level}{level.score !== null && <small>{level.score}</small>}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-k">Strongest / weakest</div>
            <div className="stat-v" style={{ fontSize: 13 }}>{strong ? strong.label : '—'} / {weak ? weak.label : '—'}</div>
          </div>
        </div>

        {CATEGORIES.map((cat) => {
          const inCat = SKILLS.filter((s) => s.category === cat && scores[s.key] !== null && scores[s.key] !== undefined);
          if (!inCat.length) return null;
          return (
            <div key={cat} className="skill-group">
              <p className="skill-group-head">{cat}</p>
              {inCat.map((s) => (
                <div className="skill-row" key={s.key}>
                  <div className="skill-row-top">
                    <span className="skill-name">{s.label}</span>
                    <span className="skill-score">{scores[s.key]}</span>
                  </div>
                  <span className="skill-hint">{s.hint}</span>
                </div>
              ))}
            </div>
          );
        })}
        {SKILLS.every((s) => scores[s.key] === null || scores[s.key] === undefined) && (
          <p className="faint">No skills measured yet — complete today's training.</p>
        )}

        <hr className="rule" />
        <h2 className="display" style={{ fontSize: 24, marginBottom: 6 }}>My communication patterns</h2>
        <p className="faint" style={{ marginBottom: 14 }}>What recurs is what matters. ORATOR raises the priority of anything that keeps coming back.</p>

        {recurringWeak.length === 0 && improving.length === 0 && onceSeen.length === 0 && (
          <p className="faint">No patterns yet — they form as you train.</p>
        )}

        {recurringWeak.map((p) => (
          <div className="weakness-card" key={p.id}>
            <div className="wc-top">
              <span className="wc-name">{WEAKNESS_LIBRARY[p.weakness_key]?.label || p.weakness_key}</span>
              <span className="wc-count">recurring · seen {p.times_observed}×</span>
            </div>
            <p className="wc-note">{p.examples?.[p.examples.length - 1]?.evidence || ''}</p>
            <p className="wc-note" style={{ color: 'var(--ink-faint)' }}>First observed {new Date(p.first_observed).toLocaleDateString()} · last {new Date(p.last_observed).toLocaleDateString()}</p>
            {onDrill && (
              <Btn small variant="ghost" style={{ marginTop: 10 }} onClick={() => onDrill(p.weakness_key)}>Drill this</Btn>
            )}
          </div>
        ))}

        {improving.map((p) => (
          <div className="weakness-card improved" key={p.id}>
            <div className="wc-top">
              <span className="wc-name">{WEAKNESS_LIBRARY[p.weakness_key]?.label || p.weakness_key}</span>
              <span className="wc-count" style={{ color: 'var(--ok)' }}>improving · {p.times_improved}×</span>
            </div>
            <p className="wc-note">Targeted and answered for in a retry. Keep it under control.</p>
          </div>
        ))}

        {onceSeen.length > 0 && (
          <>
            <p className="skill-group-head" style={{ marginTop: 20 }}>Seen once (watch list)</p>
            {onceSeen.map((p) => (
              <div className="attempt-row" key={p.id}>
                <div>
                  <span style={{ fontWeight: 500 }}>{WEAKNESS_LIBRARY[p.weakness_key]?.label || p.weakness_key}</span>
                  <br />
                  <span className="faint">{p.examples?.[p.examples.length - 1]?.evidence || ''}</span>
                </div>
                <span className="attempt-date">{new Date(p.last_observed).toLocaleDateString()}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
