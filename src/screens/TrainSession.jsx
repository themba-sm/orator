/*
 * TrainSession — the core ORATOR loop:
 * SPEAK → ANALYSE → ONE KEY WEAKNESS → TEACH → RETRY → COMPARE → REMEMBER.
 */

import { useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import FeedbackView from './FeedbackView.jsx';
import CompareView from './CompareView.jsx';
import { Btn } from '../components/ui.jsx';
import {
  analyseAttempt, selectKeyWeakness, buildRetryConstraint, compareAttempts, WEAKNESS_LIBRARY,
} from '../lib/analysis.js';
import { audioDeliveryMetrics } from '../lib/speech.js';
import { applyAttemptToSkills, SKILLS } from '../lib/skills.js';
import {
  getCurrentUser, getProfile, update, insert, recordWeaknessObservation,
  markWeaknessImproved, weaknessPatternsSorted, snapshotProgress,
} from '../lib/store.js';
import { ensureItemForWeakness, recordApplication, recordSpontaneousEvidence } from '../lib/memory-integration.js';

export default function TrainSession({ exercise, kind = 'daily', onDone, onExit }) {
  const [stage, setStage] = useState('brief'); // brief | run1 | feedback | transcribe | retry | run2 | compare
  const [attempt1, setAttempt1] = useState(null);
  const [attempt2, setAttempt2] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [manualText, setManualText] = useState('');
  const [pendingCapture, setPendingCapture] = useState(null);
  const [audioUrl1, setAudioUrl1] = useState(null);
  const [audioUrl2, setAudioUrl2] = useState(null);
  const [retrySpec, setRetrySpec] = useState(null);
  const [saved, setSaved] = useState(false);
  const [memoryItem, setMemoryItem] = useState(null);

  const patterns = useMemo(() => weaknessPatternsSorted(), [stage]);
  const user = getCurrentUser();
  const profile = getProfile();

  const sessionRow = useMemo(() => insert('trainingSessions', {
    user_id: user?.id,
    kind,
    exercise_id: exercise.id,
    exercise_title: exercise.title,
    completed: false,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  function analyseCapture(capture, transcriptOverride, attemptNumber, targetSeconds, prompt) {
    const transcript = transcriptOverride !== undefined ? transcriptOverride : capture.transcript;
    const source = transcriptOverride !== undefined ? 'self-transcribed' : capture.transcriptSource;
    const measured = analyseAttempt({
      transcript,
      transcriptSource: source,
      durationMs: capture.durationMs,
      targetSeconds,
      prompt,
      category: exercise.category,
    }).measured;
    const audio = audioDeliveryMetrics(capture.energies, capture.durationMs);
    const key = selectKeyWeakness(measured, audio, { category: exercise.category }, patterns);
    return { measured, audio, key, transcript: transcript || '', attemptNumber };
  }

  function persistAttempt(analysis, capture, attemptNumber) {
    return insert('exerciseAttempts', {
      user_id: user?.id,
      session_id: sessionRow.id,
      exercise_id: exercise.id,
      exercise_title: exercise.title,
      category: exercise.category,
      attempt_number: attemptNumber,
      session_kind: kind,
      status: 'completed',
      weakness_key: analysis.key.weaknessKey,
      measured: analysis.measured,
      audio: { measured: analysis.audio.measured, spokeEnough: analysis.audio.spokeEnough, loudnessVariation: analysis.audio.loudnessVariation || null },
      transcript: analysis.transcript,
    });
  }

  function setAudioUrl(capture, which) {
    if (!capture.audioBlob) return;
    try {
      const url = URL.createObjectURL(capture.audioBlob);
      if (which === 1) setAudioUrl1(url); else setAudioUrl2(url);
    } catch { /* playback optional */ }
  }

  /* ---------- attempt 1 ---------- */
  function handleRun1({ capture }) {
    setAudioUrl(capture, 1);
    if (capture.transcript) {
      const analysis = analyseCapture(capture, undefined, 1, exercise.speakSeconds, exercise.prompt);
      const attempt = persistAttempt(analysis, capture, 1);
      insert('speechAttempts', {
        attempt_id: attempt.id,
        duration_ms: capture.durationMs,
        transcript: capture.transcript,
        transcript_source: analysis.measured.transcript,
        had_audio_playback: !!capture.audioBlob,
      });
      insert('feedback', {
        attempt_id: attempt.id,
        weakness_key: analysis.key.weaknessKey,
        candidates: analysis.key.candidates,
        verdict: analysis.key.verdict,
        note: analysis.key.note || null,
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
      // Error-based learning: the key weakness becomes ONE memory item (not three lessons).
      const memItem = analysis.key.weaknessKey ? ensureItemForWeakness(analysis.key.weaknessKey) : null;
      setMemoryItem(memItem);
      // Silent tests: previously learned skills evaluated without being named (specs 18-19).
      recordSpontaneousEvidence(analysis.measured, analysis.audio, {
        excludeItemId: memItem ? memItem.id : null,
        category: exercise.category,
      });
      setAttempt1({ analysis, capture });
      setStage('feedback');
    } else {
      setPendingCapture(capture);
      setStage('transcribe');
    }
  }

  function submitManual() {
    const capture = pendingCapture;
    const analysis = analyseCapture(capture, manualText.trim(), 1, exercise.speakSeconds, exercise.prompt);
    const attempt = persistAttempt(analysis, capture, 1);
    if (analysis.key.weaknessKey) {
      recordWeaknessObservation({
        skillKey: analysis.key.winner.skillKey,
        weaknessKey: analysis.key.weaknessKey,
        evidence: analysis.key.winner.evidence,
        severity: analysis.key.winner.severity,
        attemptId: attempt.id,
      });
    }
    setAttempt1({ analysis, capture });
    setManualText('');
    setPendingCapture(null);
    setStage('feedback');
  }

  /* ---------- retry ---------- */
  function startRetry() {
    const w = attempt1.analysis.key.weaknessKey;
    const constraint = buildRetryConstraint(w, exercise.prompt, exercise.speakSeconds);
    setRetrySpec({
      ...exercise,
      title: 'Your next attempt',
      objective: `Same challenge — this time with one constraint: ${WEAKNESS_LIBRARY[w].label.toLowerCase()}.`,
      instructions: [constraint.instruction],
      prepSeconds: Math.max(5, Math.round(exercise.prepSeconds * 0.5)),
      speakSeconds: constraint.seconds,
    });
    setStage('retry');
  }

  function handleRun2({ capture }) {
    setAudioUrl(capture, 2);
    const transcript = capture.transcript || '';
    const analysis = transcript
      ? analyseCapture(capture, undefined, 2, retrySpec.speakSeconds, exercise.prompt)
      : null;
    if (!analysis) {
      // no transcript for the retry: compare on duration only, honestly
      const measured = analyseAttempt({ transcript: '', transcriptSource: 'unavailable', durationMs: capture.durationMs, targetSeconds: retrySpec.speakSeconds, prompt: exercise.prompt, category: exercise.category }).measured;
      setAttempt2({ analysis: { measured, audio: audioDeliveryMetrics(capture.energies, capture.durationMs), key: null }, capture });
      setComparison(compareAttempts(attempt1.analysis, { measured, audio: audioDeliveryMetrics(capture.energies, capture.durationMs) }, attempt1.analysis.key.weaknessKey));
      setStage('compare');
      return;
    }
    const attempt = persistAttempt(analysis, capture, 2);
    if (analysis.key.weaknessKey && analysis.key.weaknessKey !== attempt1.analysis.key.weaknessKey) {
      recordWeaknessObservation({
        skillKey: analysis.key.winner.skillKey,
        weaknessKey: analysis.key.weaknessKey,
        evidence: analysis.key.winner.evidence,
        severity: analysis.key.winner.severity,
        attemptId: attempt.id,
      });
    }
    setAttempt2({ analysis, capture });
    const cmp = compareAttempts(attempt1.analysis, analysis, attempt1.analysis.key.weaknessKey);
    if (memoryItem) {
      // The retry WAS told the constraint — told application evidence.
      recordApplication(memoryItem.id, {
        measured: analysis.measured,
        audio: analysis.audio,
        success: cmp.improved.length > 0,
        context: exercise.category,
        told: true,
      });
    }
    recordSpontaneousEvidence(analysis.measured, analysis.audio, {
      excludeItemId: memoryItem ? memoryItem.id : null,
      category: exercise.category,
    });
    setComparison(cmp);
    setStage('compare');
  }

  /* ---------- save & finish ---------- */
  function saveResult() {
    const weaknessKey = attempt1.analysis.key.weaknessKey;
    let scores = profile?.skill_scores || {};
    if (weaknessKey) {
      const improved = comparison && comparison.improved.length > 0;
      scores = applyAttemptToSkills(scores, attempt1.analysis, { improved: !!improved });
      scores = applyAttemptToSkills(scores, attempt2?.analysis || attempt1.analysis, { improved: !!improved });
      if (improved) markWeaknessImproved(weaknessKey);
    } else {
      scores = applyAttemptToSkills(scores, attempt1.analysis, { improved: true });
    }
    if (profile) update('userProfiles', profile.id, { skill_scores: scores });
    insert('skillScores', { user_id: user?.id, skills: scores, note: `after ${exercise.title}` });
    update('trainingSessions', sessionRow.id, { completed: true });
    snapshotProgress(scores, `${exercise.title} — ${weaknessKey || 'clean pass'}`);
    setSaved(true);
    onDone && onDone();
  }

  /* ---------- render ---------- */

  if (stage === 'brief') {
    return (
      <SpeakRunner
        exercise={exercise}
        onComplete={handleRun1}
        onCancel={onExit}
      />
    );
  }

  if (stage === 'transcribe') {
    return (
      <div className="screen">
        <div className="wrap">
          <p className="eyebrow dim">Transcript needed</p>
          <h2 className="display section-title">What did you say?</h2>
          <p className="muted" style={{ marginBottom: 18 }}>
            This browser could not transcribe your speech live, so type what you said. ORATOR analyses only what
            you give it — nothing is invented.
          </p>
          <textarea className="textarea-input" rows="7" value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Type your answer as close to what you said as possible…" />
          <div className="trainer-controls" style={{ marginTop: 18 }}>
            <Btn variant="ghost" onClick={() => { setPendingCapture(null); setStage('brief'); }}>Redo attempt</Btn>
            <Btn onClick={submitManual} disabled={manualText.trim().length < 5}>Analyse my response</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'feedback') {
    const a = attempt1.analysis;
    return (
      <FeedbackView
        analysis={{
          ...a,
          attemptNumber: 1,
          verdictNote: a.key.note,
          weakness: a.key.weaknessKey ? { ...a.key.winner, weaknessKey: a.key.weaknessKey } : null,
          candidates: a.key.candidates,
        }}
        audioUrl={audioUrl1}
        retrySeconds={retrySpec?.speakSeconds}
        onRetry={a.key.weaknessKey ? startRetry : null}
        onDone={saveResult}
      />
    );
  }

  if (stage === 'retry') {
    return (
      <SpeakRunner
        exercise={retrySpec}
        mode="retry"
        onComplete={handleRun2}
        onCancel={() => setStage('feedback')}
      />
    );
  }

  if (stage === 'compare' && comparison) {
    return (
      <CompareView
        attempt1={attempt1.analysis}
        attempt2={attempt2.analysis}
        comparison={comparison}
        weaknessKey={attempt1.analysis.key.weaknessKey}
        onDone={saveResult}
      />
    );
  }

  return (
    <div className="center-note">
      <p className="muted">Saving…</p>
    </div>
  );
}
