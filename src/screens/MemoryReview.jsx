/*
 * MemoryReview — the daily retrieval session.
 * LEARN → RETRIEVE (no hints) → COMPARE → APPLY → TRANSFER / SPONTANEOUS.
 * A manageable queue: quality over quantity. Memory always leads back to speaking.
 */

import { useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { analyseAttempt } from '../lib/analysis.js';
import { audioDeliveryMetrics } from '../lib/speech.js';
import {
  todayMemoryReview, recordRecall, recordApplication, recordTransfer, sessionSummary, ensureItemForWeakness,
} from '../lib/memory-integration.js';
import { CONTEXTS, transferPromptFor, evaluateSignature, AUTOMATICITY } from '../lib/memory.js';
import { find, insert, getCurrentUser } from '../lib/store.js';

const RECALL_KEYS = {
  prep: ['point', 'reason', 'example', 'point'],
  'central-idea': ['first', 'sentence', 'position', 'point'],
  conclusions: ['final', 'point', 'close'],
  pause: ['silence', 'pause', 'filler'],
  precision: ['specific', 'vague', 'name'],
  'short-sentences': ['short', 'one', 'idea', 'split'],
  examples: ['example', 'concrete', 'story', 'number'],
  pace: ['140', '130', '150', 'endings'],
  economy: ['first', 'third', 'early', 'stop'],
  'answer-question': ['restate', 'question', 'answer'],
  repetition: ['once', 'repeat', 'pause'],
  'voice-contrast': ['key', 'words', 'loud'],
  'contrast-ideas': ['without', 'before', 'after'],
  'listening-hook': ['their', 'words', 'quote'],
};

const RECALL_QUESTIONS = {
  prep: 'From memory: what are the four parts of the PREP path?',
  'central-idea': 'Where must your actual point appear — and what does the opening avoid?',
  conclusions: 'What must your final sentence do, and what must it never do?',
  pause: 'When you feel a filler coming, what do you do instead?',
  precision: 'The moment you notice a vague word leaving your mouth — what happens next?',
  'short-sentences': 'What is the sentence rule, and what happens to a sentence that needs two commas?',
  examples: 'What does every key claim need to survive the listener\'s memory?',
  pace: 'What is the target pace range — and what specifically must survive at that speed?',
  economy: 'By what point in your speaking time must the point be landed?',
  'answer-question': 'What do you do with the question before you answer it?',
  repetition: 'You finished a thought and your mouth wants to restate it. What do you do instead?',
  'voice-contrast': 'What happens to the loudness of key words versus supporting words?',
  'contrast-ideas': 'How does before / after framing move a listener?',
  'listening-hook': 'What do you do with the other person\'s exact words — and why does it work?',
};

const BAD_RESPONSES = {
  prep: 'Um so basically I think there are many factors to consider about this topic and it kind of depends on the person and the situation and also the context, you know, so yeah that is what I think about it.',
  pause: 'Um, so, like, the thing is that, you know, it is basically, I mean, sort of important to, uh, speak well.',
  conclusions: 'And also another thing I want to add is that we should probably also consider, which brings me to a different point entirely…',
  'central-idea': 'So when it comes to this question I think it is important, before answering, to give some background about the general area first…',
};

const RECOGNITION_SETS = [
  { text: 'The answer was fluent but drifted off the question after twenty seconds of speaking.', options: [
    { k: 'answer-question', label: 'Answer the question asked' },
    { k: 'conclusions', label: 'Land the ending' },
    { k: 'pause', label: 'Pause instead of filler' },
    { k: 'precision', label: 'Name it exactly' },
  ], answer: 'answer-question' },
  { text: 'You finished strong — but the first ten seconds were pure warm-up.', options: [
    { k: 'conclusions', label: 'Land the ending' },
    { k: 'central-idea', label: 'Lead with the actual point' },
    { k: 'prep', label: 'The PREP path' },
    { k: 'repetition', label: 'Say it once, well' },
  ], answer: 'central-idea' },
  { text: 'Your case was persuasive, then it trailed off with "…and yeah, so that\'s it, whatever."', options: [
    { k: 'conclusions', label: 'Land the ending' },
    { k: 'economy', label: 'Point in the first third' },
    { k: 'contrast-ideas', label: 'Before / after framing' },
    { k: 'listening-hook', label: 'The callback' },
  ], answer: 'conclusions' },
];

function pickContext(item) {
  const used = new Set(item.last_contexts || []);
  const fresh = CONTEXTS.filter((c) => !used.has(c.key));
  const pool = fresh.length ? fresh : CONTEXTS;
  return pool[Math.floor(Math.random() * pool.length)].key;
}

/* The review type for an item this session (specs 3, 5, 8, 20). */
function nextTypeFor(item, forced) {
  if (forced) return forced;
  const activity = item.recall_success + item.recall_fail + item.apply_success + item.apply_fail;
  if (item.last_reviewed === null && activity === 0) return 'learn';
  if (item.struggling) return 'recover';
  const total = activity;
  if (total % 4 === 3 && item.automaticity >= 4) return 'spontaneous';
  if (total % 3 === 2 && item.automaticity >= 2) return 'transfer';
  if (total % 5 === 4) return 'reconstruct';
  if (total % 7 === 5) return 'recognise';
  return item.recall_success === 0 && total < 2 ? 'recall' : 'apply';
}

export default function MemoryReview({ onDone }) {
  const { due, total } = useMemo(() => todayMemoryReview(4), []);
  const [queue, setQueue] = useState(() => due.map((d) => d.item));
  const [forcedTypes, setForcedTypes] = useState({});
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('intro');
  const [typed, setTyped] = useState('');
  const [recognitionPick, setRecognitionPick] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [lastRecallRating, setLastRecallRating] = useState(null);
  const [currentContext, setCurrentContext] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [summary, setSummary] = useState(null);
  const [beforeLevels] = useState(() => {
    const o = {};
    due.forEach((d) => { o[d.item.id] = d.item.automaticity; });
    return o;
  });

  const item = queue[idx];
  const type = item ? (forcedTypes[item.id] ? 'recall' : nextTypeFor(item, null)) : null;

  function advance(v) {
    setVerdict(v);
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
      setPhase('verdict');
      setTyped('');
      setRecognitionPick(null);
      setRecognitionResult(null);
      setLastRecallRating(null);
    } else {
      const changes = sessionSummary(beforeLevels);
      setSummary(changes);
      setPhase('summary');
    }
  }

  function exerciseFor(kind) {
    if (kind === 'apply') return item.apply_prompt || { title: item.title, prompt: item.application, prepSeconds: 15, speakSeconds: 45 };
    if (kind === 'transfer') return transferPromptFor(item, currentContext);
    if (kind === 'spontaneous') return {
      title: 'Open floor',
      objective: '',
      instructions: ['Speak about anything you care about for 45 seconds.', 'ORATOR will tell you afterwards what it listened for.'],
      prompt: 'Speak for 45 seconds about something you genuinely care about. No technique will be named.',
      prepSeconds: 10, speakSeconds: 45,
    };
    if (kind === 'recover') return {
      title: 'Rebuild: ' + item.title,
      objective: 'The rebuild starts small.',
      instructions: [item.simple, 'Now demonstrate it in the easiest possible way: ' + (item.apply_prompt?.prompt || item.application)],
      prompt: item.apply_prompt?.prompt || item.application,
      prepSeconds: 20, speakSeconds: 40,
    };
    return { title: item.title, prompt: item.application, prepSeconds: 15, speakSeconds: 45 };
  }

  function handleCapture({ capture }) {
    const transcript = capture.transcript || '';
    if (!transcript) { advance({ okText: 'No transcript available — nothing was claimed. Try again next time.' }); return; }
    const ex = exercise;
    const measured = analyseAttempt({
      transcript,
      transcriptSource: capture.transcriptSource,
      durationMs: capture.durationMs,
      targetSeconds: ex.speakSeconds,
      prompt: ex.prompt,
      category: 'memory',
    }).measured;
    const audio = audioDeliveryMetrics(capture.energies, capture.durationMs);
    if (type === 'apply') recordApplication(item.id, { measured, audio, context: 'review' });
    else if (type === 'transfer') recordTransfer(item.id, { context: currentContext, measured, audio });
    else if (type === 'spontaneous') recordApplication(item.id, { measured, audio, spontaneous: true, told: false, context: 'review' });
    else if (type === 'recover') recordApplication(item.id, { measured, audio, context: 'recovery' });

    const ok = evaluateSignature(item, measured, audio);
    let okText;
    if (type === 'spontaneous') {
      okText = ok === null
        ? 'Not measurable from this attempt — no claim either way.'
        : ok
          ? `Unprompted, you demonstrated "${item.title}". That is automaticity evidence — the strongest kind.`
          : `You were listening for "${item.title}". It did not appear. That is the gap between understanding and automatic.`;
    } else if (ok === null) {
      okText = 'Not measurable from this attempt — recorded without a pass/fail claim.';
    } else {
      okText = ok ? `Signature delivered — ${item.title} showed up in the answer.` : `Not yet. The signature of "${item.title}" was not visible in the answer.`;
    }
    advance({ ok, okText });
  }

  /* ---------- renders ---------- */

  if (phase === 'intro') {
    if (!queue.length) {
      return (
        <div className="screen">
          <div className="wrap center-note">
            <Eyebrow dim>Memory review</Eyebrow>
            <h2 className="display section-title" style={{ fontSize: 26 }}>Nothing due right now.</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              {total} item{total === 1 ? '' : 's'} in memory, none due for retrieval today. ORATOR tests silently during training — those count too.
            </p>
            <Btn onClick={onDone}>Back</Btn>
          </div>
        </div>
      );
    }
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Memory review</Eyebrow>
          <h1 className="display section-title">Today's retrieval.</h1>
          <p className="muted" style={{ marginBottom: 22 }}>
            {queue.length} item{queue.length === 1 ? '' : 's'} due. You will not be shown answers first — retrieve, then demonstrate. Recall counts more than recognition.
          </p>
          {queue.map((q, i) => (
            <div className="attempt-row" key={q.id}>
              <div>
                <span style={{ fontWeight: 500 }}>{q.title}</span>
                <br />
                <span className="faint">{AUTOMATICITY[q.automaticity]?.label} · {q.playbook}</span>
              </div>
              <span className="attempt-date">{i + 1}</span>
            </div>
          ))}
          <div className="trainer-controls" style={{ marginTop: 26 }}>
            <Btn block onClick={() => setPhase('brief')}>Begin retrieval</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Automaticity update</Eyebrow>
          <h1 className="display section-title">What moved.</h1>
          {(summary || []).length === 0 && <p className="muted" style={{ marginBottom: 18 }}>Levels held steady this session. Retention kept. Only demonstration moves levels.</p>}
          {(summary || []).map((c) => (
            <div className="weakness-card" key={c.item.id} style={{ borderColor: c.after > c.before ? 'rgba(95,138,107,0.5)' : 'var(--line)' }}>
              <div className="wc-top">
                <span className="wc-name">{c.item.title}</span>
                <span className="wc-count" style={{ color: c.after > c.before ? 'var(--ok)' : 'var(--ink-faint)' }}>
                  {AUTOMATICITY[c.before]?.label} → {AUTOMATICITY[c.after]?.label}
                </span>
              </div>
            </div>
          ))}
          <div className="trainer-controls" style={{ marginTop: 26 }}>
            <Btn block onClick={onDone}>Done</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'verdict' && verdict) {
    return (
      <div className="screen">
        <div className="wrap center-note">
          <Eyebrow dim>Recorded</Eyebrow>
          <p className="muted" style={{ fontSize: 15, margin: '14px 0 26px' }}>{verdict.okText}</p>
          <Btn block onClick={() => { setPhase('brief'); setVerdict(null); }}>Continue</Btn>
        </div>
      </div>
    );
  }

  if (!item) return null;

  /* ---------- learn ---------- */
  if (type === 'learn' && phase === 'brief') {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow>Learn — first exposure</Eyebrow>
          <h1 className="display section-title">{item.title}</h1>
          <div className="panel" style={{ marginTop: 8 }}>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, marginBottom: 12 }}>{item.explanation}</p>
            <p className="faint" style={{ marginBottom: 12 }}>In one line: {item.simple}</p>
            {item.example && (
              <>
                <p className="fb-head" style={{ marginTop: 14 }}>Good example</p>
                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14 }}>{item.example}</p>
              </>
            )}
            {item.bad_example && (
              <>
                <p className="fb-head" style={{ marginTop: 14 }}>Bad example</p>
                <p className="faint" style={{ fontStyle: 'italic' }}>{item.bad_example}</p>
              </>
            )}
          </div>
          <p className="faint" style={{ marginTop: 14 }}>You will be asked to retrieve this unaided — soon, and later without warning.</p>
          <div className="trainer-controls" style={{ marginTop: 20 }}>
            <Btn block onClick={() => {
              // same-session retrieval: requeue this item as a forced recall after the others
              setQueue((q) => [...q, item]);
              setForcedTypes((f) => ({ ...f, [item.id]: 'recall' }));
              advance({ okText: `${item.title} stored. It returns — unaided — later this session.` });
            }}>Understood — I will prove it</Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- direct recall (typed, no hints) ---------- */
  if (type === 'recall' && (phase === 'brief' || phase === 'compare')) {
    const fresh = item.last_reviewed === null && item.recall_success + item.recall_fail === 0;
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Recall — unaided</Eyebrow>
          <h2 className="display section-title" style={{ fontSize: 24 }}>{item.kind === 'vocabulary' ? `From memory: what does "${item.title}" mean — and where would you use it?` : (fresh && phase === 'brief' ? 'Prove it stuck.' : RECALL_QUESTIONS[item.cat_key] || item.simple)}</h2>
          {phase === 'brief' && (
            <>
              <p className="faint" style={{ marginBottom: 14 }}>Answer from memory. The expected principle is revealed only after you commit.</p>
              <textarea className="textarea-input" rows="4" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your answer…" />
              <div className="trainer-controls" style={{ marginTop: 18 }}>
                <Btn onClick={() => {
                  const vocabKeys = (item.vocab?.meaning || '').toLowerCase().match(/[a-z]{5,}/g) || [];
                const updated = recordRecall(item.id, {
                    transcript: typed,
                    expectedKeywords: item.kind === 'vocabulary' ? (vocabKeys.length ? vocabKeys : ['meaning']) : (RECALL_KEYS[item.cat_key] || ['point', 'reason', 'example']),
                  });
                  const lastReview = find('memoryReviews', (r) => r.item_id === item.id).slice(-1)[0];
                  setLastRecallRating({ rating: lastReview?.rating, coverage: lastReview?.coverage });
                  setPhase('compare');
                }} disabled={typed.trim().length < 3}>Commit my recall</Btn>
              </div>
            </>
          )}
          {phase === 'compare' && (
            <>
              {lastRecallRating && (
                <p className="faint" style={{ margin: '10px 0' }}>
                  {lastRecallRating.rating === 'good' ? 'Clean recall.' : lastRecallRating.rating === 'hard' ? 'Partial recall — the essentials are shaky.' : 'You did not have it. No matter — that is why retrieval is scheduled.'}
                </p>
              )}
              <hr className="rule rule-tight" />
              <Eyebrow>Compare — the expected principle</Eyebrow>
              <div className="panel" style={{ marginTop: 8 }}>
                <p style={{ fontSize: 14, marginBottom: 8 }}>{item.simple}</p>
                <p className="faint">{item.explanation}</p>
              </div>
              <div className="trainer-controls" style={{ marginTop: 18 }}>
                <Btn onClick={() => advance({ ok: lastRecallRating?.rating !== 'again', okText: 'Now it will be applied in speaking — where it counts.' })}>Continue</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------- recognition ---------- */
  if (type === 'recognise' && phase === 'brief') {
    const set = RECOGNITION_SETS[idx % RECOGNITION_SETS.length];
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Recognition — diagnose the failure</Eyebrow>
          <h2 className="display section-title" style={{ fontSize: 24 }}>What is missing here?</h2>
          <p className="today-prompt" style={{ marginTop: 12 }}>“{set.text}”</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {set.options.map((o) => (
              <button key={o.k} type="button" className={`option-tile${recognitionPick === o.k ? ' selected' : ''}`} onClick={() => setRecognitionPick(o.k)}>
                <span className="ot-title">{o.label}</span>
              </button>
            ))}
          </div>
          {recognitionResult && (
            <p className="faint" style={{ marginTop: 12 }}>
              {recognitionResult ? 'Correct — but recognition proves less than recall or application.' : 'Not the one. Remember: recognition is the weakest form of proof anyway.'}
            </p>
          )}
          <div className="trainer-controls" style={{ marginTop: 18 }}>
            <Btn
              disabled={!recognitionPick}
              onClick={() => {
                const correct = recognitionPick === set.answer;
                insert('skillRetrievalAttempts', {
                  user_id: getCurrentUser()?.id,
                  item_id: item.id,
                  mode: 'recognition',
                  rating: correct ? 'good' : 'again',
                  date: new Date().toISOString(),
                });
                setRecognitionResult(correct);
                setTimeout(() => advance({
                  ok: correct,
                  okText: correct ? 'Recognised. But a multiple-choice answer never proves a speaking skill — application does.' : `The expected diagnosis was "${(set.options.find((o) => o.k === set.answer) || {}).label}". Recognition is the weakest proof — speak it next time.`,
                }), 50);
              }}
            >{recognitionResult === null ? 'Commit' : 'Continue'}
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- reconstruction ---------- */
  if (type === 'reconstruct') {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Reconstruction — what is wrong with this?</Eyebrow>
          <h2 className="display section-title" style={{ fontSize: 24 }}>Find the failure.</h2>
          <p className="today-prompt" style={{ marginTop: 12 }}>“{BAD_RESPONSES[item.cat_key] || 'The answer lacked a visible point, drifted after thirty seconds, and opened a new idea at the end.'}”</p>
          {phase === 'brief' && (
            <>
              <p className="faint" style={{ marginBottom: 12 }}>Type what you would fix first — from memory, not from hints.</p>
              <textarea className="textarea-input" rows="4" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="What is wrong, and how would you fix it?" />
              <div className="trainer-controls" style={{ marginTop: 18 }}>
                <Btn onClick={() => {
                  insert('skillRetrievalAttempts', {
                    user_id: getCurrentUser()?.id,
                    item_id: item.id,
                    mode: 'reconstruction',
                    rating: typed.trim().length > 10 ? 'good' : 'again',
                    transcript: typed.slice(0, 400),
                    date: new Date().toISOString(),
                  });
                  setPhase('compare');
                }} disabled={typed.trim().length < 3}>Commit</Btn>
              </div>
            </>
          )}
          {phase === 'compare' && (
            <>
              <hr className="rule rule-tight" />
              <Eyebrow>The actual failure</Eyebrow>
              <div className="panel" style={{ marginTop: 8 }}>
                <p style={{ fontSize: 14, marginBottom: 6 }}>{item.simple}</p>
                <p className="faint">{item.explanation}</p>
              </div>
              <div className="trainer-controls" style={{ marginTop: 18 }}>
                <Btn onClick={() => advance({ okText: 'Diagnosis recorded. Speaking is next.' })}>Continue</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------- transfer setup ---------- */
  if (type === 'transfer' && phase === 'brief') {
    const ctx = pickContext(item);
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Transfer — same principle, new context</Eyebrow>
          <h1 className="display section-title">{item.title}</h1>
          <p className="muted" style={{ marginBottom: 18 }}>You learned this in one setting. Now it moves — so it can never be a memorised answer again.</p>
          <div className="panel">
            <p className="faint" style={{ marginBottom: 8 }}>The principle (shown because the context is the challenge, not the memory):</p>
            <p style={{ fontSize: 14 }}>{item.simple}</p>
          </div>
          <div className="trainer-controls" style={{ marginTop: 20 }}>
            <Btn block onClick={() => {
              setCurrentContext(ctx);
              const ex = transferPromptFor(item, ctx);
              setExercise(ex);
              setPhase('run');
            }}>Take it into the new context</Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- brief → run for apply / spontaneous / recover ---------- */
  if (phase === 'brief') {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>{type === 'spontaneous' ? 'Open floor' : type === 'recover' ? 'Rebuild' : 'Demonstrate'}</Eyebrow>
          <h1 className="display section-title">{type === 'spontaneous' ? 'Just speak.' : type === 'recover' ? 'Rebuild: ' + item.title : item.title}</h1>
          {(type === 'apply' || type === 'recover') && <p className="faint" style={{ marginBottom: 16, marginTop: 8 }}>{type === 'recover' ? 'It slipped. Rebuild it — simply, then small.' : 'Now apply it aloud: ' + item.application}</p>}
          {type === 'spontaneous' && <p className="faint" style={{ marginBottom: 16, marginTop: 8 }}>No technique will be named. Speak naturally — ORATOR will reveal what it listened for afterwards.</p>}
          {type === 'recover' && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <p className="fb-head">Re-explained simply</p>
              <p style={{ fontSize: 14 }}>{item.simple}</p>
              {item.example && <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13.5, marginTop: 8 }}>{item.example}</p>}
            </div>
          )}
          <div className="trainer-controls" style={{ marginTop: 22 }}>
            <Btn block onClick={() => {
              setExercise(exerciseFor(type));
              setPhase('run');
            }}>Start speaking</Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- the runner ---------- */
  if (phase === 'run' && exercise) {
    return (
      <SpeakRunner
        exercise={exercise}
        onComplete={handleCapture}
        onCancel={() => advance({ okText: 'Attempt abandoned — no evidence recorded.' })}
      />
    );
  }

  return (
    <div className="center-note"><p className="muted">Preparing retrieval…</p></div>
  );
}
