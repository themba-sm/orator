/*
 * ORATOR skill model — 16 tracked skills.
 * Scores are training indicators derived from measured evidence, never
 * presented as scientific measurements. Skills without evidence stay null.
 */

export const SKILLS = [
  { key: 'articulation', label: 'Articulation', category: 'Delivery', hint: 'Consonant clarity, word endings, natural-speed precision' },
  { key: 'clarity', label: 'Clarity', category: 'Core', hint: 'Direct openings, closed conclusions, comprehensibility' },
  { key: 'fluency', label: 'Fluency', category: 'Core', hint: 'Smooth delivery with minimal filler' },
  { key: 'vocabulary', label: 'Vocabulary', category: 'Language', hint: 'Range of working vocabulary under pressure' },
  { key: 'wordPrecision', label: 'Word precision', category: 'Language', hint: 'Exact words instead of vague ones' },
  { key: 'sentenceConstruction', label: 'Sentence construction', category: 'Language', hint: 'Sentences the listener can follow' },
  { key: 'thoughtOrganisation', label: 'Thought organisation', category: 'Structure', hint: 'Visible path: point, reason, example, close' },
  { key: 'responseSpeed', label: 'Response speed', category: 'Structure', hint: 'Reaching the answer quickly and staying on it' },
  { key: 'storytelling', label: 'Storytelling', category: 'Presence', hint: 'Concrete stories that carry the point' },
  { key: 'persuasion', label: 'Persuasion', category: 'Presence', hint: 'Position, reason, ask' },
  { key: 'conciseness', label: 'Conciseness', category: 'Core', hint: 'Point-to-distance ratio' },
  { key: 'conversationalAgility', label: 'Conversational agility', category: 'Pressure', hint: 'Handling turns and unexpected angles' },
  { key: 'confidence', label: 'Confidence / presence', category: 'Presence', hint: 'Steady, committed delivery' },
  { key: 'vocalDelivery', label: 'Vocal delivery', category: 'Delivery', hint: 'Pace, pausing, contrast, energy' },
  { key: 'explaining', label: 'Explaining ideas', category: 'Structure', hint: 'Complicated things made simple' },
  { key: 'underPressure', label: 'Speaking under pressure', category: 'Pressure', hint: 'Performance with little preparation' },
];

export const CATEGORIES = ['Core', 'Structure', 'Language', 'Delivery', 'Presence', 'Pressure'];

/* Baseline scores from an aggregate of the baseline assessment. */
export function initialSkillScores(attemptAnalyses) {
  const scores = {};
  SKILLS.forEach((s) => { scores[s.key] = null; });
  if (!attemptAnalyses.length) return scores;

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  attemptAnalyses.forEach(({ measured, audio }) => {
    const m = measured;
    if (m.fillerRate !== null) scores.fluency = (scores.fluency ?? 50) - Math.min(25, m.fillerRate * 4);
    if (m.wpm) scores.clarity = (scores.clarity ?? 50) + (m.wpm >= 120 && m.wpm <= 165 ? 8 : m.wpm > 175 ? -10 : -4);
    if (m.openingDirectness !== null) scores.clarity = (scores.clarity ?? 50) + (m.openingDirectness > 0.5 ? 8 : m.openingDirectness < 0.3 ? -8 : 0);
    if (m.structureHits >= 2) scores.thoughtOrganisation = (scores.thoughtOrganisation ?? 50) + 8;
    if (m.wordCount >= 40 && m.structureHits === 0) scores.thoughtOrganisation = (scores.thoughtOrganisation ?? 50) - 10;
    if (m.vagueRate !== null) scores.wordPrecision = (scores.wordPrecision ?? 50) - Math.min(20, m.vagueRate * 3);
    if (m.exampleHits >= 1) scores.storytelling = (scores.storytelling ?? 50) + 8;
    if (m.relevance !== null) scores.responseSpeed = (scores.responseSpeed ?? 50) + (m.relevance > 0.5 ? 8 : m.relevance < 0.2 ? -10 : 0);
    if (m.avgSentenceLen) scores.sentenceConstruction = (scores.sentenceConstruction ?? 50) + (m.avgSentenceLen <= 20 ? 8 : m.avgSentenceLen >= 26 ? -10 : 0);
    if (audio && audio.measured && audio.spokeEnough) {
      scores.vocalDelivery = (scores.vocalDelivery ?? 50) + (audio.loudnessVariation >= 0.35 ? 8 : -8);
      scores.articulation = scores.articulation ?? 50; // pace steadiness contributes until phonetics are measurable
    }
    if (m.hasConclusion) scores.clarity = (scores.clarity ?? 50) + 4;
    if (m.durationSeconds && m.targetSeconds && m.durationSeconds <= m.targetSeconds * 1.2) scores.conciseness = (scores.conciseness ?? 50) + 5;
    else if (m.durationSeconds && m.targetSeconds) scores.conciseness = (scores.conciseness ?? 50) - 5;
  });

  // normalise to 5-95
  Object.keys(scores).forEach((k) => {
    if (scores[k] !== null) scores[k] = Math.round(Math.max(5, Math.min(95, scores[k])));
  });
  return scores;
}

/* Update skills after one attempt — small evidence-based deltas. */
export function applyAttemptToSkills(scores, analysis, { improved = false } = {}) {
  const m = analysis.measured;
  const out = { ...scores };
  const move = (key, d) => { if (out[key] === null || out[key] === undefined) out[key] = 50; out[key] = Math.max(5, Math.min(95, Math.round(out[key] + d))); };
  const dir = improved ? 1 : -1;
  if (m.fillerRate !== null) move('fluency', (m.fillerRate > 3 ? -3 : m.fillerRate < 1.5 ? 3 : 0) * deltaCheck(improved));
  if (m.wpm && (m.wpm > 175 || m.wpm < 100)) move('clarity', -2); else if (m.wpm) move('clarity', 2);
  if (m.openingDirectness !== null) move('clarity', m.openingDirectness > 0.5 ? 2 : m.openingDirectness < 0.3 ? -2 : 0);
  if (m.wordCount >= 40) move('thoughtOrganisation', m.structureHits >= 2 ? 3 : m.structureHits === 0 ? -3 : 0);
  if (m.vagueRate !== null) move('wordPrecision', m.vagueRate >= 2.5 ? -3 : m.vagueRate < 1 ? 2 : 0);
  if (m.exampleHits >= 1) move('storytelling', 2);
  if (m.relevance !== null) move('responseSpeed', m.relevance > 0.5 ? 2 : m.relevance < 0.25 ? -2 : 0);
  if (m.avgSentenceLen) move('sentenceConstruction', m.avgSentenceLen >= 26 ? -2 : m.avgSentenceLen <= 18 ? 2 : 0);
  if (analysis.audio && analysis.audio.measured && analysis.audio.spokeEnough) {
    move('vocalDelivery', analysis.audio.loudnessVariation >= 0.35 ? 2 : -2);
  }
  if (m.targetSeconds && m.durationSeconds) move('conciseness', m.durationSeconds <= m.targetSeconds * 1.15 ? 1 : -2);
  return out;
}

function deltaCheck(improved) { return improved ? 1.2 : 1; }

/* Current level: a training indicator, not a scientific score. */
export function communicationLevel(scores) {
  const values = Object.values(scores).filter((v) => v !== null && v !== undefined);
  if (!values.length) return { level: 'UNMEASURED', score: null };
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  let level = 'FOUNDATION';
  if (avg >= 45) level = 'DEVELOPING';
  if (avg >= 60) level = 'ADVANCED';
  if (avg >= 75) level = 'ELITE';
  return { level, score: avg };
}

export function strongestSkill(scores) {
  let best = null;
  SKILLS.forEach((s) => { if (scores[s.key] !== null && (!best || scores[s.key] > scores[best.key])) best = s; });
  return best;
}

export function weakestSkill(scores) {
  let worst = null;
  SKILLS.forEach((s) => { if (scores[s.key] !== null && (!worst || scores[s.key] < scores[worst.key])) worst = s; });
  return worst;
}
