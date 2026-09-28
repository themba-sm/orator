/*
 * Comparison — attempt 1 vs attempt 2, what changed, honestly.
 */

import { Btn, Eyebrow, Meter } from '../components/ui.jsx';
import { WEAKNESS_LIBRARY } from '../lib/analysis.js';

export default function CompareView({ attempt1, attempt2, comparison, weaknessKey, onDone }) {
  const m1 = attempt1.measured;
  const m2 = attempt2.measured;
  const lib = WEAKNESS_LIBRARY[weaknessKey];

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>What changed</Eyebrow>
        <h2 className="display section-title">Attempt 1 vs attempt 2</h2>
        <p className="muted" style={{ marginBottom: 18 }}>
          Targeted: <span style={{ color: 'var(--brass)' }}>{lib ? lib.label : weaknessKey}</span>
        </p>

        <div className="compare-grid">
          <div className="compare-col">
            <span className="c-tag">Attempt 1</span>
            <div className="c-num">{Math.round(m1.durationSeconds)}s · {m1.wordCount || 0}w</div>
            <Meter label="Pace" value={m1.wpm ? Math.min(100, (100 - Math.abs(m1.wpm - 140) * 0.9)) : null} suffix="" />
            <Meter label="Filler rate" value={m1.fillerRate !== null ? Math.max(0, 100 - m1.fillerRate * 12) : null} />
            <Meter label="Structure" value={Math.min(100, (m1.structureHits || 0) * 22)} />
          </div>
          <div className="compare-col">
            <span className="c-tag">Attempt 2</span>
            <div className="c-num">{Math.round(m2.durationSeconds)}s · {m2.wordCount || 0}w</div>
            <Meter label="Pace" value={m2.wpm ? Math.min(100, (100 - Math.abs(m2.wpm - 140) * 0.9)) : null} suffix="" />
            <Meter label="Filler rate" value={m2.fillerRate !== null ? Math.max(0, 100 - m2.fillerRate * 12) : null} />
            <Meter label="Structure" value={Math.min(100, (m2.structureHits || 0) * 22)} />
          </div>
        </div>

        {comparison.items.length > 0 ? (
          <div className="panel" style={{ marginTop: 6 }}>
            {comparison.items.map((it) => (
              <div className="change-row" key={it.label}>
                <div>
                  <div className="change-label">{it.label}</div>
                  <div className="change-data">{it.text}</div>
                </div>
                <span className={`change-dir ${it.dir}`}>{it.dir}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="faint">Not enough shared measurements between the two attempts to compare numerically.</p>
        )}

        <div className="verdict">{comparison.headline}</div>

        <div className="panel">
          <p className="fb-head">Next step</p>
          <p style={{ fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.6 }}>{comparison.nextStep}</p>
        </div>

        <div className="trainer-controls" style={{ marginTop: 26 }}>
          <Btn block onClick={onDone}>Save result & finish</Btn>
        </div>
      </div>
    </div>
  );
}
