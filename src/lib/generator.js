/*
 * ORATOR training engine.
 * Picks today's exercise from history, recurring weaknesses and difficulty —
 * never randomly. The same weakness recurring raises its training priority.
 */

import { EXERCISES, CATEGORIES_META, BASELINE_CHALLENGES } from './exercises.js';
import { completedAttempts, weaknessPatternsSorted, getProfile } from './store.js';

const WEAKNESS_TO_CATEGORY = {
  organisation: 'organisation',
  fillers: 'fillers',
  pace: 'pace',
  precision: 'precision',
  opening: 'concise',
  conclusion: 'concise',
  repetition: 'concise',
  sentenceConstruction: 'precision',
  specificity: 'story',
  verbosity: 'concise',
  development: 'organisation',
  relevance: 'opinion',
  vocalDelivery: 'pace',
};

function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const tierForDifficulty = { foundation: 1, developing: 2, advanced: 3, elite: 4 };

/*
 * Today's training: deterministic for the day, driven by weakness patterns,
 * profile weak areas and recent exercise history.
 */
export function todaysExercise() {
  const profile = getProfile();
  const patterns = weaknessPatternsSorted();
  const attempts = completedAttempts();

  const difficulty = profile?.difficulty || 'developing';
  const targetTier = tierForDifficulty[difficulty] || 2;

  // Weight categories: recurring weaknesses first, then self-declared weak areas.
  const weights = {};
  Object.keys(CATEGORIES_META).forEach((c) => { weights[c] = 1; });
  patterns.forEach((p) => {
    const cat = WEAKNESS_TO_CATEGORY[p.weakness_key];
    if (cat) weights[cat] = (weights[cat] || 1) + Math.min(8, p.times_observed) * 1.5;
  });
  (profile?.weakAreas || []).forEach((a) => {
    const cat = WEAKNESS_TO_CATEGORY[a] || a;
    if (weights[cat]) weights[cat] = (weights[cat] || 1) + 2.5;
  });

  // Never repeat the last five exercises.
  const recentIds = new Set(attempts.slice(-5).map((a) => a.exercise_id));

  const todayISO = new Date().toISOString().slice(0, 10);
  const rng = seededRandom(`${todayISO}:${profile?.id || 'anon'}`);

  // Build a weighted pool of candidates at or one tier around the difficulty.
  const pool = [];
  EXERCISES.forEach((ex) => {
    if (recentIds.has(ex.id)) return;
    const dist = Math.abs(ex.tier - targetTier);
    if (dist > 1) return;
    const w = (weights[ex.category] || 1) * (1 + rng() * 0.5) * (1 - dist * 0.25);
    pool.push({ ex, w: Math.max(0.15, w) });
  });

  if (!pool.length) {
    return EXERCISES[0];
  }
  // Weighted pick, deterministic per day.
  let roll = rng() * pool.reduce((a, p) => a + p.w, 0);
  pool.sort((a, b) => a.ex.id.localeCompare(b.ex.id));
  for (const item of pool) {
    roll -= item.w;
    if (roll <= 0) return item.ex;
  }
  return pool[pool.length - 1].ex;
}

/* A focused category drill for the PRACTISE action. */
export function practiseExercise(categoryKey) {
  const profile = getProfile();
  const targetTier = tierForDifficulty[profile?.difficulty || 'developing'];
  const recentIds = new Set(completedAttempts().slice(-8).map((a) => a.exercise_id));
  const pool = EXERCISES.filter((e) => e.category === categoryKey && Math.abs(e.tier - targetTier) <= 1 && !recentIds.has(e.id));
  const fallback = EXERCISES.filter((e) => e.category === categoryKey);
  const list = pool.length ? pool : fallback;
  return list[Math.floor(Math.random() * list.length) % list.length];
}

export { BASELINE_CHALLENGES, CATEGORIES_META };
