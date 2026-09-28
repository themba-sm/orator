/* PressureHome — enter the Pressure Room. */

import { useMemo, useState } from 'react';
import { Eyebrow } from '../components/ui.jsx';
import { PRESSURE_MODES, PRESSURE_LEVELS, suggestedLevel } from '../lib/pressure.js';

export default function PressureHome({ onStart }) {
  const suggested = useMemo(() => suggestedLevel(), []);
  const [level, setLevel] = useState(suggested);

  return (
    <div className="screen pressure-screen">
      <div className="wrap">
        <div className="pressure-mark" />
        <Eyebrow dim>Pressure Room</Eyebrow>
        <h1 className="display section-title">Speak when it counts.</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Pressure does not create weaknesses; it reveals them. Every run analyses composure, then gives you one weakness and a retry — a different prompt, the same underlying skill.
        </p>

        <p className="skill-group-head">Pressure level {level && `— ${PRESSURE_LEVELS[level].key}`}</p>
        <div className="option-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {PRESSURE_LEVELS.slice(1).map((l) => (
            <button key={l.n} type="button" className={`option-tile${level === l.n ? ' selected' : ''}`} style={{ padding: '9px 4px', textAlign: 'center' }} onClick={() => setLevel(l.n)}>
              <span className="ot-title" style={{ fontSize: 10.5 }}>L{l.n}</span>
            </button>
          ))}
        </div>
        <p className="faint" style={{ marginTop: -12, marginBottom: 20 }}>
          Suggested for you: Level {suggested}. {level !== suggested ? `You selected Level ${level}.` : ''}
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          {PRESSURE_MODES.map((m) => (
            <button key={m.key} type="button" className="option-tile" onClick={() => onStart(m.key, level)}>
              <span className="ot-title">{m.label}</span>
              {m.hint}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
