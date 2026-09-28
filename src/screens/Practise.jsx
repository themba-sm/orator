/*
 * Practise — choose a training category, get a targeted drill.
 * Speak — a weighted open challenge right now.
 */

import { Btn, Eyebrow } from '../components/ui.jsx';
import { CATEGORIES_META } from '../lib/exercises.js';
import { WEAKNESS_LIBRARY } from '../lib/analysis.js';
import { weaknessPatternsSorted, getProfile } from '../lib/store.js';

const WEAKNESS_TO_CATEGORY = {
  organisation: 'organisation', fillers: 'fillers', pace: 'pace', precision: 'precision',
  opening: 'concise', conclusion: 'concise', repetition: 'concise', sentenceConstruction: 'precision',
  specificity: 'story', verbosity: 'concise', development: 'organisation', relevance: 'opinion', vocalDelivery: 'pace',
};

export default function Practise({ onPick }) {
  const patterns = weaknessPatternsSorted();
  const profile = getProfile();
  const flagged = new Set();
  patterns.filter((p) => p.times_observed >= 2).forEach((p) => {
    const c = WEAKNESS_TO_CATEGORY[p.weakness_key];
    if (c) flagged.add(c);
  });
  (profile?.weak_areas || []).forEach((a) => { const c = WEAKNESS_TO_CATEGORY[a] || a; if (c) flagged.add(c); });

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Practise</Eyebrow>
        <h1 className="display section-title">Choose your weapon.</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          A focused drill in one category. {flagged.size > 0 ? 'Your recurring weaknesses are flagged.' : ''}
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          {Object.entries(CATEGORIES_META).map(([key, meta]) => (
            <button key={key} type="button" className="option-tile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => onPick(key)}>
              <span>
                <span className="ot-title">{meta.label}</span>
                Trains: {meta.skill}
              </span>
              {flagged.has(key) && <span className="chip brass" style={{ marginLeft: 10 }}>your weak spot</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SpeakNow({ exercise, onStart, onBack }) {
  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Speak</Eyebrow>
        <h1 className="display section-title">The floor is open.</h1>
        <p className="muted" style={{ marginBottom: 22 }}>A challenge drawn from your history, right now.</p>
        <div className="today-card">
          <p className="today-kind">{CATEGORIES_META[exercise.category]?.label}</p>
          <h1 className="today-title">{exercise.title}</h1>
          <p className="today-prompt">“{exercise.prompt}”</p>
          <Btn block onClick={() => onStart(exercise)}>Speak now</Btn>
          <div className="trainer-controls" style={{ marginTop: 12 }}>
            <Btn small variant="ghost" onClick={onBack}>Draw another</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Settings({ onDifficultyChange, onReset }) {
  const profile = getProfile();
  const diffs = ['foundation', 'developing', 'advanced', 'elite'];
  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Settings</Eyebrow>
        <h1 className="display section-title">The academy rules.</h1>

        <div className="field" style={{ marginTop: 22 }}>
          <span className="field-label">Training difficulty</span>
          <div className="option-grid" style={{ gridTemplateColumns: '1fr' }}>
            {diffs.map((d) => (
              <button key={d} type="button" className={`option-tile${profile?.difficulty === d ? ' selected' : ''}`} onClick={() => onDifficultyChange(d)}>
                <span className="ot-title">{d.toUpperCase()}</span>
              </button>
            ))}
          </div>
          <p className="faint" style={{ marginTop: 8 }}>Changes preparation time, complexity, unpredictability and pressure. You control this — ORATOR will not force it up.</p>
        </div>

        <hr className="rule" />
        <p className="fb-head">Danger zone</p>
        <Btn variant="danger-ghost" block onClick={onReset}>Erase all training history</Btn>
        <p className="faint" style={{ marginTop: 8 }}>
          Erases your profile, every attempt, every pattern. There is no undo — this is the one place ORATOR shows no mercy.
        </p>
      </div>
    </div>
  );
}
