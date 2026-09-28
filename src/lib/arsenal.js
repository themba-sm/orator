/*
 * Cross-system arsenal: scoreboard (spec 38), personal communication
 * signature (spec 34), and the intelligent daily mixed session (spec 36).
 */

import { find, getCurrentUser, weaknessPatternsSorted } from './store.js';
import { allWords, vocabularyProfile } from './vocablab.js';
import { storyBank } from './storylab.js';
import { POSITIONS } from './persuasionlab.js';

/* ================= Scoreboard (spec 38) — trends + evidence, never one number ================= */

function rate(ok, total) { return total ? `${Math.round((ok / total) * 100)}%` : 'no evidence yet'; }

export function scoreboard() {
  const uid = getCurrentUser()?.id;
  const prof = vocabularyProfile();
  const vocabAttempts = find('vocabularyAttempts', (a) => a.user_id === uid);
  const vocabApps = find('vocabularyApplications', (a) => a.user_id === uid);
  const stories = find('stories', (s) => s.user_id === uid);
  const storyRuns = find('storyAttempts', (s) => s.user_id === uid);
  const persuasion = find('persuasionAttempts', (p) => p.user_id === uid);

  const vocabRows = [
    { label: 'Vocabulary precision', value: prof.learned ? `${prof.learned} words in memory, ${prof.usedNaturally} used naturally, ${prof.forced} forced` : 'no words learned yet' },
    { label: 'Vocabulary recall', value: (prof.recallSuccess + prof.recallFail) ? rate(prof.recallSuccess, prof.recallSuccess + prof.recallFail) : 'no reviews yet' },
    { label: 'Natural vocabulary usage', value: vocabApps.length ? rate(vocabApps.filter((a) => a.natural).length, vocabApps.length) : 'no usage evidence yet' },
  ];

  const storyOk = (k) => storyRuns.filter((r) => (r.elements || []).includes(k)).length;
  const storyRows = [
    { label: 'Story structure', value: storyRuns.length ? `${storyOk('turning')} of ${storyRuns.length} stories reached a turning point` : 'no stories analysed yet' },
    { label: 'Story detail', value: storyRuns.length ? `${storyRuns.filter((r) => r.detail_score > 0).length} of ${storyRuns.length} showed experience rather than labels` : 'no stories analysed yet' },
    { label: 'Story pacing', value: storyRuns.length ? `${storyRuns.filter((r) => r.climax_position !== null).length} of ${storyRuns.length} had a clear climax` : 'no stories analysed yet' },
    { label: 'Story bank', value: `${stories.length} saved` },
  ];

  const pOk = (k) => persuasion.filter((p) => (p.dims || []).some((d) => d.key === k && d.ok)).length;
  const persuasionRows = [
    { label: 'Persuasive reasoning', value: persuasion.length ? rate(pOk('reasoning'), persuasion.length) : 'no attempts yet' },
    { label: 'Audience adaptation', value: persuasion.length ? rate(pOk('adaptation'), persuasion.length) : 'no attempts yet' },
    { label: 'Objection handling', value: persuasion.length ? rate(pOk('counter'), persuasion.length) : 'no attempts yet' },
    { label: 'Persuasive clarity', value: persuasion.length ? rate(pOk('clarity'), persuasion.length) : 'no attempts yet' },
    { label: 'Persuasive delivery', value: persuasion.length ? rate(pOk('conclusion'), persuasion.length) : 'no attempts yet' },
  ];

  return { vocab: vocabRows, story: storyRows, persuasion: persuasionRows, attempts: vocabAttempts.length, storyRuns: storyRuns.length, persuasionRuns: persuasion.length };
}

/* ================= Communication signature (spec 34) — evidence only ================= */

export function communicationSignature() {
  const uid = getCurrentUser()?.id;
  const speeches = find('speeches', (s) => s.user_id === uid);
  const turns = find('conversationTurns', (t) => t.speaker === 'user').map((t) => t.text || '');
  const attempts = [...find('exerciseAttempts', (a) => a.user_id === uid).map((a) => a.transcript || a.measured?.transcript || ''), ...find('speechAttempts', (a) => a.user_id === uid).map((a) => a.transcript || '')];
  const corpus = [...speeches.map((s) => s.transcript || ''), ...turns, ...attempts].filter((t) => t && t.trim().length > 10);
  const total = corpus.length;
  if (total < 3) return null; // not enough evidence to describe anyone

  const joined = corpus.join(' ');
  const words = joined.split(/\s+/).length;
  const sentences = joined.split(/[.!?]+/).filter((s) => s.trim().length > 2).length;
  if (sentences < 5) return null; // sentence-level claims need real sentences
  const avgSentence = Math.round(words / Math.max(1, sentences));

  const freq = {};
  corpus.join(' ').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).forEach((w) => {
    if (w.length > 3) freq[w] = (freq[w] || 0) + 1;
  });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);

  const storyRate = corpus.filter((t) => /\b(when i|so there was|one time|it started when)\b/i.test(t)).length / total;
  const claimRate = corpus.filter((t) => /\b(i think|i believe|my position|it is better|should)\b/i.test(t)).length / total;

  const traits = [];
  if (avgSentence > 24) traits.push(`Builds long sentences (average ${avgSentence} words) — dense, and listeners can lose the thread.`);
  if (avgSentence > 0 && avgSentence <= 14) traits.push(`Speaks in short sentences (average ${avgSentence} words) — punchy, watch that ideas stay complete.`);
  if (storyRate > 0.3) traits.push('Reaches for stories naturally in conversation.');
  if (storyRate < 0.08) traits.push('Rarely tells stories unprompted — most answers stay abstract.');
  if (claimRate > 0.4) traits.push('Comfortable taking positions, not just describing.');
  if (claimRate < 0.15) traits.push('Rarely states a clear position — tends to describe rather than argue.');
  if (top.length) traits.push(`Most-used substantial words: ${top.join(', ')}.`);

  return { traits, evidence: `Based on ${total} recorded performances.` };
}

/* ================= Daily mixed session (spec 36) — weakness-driven ================= */

export function mixedSessionPlan() {
  const patterns = weaknessPatternsSorted();
  const prof = vocabularyProfile();
  const uid = getCurrentUser()?.id;
  const dueVocab = find('memoryItems', (m) => m.user_id === uid && m.kind === 'vocabulary' && m.struggling !== false ? m.kind === 'vocabulary' : false)
    .filter((m) => m.struggling || m.recall_success === 0);

  const plan = [];

  // 1. vocabulary step: retrieve a due word, or learn a new one
  if (prof.learned > 0 && (dueVocab.length || Math.random() < 0.5)) {
    const w = dueVocab.length ? dueVocab[Math.floor(Math.random() * dueVocab.length)] : null;
    plan.push({ kind: 'vocab', label: w ? `Retrieve: "${w.vocab.word}"` : 'Vocabulary retrieval', meta: w ? w.vocab : null });
  } else {
    plan.push({ kind: 'vocab-new', label: 'Learn one precise word' });
  }

  // 2-3. weakness-driven core: story or persuasion first
  const weak = new Set(patterns.slice(0, 2).map((p) => p.weakness_key));
  if (weak.has('specificity') || weak.has('development') || Math.random() < 0.5) {
    plan.push({ kind: 'story', label: 'A two-minute personal story' });
  } else {
    plan.push({ kind: 'persuasion', label: 'A sixty-second persuasion challenge' });
  }
  if (weak.has('organisation') || weak.has('conclusion')) {
    plan.push({ kind: 'persuasion', label: 'Defend a position against one objection' });
  } else {
    plan.push({ kind: 'story-compress', label: 'Compress your story to twenty seconds' });
  }

  return plan;
}
