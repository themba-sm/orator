/*
 * SpeechLabRun — prep (notes allowed, no ghostwriting) → speech → optional Q&A
 * → performance report → one biggest improvement → archive + memory update.
 */

import { useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow, TimerRing, useCountdown } from '../components/ui.jsx';
import { audioDeliveryMetrics } from '../lib/speech.js';
import {
  analyseSpeech, speechReport, simulatedReaction, generateQuestions,
  saveSpeech, compareToArchive,
} from '../lib/speechlab.js';

export default function SpeechLabRun({ config, onExit, onDone }) {
  const { type, seconds, prep, audience, prompt, isChallenge } = config;
  const [phase, setPhase] = useState(prep > 0 ? 'prep' : 'speak');
  const [notes, setNotes] = useState('');
  const [speechCapture, setSpeechCapture] = useState(null);
  const [qaLog, setQaLog] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [qaIdx, setQaIdx] = useState(0);
  const [report, setReport] = useState(null);
  const [savedRec, setSavedRec] = useState(null);

  const prepCd = useCountdown(prep, { autostart: false, onDone: () => setPhase('speak') });
  const coach = useMemo(() => config.coach || null, []);

  /* ---------- prep ---------- */
  if (phase === 'prep') {
    return (
      <div className="screen-tight">
        <div className="wrap trainer-stage">
          <Eyebrow dim>Preparation — {audience.label} audience</Eyebrow>
          <div className="brief-prompt" style={{ marginTop: 12 }}>{prompt}</div>
          {coach && <p className="faint" style={{ marginTop: 10 }}>{coach.text}</p>}
          <p className="faint" style={{ marginTop: 10 }}>Notes are allowed. A script is not the goal — decide the point, the path, and the close.</p>
          <textarea className="textarea-input" rows="5" style={{ marginTop: 10 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Your own notes — three lines is plenty." />
          {prepCd.running ? (
            <>
              <TimerRing secondsLeft={prepCd.left} total={prep} caption="prepare" />
              <Btn variant="ghost" onClick={() => { prepCd.stop(); setPhase('speak'); }}>Walk up early</Btn>
            </>
          ) : (
            <Btn style={{ marginTop: 14 }} onClick={() => prepCd.start()}>Start preparation</Btn>
          )}
          <div className="trainer-controls"><Btn variant="ghost" onClick={onExit}>Leave</Btn></div>
        </div>
      </div>
    );
  }

  /* ---------- speech ---------- */
  if (phase === 'speak') {
    return (
      <SpeakRunner
        exercise={{
          title: type === 'qa' ? 'Your speech, then the room' : 'Your speech',
          objective: prompt,
          prompt,
          prepSeconds: 0,
          speakSeconds: seconds,
          category: type,
          instructions: [audience.hint, seconds > 120 ? 'Long speech: let it breathe. Come back to your message twice.' : undefined],
        }}
        onComplete={({ capture }) => {
          if (!capture.transcript) { onDone(); return; }
          setSpeechCapture(capture);
          if (type === 'qa') {
            setQuestions(generateQuestions(capture.transcript, audience, 3));
            setPhase('qa');
          } else {
            finish(capture, []);
          }
        }}
        onCancel={onExit}
      />
    );
  }

  /* ---------- Q&A (spec 18) ---------- */
  if (phase === 'qa') {
    if (qaIdx >= questions.length) {
      finish(speechCapture, qaLog);
      return null;
    }
    const q = questions[qaIdx];
    return (
      <SpeakRunner
        key={qaIdx}
        exercise={{
          title: `Question ${qaIdx + 1} of ${questions.length}`,
          objective: 'From the audience — answer what was actually asked.',
          prompt: q,
          prepSeconds: 3,
          speakSeconds: 30,
          category: 'qa',
        }}
        onComplete={({ capture }) => {
          setQaLog((log) => [...log, { question: q, answer: capture.transcript || '' }]);
          setQaIdx((i) => i + 1);
        }}
        onCancel={() => { setQaLog((log) => [...log, { question: q, answer: '' }]); setQaIdx((i) => i + 1); }}
      />
    );
  }

  /* ---------- report ---------- */
  if (phase === 'report' && report) {
    const bandLabel = { strong: 'Strong', developing: 'Developing', inconsistent: 'Inconsistent', weak: 'Needs work' };
    const cmp = savedRec ? compareToArchive(savedRec) : null;
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Speech report — {audience.label} audience</Eyebrow>
          <h1 className="display section-title">{savedRec?.title || prompt.slice(0, 60)}</h1>

          <div className="panel" style={{ marginTop: 10 }}>
            {report.dims.map((d) => (
              <div className="attempt-row" key={d.key}>
                <div><span style={{ fontWeight: 500 }}>{d.label}</span><br /><span className="faint">{d.evidence}</span></div>
                <span className="chip brass">{bandLabel[d.band]}</span>
              </div>
            ))}
          </div>

          <p className="faint" style={{ marginTop: 12 }}>{report.reaction}</p>

          {report.reportData.weakest && (
            <>
              <hr className="rule" />
              <Eyebrow>One biggest improvement</Eyebrow>
              <h2 className="display" style={{ fontSize: 20, marginTop: 4 }}>{report.reportData.weakest.label}</h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>{report.reportData.weakest.evidence}. Everything else can wait — this first.</p>
              <p className="faint" style={{ marginTop: 8 }}>Saved to My Speeches. Memory updated: the weakness now returns in reviews until it is demonstrated.</p>
            </>
          )}

          {cmp && (
            <>
              <hr className="rule" />
              <Eyebrow dim>Before / after</Eyebrow>
              <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>Compared with your previous {type} speech ({new Date(cmp.prev.created).toLocaleDateString()}):</p>
              {cmp.improved.map((k) => <p key={k} style={{ fontSize: 13.5, color: 'var(--ok)', margin: '4px 0' }}>Improved: {k}</p>)}
              {cmp.recurring.map((k) => <p key={k} style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '4px 0' }}>Recurring weakness: {k}</p>)}
              {cmp.newlyWeak.map((k) => <p key={k} style={{ fontSize: 13.5, color: 'var(--crimson)', margin: '4px 0' }}>New: {k}</p>)}
              {!cmp.improved.length && !cmp.recurring.length && !cmp.newlyWeak.length && <p className="faint">Held steady across both speeches.</p>}
            </>
          )}

          {qaLog.length > 0 && (
            <>
              <hr className="rule" />
              <Eyebrow dim>The room's questions and your answers</Eyebrow>
              {qaLog.map((qa, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 500 }}>{qa.question}</p>
                  <p className="faint" style={{ fontSize: 13 }}>{qa.answer || '(not answered)'}</p>
                </div>
              ))}
            </>
          )}

          <div className="trainer-controls" style={{ marginTop: 26 }}>
            <Btn block onClick={onDone}>Done — saved to My Speeches</Btn>
          </div>
        </div>
      </div>
    );
  }

  return <div className="center-note"><p className="muted">Taking the stage…</p></div>;

  function finish(capture, qa) {
    const analysis = analyseSpeech(capture.transcript, capture.transcriptSource, capture.durationMs, seconds, prompt, type);
    const rep = speechReport(type, audience, analysis.measured, analysis.signals, capture.transcript);
    const rec = saveSpeech({
      type, seconds, audience, prompt, transcript: capture.transcript,
      analysis, report: rep, isChallenge, qaLog: qa,
    });
    const reaction = simulatedReaction(analysis.measured, analysis.signals, audience);
    setSavedRec(rec);
    setReport({ dims: rep.dims, reportData: rep, reaction });
    setPhase('report');
  }
}
