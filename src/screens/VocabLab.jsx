/* VocabLab — word lesson, active recall, speaking, transfer, precision drills. */

import { useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { analyseAttempt } from '../lib/analysis.js';
import {
  allWords, lessonFor, recallQuestionFor, recallHintFor, contextsFor,
  precisionDrill, vocabularyProfile, seedVocabWord, scanVocabularyUse, trackOveruse,
} from '../lib/vocablab.js';
import { find, insert, getCurrentUser } from '../lib/store.js';
import { recordRecall } from '../lib/memory-integration.js';

export default function VocabLab({ onDone }) {
  const uid = getCurrentUser()?.id;
  const [phase, setPhase] = useState('home');
  const [word, setWord] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [typed, setTyped] = useState('');
  const [hint, setHint] = useState(false);
  const [drill, setDrill] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const profile = useMemo(() => { trackOveruse(); return vocabularyProfile(); }, [phase]);

  function pickWord() {
    const known = new Set(find('memoryItems', (m) => m.user_id === uid && m.kind === 'vocabulary').map((m) => m.vocab.word));
    const fresh = allWords().filter((w) => !known.has(w.word));
    const w = fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : allWords()[Math.floor(Math.random() * allWords().length)];
    seedVocabWord(w);
    setWord(w);
    setLesson(lessonFor(w));
    setPhase('lesson');
  }

  function startRecall() {
    // active recall: definition shown, word withheld (spec 5)
    setPhase('recall');
  }

  function commitRecall() {
    const gotIt = typed.toLowerCase().trim().includes(word.word.toLowerCase());
    insert('vocabularyAttempts', { user_id: uid, word: word.word, stage: 'recall', success: gotIt, created: new Date().toISOString() });
    recordRecall(find('memoryItems', (m) => m.user_id === uid && m.cat_key === 'vocab-' + word.word)[0]?.id, { transcript: typed, expectedKeywords: [word.word] });
    setLastResult(gotIt ? 'Retrieved. Now say it aloud.' : `It was "${word.word}". Say it aloud now — that is how it sticks.`);
    setPhase('say');
  }

  /* ---------- renders ---------- */
  if (phase === 'home') {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Vocabulary Lab</Eyebrow>
          <h1 className="display section-title">The word, then the use of it.</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Words chosen for precision, not rarity. A word counts as learned only when you say it naturally without being told to.</p>

          <div className="stat-strip">
            <div className="stat-cell"><div className="stat-k">Words in memory</div><div className="stat-v">{profile.learned}</div></div>
            <div className="stat-cell"><div className="stat-k">Used naturally</div><div className="stat-v">{profile.usedNaturally}</div></div>
            <div className="stat-cell"><div className="stat-k">Forced uses</div><div className="stat-v">{profile.forced}</div></div>
            <div className="stat-cell"><div className="stat-k">Recall</div><div className="stat-v">{profile.recallSuccess}✓</div></div>
          </div>

          {profile.words.length > 0 && (
            <div className="panel" style={{ marginTop: 16 }}>
              <p className="fb-head">My words</p>
              {profile.words.map((w) => (
                <p key={w.word} style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '5px 0' }}>{w.word} <span className="faint">— {w.level}</span></p>
              ))}
            </div>
          )}
          {profile.overused.length > 0 && (
            <div className="panel" style={{ marginTop: 12 }}>
              <p className="fb-head">Overused in your recorded speech</p>
              {profile.overused.map((o) => (
                <p key={o.word} style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '5px 0' }}>"{o.word}" <span className="faint">— {o.per1000} per 1000 words</span></p>
              ))}
              <p className="faint" style={{ marginTop: 6 }}>Only flagged when meaningfully frequent across your history.</p>
            </div>
          )}

          <div className="trainer-controls" style={{ marginTop: 22 }}>
            <Btn block onClick={pickWord}>Learn a word</Btn>
            <Btn block variant="ghost" onClick={() => { setDrill(precisionDrill()); setPhase('precision'); }}>Precision drill — replace the vague word</Btn>
          </div>
          <div className="trainer-controls"><Btn variant="ghost" onClick={onDone}>Back</Btn></div>
        </div>
      </div>
    );
  }

  if (phase === 'lesson' && lesson) {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Word — {lesson.category}</Eyebrow>
          <h1 className="display section-title" style={{ fontFamily: 'var(--font-display)' }}>{lesson.word}</h1>
          <div className="panel" style={{ marginTop: 8 }}>
            <p style={{ fontSize: 15, marginBottom: 10 }}>{lesson.meaning}.</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-dim)', marginBottom: 10 }}>{lesson.explanation}</p>
            <p className="fb-head">Where it lives</p>
            <p style={{ fontSize: 13.5, marginBottom: 10 }}>{lesson.context}</p>
            <p className="fb-head">Spoken example</p>
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, marginBottom: 10 }}>"{lesson.spokenExample}"</p>
            <p className="fb-head">Common misuse</p>
            <p className="faint" style={{ marginBottom: 10 }}>{lesson.misuse}</p>
            {lesson.similar.length > 0 && (
              <>
                <p className="fb-head">Similar words — and the difference</p>
                {lesson.similar.map((s) => <p key={s.word} style={{ fontSize: 13, margin: '4px 0' }}><b>{s.word}</b> <span className="faint">— {s.difference}</span></p>)}
              </>
            )}
          </div>
          <div className="trainer-controls" style={{ marginTop: 18 }}>
            <Btn block onClick={startRecall}>I have it — test me</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'recall' && word) {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Active recall</Eyebrow>
          <h2 className="display section-title" style={{ fontSize: 22 }}>{recallQuestionFor(word)}</h2>
          {hint && <p className="faint">{recallHintFor(word)}</p>}
          <textarea className="textarea-input" rows="2" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="The word…" />
          <div className="trainer-controls" style={{ marginTop: 14 }}>
            {!hint ? <Btn variant="ghost" onClick={() => setHint(true)}>Give me a hint</Btn> : null}
            <Btn onClick={commitRecall} disabled={typed.trim().length < 2}>Commit</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'say' && word) {
    return (
      <>
        {lastResult && <p className="center-note faint" style={{ margin: 0, padding: '10px 0 0' }}>{lastResult}</p>}
        <SpeakRunner
          exercise={{
            title: 'Say it',
            objective: `Use "${word.word}" in a sentence of your own — something real.`,
            prompt: `Use the word "${word.word}" in your own sentence. Real, not rehearsed.`,
            prepSeconds: 5, speakSeconds: 20, category: 'vocabulary',
          }}
          onComplete={({ capture }) => {
            const ok = (capture.transcript || '').toLowerCase().includes(word.word.toLowerCase());
            insert('vocabularyAttempts', { user_id: uid, word: word.word, stage: 'say', success: ok, created: new Date().toISOString() });
            scanVocabularyUse(capture.transcript || '', 'vocab-lab');
            const ctxs = contextsFor(word);
            setDrill(ctxs[Math.floor(Math.random() * ctxs.length)]);
            setPhase('transfer');
          }}
          onCancel={() => setPhase('home')}
        />
      </>
    );
  }

  if (phase === 'transfer' && drill) {
    return (
      <SpeakRunner
        exercise={{
          title: 'Transfer it',
          objective: drill.label,
          prompt: drill.prompt,
          prepSeconds: 8, speakSeconds: 30, category: 'vocabulary',
        }}
        onComplete={({ capture }) => {
          scanVocabularyUse(capture.transcript || '', 'transfer');
          setLastResult('Transfer exercise recorded. This word will be tested again — later, unannounced.');
          setPhase('home');
        }}
        onCancel={() => setPhase('home')}
      />
    );
  }

  if (phase === 'precision' && drill) {
    return (
      <SpeakRunner
        exercise={{
          title: 'Precision drill',
          objective: 'Kill the vague word with a precise one.',
          prompt: `Someone said: "${drill.base}" What specifically was the issue? Replace "${drill.vague}" with something precise.`,
          prepSeconds: 8, speakSeconds: 30, category: 'precision',
          instructions: [`Alternatives that would work: ${drill.alternatives.join(', ')} — but choose from what is actually true.`],
        }}
        onComplete={({ capture }) => {
          const t = (capture.transcript || '').toLowerCase();
          const used = drill.alternatives.filter((alt) => t.includes(alt));
          insert('precisionCorrections', { user_id: uid, vague: drill.vague, used: used[0] || null, created: new Date().toISOString() });
          setLastResult(used.length ? `"${used[0]}" — that is a real correction, not a costume.` : 'Still vague this time. Precision is a habit, not a lesson.');
          setPhase('home');
        }}
        onCancel={() => setPhase('home')}
      />
    );
  }

  return null;
}
