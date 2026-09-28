/*
 * ORATOR Storytelling Lab engine.
 * Structure taught, personality preserved. Show the experience, don't only label it.
 */

import { extractSignals } from './simulator.js';
import { insert, find, getCurrentUser } from './store.js';
import { recordSpontaneousEvidence } from './memory-integration.js';

/* ================= Story elements (spec 12) ================= */

export const ELEMENTS = [
  { key: 'hook', label: 'Hook', re: /^(when i|the day|on my first|i was nineteen|nobody told me|it was )/i, generic: /\b(have you ever|nobody tells you|the day)\b/i },
  { key: 'setting', label: 'Setting', re: /\b(in|at|on) [A-Z]|\b(morning|evening|night|monday|january|kitchen|office|school|town|city)\b/i },
  { key: 'character', label: 'Character', re: /\b(i|my (boss|father|mother|friend|client|colleague)|he|she)\b/i },
  { key: 'desire', label: 'Desire', re: /\b(i (wanted|needed|hoped|planned)|we wanted)\b/i },
  { key: 'problem', label: 'Problem', re: /\b(but|the problem|until|then everything|it didn't)\b/i },
  { key: 'conflict', label: 'Conflict', re: /\b(argued|fought|disagreed|clashed|confronted|pushed back)\b/i },
  { key: 'tension', label: 'Tension', re: /\b(worried|scared|afraid|risk|at stake|deadline|could lose|one chance)\b/i },
  { key: 'turning', label: 'Turning point', re: /\b(then|finally|that (moment|day)|i decided|everything changed|it hit me)\b/i },
  { key: 'consequence', label: 'Consequence', re: /\b(as a result|so i|after that|what followed|it cost)\b/i },
  { key: 'resolution', label: 'Resolution', re: /\b(solved|fixed|it worked|we rebuilt|recovered|got through)\b/i },
  { key: 'meaning', label: 'Meaning', re: /\b(i (learned|realised|realized)|what it taught|ever since)\b/i },
  { key: 'ending', label: 'Memorable ending', check: (t, m) => {
    const last = (t.match(/[^.!?]+[.!?]*\s*$/) || [''])[0].trim();
    return last.length > 0 && last.split(/\s+/).length <= 14 && (m.hasConclusion || /\b(never|always|that'?s why|and that|still)\b/i.test(last));
  } },
];

/* Detail: show, don't label (spec 15). */
const LABEL_EMOTIONS = /\b(nervous|scared|excited|angry|sad|happy|proud|embarrassed|stressed)\b/gi;
const SHOW_MARKERS = /\b(shaking|sweat|heartbeat|checking|staring|silence|paused|laughed|cried|hands|voice|clock|door|phone rang|walked|ran|whisper)\b/gi;

export function analyseStory(transcript, measured, durationSeconds) {
  const signals = extractSignals(measured, transcript);
  const found = ELEMENTS.filter((el) => (el.check ? el.check(transcript, measured) : el.re.test(transcript))).map((el) => el.key);
  const labels = (transcript.match(LABEL_EMOTIONS) || []).length;
  const shows = (transcript.match(SHOW_MARKERS) || []).length;
  const detailScore = shows + (measured.exampleHits >= 1 ? 1 : 0);
  const labeledOnly = labels > 0 && shows === 0;

  // pacing: where does the turning point land?
  const turningMatch = transcript.match(/\b(then|finally|that (moment|day)|i decided)\b/i);
  let climaxPosition = null;
  if (turningMatch) {
    climaxPosition = turningMatch.index / Math.max(1, transcript.length);
  }

  return {
    signals, found, missing: ELEMENTS.map((e) => e.key).filter((k) => !found.includes(k)),
    labels, shows, labeledOnly, detailScore,
    climaxPosition, wpm: measured.wpm,
    words: transcript.split(/\s+/).length,
    durationSeconds,
    strongest: found.length ? ELEMENTS.find((e) => e.key === found[found.length - 1])?.label : null,
  };
}

/* ================= Hook training (spec 13) ================= */

export const HOOK_TYPES = [
  { key: 'curiosity', label: 'Curiosity', example: '"I found out something at that job I still use today."' },
  { key: 'surprise', label: 'Surprise', example: '"I quit on a Tuesday. Best decision I ever made."' },
  { key: 'emotion', label: 'Emotion', example: '"I have never been more scared than the morning of that pitch."' },
  { key: 'conflict', label: 'Conflict', example: '"My boss and I disagreed about one number, and it cost the company a client."' },
  { key: 'mystery', label: 'Mystery', example: '"For three months, nobody knew why our customers were leaving."' },
  { key: 'direct', label: 'Direct statement', example: '"This is a story about the worst meeting of my life."' },
  { key: 'detail', label: 'Unusual detail', example: '"The email arrived at 2:47 in the morning."' },
  { key: 'dialogue', label: 'Dialogue', example: '"\'Are you sure about this?\' she asked. I was not."' },
];

export function hookDrill(storyIdea) {
  const idea = storyIdea || 'a time you were wrong about something important';
  return { idea, types: HOOK_TYPES, prompt: `Take the story of ${idea}. Give me three different openings: one curiosity, one surprise, one direct statement. Then say which one you would actually use, and why.` };
}

/* ================= Prompts, emotions, endings (specs 14, 20, 21) ================= */

export const STORY_PROMPTS = [
  'Tell me about a time you failed.',
  'Tell me about a moment that changed your perspective.',
  'Tell me about an embarrassing experience.',
  'Tell me about a difficult decision.',
  'Tell me about a person who influenced you.',
  'Tell me about the time you almost gave up on something.',
];

export const EMOTIONS = ['excitement', 'humour', 'tension', 'disappointment', 'pride', 'uncertainty', 'surprise', 'gratitude', 'frustration'];

export const ENDING_TYPES = [
  { key: 'lesson', label: 'A lesson, if one genuinely exists' },
  { key: 'realisation', label: 'A realisation the narrator arrives at' },
  { key: 'callback', label: 'A callback to the opening line' },
  { key: 'emotion', label: 'An emotional conclusion' },
  { key: 'consequence', label: 'A surprising consequence' },
  { key: 'line', label: 'One clean final sentence' },
];

/* ================= Pacing & compression (specs 16, 17) ================= */

export const COMPRESSION_CHAIN = [120, 60, 20, 15];
export const PACING_CHAIN = [30, 60, 120, 300];

export function compressionPrompt(seconds, storyIdea) {
  if (seconds <= 20) return `Same story of ${storyIdea}: tell it in ${seconds} seconds. The core meaning must survive.`;
  return `Tell the story of ${storyIdea} in about ${seconds >= 120 ? 'two minutes' : seconds + ' seconds'}.`;
}
export function oneSentencePrompt(storyIdea) {
  return `Now: the story of ${storyIdea} in one sentence. One.`;
}

/* ================= Expansion (spec 18) ================= */

export const SHORT_PREMISES = [
  'A missed phone call changed someone\'s career.',
  'A stubborn shop owner saved a failing business with one rule.',
  'Two friends made the same mistake; only one learned from it.',
];

/* ================= Story bank (spec 22) ================= */

export const BANK_CATEGORIES = ['personal', 'business', 'childhood', 'failure', 'success', 'lesson', 'funny', 'difficult', 'inspirational', 'unexpected', 'career', 'relationships', 'leadership'];

export function saveStory({ prompt, transcript, analysis, category, emotion }) {
  const uid = getCurrentUser()?.id;
  return insert('stories', {
    user_id: uid,
    title: prompt.slice(0, 90),
    transcript: (transcript || '').slice(0, 5000),
    category: category || 'personal',
    emotion: emotion || null,
    elements: analysis ? analysis.found : [],
    duration_seconds: analysis ? analysis.durationSeconds : null,
    created: new Date().toISOString(),
  });
}

export function storyBank() {
  const uid = getCurrentUser()?.id;
  return find('stories', (s) => s.user_id === uid).slice(-30).reverse();
}

export function recallStory(story) {
  return {
    title: 'Retrieve your own story',
    prompt: `Tell your saved story — "${story.title}" — in 30 seconds, as if to a friend. No rehearsal.`,
    prepSeconds: 5, speakSeconds: 30,
  };
}
