/*
 * Memory ↔ training integration.
 * - Error-based learning: each key weakness becomes (or links to) ONE Memory Item.
 * - Spontaneous evidence: normal training silently tests previously learned skills.
 * - Application evidence: retries with a constraint rate the targeted skill.
 */

import {
  find, first, insert, update, getCurrentUser, getProfile, linkWeaknessMemory,
  weaknessMemoryLinks, memorySnapshot,
} from './store.js';
import {
  PRINCIPLE_CATALOG, VOCAB_CATALOG, createMemoryItem, createVocabItem,
  evaluateSignature, recomputeAutomaticity, scheduleNext, dueItems,
} from './memory.js';

/* Find or create the user's Memory Item for a catalog entry. */
export function ensureItemForCatKey(catKey) {
  const user = getCurrentUser();
  if (!user) return null;
  let item = first('memoryItems', (m) => m.user_id === user.id && m.cat_key === catKey);
  if (!item) {
    const cat = PRINCIPLE_CATALOG.find((c) => c.cat_key === catKey)
      || VOCAB_CATALOG.find((v) => 'vocab-' + v.word === catKey);
    if (!cat) return null;
    item = cat.word
      ? insert('memoryItems', createVocabItem(user, cat))
      : insert('memoryItems', createMemoryItem(user, cat));
  }
  return item;
}

/* Error-based learning (specs 12-13): one weakness → one high-priority item. */
export function ensureItemForWeakness(weaknessKey) {
  const cat = PRINCIPLE_CATALOG.find((c) => (c.weakness || []).includes(weaknessKey));
  if (!cat) return null;
  const item = ensureItemForCatKey(cat.cat_key);
  if (item) linkWeaknessMemory(weaknessKey, item.id);
  return item;
}

/* Seed the first items after baseline: top observed weaknesses become items. */
export function seedFromWeaknessPatterns() {
  const links = [];
  const seen = new Set();
  find('weaknessPatterns', () => true)
    .sort((a, b) => (b.severity || 0) * (b.times_observed || 0) - (a.severity || 0) * (a.times_observed || 0))
    .slice(0, 3)
    .forEach((p) => {
      const item = ensureItemForWeakness(p.weakness_key);
      if (item && !seen.has(item.id)) { seen.add(item.id); links.push(item); }
    });
  return links;
}

/*
 * Vocabulary seeding (specs 14-15): deliberately sparse — never hundreds of words.
 * Two useful, precise words join memory at baseline; more join only when the
 * user's training shows a need for them.
 */
export function seedVocabulary(words) {
  const user = getCurrentUser();
  if (!user) return [];
  const picks = VOCAB_CATALOG.filter((v) => (words || ['concise', 'articulate']).includes(v.word));
  const made = [];
  picks.forEach((v) => {
    const key = 'vocab-' + v.word;
    if (!first('memoryItems', (m) => m.user_id === user.id && m.cat_key === key)) {
      made.push(insert('memoryItems', createVocabItem(user, v)));
    }
  });
  return made;
}

/* Evidence records ------------------------------------------------ */

/* Accept either a metrics object or a full analysis result. */
function normMeasured(measured) {
  return measured && measured.measured ? measured.measured : measured;
}

function evidenceLists(itemId) {
  const reviews = find('memoryReviews', (r) => r.item_id === itemId);
  const applications = find('memoryApplications', (a) => a.item_id === itemId);
  const spontaneous = applications.filter((a) => a.spontaneous);
  return { reviews, applications, spontaneous };
}

function refreshItem(itemId, extra) {
  const item = first('memoryItems', (m) => m.id === itemId);
  if (!item) return null;
  const { reviews, applications, spontaneous } = evidenceLists(itemId);
  const level = recomputeAutomaticity(item, { reviews, applications, spontaneous });
  const patch = { automaticity: level, ...extra };
  const updated = update('memoryItems', itemId, patch);
  // Upsert playbook entry
  const uid = getCurrentUser()?.id;
  const pb = first('playbookItems', (p) => p.user_id === uid && p.item_id === itemId);
  if (!pb) {
    insert('playbookItems', { user_id: uid, item_id: itemId, title: item.title, playbook: item.playbook, automaticity: level, category: item.category });
  } else {
    update('playbookItems', pb.id, { automaticity: level, title: item.title });
  }
  return updated;
}

/* Record a direct recall (typed) attempt. rating: good | hard | again (auto-derived). */
export function recordRecall(itemId, { transcript, expectedKeywords, context }) {
  const item = first('memoryItems', (m) => m.id === itemId);
  if (!item) return null;
  const lower = (transcript || '').toLowerCase();
  const hits = expectedKeywords.filter((k) => lower.includes(k.toLowerCase())).length;
  const coverage = expectedKeywords.length ? hits / expectedKeywords.length : 0;
  const rating = coverage >= 0.6 ? 'good' : coverage >= 0.3 ? 'hard' : 'again';
  const intervalDays = Math.max(0, Math.round((new Date() - new Date(item.date_learned)) / 86400000));
  insert('memoryReviews', {
    user_id: getCurrentUser()?.id,
    item_id: itemId,
    kind: 'recall',
    rating,
    coverage: +coverage.toFixed(2),
    interval_days: intervalDays,
    item_interval_days: item.review_interval || 0,
    date: new Date().toISOString(),
  });
  insert('skillRetrievalAttempts', {
    user_id: getCurrentUser()?.id,
    item_id: itemId,
    mode: 'direct-recall',
    rating,
    transcript: (transcript || '').slice(0, 600),
    date: new Date().toISOString(),
  });
  const sched = scheduleNext(item, rating);
  return refreshItem(itemId, {
    last_reviewed: new Date().toISOString(),
    recall_success: item.recall_success + (rating === 'good' ? 1 : 0),
    recall_fail: item.recall_fail + (rating === 'again' ? 1 : 0),
    struggling: rating === 'again',
    ...sched,
  });
}

/* Record an application (speaking) attempt. success from the item signature
   where measurable, otherwise from the explicit comparison verdict. */
export function recordApplication(itemId, { measured: measuredIn, audio, success, context, spontaneous = false, told = true, attemptId }) {
  const item = first('memoryItems', (m) => m.id === itemId);
  if (!item) return null;
  const measured = normMeasured(measuredIn);
  let ok = success;
  if (ok === undefined || ok === null) ok = evaluateSignature(item, measured, audio);
  if (ok === null) return null; // not measurable — record nothing rather than invent
  const uid = getCurrentUser()?.id;
  insert('memoryApplications', {
    user_id: uid,
    item_id: itemId,
    success: !!ok,
    context: context || null,
    spontaneous,
    told,
    attempt_id: attemptId || null,
    date: new Date().toISOString(),
    measured_summary: measured ? {
      wpm: measured.wpm, fillerRate: measured.fillerRate, vagueRate: measured.vagueRate,
      structureHits: measured.structureHits, openingDirectness: measured.openingDirectness,
      hasConclusion: measured.hasConclusion, exampleHits: measured.exampleHits,
      avgSentenceLen: measured.avgSentenceLen, relevance: measured.relevance,
    } : null,
  });
  let patch;
  if (spontaneous) {
    patch = {
      spontaneous_success: item.spontaneous_success + (ok ? 1 : 0),
      spontaneous_fail: item.spontaneous_fail + (ok ? 0 : 1),
    };
  } else {
    patch = {
      apply_success: item.apply_success + (ok ? 1 : 0),
      apply_fail: item.apply_fail + (ok ? 0 : 1),
      last_reviewed: new Date().toISOString(),
      struggling: !ok,
      ...scheduleNext(item, ok ? 'good' : 'hard'),
    };
    if (context) patch.last_contexts = [...(item.last_contexts || []), context].slice(-8);
  }
  return refreshItem(itemId, patch);
}

/* Record a transfer exercise (same principle, new context). */
export function recordTransfer(itemId, { context, measured: measuredIn, audio, attemptId }) {
  const item = first('memoryItems', (m) => m.id === itemId);
  if (!item) return null;
  const measured = normMeasured(measuredIn);
  const ok = evaluateSignature(item, measured, audio);
  const uid = getCurrentUser()?.id;
  insert('transferExercises', {
    user_id: uid,
    item_id: itemId,
    context,
    success: ok === null ? null : !!ok,
    attempt_id: attemptId || null,
    date: new Date().toISOString(),
  });
  return recordApplication(itemId, { measured, audio, success: ok === null ? undefined : ok, context, told: true, attemptId });
}

/*
 * Spontaneous evidence (specs 8, 18, 19): during NORMAL training, silently
 * evaluate previously learned items whose signatures are measurable.
 * The item targeted explicitly this session is excluded — told use is not
 * spontaneous use.
 */
export function recordSpontaneousEvidence(measuredIn, audio, { excludeItemId, category }) {
  const measured = normMeasured(measuredIn);
  const uid = getCurrentUser()?.id;
  const items = find('memoryItems', (m) => m.user_id === uid && m.automaticity >= 3 && m.signature);
  const results = [];
  items.forEach((item) => {
    if (item.id === excludeItemId) return;
    // only re-test each item's spontaneity at most once per day
    const recent = find('memoryApplications', (a) => a.item_id === item.id && a.spontaneous && Date.now() - new Date(a.date).getTime() < 86400000);
    if (recent.length) return;
    const ok = evaluateSignature(item, measured, audio);
    if (ok === null) return;
    // only count a "success" when there is enough transcript to judge
    if (measured.wordCount < 40) return;
    recordApplication(item.id, { measured, audio, success: ok, context: category, spontaneous: true, told: false });
    results.push({ item, success: ok });
  });
  return results;
}

/* Dashboard: the MEMORY REVIEW block. */
export function todayMemoryReview(limit = 4) {
  const uid = getCurrentUser()?.id;
  const profile = getProfile();
  const items = find('memoryItems', (m) => m.user_id === uid);
  return { due: dueItems(items, null, profile, limit), total: items.length };
}

/* End-of-session snapshot + automaticity delta text. */
export function sessionSummary(beforeLevels) {
  const uid = getCurrentUser()?.id;
  const items = find('memoryItems', (m) => m.user_id === uid);
  const changes = [];
  items.forEach((i) => {
    const before = beforeLevels[i.id];
    if (before !== undefined && before !== i.automaticity) {
      changes.push({ item: i, before, after: i.automaticity });
    }
  });
  memorySnapshot(items, 'session', changes.map((c) => `${c.item.title}: ${c.before}→${c.after}`).join('; '));
  return changes;
}
