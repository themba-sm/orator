/* MixedSession — today's intelligent combination (spec 36): vocab + story + persuasion. */

import { useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { analyseAttempt } from '../lib/analysis.js';
import { mixedSessionPlan, scoreboard, communicationSignature } from '../lib/arsenal.js';
import { allWords, lessonFor, seedVocabWord, recallQuestionFor, scanVocabularyUse } from '../lib/vocablab.js';
import { STORY_PROMPTS } from '../lib/storylab.js';
import { POSITIONS, analysePersuasion } from '../lib/persuasionlab.js';
import { find, insert, getCurrentUser } from '../lib/store.js';
import { recordRecall } from '../lib/memory-integration.js';

export default function MixedSession({ onDone }) {
  const uid = getCurrentUser()?.id;
  const plan = useMemo(() => mixedSessionPlan(), []);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState('');
  const [word, setWord] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [summary, setSummary] = useState([]);
  const [showScore, setShowScore] = useState(null);

  const current = plan[step];

  function note(t) { setSummary((s) => [...s, t]); setStep((i) => i + 1); }

  /* ---------- renders ---------- */
  if (showScore) {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Session complete</Eyebrow>
          <h1 className="display section-title">Today's session.</h1>
          {summary.map((t, i) => <p key={i} style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '6px 0' }}>{t}</p>)}
          {showScore.traits && (
            <div className="panel" style={{ marginTop: 14 }}>
              <p className="fb-head">Your communication signature</p>
              {showScore.traits.map((t) => <p key={t} style={{ fontSize: 13, margin: '4px 0' }}>{t}</p>)}
              <p className="faint" style={{ marginTop: 6 }}>{showScore.evidence}</p>
            </div>
          )}
          <div className="trainer-controls" style={{ marginTop: 22 }}>
            <Btn block onClick={onDone}>Done</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    // all steps done — finalise
    const sig = communicationSignature();
    return (
      <div className="center-note">
        <Btn onClick={() => setShowScore({ traits: sig?.traits, evidence: sig?.evidence })}>See the session summary</Btn>
      </div>
    );
  }

  /* step: vocabulary */
  if (current.kind === 'vocab-new') {
    const known = new Set(find('memoryItems', (m) => m.user_id === uid && m.kind === 'vocabulary').map((m) => m.vocab.word));
    const fresh = allWords().filter((w) => !known.has(w.word));
    const w = fresh[0] || allWords()[0];
    if (!word) { seedVocabWord(w); setWord(w); setStep(step); }
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Step {step + 1} of {plan.length} — one precise word</Eyebrow>
          <h2 className="display section-title" style={{ fontSize: 24 }}>{w.word}</h2>
          <div className="panel">
            <p style={{ fontSize: 14 }}>{w.meaning}.</p>
            <p className="faint" style={{ marginTop: 8 }}>"{w.example}"</p>
            <p className="faint" style={{ marginTop: 8 }}>{lessonFor(w).misuse}</p>
          </div>
          <div className="trainer-controls" style={{ marginTop: 18 }}>
            <Btn block onClick={() => { setStep(step + 1); note(`Learned the word "${w.word}".`); setStep(plan.length); }}>Understood — done for today</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (current.kind === 'vocab' && current.meta) {
    const item = find('memoryItems', (m) => m.user_id === uid && m.cat_key === 'vocab-' + current.meta.word)[0];
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Step {step + 1} of {plan.length} — vocabulary retrieval</Eyebrow>
          <h2 className="display section-title" style={{ fontSize: 22 }}>{recallQuestionFor(current.meta)}</h2>
          <textarea className="textarea-input" rows="2" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="The word…" />
          <div className="trainer-controls" style={{ marginTop: 14 }}>
            <Btn disabled={typed.trim().length < 2} onClick={() => {
              const gotIt = typed.toLowerCase().includes(current.meta.word.toLowerCase());
              if (item) recordRecall(item.id, { transcript: typed, expectedKeywords: [current.meta.word] });
              note(gotIt ? `Retrieved "${current.meta.word}" unaided.` : `Could not retrieve "${current.meta.word}" — it returns in reviews.`);
              setTyped('');
            }}>Commit</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (current.kind === 'story' || current.kind === 'story-compress') {
    const isCompress = current.kind === 'story-compress';
    return (
      <SpeakRunner
        exercise={isCompress
          ? { title: 'Compress your story', objective: 'Same story. Twenty seconds. Meaning survives.', prompt: `Retell the story you just told — in twenty seconds, to a friend. ${storyText ? 'You know the one.' : 'Any real story of yours.'}`, prepSeconds: 5, speakSeconds: 20, category: 'story' }
          : { title: 'A personal story', objective: 'Real beats polished.', prompt: STORY_PROMPTS[Math.floor(Math.random() * STORY_PROMPTS.length)], prepSeconds: 15, speakSeconds: 120, category: 'story' }}
        onComplete={({ capture }) => {
          const t = capture.transcript || '';
          scanVocabularyUse(t, 'mixed-session');
          if (!isCompress) setStoryText(t);
          note(isCompress ? 'Compressed your story to twenty seconds — compression recorded.' : 'Told a two-minute story. Feedback is on the report screen of the Storytelling Lab.');
        }}
        onCancel={onDone}
      />
    );
  }

  if (current.kind === 'persuasion') {
    return (
      <SpeakRunner
        exercise={{ title: 'Persuasion challenge', objective: 'Claim. Reason. One piece of evidence. Land it.', prompt: POSITIONS[Math.floor(Math.random() * POSITIONS.length)] + ' You have sixty seconds.', prepSeconds: 10, speakSeconds: 60, category: 'persuasion' }}
        onComplete={({ capture }) => {
          const t = capture.transcript || '';
          const res = analyseAttempt({ transcript: t, transcriptSource: capture.transcriptSource, durationMs: capture.durationMs, targetSeconds: 60, prompt: 'persuade', category: 'persuasion' });
          const a = analysePersuasion(res.measured, t, { key: 'general' });
          scanVocabularyUse(t, 'mixed-session');
          insert('persuasionAttempts', { user_id: uid, position: 'mixed', audience: 'general', stage: 5, dims: a.dims.map((d) => ({ key: d.key, ok: d.ok })), biggest: a.biggest?.key || null, transcript: t.slice(0, 2000), created: new Date().toISOString() });
          note(`Persuasion challenge done. ${a.biggest ? 'Focus next: ' + a.biggest.label + '.' : 'Argument held.'}`);
        }}
        onCancel={onDone}
      />
    );
  }

  return null;
}
