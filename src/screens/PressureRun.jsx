/*
 * PressureRun — one pressure run.
 * PROMPT → PREP → SPEAK → (INTERRUPT / CHALLENGE) → ANALYSE →
 * ONE BIGGEST PRESSURE WEAKNESS → RETRY (paired prompt) → SAVE → MEMORY.
 */

import { useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow, TimerRing, useCountdown } from '../components/ui.jsx';
import { audioDeliveryMetrics } from '../lib/speech.js';
import { compareAttempts } from '../lib/analysis.js';
import {
  buildPressureRun, analysePressure, savePressureRun, retryPrompt,
  interruptLine, challengeLine, pressureWeaknessKey,
} from '../lib/pressure.js';

export default function PressureRun({ mode, level, onExit, onDone }) {
  const run = useMemo(() => buildPressureRun(mode, level), [mode, level]);
  const [phase, setPhase] = useState('brief');
  const [captures, setCaptures] = useState([]);
  const [interrupted, setInterrupted] = useState(false);
  const [challengeRound, setChallengeRound] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [retryDone, setRetryDone] = useState(null);
  const [saved, setSaved] = useState(false);

  const prep = useCountdown(run.prepSeconds, { autostart: false, onDone: () => setPhase('speak') });
  const rapidQs = run.rapidChain || [];
  const [rapidIdx, setRapidIdx] = useState(0);

  const isRapid = mode === 'rapid';
  const currentPrompt = isRapid ? rapidQs[rapidIdx] : run.prompt.text;

  function addCapture(capture, extra) {
    const list = [...captures, { transcript: capture.transcript, transcriptSource: capture.transcriptSource, durationMs: capture.durationMs, energies: capture.energies }];
    setCaptures(list);

    if (isRapid && rapidIdx + 1 < rapidQs.length) {
      setRapidIdx(rapidIdx + 1);
      return; // next question immediately — no breath between
    }
    if ((mode === 'interrupt' || run.willInterrupt) && !interrupted && !extra?.skipInterrupt) {
      setInterrupted(true);
      setPhase('interrupted');
      return;
    }
    if (mode === 'challenge' && challengeRound < run.challengeRounds) {
      setChallengeRound(challengeRound + 1);
      setPhase('challenged');
      return;
    }
    finish(list, interrupted || (mode === 'interrupt'));
  }

  function finish(list, wasInterrupted) {
    const a = analysePressure(run, list.filter((c) => c.transcript), currentPrompt);
    a.audio = audioDeliveryMetrics(list.flatMap((c) => c.energies || []), list.reduce((s, c) => s + c.durationMs, 0));
    setAnalysis(a);
    setPhase('feedback');
    if (!saved) {
      savePressureRun(run, a, { ...list, interrupted: wasInterrupted });
      setSaved(true);
    }
  }

  /* ---------- brief / prep ---------- */
  if (phase === 'brief') {
    return (
      <div className="screen-tight pressure-screen">
        <div className="wrap trainer-stage">
          <Eyebrow dim>Level {run.level.n} — {run.level.key}</Eyebrow>
          {run.prepSeconds > 0 ? (
            <>
              <p className="faint" style={{ marginTop: 10 }}>You have {run.prepSeconds} seconds to prepare. Do not script — decide your point.</p>
              <div className="brief-prompt" style={{ marginTop: 12 }}>{currentPrompt}</div>
              {prep.running ? (
                <>
                  <TimerRing secondsLeft={prep.left} total={run.prepSeconds} caption="prepare" />
                  <Btn variant="ghost" onClick={() => { prep.stop(); setPhase('speak'); }}>Speak now</Btn>
                </>
              ) : (
                <Btn style={{ marginTop: 18 }} onClick={() => prep.start()}>Start the clock</Btn>
              )}
            </>
          ) : (
            <>
              <div className="brief-prompt" style={{ marginTop: 14 }}>{currentPrompt}</div>
              <p className="faint" style={{ margin: '14px 0 0' }}>No preparation. Speak.</p>
              <Btn style={{ marginTop: 18 }} onClick={() => setPhase('speak')}>Speak now</Btn>
            </>
          )}
          <div className="trainer-controls"><Btn variant="ghost" onClick={onExit}>Leave the room</Btn></div>
        </div>
      </div>
    );
  }

  /* ---------- interrupted ---------- */
  if (phase === 'interrupted') {
    return (
      <div className="screen-tight pressure-screen">
        <div className="wrap trainer-stage">
          <Eyebrow dim>Interruption</Eyebrow>
          <div className="brief-prompt interrupt-prompt" style={{ marginTop: 12 }}>{run._interruptLine || (run._interruptLine = interruptLine())}</div>
          <p className="faint" style={{ marginTop: 12 }}>Recover. {analysis ? '' : 'Pause. Restate your point. Continue calmly.'}</p>
          <Btn style={{ marginTop: 16 }} onClick={() => setPhase('speak-recover')}>Recover</Btn>
        </div>
      </div>
    );
  }

  /* ---------- challenged ---------- */
  if (phase === 'challenged') {
    const line = challengeLine(null);
    return (
      <div className="screen-tight pressure-screen">
        <div className="wrap trainer-stage">
          <Eyebrow dim>Challenge</Eyebrow>
          <div className="brief-prompt interrupt-prompt" style={{ marginTop: 12 }}>{line}</div>
          <p className="faint" style={{ marginTop: 12 }}>Do not rush. Reason, then answer.</p>
          <Btn style={{ marginTop: 16 }} onClick={() => setPhase('speak')}>Respond</Btn>
        </div>
      </div>
    );
  }

  /* ---------- speaking ---------- */
  if (phase === 'speak' || phase === 'speak-recover') {
    const recovering = phase === 'speak-recover';
    return (
      <SpeakRunner
        key={`${phase}-${rapidIdx}-${challengeRound}`}
        exercise={{
          title: recovering ? 'Recover' : 'Pressure',
          objective: recovering ? 'Land the point cleanly and stop.' : run.prompt.expects === 'uncertainty' ? 'Say what you know. Say what you do not. Stay articulate.' : 'Point first. Keep your composure.',
          prompt: recovering ? (run._interruptLine || 'Recover your point.') : currentPrompt,
          prepSeconds: isRapid ? 3 : 0,
          speakSeconds: recovering ? Math.max(10, Math.round(run.speakSeconds * 0.5)) : (isRapid ? 25 : run.speakSeconds),
          category: 'pressure',
          instructions: isRapid ? ['Short answers. Next question comes immediately.'] : undefined,
        }}
        onComplete={({ capture }) => addCapture(capture, { skipInterrupt: recovering })}
        onCancel={onExit}
      />
    );
  }

  /* ---------- feedback ---------- */
  if (phase === 'feedback' && analysis) {
    return (
      <div className="screen-tight pressure-screen">
        <div className="wrap trainer-stage">
          <Eyebrow dim>Pressure report</Eyebrow>
          <h2 className="display brief-title" style={{ fontSize: 24 }}>Held under pressure.</h2>
          <div className="panel" style={{ marginTop: 10 }}>
            {analysis.dims.map((d) => (
              <div className="attempt-row" key={d.key}>
                <div><span style={{ fontWeight: 500 }}>{d.label}</span><br /><span className="faint">{d.evidence}</span></div>
                <span className="chip brass">{d.ok ? 'held' : 'slipped'}</span>
              </div>
            ))}
          </div>

          {run.prompt.expects === 'uncertainty' && (
            <p className="faint" style={{ marginTop: 10 }}>
              {analysis.bluffing
                ? 'This was an "I do not know" prompt. You did not acknowledge uncertainty — asserting beyond what you know is a pressure weakness.'
                : analysis.honest
                  ? 'You acknowledged uncertainty while staying articulate. That is exactly the skill.'
                  : 'This prompt rewarded honest uncertainty — something to practise.'}
            </p>
          )}

          {analysis.biggest && (
            <>
              <hr className="rule rule-tight" />
              <Eyebrow>Your biggest pressure weakness</Eyebrow>
              <h3 className="display" style={{ fontSize: 18, marginTop: 4 }}>{analysis.biggest.label}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>{analysis.biggest.evidence}. Under time pressure this slipped first.</p>
              <p className="faint" style={{ marginTop: 8 }}>Recovery technique: {analysis.recoveryHint}</p>
            </>
          )}
          {!analysis.biggest && <p className="faint" style={{ marginTop: 10 }}>Nothing slipped far enough to call a weakness. Composure held.</p>}

          <div className="trainer-controls" style={{ marginTop: 24 }}>
            <Btn variant="ghost" onClick={() => setPhase('retry')}>Try again — a different prompt</Btn>
            <Btn onClick={() => onDone()}>Done</Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- retry (spec 7): similar, different, same underlying skill ---------- */
  if (phase === 'retry') {
    return (
      <SpeakRunner
        exercise={{
          title: 'Retry — same skill, new prompt',
          objective: 'The prompt changes. The skill does not.',
          prompt: retryPrompt(run),
          prepSeconds: Math.max(5, Math.round(run.prepSeconds * 0.5)),
          speakSeconds: run.speakSeconds,
          category: 'pressure',
        }}
        onComplete={({ capture }) => {
          if (!capture.transcript) { onDone(); return; }
          const second = analysePressure(run, [{ transcript: capture.transcript, transcriptSource: capture.transcriptSource, durationMs: capture.durationMs }], retryPrompt(run));
          const cmp = compareAttempts({ measured: analysis.measured, audio: null }, { measured: second.measured, audio: null }, pressureWeaknessKey(analysis) || 'fillers');
          setRetryDone({ second, cmp });
          setPhase('retry-result');
        }}
        onCancel={() => setPhase('feedback')}
      />
    );
  }

  if (phase === 'retry-result' && retryDone) {
    return (
      <div className="screen-tight pressure-screen">
        <div className="wrap trainer-stage">
          <Eyebrow dim>Retry comparison</Eyebrow>
          <h2 className="display brief-title" style={{ fontSize: 22 }}>{retryDone.cmp.headline}</h2>
          <div className="panel" style={{ marginTop: 10 }}>
            {retryDone.cmp.items.map((it) => (
              <p key={it.label} style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '6px 0' }}>{it.label}: {it.text} ({it.dir})</p>
            ))}
          </div>
          <p className="faint" style={{ marginTop: 10 }}>{retryDone.cmp.nextStep}</p>
          <div className="trainer-controls" style={{ marginTop: 20 }}>
            <Btn block onClick={onDone}>Done — saved to training history</Btn>
          </div>
        </div>
      </div>
    );
  }

  return <div className="center-note"><p className="muted">Preparing the room…</p></div>;
}
