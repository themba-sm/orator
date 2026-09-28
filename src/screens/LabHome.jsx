/* LabHome — the doors to the two advanced environments. */

import { useMemo } from 'react';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { monthlyChallenge, environmentTrends } from '../lib/speechlab.js';
import { scoreboard, communicationSignature } from '../lib/arsenal.js';

export default function LabHome({ onPressure, onSpeech, onChallenge, onVocab, onStory, onPersuasion, onMixed }) {
  const challenge = useMemo(() => monthlyChallenge(), []);
  const trends = useMemo(() => environmentTrends(), []);
  const board = useMemo(() => scoreboard(), []);
  const signature = useMemo(() => communicationSignature(), []);

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Training environments</Eyebrow>
        <h1 className="display section-title">Two rooms. One goal.</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Calm brain → clear thinking → precise words → controlled delivery. These rooms exist for the moments when none of that comes for free.
        </p>

        <button type="button" className="option-tile" style={{ borderColor: 'rgba(198,161,91,0.5)', marginBottom: 10 }} onClick={onMixed}>
          <span className="ot-title">Today's mixed session</span>
          Vocabulary retrieval + a personal story + a persuasion challenge — chosen from your current weaknesses.
        </button>

        <button type="button" className="option-tile" onClick={onVocab}>
          <span className="ot-title">Vocabulary Lab</span>
          Precise words, learned by use. Overuse tracked, vagueness corrected.
        </button>
        <button type="button" className="option-tile" style={{ marginTop: 10 }} onClick={onStory}>
          <span className="ot-title">Storytelling Lab</span>
          Structure, hooks, detail, pacing, compression. A bank of your own stories.
        </button>
        <button type="button" className="option-tile" style={{ marginTop: 10 }} onClick={onPersuasion}>
          <span className="ot-title">Persuasion Lab</span>
          Claim, evidence, objections, steelmen. Convince without manipulating.
        </button>

        <hr className="rule" />
        <Eyebrow dim>The rooms</Eyebrow>

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

        {signature && signature.traits.length > 0 && (
          <>
            <hr className="rule" />
            <Eyebrow dim>Your communication signature</Eyebrow>
            {signature.traits.map((t) => <p key={t} style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '5px 0' }}>{t}</p>)}
            <p className="faint" style={{ fontSize: 12 }}>{signature.evidence}</p>
          </>
        )}

        <hr className="rule" />
        <Eyebrow dim>Scoreboard — trends and evidence, never one number</Eyebrow>
        {[['Vocabulary', board.vocab], ['Storytelling', board.story], ['Persuasion', board.persuasion]].map(([group, rows]) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <p className="skill-group-head">{group}</p>
            {rows.map((r) => (
              <div className="attempt-row" key={r.label}>
                <div><span style={{ fontWeight: 500 }}>{r.label}</span></div>
                <span className="faint" style={{ maxWidth: '60%', textAlign: 'right' }}>{r.value}</span>
              </div>
            ))}
          </div>
        ))}

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
