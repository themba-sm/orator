/* LabHome — the doors to the two advanced environments. */

import { useMemo } from 'react';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { monthlyChallenge, environmentTrends } from '../lib/speechlab.js';

export default function LabHome({ onPressure, onSpeech, onChallenge }) {
  const challenge = useMemo(() => monthlyChallenge(), []);
  const trends = useMemo(() => environmentTrends(), []);

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Training environments</Eyebrow>
        <h1 className="display section-title">Two rooms. One goal.</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Calm brain → clear thinking → precise words → controlled delivery. These rooms exist for the moments when none of that comes for free.
        </p>

        <button type="button" className="option-tile pressure-door" onClick={onPressure}>
          <span className="ot-title">Pressure Room</span>
          Unexpected prompts. Interruptions. Shrinking clocks. Composure is the skill.
        </button>

        <button type="button" className="option-tile" onClick={onSpeech} style={{ marginTop: 10 }}>
          <span className="ot-title">Public Speaking Lab</span>
          Structured speeches. Audiences. Q&A. From impromptu to keynote.
        </button>

        {challenge && !challenge.done && (
          <>
            <hr className="rule" />
            <Eyebrow dim>This month's speaking challenge</Eyebrow>
            <div className="panel" style={{ marginTop: 8 }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>{challenge.label}</p>
              <Btn small onClick={() => onChallenge(challenge)}>Accept the challenge</Btn>
            </div>
          </>
        )}
        {challenge && challenge.done && (
          <p className="faint" style={{ marginTop: 14 }}>This month's challenge is complete. The next one is waiting on the first of the month.</p>
        )}

        {trends.length > 0 && (
          <>
            <hr className="rule" />
            <Eyebrow dim>Environment trends</Eyebrow>
            {trends.map((t) => <p key={t} style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '6px 0' }}>{t}</p>)}
          </>
        )}
      </div>
    </div>
  );
}
