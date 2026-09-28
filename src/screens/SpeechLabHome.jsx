/* SpeechLabHome — configure a speech. */

import { useMemo, useState } from 'react';
import { Eyebrow } from '../components/ui.jsx';
import { SPEECH_TYPES, DURATIONS, PREP_OPTIONS, AUDIENCES, coachRecommendation, speechPromptFor } from '../lib/speechlab.js';
import { getProfile } from '../lib/store.js';

export default function SpeechLabHome({ onStart, preset }) {
  const profile = getProfile();
  const [type, setType] = useState(preset?.type || 'keynote');
  const [seconds, setSeconds] = useState(preset?.seconds || 60);
  const [prep, setPrep] = useState(preset?.prep !== undefined ? preset.prep : 30);
  const [audienceKey, setAudienceKey] = useState('neutral');

  const coach = useMemo(() => coachRecommendation(type, profile), [type]);
  const audience = AUDIENCES[audienceKey];

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Public Speaking Lab</Eyebrow>
        <h1 className="display section-title">Take the stage.</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          A speech, an audience, honest feedback. Notes during preparation are yours — ORATOR will not write the speech for you.
        </p>

        <p className="skill-group-head">Speech type</p>
        <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          {SPEECH_TYPES.map((t) => (
            <button key={t.key} type="button" className={`option-tile${type === t.key ? ' selected' : ''}`} onClick={() => setType(t.key)}>
              <span className="ot-title">{t.label}</span>
              {t.hint}
            </button>
          ))}
        </div>

        <p className="skill-group-head">Duration</p>
        <div className="option-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 18 }}>
          {DURATIONS.map((d) => (
            <button key={d.seconds} type="button" className={`option-tile${seconds === d.seconds ? ' selected' : ''}`} style={{ padding: '9px 2px', textAlign: 'center' }} onClick={() => setSeconds(d.seconds)}>
              <span className="ot-title" style={{ fontSize: 11 }}>{d.label}</span>
            </button>
          ))}
        </div>
        <p className="faint" style={{ marginTop: -10, marginBottom: 16 }}>Progress matters more than length — climb the ladder when the last level felt easy.</p>

        <p className="skill-group-head">Preparation</p>
        <div className="option-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 18 }}>
          {PREP_OPTIONS.map((p) => (
            <button key={p.seconds} type="button" className={`option-tile${prep === p.seconds ? ' selected' : ''}`} style={{ padding: '9px 2px', textAlign: 'center' }} onClick={() => setPrep(p.seconds)}>
              <span className="ot-title" style={{ fontSize: 10.5 }}>{p.label}</span>
            </button>
          ))}
        </div>

        <p className="skill-group-head">Audience</p>
        <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          {Object.values(AUDIENCES).map((a) => (
            <button key={a.key} type="button" className={`option-tile${audienceKey === a.key ? ' selected' : ''}`} onClick={() => setAudienceKey(a.key)}>
              <span className="ot-title">{a.label}</span>
              {a.hint}
            </button>
          ))}
        </div>

        <div className="panel" style={{ marginBottom: 18 }}>
          <p className="fb-head">Structure coach</p>
          <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>{coach.text}</p>
        </div>

        <div onClick={() => onStart({ type, seconds, prep, audience, prompt: speechPromptFor(type, seconds) })}>
        <Btn block>
          {prep > 0 ? `Prepare (${prep >= 60 ? Math.round(prep / 60) + ' min' : prep + 's'}) and speak` : 'No preparation — speak now'}
        </Btn></div>
      </div>
    </div>
  );
}
