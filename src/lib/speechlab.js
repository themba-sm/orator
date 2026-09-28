/*
 * ORATOR Public Speaking Lab engine.
 * Structured speeches: types, durations, prep with notes, structure coach that
 * fades with ability, audience simulation (clearly simulated), post-speech Q&A
 * generated from what was actually said, honest performance report, archive,
 * before/after comparison, monthly challenge.
 */

import { analyseAttempt } from './analysis.js';
import { extractSignals } from './simulator.js';
import { find, insert, getCurrentUser, getProfile, weaknessPatternsSorted } from './store.js';
import { ensureItemForWeakness, recordSpontaneousEvidence } from './memory-integration.js';
import { communicationLevel } from './skills.js';

/* ================= Speech types (spec 8) ================= */

export const SPEECH_TYPES = [
  { key: 'impromptu', label: 'Impromptu', hint: 'Little or no preparation. Think on your feet.' },
  { key: 'informative', label: 'Informative', hint: 'Teach the audience something.' },
  { key: 'persuasive', label: 'Persuasive', hint: 'Convince them.' },
  { key: 'story', label: 'Storytelling', hint: 'A narrative, not a list of events.' },
  { key: 'keynote', label: 'Keynote', hint: 'One central message, delivered.' },
  { key: 'presentation', label: 'Presentation', hint: 'Explain an idea or proposal.' },
  { key: 'interview', label: 'Interview answer', hint: 'Podcast / professional interview setting.' },
  { key: 'qa', label: 'Speech + Q&A', hint: 'Deliver, then handle the room.' },
];

export const DURATIONS = [
  { seconds: 30, label: '30s' }, { seconds: 60, label: '60s' }, { seconds: 120, label: '2 min' },
  { seconds: 300, label: '5 min' }, { seconds: 600, label: '10 min' }, { seconds: 900, label: '15 min' },
];

export const PREP_OPTIONS = [
  { seconds: 0, label: 'None' }, { seconds: 10, label: '10s' }, { seconds: 30, label: '30s' },
  { seconds: 60, label: '1 min' }, { seconds: 180, label: '3 min' }, { seconds: 300, label: '5 min' }, { seconds: 600, label: '10 min' },
];

/* ================= Audiences (spec 16) ================= */

export const AUDIENCES = {
  friendly: { key: 'friendly', label: 'Friendly', hint: 'Supportive and engaged.', weights: { story: 1.2, presence: 1.1 }, qaStyle: 'warm, curious questions' },
  neutral: { key: 'neutral', label: 'Neutral', hint: 'Quiet. Difficult to read.', weights: { message: 1.2 }, qaStyle: 'measured, testing questions' },
  skeptical: { key: 'skeptical', label: 'Skeptical', hint: 'Questions every claim.', weights: { persuasion: 1.3, language: 1.1 }, qaStyle: 'challenging, evidence-hungry questions' },
  distracted: { key: 'distracted', label: 'Distracted', hint: 'You must earn attention.', weights: { delivery: 1.3, message: 1.1 }, qaStyle: 'scattered questions, some off-topic' },
  executive: { key: 'executive', label: 'Executive', hint: 'Concise and useful, or nothing.', weights: { structure: 1.2, message: 1.2 }, qaStyle: 'bottom-line questions' },
  expert: { key: 'expert', label: 'Expert', hint: 'Expects precision.', weights: { language: 1.2, persuasion: 1.1 }, qaStyle: 'technical, precise questions' },
};

/* ================= Structures (spec 11) ================= */

export const STRUCTURES = {
  prep: { key: 'prep', name: 'PREP', parts: ['Point', 'Reason', 'Example', 'Point'], fits: ['persuasive', 'interview', 'impromptu'] },
  pcs: { key: 'pcs', name: 'Problem → Cause → Solution', parts: ['Problem', 'Cause', 'Solution'], fits: ['informative', 'presentation', 'persuasive'] },
  storyArc: { key: 'storyArc', name: 'Story arc', parts: ['Situation', 'Conflict', 'Turning point', 'Resolution', 'Lesson'], fits: ['story'] },
  cee: { key: 'cee', name: 'Claim → Evidence → Explanation', parts: ['Claim', 'Evidence', 'Explanation'], fits: ['informative', 'keynote', 'presentation'] },
  keynote: { key: 'keynote', name: 'Keynote spine', parts: ['Hook', 'One message', 'Proof', 'Return to the message'], fits: ['keynote', 'qa'] },
};

/* Structure coach that fades with ability (spec 29). */
export function coachRecommendation(type, profile) {
  const lv = communicationLevel(profile?.skill_scores || {});
  const n = typeof lv === 'number' ? lv : (typeof lv?.score === 'number' ? lv.score : 37);
  const fit = Object.values(STRUCTURES).find((s) => s.fits.includes(type));
  if (n >= 70) return { mode: 'independent', text: 'You do not need a structure handed to you. Choose your own — or speak without one.', structure: null };
  if (n >= 50) return { mode: 'nudge', text: `If you want one: ${fit ? fit.name : 'PREP'}. But the choice is yours now.`, structure: fit || STRUCTURES.prep };
  return { mode: 'guided', text: `Recommended structure: ${fit ? fit.name + ' — ' + fit.parts.join(' · ') : 'PREP — Point · Reason · Example · Point'}`, structure: fit || STRUCTURES.prep };
}

/* ================= Speech prompts ================= */

const SPEECH_PROMPTS = {
  impromptu: ['Speak about the best advice you ever ignored.', 'Your phone rings: you are on stage in two minutes. Speak about work that matters.', 'Speak about a moment that changed how you see time.'],
  informative: ['Teach the audience something you understand deeply. Simply and clearly.', 'Explain how something in your field actually works — and where people get it wrong.'],
  persuasive: ['Convince the audience that young entrepreneurs should learn public speaking.', 'Persuade a skeptical client to consider your proposal.', 'Defend an unpopular but reasonable position. Make it land.'],
  story: ['Tell the story of a decision that changed your direction.', 'Tell the story of a failure that taught you something you still use.', 'Tell the story of the moment you almost gave up — and what happened instead.'],
  keynote: ['Deliver a keynote with one message the audience will remember for a year.', 'The stage is yours. One idea, fully delivered.'],
  presentation: ['Present a proposal to improve something you know well.', 'Present a change you believe in to people who can make it happen.'],
  interview: ['You are a podcast guest. The first question: "What do you do — and why does it matter?"', 'The interview opens with: "Everyone says you are good at this. Prove it."'],
  qa: ['Deliver a short position, then face the room. The topic is yours — choose well.', 'Make your case, then handle whatever comes back.'],
};

export function speechPromptFor(type, seconds) {
  const pool = SPEECH_PROMPTS[type] || SPEECH_PROMPTS.impromptu;
  const p = pool[Math.floor(Math.random() * pool.length)];
  if (type === 'impromptu' && seconds <= 60) return p + ' Keep it tight.';
  return p;
}

/* ================= Audience Q&A (spec 18) ================= */

export function generateQuestions(transcript, audience, count = 3) {
  const lower = (transcript || '').toLowerCase();
  const topics = [...new Set((lower.match(/\b[a-z]{5,}\b/g) || [])
    .filter((w) => !['about', 'would', 'should', 'there', 'their', 'which', 'because', 'people', 'think', 'thing', 'things', 'really', 'always', 'never', 'reason', 'every', 'where', 'other'].includes(w)))].slice(0, 6);
  const t = () => (topics.length ? topics[Math.floor(Math.random() * topics.length)] : 'that');
  const questions = [
    `You spoke about ${t()}. Why should a small business care about that?`,
    `Clarify something: what exactly did you mean when you brought up ${t()}?`,
    audience.key === 'skeptical' || audience.key === 'expert'
      ? `I am not sure I buy it. What is the strongest piece of evidence behind your point about ${t()}?`
      : `What would you say to someone who thinks ${t()} is overrated?`,
    `An unexpected one: if you had to bet money against your own argument, where would it lose?`,
    `Bottom line: what should the audience do differently tomorrow?`,
  ];
  return questions.slice(0, count);
}

/* Audience reaction (spec 17) — simulated, inferred, clearly labelled. */
export function simulatedReaction(measured, signals, audience) {
  const bits = [];
  const wpm = measured.wpm;
  if (measured.structureHits >= 2 && (measured.relevance ?? 0) >= 0.4) bits.push('engaged');
  if (signals.vague && audience.key !== 'friendly') bits.push('skeptical');
  if ((measured.avgSentenceLen ?? 15) > 26) bits.push('straining to follow');
  if ((measured.fillerRate ?? 0) > 5 && audience.key !== 'friendly') bits.push('distracted');
  if (measured.hasConclusion) bits.push('settled at the end');
  if (!bits.length) bits.push('quiet but attentive');
  return `Simulated ${audience.label.toLowerCase()} audience reaction: ${bits.join(', ')}. (This is inferred from your delivery, not a real audience.)`;
}

/* ================= Speech report (spec 21) ================= */

function rank(b) { return { strong: 3, developing: 2, inconsistent: 1, weak: 0 }[b] ?? 0; }

export function speechReport(type, audience, measured, signals, transcript) {
  const words = (transcript || '').split(/\s+/).length;
  const distinct = new Set((transcript || '').toLowerCase().match(/\b[a-z']+\b/g) || []).size;
  const variety = words > 20 ? distinct / words : null;
  const windowUse = measured.targetSeconds ? measured.durationSeconds / measured.targetSeconds : null;

  const dims = [
    { key: 'message', label: 'Message', band: (measured.openingDirectness ?? 0.3) >= 0.5 && (measured.relevance ?? 0) >= 0.3 ? 'strong' : ((measured.openingDirectness ?? 0) >= 0.25 ? 'developing' : 'weak'), evidence: measured.openingDirectness !== null ? `central idea ${measured.openingDirectness >= 0.5 ? 'visible early' : 'arrived late or never'}` : 'not measurable' },
    { key: 'structure', label: 'Structure', band: measured.structureHits >= 2 ? 'strong' : measured.structureHits === 1 ? 'developing' : 'weak', evidence: `${measured.structureHits} structure marker(s)` + (measured.hasConclusion ? ', clean close' : ', no visible close') },
    { key: 'delivery', label: 'Delivery', band: (measured.fillerRate ?? 0) < 1.5 && (measured.avgSentenceLen ?? 15) <= 22 ? 'strong' : (measured.fillerRate ?? 0) < 4 ? 'developing' : 'weak', evidence: measured.fillerRate !== null ? `${measured.fillerRate} fillers per 100 words, average sentence ${Math.round(measured.avgSentenceLen || 0)} words` : 'limited audio metrics — qualitative only' },
    { key: 'language', label: 'Language', band: (measured.vagueRate ?? 0) < 1 && (variety ?? 0) > 0.35 ? 'strong' : (measured.vagueRate ?? 0) < 2.5 ? 'developing' : 'weak', evidence: measured.vagueRate !== null ? `${measured.vagueRate} vague words per 100; ${variety ? Math.round(variety * 100) + '% unique words' : 'variety not measured'}` : 'not measurable' },
    { key: 'story', label: 'Story', band: signals.story && measured.exampleHits >= 1 ? 'strong' : signals.story ? 'developing' : 'weak', evidence: signals.story ? 'narrative elements present' : 'listed events more than told a story', applies: ['story', 'impromptu'].includes(type) },
    { key: 'persuasion', label: 'Persuasion', band: signals.claim && measured.exampleHits >= 1 && measured.hasConclusion ? 'strong' : (signals.claim || measured.exampleHits >= 1 ? 'developing' : 'weak'), evidence: (signals.claim ? 'claims made' : 'few claims') + (measured.exampleHits ? ' with support' : ' without visible support'), applies: ['persuasive', 'keynote', 'presentation'].includes(type) },
    { key: 'presence', label: 'Presence', band: (measured.fillerRate ?? 0) < 1.5 && measured.wpm !== null && measured.wpm <= 165 && measured.wpm >= 110 ? 'strong' : (measured.fillerRate ?? 0) < 4 ? 'developing' : 'weak', evidence: measured.wpm !== null ? `${measured.wpm} wpm` : 'not measurable' },
    { key: 'audience', label: 'Audience', band: measured.hasConclusion && !signals.vague ? 'strong' : (measured.relevance ?? 0) >= 0.3 ? 'developing' : 'weak', evidence: windowUse !== null ? `used ${Math.round(windowUse * 100)}% of the allotted time; the ${audience.label.toLowerCase()} bias weights ${Object.keys(audience.weights).join(', ')}` : '—' },
  ].filter((d) => d.applies !== false);

  const applicable = dims;
  const weakest = applicable.slice().sort((a, b) => rank(a.band) - rank(b.band))[0] || null;
  const strongest = applicable.slice().sort((a, b) => rank(b.band) - rank(a.band))[0] || null;

  const KEY_MAP = { message: 'opening', structure: 'organisation', delivery: 'fillers', language: 'precision', story: 'specificity', persuasion: 'development', presence: 'pace', audience: 'conclusion' };
  return { dims: applicable, weakest, strongest, weaknessKey: weakest ? KEY_MAP[weakest.key] : null };
}

export function analyseSpeech(transcript, transcriptSource, durationMs, targetSeconds, prompt, type) {
  const result = analyseAttempt({ transcript, transcriptSource, durationMs, targetSeconds, prompt, category: type });
  return { measured: result.measured, signals: extractSignals(result.measured, transcript) };
}

export function saveSpeech({ type, seconds, audience, prompt, transcript, analysis, report, isChallenge, qaLog }) {
  const uid = getCurrentUser()?.id;
  const rec = insert('speeches', {
    user_id: uid,
    title: prompt.slice(0, 80),
    type, seconds, audience: audience.key,
    prompt, transcript: (transcript || '').slice(0, 8000),
    report: report.dims.map((d) => ({ key: d.key, band: d.band })),
    weakest: report.weakest?.label || null,
    weakness_key: report.weaknessKey,
    strongest: report.strongest?.label || null,
    is_challenge: !!isChallenge,
    month_key: isChallenge ? new Date().toISOString().slice(0, 7) : null,
    qa: (qaLog || []).map((q) => ({ q: q.question, a: (q.answer || '').slice(0, 500) })),
    created: new Date().toISOString(),
  });
  recordSpontaneousEvidence(analysis.measured, null, { excludeItemId: null, category: type });
  if (report.weaknessKey && report.weakest && report.weakest.band === 'weak') ensureItemForWeakness(report.weaknessKey);
  return rec;
}

/* ================= Before / after (spec 22) ================= */

export function compareToArchive(rec) {
  const prior = find('speeches', (s) => s.type === rec.type && s.id !== rec.id);
  if (!prior.length) return null;
  const prev = prior[prior.length - 1];
  const prevDims = Object.fromEntries((prev.report || []).map((d) => [d.key, d.band]));
  const curDims = Object.fromEntries((rec.report || []).map((d) => [d.key, d.band]));
  const improved = [], recurring = [], newlyWeak = [];
  Object.entries(curDims).forEach(([k, band]) => {
    const pb = prevDims[k];
    if (pb === undefined) return;
    if (rank(band) > rank(pb)) improved.push(k);
    else if (band === pb && band === 'weak') recurring.push(k);
    else if (rank(band) < rank(pb)) newlyWeak.push(k);
  });
  return { prev, improved, recurring, newlyWeak };
}

/* ================= Monthly challenge (spec 24) ================= */

export function monthlyChallenge() {
  const uid = getCurrentUser()?.id;
  const monthKey = new Date().toISOString().slice(0, 7);
  const existing = find('speeches', (s) => s.user_id === uid && s.is_challenge && s.month_key === monthKey);
  const done = existing.length > 0;
  const lv = communicationLevel(getProfile()?.skill_scores || {});
  const n = typeof lv === 'number' ? lv : (typeof lv?.score === 'number' ? lv.score : 37);
  const base = [
    { type: 'keynote', seconds: 300, label: 'A five-minute keynote.' },
    { type: 'persuasive', seconds: 600, label: 'A ten-minute persuasive presentation.' },
    { type: 'qa', seconds: 600, label: 'A ten-minute keynote, then Q&A from the room.' },
    { type: 'interview', seconds: 600, label: 'A high-pressure podcast interview.' },
  ];
  const monthN = Math.max(1, Math.min(12, Number(monthKey.slice(5, 7))));
  const scale = n >= 70 ? 1 : 0.6;
  const c = base[(monthN - 1) % base.length];
  return {
    monthKey, done,
    type: c.type,
    seconds: Math.round(c.seconds * (n >= 70 ? 1 : scale)),
    label: c.label + (n < 70 ? ' (scaled to your current level — it grows as you do.)' : ''),
  };
}

/* ================= Environment trends (spec 27) ================= */

export function environmentTrends() {
  const runs = find('pressureRuns', () => true).slice(-6);
  const speeches = find('speeches', () => true).slice(-6);
  const line = (recs, label) => {
    if (!recs.length) return null;
    const failedLast = recs[recs.length - 1].biggest ? 1 : 0;
    const failRate = recs.filter((r) => r.biggest).length / recs.length;
    const trend = failRate < 0.5 ? 'improving' : 'steady';
    return `${label}: ${recs.length} run(s), ${trend}${failedLast ? ' — last run found a weakness' : ' — last run clean'}`;
  };
  const t = [];
  const p = line(runs, 'Pressure'); if (p) t.push(p);
  const s = line(speeches, 'Speeches'); if (s) t.push(s);
  return t;
}
