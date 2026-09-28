/*
 * Conversation — the live room. Minimal distraction, obvious microphone,
 * a present persona, and a transcript that reads like a real exchange.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn, Eyebrow, TimerRing, useCountdown } from '../components/ui.jsx';
import { startCapture, speechCapabilities, audioDeliveryMetrics } from '../lib/speech.js';
import { analyseTurn, pickScenario, rapidScenario, nextLine, computeReport } from '../lib/simulator.js';
import { find, insert, update, getCurrentUser } from '../lib/store.js';
import ConversationReport from './ConversationReport.jsx';

export default function Conversation({ mode, difficulty, coached, onExit }) {
  const [conv, setConv] = useState(null);
  const [phase, setPhase] = useState('brief');
  const [turns, setTurns] = useState([]); // {speaker, text, analysis?, interrupt?, meta}
  const [currentLine, setCurrentLine] = useState(null); // {line, followUpType, interrupt, end, seconds}
  const [capturing, setCapturing] = useState(false);
  const [interim, setInterim] = useState('');
  const [typed, setTyped] = useState('');
  const [needsTyping, setNeedsTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [coach, setCoach] = useState(null);
  const [report, setReport] = useState(null);
  const captureRef = useRef(null);
  const memRef = useRef({ facts: [], usedFact: false, lastTopic: null });
  const askedRef = useRef([]);
  const convRecRef = useRef(null);
  const caps = speechCapabilities();

  const scenario = useMemoInitial(() => (mode === 'spotlight' ? rapidScenario(difficulty) : pickScenario(mode, difficulty)), [mode, difficulty]);
  const prep = useCountdown(scenario.prepSeconds, { autostart: false, onDone: () => beginConversation() });

  useEffect(() => {
    if (phase !== 'live') return undefined;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => () => { if (captureRef.current) captureRef.current.cancel(); }, []);

  function useMemoInitial(fn) {
    const ref = useRef(null);
    if (ref.current === null) ref.current = fn();
    return ref.current;
  }

  function beginConversation() {
    const rec = insert('conversations', {
      user_id: getCurrentUser()?.id,
      mode, difficulty, coached,
      scenario_id: scenario.id,
      persona: scenario.personaKey,
      status: 'in_progress',
    });
    convRecRef.current = rec;
    const first = nextLine(makeConv(), 0, null, null, askedRef.current, memRef.current);
    setTurns([{ speaker: 'ai', text: first.line }]);
    setCurrentLine(first);
    setPhase('live');
  }

  function makeConv() {
    return {
      ...scenario,
      mode,
      diff: scenario.diff,
      persona: scenario.persona,
      opener: scenario.opener,
      targetTurns: scenario.targetTurns,
    };
  }

  /* ---------- capture the user's turn ---------- */
  async function startSpeaking() {
    setNeedsTyping(false);
    setTyped('');
    try {
      captureRef.current = await startCapture({
        onTranscript: () => {},
        onInterim: (t) => setInterim(t),
      });
      setCapturing(true);
      if (currentLine && currentLine.seconds) {
        setTimeout(() => { if (captureRef.current) finishSpeaking(); }, currentLine.seconds * 1500);
      }
    } catch {
      setNeedsTyping(true); // browser cannot record — typed conversation still works
    }
  }

  async function finishSpeaking() {
    if (!captureRef.current) return;
    const capture = await captureRef.current.stop();
    captureRef.current = null;
    setCapturing(false);
    setInterim('');
    if (capture.transcript && capture.transcript.trim().length > 2) {
      commitTurn(capture.transcript, capture.transcriptSource, capture.durationMs);
    } else {
      setNeedsTyping(true);
    }
  }

  function commitTyped() {
    commitTurn(typed.trim(), 'self-transcribed', Math.max(4000, typed.split(/\s+/).length * 380));
    setTyped('');
    setNeedsTyping(false);
  }

  function commitTurn(transcript, source, durationMs) {
    const convObj = makeConv();
    const turnIndex = turns.filter((t) => t.speaker === 'user').length + 1;
    const analysis = analyseTurn(transcript, source, durationMs, currentLine.line, scenario.category);
    const userTurn = { speaker: 'user', text: transcript, analysis, meta: { followUpType: currentLine.followUpType, interrupt: currentLine.interrupt } };
    const next = nextLine(convObj, turnIndex, analysis.signals, transcript, askedRef.current, memRef.current);

    setTurns((prev) => [...prev, userTurn, { speaker: 'ai', text: next.line, interrupt: next.interrupt, meta: next }]);

    insert('conversationTurns', {
      conversation_id: convRecRef.current?.id,
      speaker: 'user',
      text: transcript.slice(0, 2000),
      meta: { wpm: analysis.measured.wpm, fillerRate: analysis.measured.fillerRate, vagueRate: analysis.measured.vagueRate, relevance: analysis.measured.relevance, followUpType: currentLine.followUpType, interrupt: !!currentLine.interrupt },
    });
    insert('conversationTurns', {
      conversation_id: convRecRef.current?.id,
      speaker: 'ai',
      text: next.line.slice(0, 2000),
      meta: { followUpType: next.followUpType, interrupt: !!next.interrupt },
    });

    if (next.end) {
      endConversation([...turns, userTurn, { speaker: 'ai', text: next.line, interrupt: next.interrupt }]);
      return;
    }

    /* coached mode (spec 18): severe issues stop the conversation for one correction */
    const m = analysis.measured;
    const severe = (m.fillerRate !== null && m.fillerRate > 5)
      || (m.relevance !== null && m.relevance < 0.15 && (analysis.signals.wordCount || 0) > 30)
      || analysis.signals.wordCount > 120;
    if (coached && severe) {
      setCoach({
        issue: m.fillerRate > 5 ? 'Fillers took over that answer.'
          : m.relevance < 0.15 ? 'That answer drifted off the question.'
          : 'That answer ran long — the point arrived late.',
        advice: m.fillerRate > 5 ? 'Pause instead of filling. Silence reads as thought.'
          : m.relevance < 0.15 ? 'Restate their question, then answer only that.'
          : 'Point first. Then one supporting sentence. Stop.',
        retryOf: currentLine,
      });
    }
    setCurrentLine(next);
  }

  function retryCoach() {
    // same prompt again, tightened (spec 22)
    setCurrentLine({ ...coach.retryOf, line: 'Again — tighter this time. ' + coach.retryOf.line });
    setCoach(null);
  }

  function endConversation(finalTurns) {
    const convObj = makeConv();
    const rep = computeReport(convObj, finalTurns);
    const rec = convRecRef.current;
    if (rec) {
      update('conversations', rec.id, {
        status: 'completed',
        duration_seconds: elapsed,
        opportunity: rep?.weakest?.label || null,
        mode_label: scenario.context ? null : mode,
      });
    }
    setReport(rep);
    setPhase('report');
  }

  /* ---------- renders ---------- */

  if (phase === 'brief') {
    return (
      <div className="screen-tight">
        <div className="wrap trainer-stage">
          <Eyebrow dim>{scenario.diff.label} · {mode === 'spotlight' ? 'Rapid fire' : 'Briefing'}</Eyebrow>
          <h2 className="display brief-title">{scenario.persona.name} is waiting.</h2>
          <div className="brief-prompt">{scenario.context}</div>
          <div className="panel" style={{ marginTop: 14 }}>
            <p className="fb-head">Your role</p>
            <p style={{ fontSize: 14 }}>{scenario.userRole}</p>
            <p className="fb-head" style={{ marginTop: 10 }}>Objective</p>
            <p style={{ fontSize: 14 }}>{scenario.objective}</p>
          </div>
          {scenario.prepSeconds > 0 ? (
            <>
              <p className="faint" style={{ marginTop: 16 }}>Preparation: {scenario.prepSeconds}s. Decide your opening point — not a script.</p>
              {prep.running ? (
                <>
                  <TimerRing secondsLeft={prep.left} total={scenario.prepSeconds} caption="preparation" />
                  <Btn variant="ghost" onClick={() => { prep.stop(); setPhase('brief'); }}>Stop prep</Btn>
                </>
              ) : (
                <Btn style={{ marginTop: 14 }} onClick={() => { prep.start(); }}>Start preparation</Btn>
              )}
            </>
          ) : (
            <Btn style={{ marginTop: 16 }} onClick={beginConversation}>Walk in</Btn>
          )}
          <div className="trainer-controls">
            <Btn variant="ghost" onClick={onExit}>Leave</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'report') {
    return (
      <ConversationReport
        convRecord={convRecRef.current}
        scenario={scenario}
        turns={turns}
        report={report}
        elapsed={elapsed}
        onExit={onExit}
      />
    );
  }

  /* ---------- live room ---------- */
  const visible = turns.slice(-6);
  return (
    <div className="screen-tight conv-room">
      <div className="conv-header">
        <div className="wrap conv-header-inner">
          <div>
            <span className="conv-persona">{scenario.persona.name}</span>
            <span className="conv-role">{scenario.persona.role}</span>
          </div>
          <div className="conv-status">
            <span className="conv-timer">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>
            <button type="button" className="conv-end" onClick={() => endConversation(turns)}>End</button>
          </div>
        </div>
      </div>

      <div className="wrap conv-body">
        <div className="conv-transcript">
          {visible.map((t, i) => (
            <div key={i} className={`conv-line ${t.speaker}`}>
              <span className="conv-who">{t.speaker === 'ai' ? scenario.persona.name.split(' ')[1] || scenario.persona.name : 'You'}</span>
              <p className={`conv-text${t.interrupt ? ' interrupt' : ''}`}>{t.text}</p>
              {t.interrupt && <span className="conv-flag">interruption</span>}
            </div>
          ))}
        </div>

        {coach && (
          <div className="panel coach-card">
            <p className="fb-head">Coach pause</p>
            <p style={{ fontSize: 14, marginBottom: 6 }}>{coach.issue}</p>
            <p className="faint" style={{ marginBottom: 12 }}>{coach.advice}</p>
            <div className="trainer-controls">
              <Btn variant="ghost" onClick={() => setCoach(null)}>Continue</Btn>
              <Btn onClick={retryCoach}>Try it again, tighter</Btn>
            </div>
          </div>
        )}

        {!coach && !capturing && !needsTyping && (
          <div className="conv-input-area">
            {currentLine && currentLine.seconds && <p className="faint" style={{ marginBottom: 8 }}>Aim for about {currentLine.seconds}s.</p>}
            <Btn block onClick={startSpeaking}>{caps.mic ? 'Hold the floor — speak' : 'Respond (typed)'}</Btn>
          </div>
        )}

        {capturing && (
          <div className="conv-input-area">
            <p className="faint" style={{ marginBottom: 8 }}>
              <span className="rec-dot" /> Listening… say your answer, then finish.
            </p>
            {caps.recognition && <p className="conv-live">{interim || '…'}</p>}
            <Btn block onClick={finishSpeaking}>Finish my answer</Btn>
          </div>
        )}

        {needsTyping && (
          <div className="conv-input-area">
            <textarea className="textarea-input" rows="3" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type what you said…" />
            <div className="trainer-controls" style={{ marginTop: 10 }}>
              <Btn variant="ghost" onClick={() => { setTyped(''); setNeedsTyping(false); }}>Back</Btn>
              <Btn onClick={commitTyped} disabled={typed.trim().length < 3}>Send it</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
