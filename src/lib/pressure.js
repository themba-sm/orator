/*
 * ORATOR Pressure Room engine.
 * CALM BRAIN → CLEAR THINKING → PRECISE WORDS → CONTROLLED DELIVERY.
 * Six modes, eight pressure levels, paired retry prompts, recovery and
 * honest-uncertainty training, pressure-specific feedback.
 */

import { analyseAttempt } from './analysis.js';
import { extractSignals, RAPID_CHAINS } from './simulator.js';
import { find, insert, getCurrentUser, getProfile, weaknessPatternsSorted } from './store.js';
import { ensureItemForWeakness, recordApplication, recordSpontaneousEvidence } from './memory-integration.js';

/* ================= Modes (spec 1) ================= */

export const PRESSURE_MODES = [
  { key: 'spot', label: 'Put me on the spot', hint: 'One unexpected prompt. Short fuse. Speak.' },
  { key: 'rapid', label: 'Rapid fire', hint: 'Consecutive questions, shrinking gaps.' },
  { key: 'interrupt', label: 'Interrupt me', hint: 'Deliberate interruptions. Recover without panic.' },
  { key: 'challenge', label: 'Challenge me', hint: 'Your claims get pushed back on.' },
  { key: 'noprep', label: 'No preparation', hint: 'Prompt. Then speak. Immediately.' },
  { key: 'time', label: 'Limited time', hint: '60 → 30 → 15 → 10 → 5 seconds.' },
];

/* ================= Levels (spec 3) ================= */

export const PRESSURE_LEVELS = [
  null,
  { n: 1, key: 'COMPOSED', prep: 60, speak: 60, tiers: [1], interruptP: 0, followUps: 0, skeptic: 0 },
  { n: 2, key: 'QUICK', prep: 30, speak: 60, tiers: [1, 2], interruptP: 0, followUps: 0, skeptic: 0 },
  { n: 3, key: 'UNEXPECTED', prep: 10, speak: 60, tiers: [2, 3], interruptP: 0, followUps: 0, skeptic: 0.2 },
  { n: 4, key: 'CHALLENGED', prep: 10, speak: 60, tiers: [2, 3], interruptP: 0, followUps: 1, skeptic: 0.6 },
  { n: 5, key: 'INTERRUPTED', prep: 10, speak: 60, tiers: [2, 3], interruptP: 0.85, followUps: 0, skeptic: 0.3 },
  { n: 6, key: 'RAPID', prep: 3, speak: 25, tiers: [2, 3, 4], interruptP: 0.1, followUps: 1, skeptic: 0.4 },
  { n: 7, key: 'HIGH PRESSURE', prep: 5, speak: 45, tiers: [3, 4], interruptP: 0.6, followUps: 1, skeptic: 0.8 },
  { n: 8, key: 'EXECUTIVE PRESSURE', prep: 5, speak: 30, tiers: [3, 4], interruptP: 0.75, followUps: 1, skeptic: 1 },
];

/* ================= Prompt bank — every prompt has a paired variant (spec 7) ================= */

const PROMPTS = [
  { id: 'sec-free', tier: 2, text: 'Should people prioritise financial security or personal freedom?', pair: 'Would you rather have guaranteed financial stability or complete career freedom? Explain your choice.' },
  { id: 'procrast', tier: 1, text: 'Explain why people procrastinate.', pair: 'Explain why people find it hard to start important things and easy to start unimportant ones.', expects: 'knowledge' },
  { id: 'lesson', tier: 1, text: 'Describe a lesson you have learned the hard way.', pair: 'Tell me about a mistake you would make again if you had to, and what it taught you.' },
  { id: 'book', tier: 2, text: 'Convince me to read a book — any book — in the next thirty days.', pair: 'Convince me to give up one hour of scrolling every day for a month.' },
  { id: 'explain-well', tier: 2, text: 'Explain something you understand extremely well. Simply.', pair: 'Explain something complicated you do every day, so a ten-year-old could repeat it.' },
  { id: 'online', tier: 3, text: 'Argue that businesses should invest more in their online presence.', pair: 'Argue that a small business should spend money on its website before it spends money on advertising.' },
  { id: 'speaking-schools', tier: 3, text: 'Convince an audience that public speaking should be taught in schools.', pair: 'Convince a principal that one hour a week of speaking training would change their school.' },
  { id: 'disagree-fair', tier: 3, text: 'Defend an unpopular but reasonable position you actually hold.', pair: 'Name something most people believe that you think is wrong, and defend your view.' },
  { id: 'risk', tier: 4, text: 'Is it better to be respected or liked? Decide and defend it under time pressure.', pair: 'A colleague says being liked is a career strategy. Rebuke or endorse that in one minute.' },
  { id: 'unknown1', tier: 4, text: 'Explain how a country should decide when to cancel public debt.', pair: 'A CEO asks you to explain quantum tunnelling to the board in sixty seconds. Go.', expects: 'uncertainty' },
  { id: 'unknown2', tier: 4, text: 'Explain the exact mechanism your government uses to set interest rates.', pair: 'Explain precisely how a vaccine mRNA sequence is chosen, to an expert audience.', expects: 'uncertainty' },
  { id: 'hire', tier: 4, text: 'You have thirty seconds to tell a hiring panel why they should take a risk on you.', pair: 'A investor offers funding but asks: why you? Twenty seconds.' },
];

const INTERRUPT_LINES = [
  'Stop. What is your main point?',
  'Give me the short version.',
  'I do not understand. Explain that differently.',
  'I am not convinced.',
  'Give me an example.',
  'You lost your point. Recover.',
  'Fifteen seconds left. Land it.',
];

const CHALLENGE_LINES = [
  'Why? Plenty of people would say the opposite.',
  'That is a claim. What is the reason underneath it?',
  'I have heard that before. What makes your version true?',
  'Give me the strongest piece of evidence you have.',
  'And if you are wrong? What does that cost?',
];

const RECOVERY_TECHNIQUES = [
  'Pause. Silence is allowed. It reads as thought, not weakness.',
  'Restate the point in one clean sentence, then continue.',
  'Simplify: drop the detail, keep the direction.',
  'Summarise where you are and move forward: "So the point so far is…"',
  'Say what you do know. Say plainly what you do not. Keep going.',
];

/* ================= Run construction ================= */

export function buildPressureRun(modeKey, levelN) {
  const level = PRESSURE_LEVELS[levelN] || PRESSURE_LEVELS[3];
  const profile = getProfile();
  const patterns = weaknessPatternsSorted();
  // weakness personalisation (spec 26): conciseness → shorter windows; storytelling → story-ish prompts
  const weak = new Set(patterns.slice(0, 2).map((p) => p.weakness_key));
  let tierPool = PROMPTS.filter((p) => level.tiers.includes(p.tier));
  if (weak.has('verbosity')) tierPool = tierPool; // shorter windows handled by level
  const prevIds = find('pressureRuns', () => true).slice(-3).map((r) => r.prompt_id);
  const fresh = tierPool.filter((p) => !prevIds.includes(p.id));
  const prompt = (fresh.length ? fresh : tierPool)[Math.floor(Math.random() * (fresh.length ? fresh.length : tierPool.length))];

  let speakSeconds = level.speak;
  if (modeKey === 'time') speakSeconds = [60, 30, 15, 10, 5][Math.min(4, find('pressureRuns', (r) => r.mode === 'time').length % 5)];
  if (modeKey === 'rapid') speakSeconds = 25;

  return {
    id: null,
    mode: modeKey,
    level,
    prompt,
    prepSeconds: modeKey === 'noprep' || modeKey === 'rapid' ? 0 : level.prep,
    speakSeconds,
    interruptAt: modeKey === 'interrupt' ? 0.35 + Math.random() * 0.3 : null,
    willInterrupt: modeKey === 'interrupt' || Math.random() < level.interruptP * 0.5,
    challengeRounds: modeKey === 'challenge' ? 2 : level.followUps,
    rapidChain: modeKey === 'rapid' ? (RAPID_CHAINS[levelN >= 7 ? 'advanced' : levelN >= 4 ? 'developing' : 'foundation'].slice(0, 4)) : null,
  };
}

export function interruptLine() { return INTERRUPT_LINES[Math.floor(Math.random() * INTERRUPT_LINES.length)]; }
export function challengeLine(signals) {
  const t = CHALLENGE_LINES[Math.floor(Math.random() * CHALLENGE_LINES.length)];
  return signals && signals.topic ? t : t;
}
export function retryPrompt(run) {
  return run.prompt.pair;
}

/* ================= Analysis (spec 6) ================= */

export function analysePressure(run, captures, aiLine) {
  const transcript = captures.map((c) => c.transcript || '').join(' ');
  const durationMs = captures.reduce((a, c) => a + (c.durationMs || 0), 0);
  const measured = analyseAttempt({
    transcript,
    transcriptSource: captures[0]?.transcriptSource || 'speech-api',
    durationMs,
    targetSeconds: run.speakSeconds,
    prompt: run.prompt.text,
    category: 'pressure',
  }).measured;
  const signals = extractSignals(measured, transcript);

  const usedWindow = measured.targetSeconds ? +(measured.durationSeconds / measured.targetSeconds).toFixed(2) : null;
  const dims = [
    { key: 'composure', label: 'Composure', ok: (measured.fillerRate ?? 0) < 3, evidence: measured.fillerRate !== null ? `${measured.fillerRate} fillers per 100 words` : 'not measurable' },
    { key: 'clarity', label: 'Clarity', ok: (measured.vagueRate ?? 99) < 2, evidence: measured.vagueRate !== null ? `${measured.vagueRate} vague words per 100` : 'not measurable' },
    { key: 'structure', label: 'Structure under pressure', ok: measured.structureHits >= 1, evidence: `${measured.structureHits} structure marker${measured.structureHits === 1 ? '' : 's'} in the answer` },
    { key: 'conciseness', label: 'Conciseness', ok: usedWindow === null || usedWindow <= 1.2, evidence: usedWindow !== null ? `used ${(usedWindow * 100).toFixed(0)}% of the window` : '—' },
    { key: 'reasoning', label: 'Reasoning', ok: measured.exampleHits >= 1 || signals.claim, evidence: measured.exampleHits ? 'carried an example or evidence' : 'assertion without visible support' },
    { key: 'relevance', label: 'Stayed on target', ok: (measured.relevance ?? 1) >= 0.3, evidence: measured.relevance !== null ? `relevance ${(measured.relevance * 100).toFixed(0)}%` : 'not measurable' },
    { key: 'vocalControl', label: 'Vocal control', ok: measured.wpm === null || (measured.wpm >= 110 && measured.wpm <= 175), evidence: measured.wpm !== null ? `${measured.wpm} words per minute` : 'not measurable' },
  ];

  const ORDER = ['composure', 'structure', 'conciseness', 'clarity', 'relevance', 'reasoning', 'vocalControl'];
  const failed = dims.filter((d) => !d.ok && d.evidence !== 'not measurable' && d.evidence !== '—');
  let biggest = failed.slice().sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))[0] || null;

  // honest uncertainty check (spec 5): bluffing is a weakness, honesty is composure
  const honest = /\b(i don'?t know|do not know|not sure|not certain|i'?m not certain|uncertain|i would need|i would want|roughly|as i understand|how i would)\b/i.test(transcript);
  const bluffing = run.prompt.expects === 'uncertainty' && !honest && measured.vagueCount > 2;

  return {
    measured, signals, dims, biggest, usedWindow, honest, bluffing,
    recoveryHint: RECOVERY_TECHNIQUES[Math.floor(Math.random() * RECOVERY_TECHNIQUES.length)],
  };
}

/* WeaknessKey mapping for memory integration */
export function pressureWeaknessKey(analysis) {
  switch (analysis.biggest?.key) {
    case 'composure': return 'fillers';
    case 'clarity': return 'precision';
    case 'structure': return 'organisation';
    case 'conciseness': return 'verbosity';
    case 'reasoning': return 'specificity';
    case 'relevance': return 'relevance';
    case 'vocalControl': return 'pace';
    default: return null;
  }
}

/* Save + memory integration (spec 25) */
export function savePressureRun(run, analysis, captures) {
  const uid = getCurrentUser()?.id;
  const rec = insert('pressureRuns', {
    user_id: uid,
    mode: run.mode,
    level: run.level.n,
    prompt_id: run.prompt.id,
    prompt_text: run.prompt.text,
    interrupted: !!captures.interrupted,
    dims: analysis.dims.map((d) => ({ key: d.key, ok: d.ok, evidence: d.evidence })),
    biggest: analysis.biggest?.key || null,
    biggest_label: analysis.biggest?.label || null,
    honest: analysis.honest,
    transcript: captures.map((c) => c.transcript || '').join(' ').slice(0, 3000),
  });
  // silent automaticity testing of previously learned skills
  recordSpontaneousEvidence(analysis.measured, null, { excludeItemId: null, category: 'pressure' });
  const wk = pressureWeaknessKey(analysis);
  if (wk && analysis.biggest) ensureItemForWeakness(wk);
  return rec;
}

/* Suggested level from history */
export function suggestedLevel() {
  const runs = find('pressureRuns', () => true);
  if (runs.length < 3) return 3;
  const recent = runs.slice(-4);
  const wins = recent.filter((r) => !r.biggest).length;
  if (wins >= 3 && recent[recent.length - 1].level < 8) return Math.min(8, recent[recent.length - 1].level + 1);
  if (wins === 0) return Math.max(1, recent[recent.length - 1].level - 1);
  return recent[recent.length - 1].level;
}
