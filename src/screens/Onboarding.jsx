/*
 * ORATOR onboarding — short, premium, ends in the baseline assessment.
 * Collects: name, goals, confidence, difficulty, experience, self-declared weak areas.
 */

import { useMemo, useState } from 'react';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { insert, getCurrentUser, update } from '../lib/store.js';

const GOALS = [
  { key: 'presence', label: 'Command a room', hint: 'Presence and authority when all eyes are on me' },
  { key: 'clarity', label: 'Think on my feet', hint: 'Answer any question well, instantly' },
  { key: 'persuade', label: 'Persuade', hint: 'Move people to act, not just agree' },
  { key: 'story', label: 'Tell stories', hint: 'Hold attention and make ideas stick' },
  { key: 'career', label: 'Advance my career', hint: 'Interviews, pitches, presentations' },
  { key: 'everyday', label: 'Speak better daily', hint: 'Conversations, calls, meetings' },
];

const CONFIDENCE = ['Very low', 'Low', 'Moderate', 'High', 'Unshakeable'];
const EXPERIENCE = ['Almost none', 'Occasional', 'Regular', 'Extensive'];
const DIFFICULTIES = [
  { key: 'foundation', label: 'FOUNDATION', hint: 'Build the fundamentals' },
  { key: 'developing', label: 'DEVELOPING', hint: 'Comfortable, sharpening' },
  { key: 'advanced', label: 'ADVANCED', hint: 'Tested, demanding' },
  { key: 'elite', label: 'ELITE', hint: 'Full pressure, no mercy' },
];
const WEAK_AREAS = [
  { key: 'fillers', label: 'Filler words' },
  { key: 'organisation', label: 'Losing structure' },
  { key: 'precision', label: 'Vague language' },
  { key: 'pace', label: 'Pace control' },
  { key: 'story', label: 'Dry delivery' },
  { key: 'pressure', label: 'Freezing under pressure' },
];

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goals, setGoals] = useState([]);
  const [confidence, setConfidence] = useState(2);
  const [experience, setExperience] = useState(1);
  const [difficulty, setDifficulty] = useState('developing');
  const [weakAreas, setWeakAreas] = useState([]);

  const steps = 6;
  const canNext = useMemo(() => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return goals.length > 0;
    return true;
  }, [step, name, goals]);

  const toggle = (list, setList, key) => {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  function finish() {
    const existing = getCurrentUser();
    const user = existing || insert('users', { name: name.trim() });
    if (existing) update('users', existing.id, { name: name.trim() });
    insert('userProfiles', {
      user_id: user.id,
      goals,
      confidence: CONFIDENCE[confidence],
      experience: EXPERIENCE[experience],
      difficulty,
      weak_areas: weakAreas,
      onboarding_complete: true,
      baseline_complete: false,
    });
    onDone();
  }

  return (
    <div className="screen">
      <div className="wrap">
        <div className="step-dots">
          {Array.from({ length: steps }).map((_, i) => (
            <div key={i} className={`step-dot${i <= step ? ' on' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <Eyebrow>Private communication academy</Eyebrow>
            <h1 className="display hero-title">Who will be doing the speaking?</h1>
            <p className="muted" style={{ marginBottom: 26 }}>ORATOR will train you until excellent speaking becomes automatic. First, the basics — then we measure where you stand.</p>
            <div className="field">
              <label className="field-label" htmlFor="ob-name">Your name</label>
              <input id="ob-name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Say it like you mean it" autoFocus />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Eyebrow>Speaking goals</Eyebrow>
            <h1 className="display section-title">What are we training for?</h1>
            <p className="muted" style={{ marginBottom: 22 }}>Choose everything that applies. This decides what ORATOR pushes hardest.</p>
            <div className="option-grid">
              {GOALS.map((g) => (
                <button key={g.key} type="button" className={`option-tile${goals.includes(g.key) ? ' selected' : ''}`} onClick={() => toggle(goals, setGoals, g.key)}>
                  <span className="ot-title">{g.label}</span>
                  {g.hint}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Eyebrow>Self-assessment</Eyebrow>
            <h1 className="display section-title">How confident are you today?</h1>
            <p className="muted" style={{ marginBottom: 22 }}>Honest answers train you faster than kind ones.</p>
            <div className="field">
              <span className="field-label">Current speaking confidence</span>
              <div className="option-grid" style={{ gridTemplateColumns: '1fr' }}>
                {CONFIDENCE.map((c, i) => (
                  <button key={c} type="button" className={`option-tile${confidence === i ? ' selected' : ''}`} onClick={() => setConfidence(i)}>
                    <span className="ot-title">{c}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Eyebrow>Self-assessment</Eyebrow>
            <h1 className="display section-title">How much have you spoken?</h1>
            <p className="muted" style={{ marginBottom: 22 }}>Presentations, meetings, arguments, stages — everything counts.</p>
            <div className="field">
              <span className="field-label">Speaking experience</span>
              <div className="option-grid" style={{ gridTemplateColumns: '1fr' }}>
                {EXPERIENCE.map((c, i) => (
                  <button key={c} type="button" className={`option-tile${experience === i ? ' selected' : ''}`} onClick={() => setExperience(i)}>
                    <span className="ot-title">{c}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <Eyebrow>Training difficulty</Eyebrow>
            <h1 className="display section-title">Choose the pressure.</h1>
            <p className="muted" style={{ marginBottom: 22 }}>This sets preparation time, complexity and how hard the challenges bite. You control it — change it any time.</p>
            <div className="option-grid" style={{ gridTemplateColumns: '1fr' }}>
              {DIFFICULTIES.map((d) => (
                <button key={d.key} type="button" className={`option-tile${difficulty === d.key ? ' selected' : ''}`} onClick={() => setDifficulty(d.key)}>
                  <span className="ot-title">{d.label}</span>
                  {d.hint}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <Eyebrow>Honesty round</Eyebrow>
            <h1 className="display section-title">Where do you already feel weak?</h1>
            <p className="muted" style={{ marginBottom: 22 }}>Optional — but knowing where it hurts helps ORATOR target it from day one.</p>
            <div className="option-grid">
              {WEAK_AREAS.map((w) => (
                <button key={w.key} type="button" className={`option-tile${weakAreas.includes(w.key) ? ' selected' : ''}`} onClick={() => toggle(weakAreas, setWeakAreas, w.key)}>
                  <span className="ot-title">{w.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="trainer-controls" style={{ marginTop: 34 }}>
          {step > 0 && <Btn variant="ghost" onClick={() => setStep(step - 1)}>Back</Btn>}
          {step < steps - 1 ? (
            <Btn onClick={() => canNext && setStep(step + 1)} disabled={!canNext}>Continue</Btn>
          ) : (
            <Btn onClick={finish}>Begin baseline</Btn>
          )}
        </div>
      </div>
    </div>
  );
}
