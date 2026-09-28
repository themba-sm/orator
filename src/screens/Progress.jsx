/*
 * Progress — "What am I improving?"
 */

import { Btn, Eyebrow, Meter } from '../components/ui.jsx';
import { SKILLS, CATEGORIES, communicationLevel } from '../lib/skills.js';
import { WEAKNESS_LIBRARY } from '../lib/analysis.js';
import { getProfile, completedAttempts, find } from '../lib/store.js';

export default function Progress({ onTrain }) {
  const profile = getProfile();
  const scores = profile?.skill_scores || {};
  const attempts = completedAttempts();
  const level = communicationLevel(scores);
  const snapshots = find('progressSnapshots', () => true).slice(-8);
  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  let rising = 0; let falling = 0;
  if (first && latest && first.id !== latest.id) {
    Object.keys(latest.skills || {}).forEach((k) => {
      const a = (first.skills || {})[k];
      const b = (latest.skills || {})[k];
      if (a !== null && b !== null && a !== undefined && b !== undefined) {
        if (b > a) rising += 1; else if (b < a) falling += 1;
      }
    });
  }

  const recent = attempts.slice(-6).reverse();
  const weakRank = Object.entries(scores).filter(([, v]) => v !== null && v !== undefined).sort((a, b) => a[1] - b[1]).slice(0, 3);

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Progress</Eyebrow>
        <h1 className="display section-title">What am I improving?</h1>
        <p className="faint" style={{ marginBottom: 22 }}>
          The only question that matters. Based on {attempts.length} completed attempt{attempts.length === 1 ? '' : 's'} and {snapshots.length} progress snapshot{snapshots.length === 1 ? '' : 's'}.
        </p>

        <div className="stat-strip">
          <div className="stat-cell">
            <div className="stat-k">Overall development</div>
            <div className="stat-v">{level.level}{level.score !== null && <small>{level.score}</small>}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-k">Trend</div>
            <div className="stat-v">{rising} <small>skills rising</small></div>
            {falling > 0 && <div className="stat-k" style={{ marginTop: 2 }}>{falling} slipped</div>}
          </div>
        </div>

        <hr className="rule" />
        <p className="fb-head">Skill categories</p>
        {CATEGORIES.map((cat) => {
          const inCat = SKILLS.filter((s) => s.category === cat && scores[s.key] !== null && scores[s.key] !== undefined);
          if (!inCat.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <p className="skill-group-head">{cat}</p>
              {inCat.map((s) => <Meter key={s.key} label={s.label} value={scores[s.key]} />)}
            </div>
          );
        })}

        {weakRank.length > 0 && (
          <>
            <hr className="rule" />
            <p className="fb-head">Current priorities</p>
            {weakRank.map(([k, v]) => (
              <div className="attempt-row" key={k}>
                <div>
                  <span style={{ fontWeight: 500 }}>{SKILLS.find((s) => s.key === k)?.label || k}</span>
                  <br />
                  <span className="faint">Lowest standing indicator — training will keep returning here.</span>
                </div>
                <span className="attempt-date">{v}</span>
              </div>
            ))}
          </>
        )}

        <hr className="rule" />
        <p className="fb-head">Recent attempts</p>
        {recent.length === 0 && <p className="faint">No attempts yet — today's training is waiting.</p>}
        {recent.map((a) => (
          <div className="attempt-row" key={a.id}>
            <div>
              <span style={{ fontWeight: 500 }}>{a.exercise_title || a.exercise_id}</span>
              <br />
              <span className="faint">
                {a.weakness_key ? `Key weakness: ${WEAKNESS_LIBRARY[a.weakness_key]?.label || a.weakness_key}` : 'No dominant weakness'}
                {a.attempt_number === 2 ? ' · retry attempt' : ''}
              </span>
            </div>
            <span className="attempt-date">{new Date(a.created_date).toLocaleDateString()}</span>
          </div>
        ))}

        <div className="trainer-controls" style={{ marginTop: 30 }}>
          <Btn block onClick={onTrain}>Train now</Btn>
        </div>
      </div>
    </div>
  );
}
