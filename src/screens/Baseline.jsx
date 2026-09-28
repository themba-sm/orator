/*
 * Baseline Speaking Assessment — a fixed sequence of challenges that
 * establishes the initial communication profile.
 */

import { useMemo, useRef, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow, Meter } from '../components/ui.jsx';
import { BASELINE_CHALLENGES } from '../lib/exercises.js';
import { analyseAttempt, selectKeyWeakness, WEAKNESS_LIBRARY } from '../lib/analysis.js';
import { audioDeliveryMetrics, speechCapabilities } from '../lib/speech.js';
import { initialSkillScores } from '../lib/skills.js';
import {
  getCurrentUser, getProfile, update, insert, recordWeaknessObservation,
  weaknessPatternsSorted, completedAttempts,
} from '../lib/store.js';

export default function Baseline({ onDone }) {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const resultsRef = useRef([]);
  const [finished, setFinished] = useState(false);
  const [manualText, setManualText] = useState('');
  const [awaitingTranscript, setAwaitingTranscript] = useState(null); // pending capture
  const [profileResult, setProfileResult] = useState(null);
  const caps = speechCapabilities();
  const challenge = BASELINE_CHALLENGES[index];
  const patterns = useMemo(() => weaknessPatternsSorted(), [index]);

  function analyseCapture(capture, transcriptOverride) {
    const transcript = transcriptOverride !== undefined ? transcriptOverride : capture.transcript;
    const source = transcriptOverride !== undefined ? 'self-transcribed' : capture.transcriptSource;
    const measured = analyseAttempt({
      transcript,
      transcriptSource: source,
      durationMs: capture.durationMs,
      targetSeconds: challenge.speakSeconds,
      prompt: challenge.prompt,
      category: challenge.category,
    });
    const audio = audioDeliveryMetrics(capture.energies, capture.durationMs);
    const key = selectKeyWeakness(measured, audio, { category: challenge.category }, patterns);
    return { measured, audio, key };
  }

  function commitResult(analysis, capture) {
    const nextResults = [...resultsRef.current, { challenge, analysis }];
    resultsRef.current = nextResults;
    setResults(nextResults);

    // Persist the attempt + weakness observation.
    const attempt = insert('exerciseAttempts', {
      user_id: getCurrentUser().id,
      exercise_id: challenge.id,
      exercise_title: challenge.title,
      category: challenge.category,
      attempt_number: 1,
      session_kind: 'baseline',
      status: 'completed',
      weakness_key: analysis.key.weaknessKey,
      measured: analysis.measured,
      audio: { measured: analysis.audio.measured, spokeEnough: analysis.audio.spokeEnough, loudnessVariation: analysis.audio.loudnessVariation || null },
    });
    insert('speechAttempts', {
      attempt_id: attempt.id,
      duration_ms: capture.durationMs,
      transcript: capture.transcript || (manualText ? manualText : ''),
      transcript_source: analysis.measured.transcript,
      had_audio_playback: !!capture.audioBlob,
    });
    if (analysis.key.weaknessKey) {
      recordWeaknessObservation({
        skillKey: analysis.key.winner.skillKey,
        weaknessKey: analysis.key.weaknessKey,
        evidence: analysis.key.winner.evidence,
        severity: analysis.key.winner.severity,
        attemptId: attempt.id,
      });
    }
    return attempt;
  }

  function handleCapture({ capture }) {
    if (capture.transcript) {
      const analysis = analyseCapture(capture);
      commitResult(analysis, capture);
      advance();
    } else {
      setAwaitingTranscript(capture); // no live transcription — offer manual transcript
    }
  }

  function submitManual() {
    const capture = awaitingTranscript;
    const analysis = analyseCapture(capture, manualText.trim());
    commitResult(analysis, capture);
    setManualText('');
    setAwaitingTranscript(null);
    advance();
  }

  function skipManual() {
    const capture = awaitingTranscript;
    const analysis = analyseCapture(capture, capture.transcript || '');
    commitResult(analysis, capture);
    setAwaitingTranscript(null);
    advance();
  }

  function advance() {
    setRunning(false);
    if (index < BASELINE_CHALLENGES.length - 1) {
      setIndex(index + 1);
    } else {
      finishBaseline();
    }
  }

  function finishBaseline() {
    const finalResults = resultsRef.current;
    const scores = initialSkillScores(finalResults.map((r) => r.analysis));
    const profile = getProfile();
    update('userProfiles', profile.id, { baseline_complete: true, skill_scores: scores });
    insert('skillScores', { user_id: getCurrentUser().id, skills: scores, note: 'baseline' });
    insert('trainingSessions', {
      user_id: getCurrentUser().id,
      kind: 'baseline',
      challenge_count: finalResults.length,
      completed: true,
    });
    const patternsNow = weaknessPatternsSorted();
    setProfileResult({ scores, patterns: patternsNow });
    setFinished(true);
  }

  /* ---------- finished: show the profile ---------- */
  if (finished) {
    const strengths = Object.entries(profileResult.scores).filter(([, v]) => v !== null && v >= 60);
    const weak = profileResult.patterns.filter((p) => p.times_observed >= 1);
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow>Baseline complete</Eyebrow>
          <h1 className="display hero-title">Your starting profile, {getCurrentUser().name.split(' ')[0]}.</h1>
          <p className="muted" style={{ marginBottom: 8 }}>
            Seven challenges measured. These scores are training indicators — a map of where you are, not a verdict on where you can go.
          </p>

          <div className="panel" style={{ marginTop: 18 }}>
            <p className="fb-head">Skill indicators</p>
            {Object.entries(profileResult.scores).filter(([, v]) => v !== null).map(([k, v]) => (
              <Meter key={k} label={labelFor(k)} value={v} />
            ))}
          </div>

          {weak.length > 0 && (
            <>
              <hr className="rule" />
              <Eyebrow dim>What ORATOR will target first</Eyebrow>
              {weak.slice(0, 3).map((w) => (
                <div className="weakness-card" key={w.id}>
                  <div className="wc-top">
                    <span className="wc-name">{WEAKNESS_LIBRARY[w.weakness_key]?.label || w.weakness_key}</span>
                    <span className="wc-count">seen {w.times_observed}×</span>
                  </div>
                  <p className="wc-note">{w.examples?.[w.examples.length - 1]?.evidence || 'Observed during baseline.'}</p>
                </div>
              ))}
            </>
          )}

          <p className="faint" style={{ marginTop: 14 }}>
            {caps.recognition
              ? 'Your answers were transcribed live. Fillers, pace, structure and vocabulary precision above are measured from what you actually said.'
              : 'Live transcription was unavailable, so some indicators above are based on the transcripts you entered.'}
          </p>

          <div className="trainer-controls" style={{ marginTop: 30 }}>
            <Btn block onClick={onDone}>Enter the academy</Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- manual transcript fallback ---------- */
  if (awaitingTranscript) {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Transcript needed</Eyebrow>
          <h2 className="display section-title">What did you say?</h2>
          <p className="muted" style={{ marginBottom: 18 }}>
            This browser could not transcribe your speech live, so type (or paste) what you said. ORATOR analyses only what
            you give it — it will not invent measurements.
          </p>
          <textarea className="textarea-input" rows="7" value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Type your answer as close to what you said as possible…" />
          <div className="trainer-controls" style={{ marginTop: 18 }}>
            <Btn variant="ghost" onClick={skipManual}>Skip</Btn>
            <Btn onClick={submitManual} disabled={manualText.trim().length < 5}>Analyse</Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- runner or progress strip ---------- */
  return (
    <div className="screen-tight">
      <div className="wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <Eyebrow dim>Baseline assessment</Eyebrow>
          <span className="faint">{index + 1} / {BASELINE_CHALLENGES.length}</span>
        </div>
        <div className="step-dots" style={{ marginBottom: 18 }}>
          {BASELINE_CHALLENGES.map((c, i) => (
            <div key={c.id} className={`step-dot${i <= index ? ' on' : ''}`} />
          ))}
        </div>
        {running ? (
          <SpeakRunner
            exercise={challenge}
            onComplete={handleCapture}
            onCancel={() => setRunning(false)}
          />
        ) : (
          <>
            <h2 className="display section-title" style={{ fontSize: 26 }}>“{challenge.title}”</h2>
            <p className="muted">{challenge.objective}</p>
            <p className="faint" style={{ margin: '12px 0 22px' }}>{challenge.prompt}</p>
            <Btn block onClick={() => setRunning(true)}>Start challenge {index + 1}</Btn>
            {index > 0 && completedAttempts().length > 0 && (
              <p className="faint" style={{ marginTop: 14 }}>Challenges behind you: {results.length}. Keep going — the profile needs all seven.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function labelFor(key) {
  const map = {
    articulation: 'Articulation', clarity: 'Clarity', fluency: 'Fluency', vocabulary: 'Vocabulary',
    wordPrecision: 'Word precision', sentenceConstruction: 'Sentence construction',
    thoughtOrganisation: 'Thought organisation', responseSpeed: 'Response speed',
    storytelling: 'Storytelling', persuasion: 'Persuasion', conciseness: 'Conciseness',
    conversationalAgility: 'Conversational agility', confidence: 'Confidence / presence',
    vocalDelivery: 'Vocal delivery', explaining: 'Explaining ideas', underPressure: 'Speaking under pressure',
  };
  return map[key] || key;
}
