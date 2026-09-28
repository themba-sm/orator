/* PersuasionLab — build, defend, handle objections, persuade under pressure. */

import { useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { analyseAttempt } from '../lib/analysis.js';
import {
  PERSUASION_AUDIENCES, POSITIONS, scaffoldFor, objectionFor,
  steelmanExercise, analysePersuasion, savePersuasionAttempt, retryAudience, TIME_CHAIN,
} from '../lib/persuasionlab.js';
import { find, getCurrentUser } from '../lib/store.js';

export default function PersuasionLab({ onDone }) {
  const uid = getCurrentUser()?.id;
  const [phase, setPhase] = useState('home');
  const [position, setPosition] = useState(null);
  const [audience, setAudience] = useState(null);
  const [stage, setStage] = useState(0);
  const [round, setRound] = useState(0);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [steelStep, setSteelStep] = useState(0);
  const [steelmanText, setSteelmanText] = useState('');

  const attempts = useMemo(() => find('persuasionAttempts', (p) => p.user_id === uid).length, [phase]);

  function begin(kind) {
    const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const aud = PERSUASION_AUDIENCES[Math.floor(Math.random() * PERSUASION_AUDIENCES.length)];
    setPosition(pos);
    setAudience(aud);
    setRound(0);
    if (kind === 'build') { setStage(Math.min(2, Math.floor(attempts / 3))); setPhase('build'); }
    if (kind === 'time') { setPhase('time'); }
    if (kind === 'steel') { setPhase('steel'); setSteelStep(0); setSteelmanText(''); }
  }

  function analyse(capture, targetSeconds, onSave) {
    const res = analyseAttempt({ transcript: capture.transcript, transcriptSource: capture.transcriptSource, durationMs: capture.durationMs, targetSeconds, prompt: position, category: 'persuasion' });
    const a = analysePersuasion(res.measured, capture.transcript, audience);
    return { res, a };
  }

  /* ---------- renders ---------- */
  if (phase === 'home') {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Persuasion Lab</Eyebrow>
          <h1 className="display section-title">Convince. Don't manipulate.</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Claim, reason, evidence, objection, landing. The scaffold fades as you improve — {attempts} attempts recorded, current scaffold stage: {Math.min(2, Math.floor(attempts / 3)) + 1} of 3.</p>

          <div className="trainer-controls">
            <Btn block onClick={() => begin('build')}>Build an argument</Btn>
            <Btn block variant="ghost" onClick={() => begin('time')}>Persuade under time pressure — 60 → 30 → 15</Btn>
            <Btn block variant="ghost" onClick={() => begin('steel')}>Steelman training</Btn>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <p className="fb-head">The difference that matters</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>Persuasion gives someone real reasons to agree. Argument tries to beat them. Manipulation bypasses their judgment. ORATOR rewards the first only.</p>
          </div>
          <div className="trainer-controls"><Btn variant="ghost" onClick={onDone}>Back</Btn></div>
        </div>
      </div>
    );
  }

  if (phase === 'build') {
    const scaffold = scaffoldFor(stage);
    const inObjection = round > 0;
    return (
      <SpeakRunner
        key={round}
        exercise={{
          title: inObjection ? `Objection ${round}` : 'Your argument',
          objective: inObjection ? 'Respond to the objection directly. Address its actual point.' : `Persuade: ${audience.label}. ${audience.hint}`,
          prompt: inObjection ? lastObjection : `${position}\n\nStructure this time: ${scaffold.join(' · ')}`,
          prepSeconds: inObjection ? 5 : 20,
          speakSeconds: inObjection ? 45 : 90,
          category: 'persuasion',
          instructions: inObjection ? undefined : scaffold,
        }}
        onComplete={({ capture }) => {
          if (!capture.transcript) { onDone(); return; }
          const { res, a } = analyse(capture, inObjection ? 45 : 90);
          if (round === 0) {
            setLastAnalysis({ a, measured: res.measured });
            const obj = objectionFor(position, a.signals, round);
            lastObjection = obj;
            setRound(1);
            return; // dynamic objection based on what they said (spec 26)
          }
          const merged = lastAnalysis.a;
          merged.dims = merged.dims.map((d) => (d.key === 'counter' ? { ...d, ok: a.dims.find((x) => x.key === 'reasoning')?.ok || d.ok } : d));
          savePersuasionAttempt({ position, audience, stage, analysis: merged, transcript: capture.transcript, measured: res.measured });
          setLastAnalysis({ a: merged, measured: lastAnalysis.measured });
          setPhase('feedback');
        }}
        onCancel={() => setPhase('home')}
      />
    );
  }

  if (phase === 'feedback' && lastAnalysis) {
    const { a } = lastAnalysis;
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Persuasion report</Eyebrow>
          <h1 className="display section-title" style={{ fontSize: 26 }}>The argument, examined.</h1>
          <div className="panel" style={{ marginTop: 10 }}>
            {a.dims.map((d) => (
              <div className="attempt-row" key={d.key}>
                <div><span style={{ fontWeight: 500 }}>{d.label}</span><br /><span className="faint">{d.evidence}</span></div>
                <span className="chip brass">{d.ok ? 'held' : 'slipped'}</span>
              </div>
            ))}
          </div>
          {a.biggest && (
            <>
              <Eyebrow>Your biggest weakness</Eyebrow>
              <h2 className="display" style={{ fontSize: 20 }}>{a.biggest.label}</h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>{a.biggest.evidence}. One thing to fix next time — nothing else.</p>
            </>
          )}
          {a.manipulative && <p className="faint" style={{ marginTop: 8, color: 'var(--crimson)' }}>Pressure phrases detected. ORATOR does not train coercion — replace pressure with reasons.</p>}
          <div className="trainer-controls" style={{ marginTop: 20 }}>
            <Btn block onClick={() => { setAudience(retryAudience(audience.key)); setRound(0); setPhase('build'); }}>Try again — different audience</Btn>
            <Btn block variant="ghost" onClick={onDone}>Done</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'steel') {
    const steps = steelmanExercise(position);
    const current = steps[steelStep];
    return (
      <SpeakRunner
        key={steelStep}
        exercise={{ title: current.label, objective: current.label, prompt: current.prompt, prepSeconds: 10, speakSeconds: 40, category: 'persuasion' }}
        onComplete={({ capture }) => {
          if (steelStep === 0) { setSteelmanText(capture.transcript || ''); setSteelStep(1); return; }
          const response = (capture.transcript || '').toLowerCase();
          const steel = steelmanText.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
          const overlap = steel.filter((w) => response.includes(w)).length;
          const addressed = overlap >= 2;
          savePersuasionAttempt({ position, audience, stage: 3, analysis: { dims: [{ key: 'counter', ok: addressed, evidence: addressed ? 'response engaged the steelman' : 'response dodged the strongest point' }], biggest: addressed ? null : { key: 'counter', label: 'Addressing the strongest objection', evidence: 'your response did not engage the objection you yourself raised' } }, transcript: capture.transcript, measured: null });
          setLastAnalysis({ a: { dims: [{ key: 'counter', ok: addressed, evidence: addressed ? 'You addressed the strongest version of the opposing case.' : 'You stated the steelman fairly — then responded beside it, not to it.' }], biggest: addressed ? null : { key: 'counter', label: 'Addressing the strongest objection', evidence: 'you raised the strongest objection fairly, then answered something else' } } });
          setPhase('feedback');
        }}
        onCancel={() => setPhase('home')}
      />
    );
  }

  if (phase === 'time') {
    const sec = TIME_CHAIN[Math.min(round, TIME_CHAIN.length - 1)];
    return (
      <SpeakRunner
        key={round}
        exercise={{
          title: `Persuade in ${sec} seconds`,
          objective: `Same argument, tighter window. ${audience.hint}`,
          prompt: `You have ${sec} seconds. ${position}`,
          prepSeconds: round === 0 ? 10 : 3,
          speakSeconds: sec,
          category: 'persuasion',
        }}
        onComplete={({ capture }) => {
          if (!capture.transcript || round >= TIME_CHAIN.length - 1) {
            if (capture.transcript) {
              const res = analyseAttempt({ transcript: capture.transcript, transcriptSource: capture.transcriptSource, durationMs: capture.durationMs, targetSeconds: sec, prompt: position, category: 'persuasion' });
              const a = analysePersuasion(res.measured, capture.transcript, audience);
              savePersuasionAttempt({ position, audience, stage: 4, analysis: a, transcript: capture.transcript, measured: res.measured });
              setLastAnalysis({ a });
              setPhase('feedback');
            } else { setPhase('home'); }
            return;
          }
          setRound(round + 1);
        }}
        onCancel={() => setPhase('home')}
      />
    );
  }

  return null;
}

let lastObjection = '';
