/*
 * SpeakRunner — the focused speaking screen.
 * Brief → prep countdown → speak (mic + live transcript) → capture result.
 * Minimal interface during the exercise; nothing distracts.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn, Eyebrow, TimerRing, useCountdown } from '../components/ui.jsx';
import { startCapture, speechCapabilities } from '../lib/speech.js';

export default function SpeakRunner({ exercise, onComplete, onCancel, mode = 'normal' }) {
  const [stage, setStage] = useState('brief'); // brief | prep | speak | stopping
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const captureRef = useRef(null);
  const caps = speechCapabilities();

  const prep = useCountdown(exercise.prepSeconds, {
    onDone: () => beginSpeak(),
    autostart: false,
  });

  const prepLeft = prep.left;

  useEffect(() => () => {
    if (captureRef.current) captureRef.current.cancel();
  }, []);

  useEffect(() => {
    if (stage !== 'speak') return undefined;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  async function beginSpeak() {
    setError(null);
    try {
      captureRef.current = await startCapture({
        onTranscript: (text) => setTranscript(text),
        onInterim: (text) => setInterim(text),
      });
      setElapsed(0);
      setStage('speak');
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.message === 'NOMIC')) {
        setError('Microphone access is required. Allow the microphone and try again.');
      } else {
        setError('Could not access the microphone. Check that no other app is using it.');
      }
      setStage('brief');
    }
  }

  async function finishSpeak() {
    if (!captureRef.current) return;
    setStage('stopping');
    const capture = await captureRef.current.stop();
    captureRef.current = null;
    onComplete({ capture });
  }

  const secondsLeft = Math.max(0, exercise.speakSeconds - elapsed);

  return (
    <div className="screen-tight">
      <div className="wrap trainer-stage">
        {stage === 'brief' && (
          <>
            <Eyebrow dim>{mode === 'retry' ? 'Second attempt' : 'Challenge'}</Eyebrow>
            <h2 className="display brief-title">{exercise.title}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>{exercise.objective}</p>

            <div className="brief-prompt">“{exercise.prompt}”</div>

            <ul className="instruction-list">
              {exercise.instructions && exercise.instructions.map((i) => <li key={i}>{i}</li>)}
              {mode === 'retry' && exercise.retryInstruction && <li>{exercise.retryInstruction}</li>}
            </ul>

            <p className="faint">
              Preparation: {exercise.prepSeconds}s · Speaking: {exercise.speakSeconds}s
            </p>
            {error && <p style={{ color: '#D98A91', fontSize: 13, marginTop: 12 }}>{error}</p>}
            {!caps.mic && (
              <p className="faint" style={{ marginTop: 12 }}>
                This browser does not expose microphone recording — ORATOR needs Chrome, Edge, Safari or Firefox.
              </p>
            )}
            <div className="trainer-controls">
              {onCancel && <Btn variant="ghost" onClick={onCancel}>Exit</Btn>}
              <Btn onClick={() => { setStage('prep'); prep.start(); }} disabled={!caps.mic}>
                {exercise.prepSeconds > 0 ? 'Begin preparation' : 'Speak now'}
              </Btn>
            </div>
          </>
        )}

        {stage === 'prep' && (
          <>
            <Eyebrow>Prepare</Eyebrow>
            <p className="muted" style={{ margin: '6px 0 4px', minHeight: 22 }}>Decide your point. Not your words — your point.</p>
            <TimerRing secondsLeft={prepLeft} total={exercise.prepSeconds} caption="preparation" />
            <p className="faint" style={{ marginTop: 8 }}>Recording begins when the ring closes.</p>
            <div className="trainer-controls">
              <Btn variant="ghost" onClick={() => { prep.stop(); setStage('brief'); }}>Cancel</Btn>
            </div>
          </>
        )}

        {stage === 'speak' && (
          <>
            <Eyebrow><span className="rec-dot" />Speaking</Eyebrow>
            <TimerRing secondsLeft={secondsLeft} total={exercise.speakSeconds} caption="remaining" accent={secondsLeft <= 5 ? '#C0303A' : '#C6A15B'} />
            <div className="live-transcript">
              {caps.recognition ? (
                <>
                  <span className="final">{transcript}</span>
                  <span>{interim}</span>
                  {!transcript && !interim && <span className="faint">Transcribing as you speak…</span>}
                </>
              ) : (
                <span className="faint">
                  Live transcription is not available in this browser. Speak — you will add your transcript afterwards.
                </span>
              )}
            </div>
            <div className="trainer-controls">
              <Btn variant="ghost" onClick={() => { captureRef.current?.cancel(); captureRef.current = null; onCancel && onCancel(); }}>Abandon</Btn>
              <Btn onClick={finishSpeak}>Finish answer</Btn>
            </div>
          </>
        )}

        {stage === 'stopping' && (
          <div className="center-note">
            <Eyebrow dim>Sealing the attempt</Eyebrow>
            <p className="muted" style={{ marginTop: 10 }}>Measuring what actually happened…</p>
          </div>
        )}
      </div>
    </div>
  );
}
