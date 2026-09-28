/*
 * ORATOR Vocabulary Lab engine.
 * UNDERSTAND → RETRIEVE → SAY → APPLY → REUSE → TRANSFER → AUTOMATE.
 * Words taught by usefulness and precision, not rarity. Usage is the evidence.
 */

import { VOCAB_CATALOG, createVocabItem, AUTOMATICITY } from './memory.js';
import { find, insert, update, getCurrentUser, getProfile, weaknessPatternsSorted } from './store.js';
import { recordApplication } from './memory-integration.js';

export const VOCAB_CATEGORIES = [
  'everyday precision', 'professional communication', 'business', 'leadership', 'persuasion',
  'storytelling', 'emotions', 'ideas', 'analysis', 'disagreement', 'explanation',
  'presentations', 'interviews', 'conversation', 'rhetorical language',
];

/* Extra words chosen for vague-language replacement (spec 3, 9). */
export const VOCAB_EXTRA = [
  { word: 'pragmatic', meaning: 'practical rather than idealistic', fits: 'describing an approach', example: 'It was the pragmatic choice: imperfect, but it shipped.' },
  { word: 'candid', meaning: 'honest and direct, even when uncomfortable', fits: 'describing feedback or truth-telling', example: 'Let me be candid: the plan has a hole in it.' },
  { word: 'flawed', meaning: 'having a specific weakness', fits: 'replacing "bad"', example: 'The idea is good; the execution plan is flawed.' },
  { word: 'counterproductive', meaning: 'working against the very goal you want', fits: 'replacing "bad" when something backfires', example: 'Longer meetings are counterproductive to focus.' },
  { word: 'substantial', meaning: 'large in amount or importance', fits: 'replacing "big"', example: 'The upgrade made a substantial difference to speed.' },
  { word: 'essential', meaning: 'absolutely necessary', fits: 'replacing "important"', example: 'Sleep is essential to clear thinking.' },
];

export function allWords() { return [...VOCAB_CATALOG, ...VOCAB_EXTRA]; }

/* Lesson depth data per word: explanation, misuse, similar words + differences. */
const LESSON_EXTRAS = {
  concise: { explanation: 'A concise answer says the whole point in the fewest words that still carry it. Short is a side effect; complete is the point.', context: 'When someone asks for your recommendation and you have thirty seconds.', misuse: 'Do not use it for anything cut short — a missing conclusion is not concise, it is incomplete.', similar: [{ word: 'brief', difference: 'brief = short in time; concise = complete with nothing wasted' }, { word: 'short', difference: 'short says nothing about whether the point survived' }] },
  articulate: { explanation: 'Articulate is not about vocabulary size. It is the ability to make a thought findable in the listener\'s head.', context: 'Describing a colleague in an interview or a reference.', misuse: 'Not a synonym for "talks a lot" or "uses big words".', similar: [{ word: 'eloquent', difference: 'eloquent is moving and beautiful; articulate is clear and effective' }] },
  compelling: { explanation: 'A compelling case makes ignoring it feel like a mistake. It pulls attention by being convincing, not loud.', context: 'Recommending an idea to a decision-maker.', misuse: 'Not a general-purpose replacement for "good" — only for arguments, cases, reasons.', similar: [{ word: 'convincing', difference: 'convincing wins agreement; compelling makes attention follow it' }, { word: 'interesting', difference: 'interesting invites; compelling insists' }] },
  deliberate: { explanation: 'A deliberate choice was made on purpose. The word converts an accident into a decision.', context: 'Explaining technique: a pause, a structure, a slow answer.', misuse: 'Do not use it to mean "slow" alone.', similar: [{ word: 'intentional', difference: 'near-identical; deliberate sounds more measured' }] },
  nuanced: { explanation: 'A nuanced view can hold two truths at once. It is the opposite of black-and-white thinking.', context: 'Discussing opinions, ethics, strategy.', misuse: 'Not a fancy way to say "complicated".', similar: [{ word: 'complex', difference: 'complex has many parts; nuanced sees differences within the parts' }] },
  credible: { explanation: 'Credible means worth believing — earned through evidence or track record.', context: 'Discussing sources, people, plans.', misuse: 'Not the same as "true" — credibility is about earned trust.', similar: [{ word: 'reliable', difference: 'reliable behaves consistently; credible deserves belief' }] },
  tangible: { explanation: 'Tangible results can be pointed at. If you cannot show it, it is not tangible.', context: 'Describing outcomes and benefits.', misuse: 'Do not use for abstract benefits like "growth in confidence".', similar: [{ word: 'measurable', difference: 'measurable can be counted; tangible can be shown' }] },
  succinct: { explanation: 'Succinct carries the whole meaning in the smallest form. Like a good headline.', context: 'Summaries, elevator answers.', misuse: 'Not the same as "vague because it was short".', similar: [{ word: 'concise', difference: 'near-twins; succinct suits summaries, concise suits answers' }] },
  resonate: { explanation: 'When something resonates, the listener recognises themselves inside it.', context: 'Explaining why a story or message worked.', misuse: 'A thing does not resonate "with" nobody — name the audience.', similar: [{ word: 'connect', difference: 'connect is effort; resonate is effect' }] },
  coherent: { explanation: 'Coherent means every part supports the others. The listener never has to rebuild your logic.', context: 'Describing arguments and plans.', misuse: 'Not a synonym for "correct" — a coherent argument can still be wrong.', similar: [{ word: 'logical', difference: 'logical follows rules; coherent holds together' }] },
  pragmatic: { explanation: 'The pragmatic option trades elegance for what actually works now.', context: 'Choosing between ideal and workable.', misuse: 'Not a polite word for "lazy".', similar: [{ word: 'practical', difference: 'practical works in reality; pragmatic chooses the workable option deliberately' }] },
  candid: { explanation: 'Candour is honesty without decoration — the kind people thank you for later.', context: 'Feedback, hard truths, interviews.', misuse: 'Not a licence to be cruel; candid respects the listener.', similar: [{ word: 'honest', difference: 'honest is a trait; candid is the act of using it in the moment' }] },
  flawed: { explanation: 'Flawed points at a specific weakness without condemning the whole.', context: 'Replacing "bad" in criticism.', misuse: 'Do not say "flawed" without saying what the flaw is.', similar: [{ word: 'imperfect', difference: 'imperfect is neutral; flawed implies the flaw matters' }] },
  counterproductive: { explanation: 'A counterproductive action fights its own goal. The word names the backfire precisely.', context: 'Criticising a process or policy.', misuse: 'Only when the action harms the goal it serves — not for any bad outcome.', similar: [{ word: 'ineffective', difference: 'ineffective does nothing; counterproductive does damage' }] },
  substantial: { explanation: 'Substantial means big enough to matter. It earns the size it claims.', context: 'Replacing "big" for results, changes, differences.', misuse: 'Do not stack it ("very substantial") — that admits it was empty.', similar: [{ word: 'significant', difference: 'significant stresses importance; substantial stresses amount' }] },
  essential: { explanation: 'Essential means remove it and the thing fails. It is the strongest "important" that stays honest.', context: 'Priorities, requirements.', misuse: 'Overusing it inflates everything and convinces no one.', similar: [{ word: 'critical', difference: 'critical stresses urgency and danger; essential stresses necessity' }] },
};

const GENERIC_LESSON = { explanation: 'Learn this word by using it, not by admiring it.', context: 'Everyday professional speech.', misuse: 'Never use a word to sound smart — only to be precise.', similar: [] };

/* ================= Lesson assembly (spec 4) ================= */

export function lessonFor(w) {
  const extras = LESSON_EXTRAS[w.word] || GENERIC_LESSON;
  return {
    word: w.word,
    meaning: w.meaning,
    explanation: extras.explanation,
    context: extras.context,
    example: w.example,
    spokenExample: w.example,
    misuse: extras.misuse,
    similar: extras.similar,
    category: extras.category || 'everyday precision',
  };
}

/* ================= Active recall (spec 5) ================= */

export function recallQuestionFor(w) {
  return `Give me the word that means: ${w.meaning}.`;
}
export function recallHintFor(w) {
  return `Starts with "${w.word[0]}", ${w.word.length} letters. It fits ${w.fits}.`;
}

/* ================= Context transfer (spec 7) ================= */

export function contextsFor(w) {
  return [
    { key: 'define', label: 'Define it in your own words', prompt: `Define "${w.word}" without repeating its dictionary meaning.` },
    { key: 'sentence', label: 'Use it in a sentence', prompt: `Use "${w.word}" in one sentence about something real in your life.` },
    { key: 'business', label: 'Use it explaining a business idea', prompt: `Explain a business idea or project you know, using "${w.word}" where it genuinely fits.` },
    { key: 'disagreement', label: 'Use it during a disagreement', prompt: `Disagree with this claim — "${w.word}" should appear naturally: "Every meeting should have a written agenda."` },
    { key: 'conversation', label: 'Use it naturally in conversation', prompt: `Answer conversationally, as if to a friend: what makes work feel worth it? Use "${w.word}" only if it truly belongs there.` },
  ];
}

/* ================= Precision training (spec 9) ================= */

export const PRECISION_MAP = {
  bad: ['ineffective', 'flawed', 'inefficient', 'inadequate', 'counterproductive'],
  good: ['effective', 'compelling', 'valuable', 'practical', 'persuasive'],
  big: ['significant', 'substantial', 'extensive', 'major'],
  important: ['essential', 'critical', 'consequential', 'relevant'],
  hard: ['demanding', 'complicated', 'taxing', 'delicate'],
  weird: ['unusual', 'unexpected', 'inconsistent', 'odd'],
};

export function precisionDrill() {
  const bases = [
    'The project went really badly.',
    'That was a really good pitch.',
    'Losing that client was a big problem.',
    'This decision is important for the business.',
    'The feedback was hard to hear.',
    'Something weird happened in the meeting.',
  ];
  const base = bases[Math.floor(Math.random() * bases.length)];
  const vague = Object.keys(PRECISION_MAP).find((v) => new RegExp('\\b' + v + '\\w*\\b').test(base.toLowerCase()));
  return { base, vague, alternatives: PRECISION_MAP[vague] || PRECISION_MAP.bad };
}

/* ================= Overused word detection (spec 10) ================= */

const OVERUSE_WATCH = ['like', 'basically', 'obviously', 'you know', 'really', 'very', 'thing', 'things', 'stuff', 'good', 'bad', 'literally', 'actually', 'just'];
const OVERUSE_PER1000 = { like: 8, basically: 4, obviously: 3, 'you know': 4, really: 8, very: 8, thing: 6, things: 6, stuff: 4, good: 6, bad: 6, literally: 2, actually: 6, just: 10 };

export function trackOveruse() {
  const uid = getCurrentUser()?.id;
  const texts = [];
  find('speeches', (s) => s.user_id === uid).forEach((s) => texts.push(s.transcript || ''));
  find('conversationTurns', (t) => t.speaker === 'user').forEach((t) => texts.push(t.text || ''));
  find('exerciseAttempts', (a) => a.user_id === uid).forEach((a) => texts.push(a.transcript || ''));
  find('speechAttempts', (a) => a.user_id === uid).forEach((a) => texts.push(a.transcript || ''));
  const corpus = texts.join(' ').toLowerCase();
  const totalWords = corpus.split(/\s+/).filter(Boolean).length;
  if (totalWords < 200) return []; // not enough evidence to accuse anyone of anything
  const found = [];
  OVERUSE_WATCH.forEach((w) => {
    const re = new RegExp('\\b' + w + '\\b', 'g');
    const count = (corpus.match(re) || []).length;
    const per1000 = (count / totalWords) * 1000;
    if (per1000 > (OVERUSE_PER1000[w] || 5)) {
      found.push({ word: w, count, per1000: +per1000.toFixed(1) });
      const existing = find('overusedWords', (o) => o.user_id === uid && o.word === w)[0];
      if (existing) update('overusedWords', existing.id, { count, per1000: +per1000.toFixed(1), updated: new Date().toISOString() });
      else insert('overusedWords', { user_id: uid, word: w, count, per1000: +per1000.toFixed(1), created: new Date().toISOString() });
    }
  });
  return found;
}

/* ================= Naturalness detection (specs 8, 33) ================= */

export function scanVocabularyUse(transcript, context) {
  const uid = getCurrentUser()?.id;
  const items = find('memoryItems', (m) => m.user_id === uid && m.kind === 'vocabulary');
  const results = [];
  items.forEach((item) => {
    const re = new RegExp('\\b' + item.vocab.word + '\\b', 'gi');
    const hits = (transcript.match(re) || []).length;
    if (hits === 0) return;
    const forced = /the word|how do you say|the term/i.test(transcript) || hits > 2;
    insert('vocabularyApplications', { user_id: uid, item_id: item.id, word: item.vocab.word, context, natural: !forced, hits, created: new Date().toISOString() });
    if (!forced) {
      recordApplication(item.id, { success: true, context, spontaneous: true, told: false, measured: { wordCount: (transcript.split(/\s+/)).length } });
    }
    results.push({ word: item.vocab.word, natural: !forced, hits });
  });
  return results;
}

/* ================= Vocabulary profile (spec 1) ================= */

export function vocabularyProfile() {
  const uid = getCurrentUser()?.id;
  const words = find('memoryItems', (m) => m.user_id === uid && m.kind === 'vocabulary');
  const attempts = find('vocabularyAttempts', (a) => a.user_id === uid);
  const applications = find('vocabularyApplications', (a) => a.user_id === uid);
  const reviews = find('memoryReviews', (r) => true).filter((r) => words.some((w) => w.id === r.item_id));
  const overused = find('overusedWords', (o) => o.user_id === uid);
  return {
    learned: words.length,
    words: words.map((w) => ({ word: w.vocab.word, level: AUTOMATICITY[w.automaticity]?.label || 'Exposed', item: w })),
    recallSuccess: reviews.filter((r) => r.rating === 'good').length,
    recallFail: reviews.filter((r) => r.rating === 'again').length,
    spoken: attempts.filter((a) => a.stage === 'say' && a.success).length,
    usedNaturally: applications.filter((a) => a.natural).length,
    forced: applications.filter((a) => !a.natural).length,
    forgotten: words.filter((w) => w.struggling).length,
    overused: overused.map((o) => ({ word: o.word, per1000: o.per1000 })),
  };
}

/* ================= Scheduling (spec 11) — the memory engine handles it. ================= */
/* Vocabulary items live in memoryItems (kind: vocabulary) and follow the
   same spaced-retrieval ladder as principles: same-session → 1d → 3d → 7d → 14d → 30d. */

export function seedVocabWord(word) {
  const uid = getCurrentUser()?.id;
  if (!uid) return null;
  const existing = find('memoryItems', (m) => m.user_id === uid && m.cat_key === 'vocab-' + word.word);
  if (existing.length) return existing[0];
  return insert('memoryItems', createVocabItem({ id: uid }, word));
}
