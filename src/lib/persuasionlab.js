/*
 * ORATOR Persuasion Lab engine.
 * Convince without manipulating: claim, reason, evidence, objection, landing.
 */

import { extractSignals } from './simulator.js';
import { insert, getCurrentUser } from './store.js';
import { recordSpontaneousEvidence } from './memory-integration.js';

export const PERSUASION_AUDIENCES = [
  { key: 'skeptic-owner', label: 'A skeptical business owner', hint: 'They have heard a hundred pitches this year.', conciseLimit: null },
  { key: 'students', label: 'A group of university students', hint: 'Smart, and allergic to corporate tone.', conciseLimit: null },
  { key: 'executive', label: 'An executive with two minutes', hint: 'Bottom line first or not at all.', conciseLimit: 130 },
  { key: 'friend', label: 'A good friend who disagrees', hint: 'Respect matters more than winning.', conciseLimit: null },
  { key: 'expert', label: 'A technical expert in your field', hint: 'Imprecision gets noticed instantly.', conciseLimit: null },
];

export const POSITIONS = [
  'Businesses should invest more in customer retention than acquisition.',
  'Reading books is still valuable in the age of short video.',
  'Failure can be genuinely useful.',
  'People should protect their attention from their phones.',
  'Public speaking should be taught in every school.',
];

/* Argument scaffold that fades (spec 25). */
export function scaffoldFor(stage) {
  if (stage === 0) return ['CLAIM — your position in one sentence', 'WHY — the main reason', 'EVIDENCE — what supports it', 'EXAMPLE — a specific instance', 'COUNTERARGUMENT — the strongest objection, stated fairly', 'RESPONSE — your answer to it', 'CONCLUSION — land it in one line'];
  if (stage === 1) return ['CLAIM', 'WHY', 'EVIDENCE', 'EXAMPLE', '— handle whatever objection comes at you —', 'CONCLUSION'];
  return ['— Just the position. You build everything yourself. —'];
}

/* Dynamic objections tied to what the user actually said (spec 26). */
export function objectionFor(topic, signals, round) {
  const pool = [
    `Why? The opposite seems more important to most people.`,
    (signals?.topic ? `You said "${signals.topic}" matters. What does that cost, and who pays for it?` : 'What does that cost, and who pays for it?'),
    'I have seen this exact thing fail before. Why is your version different?',
    'You are assuming everyone agrees with your premise. Do they?',
    'If this were true, everyone would already be doing it. Why are they not?',
  ];
  return pool[Math.min(round, pool.length - 1)];
}

/* Steelman training (spec 29). */
export function steelmanExercise(position) {
  return [
    { label: 'Steelman', prompt: `What is the strongest argument AGAINST: "${position}"? State it fairly, at full strength.` },
    { label: 'Respond', prompt: 'Now respond to that strongest objection directly. Address its actual point.' },
  ];
}

/* Time-pressure chain (spec 27). */
export const TIME_CHAIN = [60, 30, 15];

const MANIPULATION_MARKERS = /\b(you have to|everyone knows|only an idiot|trust me|or else|you'?d be stupid|obviously everyone)\b/i;

export function analysePersuasion(measured, transcript, audience) {
  const signals = extractSignals(measured, transcript);
  const claim = signals.claim || /\b(should|must|need to|my position|the case)\b/i.test(transcript);
  const evidence = measured.exampleHits >= 1 || /\b(for example|data|research|study|numbers|percent|per cent|%|\d)\b/i.test(transcript);
  const counterAddressed = /\b(you might (say|think)|the objection|some would argue|fair point|but critics|of course, some)\b/i.test(transcript);
  const manipulative = MANIPULATION_MARKERS.test(transcript);
  const words = transcript.split(/\s+/).length;
  const conciseEnough = audience?.conciseLimit ? words <= audience.conciseLimit : true;

  const dims = [
    { key: 'reasoning', label: 'Reasoning', ok: measured.structureHits >= 1, evidence: `${measured.structureHits} structure marker(s)` },
    { key: 'clarity', label: 'Clarity', ok: (measured.vagueRate ?? 9) < 2.5, evidence: measured.vagueRate !== null ? `${measured.vagueRate} vague words per 100` : 'not measurable' },
    { key: 'evidence', label: 'Evidence', ok: evidence, evidence: evidence ? 'support was visible' : 'assertion without support' },
    { key: 'counter', label: 'Addressed the other side', ok: counterAddressed, evidence: counterAddressed ? 'acknowledged the objection' : 'never touched the opposing case' },
    { key: 'conclusion', label: 'Landed the conclusion', ok: !!measured.hasConclusion, evidence: measured.hasConclusion ? 'closed cleanly' : 'ended without a landing' },
    { key: 'ethics', label: 'Persuaded without pressure', ok: !manipulative, evidence: manipulative ? 'pressure phrases detected — that is coercion, not persuasion' : 'clean of pressure tactics' },
    { key: 'adaptation', label: 'Adapted to the audience', ok: conciseEnough, evidence: audience?.conciseLimit ? `${words} words (limit ~${audience.conciseLimit} for ${audience.label})` : `${words} words` },
  ];
  const ORDER = ['reasoning', 'clarity', 'evidence', 'counter', 'conclusion', 'adaptation', 'ethics'];
  const biggest = dims.filter((d) => !d.ok && d.evidence !== 'not measurable').sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))[0] || null;

  return { dims, biggest, signals, manipulative };
}

export function savePersuasionAttempt({ position, audience, stage, analysis, transcript, measured }) {
  const uid = getCurrentUser()?.id;
  const rec = insert('persuasionAttempts', {
    user_id: uid,
    position, audience: audience?.key || 'unknown', stage,
    dims: analysis.dims.map((d) => ({ key: d.key, ok: d.ok })),
    biggest: analysis.biggest?.key || null,
    biggest_label: analysis.biggest?.label || null,
    manipulative: analysis.manipulative,
    transcript: (transcript || '').slice(0, 3000),
    created: new Date().toISOString(),
  });
  if (measured) recordSpontaneousEvidence(measured, null, { excludeItemId: null, category: 'persuasion' });
  return rec;
}

/* Retry with a different audience/scenario (spec 32). */
export function retryAudience(currentKey) {
  const others = PERSUASION_AUDIENCES.filter((a) => a.key !== currentKey);
  return others[Math.floor(Math.random() * others.length)];
}
