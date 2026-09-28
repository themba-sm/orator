/*
 * ORATOR data layer.
 * Persistent structured storage with the full schema:
 * Users, UserProfiles, Skills, SkillScores, TrainingSessions, Exercises,
 * ExerciseAttempts, SpeechAttempts, Feedback, WeaknessPatterns, ProgressSnapshots.
 * Everything lives on-device (localStorage) in v1; the schema is migration-ready.
 */

const DB_KEY = 'orator.db.v1';

const EMPTY_DB = {
  version: 1,
  users: [],
  userProfiles: [],
  skills: [],
  skillScores: [],
  trainingSessions: [],
  exercises: [],
  exerciseAttempts: [],
  speechAttempts: [],
  feedback: [],
  weaknessPatterns: [],
  progressSnapshots: [],
  /* --- Memory & Automaticity Engine --- */
  memoryItems: [],
  memoryReviews: [],
  memoryApplications: [],
  skillRetrievalAttempts: [],
  transferExercises: [],
  interleavedExercises: [],
  weaknessMemory: [],
  playbookItems: [],
  memorySnapshots: [],
  /* --- Conversation Simulator --- */
  conversations: [],
  conversationTurns: [],
  conversationReports: [],
  meta: {},
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    cache = raw ? { ...EMPTY_DB, ...JSON.parse(raw) } : structuredClone(EMPTY_DB);
  } catch {
    cache = structuredClone(EMPTY_DB);
  }
  return cache;
}

function save() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(load())); } catch (e) { console.warn('ORATOR: storage full', e); }
}

let seq = null;
function nextId(prefix) {
  const db = load();
  if (seq === null) seq = db.meta.seq || 0;
  seq += 1;
  db.meta.seq = seq;
  return `${prefix}_${String(seq).padStart(5, '0')}`;
}

export function getDB() { return load(); }

export function insert(collection, record) {
  const db = load();
  const now = new Date().toISOString();
  const row = {
    id: nextId(collection.slice(0, 3)),
    created_date: now,
    updated_date: now,
    ...record,
  };
  db[collection].push(row);
  save();
  return row;
}

export function update(collection, id, patch) {
  const db = load();
  const row = db[collection].find((r) => r.id === id);
  if (!row) return null;
  Object.assign(row, patch, { updated_date: new Date().toISOString() });
  save();
  return row;
}

export function remove(collection, id) {
  const db = load();
  const i = db[collection].findIndex((r) => r.id === id);
  if (i !== -1) { db[collection].splice(i, 1); save(); return true; }
  return false;
}

export function find(collection, predicate) {
  return load()[collection].filter(predicate);
}

export function first(collection, predicate) {
  return load()[collection].find(predicate) || null;
}

/* ---------- app-level helpers ---------- */

export function getCurrentUser() {
  return first('users', () => true);
}

export function getProfile() {
  const user = getCurrentUser();
  if (!user) return null;
  return first('userProfiles', (p) => p.user_id === user.id);
}

export function completedAttempts() {
  return find('exerciseAttempts', (a) => a.status === 'completed').sort(
    (a, b) => new Date(a.created_date) - new Date(b.created_date)
  );
}

export function isOnboarded() {
  const profile = getProfile();
  return !!(profile && profile.onboarding_complete);
}

export function baselineComplete() {
  const profile = getProfile();
  return !!(profile && profile.baseline_complete);
}

/* Streak: consecutive days (ending today or yesterday) with >=1 completed attempt. */
export function trainingStreak() {
  const attempts = completedAttempts();
  if (!attempts.length) return 0;
  const days = new Set(attempts.map((a) => a.created_date.slice(0, 10)));
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  let streak = 0;
  let cursor = new Date(today);
  if (!days.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1); // today not trained yet? streak counts up to yesterday
  while (days.has(iso(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function attemptsOnDate(isoDay) {
  return completedAttempts().filter((a) => a.created_date.slice(0, 10) === isoDay);
}

export function trainingHistory(days = 14) {
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, count: attemptsOnDate(iso).length });
  }
  return out;
}

/* Upsert a weakness observation into the pattern store. */
export function recordWeaknessObservation({ skillKey, weaknessKey, evidence, severity, attemptId }) {
  const db = load();
  const now = new Date().toISOString();
  let row = db.weaknessPatterns.find((w) => w.weakness_key === weaknessKey && w.user_id === getCurrentUser().id);
  if (!row) {
    row = insert('weaknessPatterns', {
      user_id: getCurrentUser().id,
      skill_key: skillKey,
      weakness_key: weaknessKey,
      times_observed: 0,
      times_improved: 0,
      severity: 0,
      first_observed: now,
      last_observed: now,
      examples: [],
    });
    // re-fetch the inserted row (insert returns it already)
  }
  update('weaknessPatterns', row.id, {
    times_observed: (row.times_observed || 0) + 1,
    severity: Math.max(row.severity || 0, severity),
    last_observed: now,
    examples: [...(row.examples || []), { evidence, attempt_id: attemptId, date: now }].slice(-12),
  });
  return first('weaknessPatterns', (w) => w.id === row.id);
}

export function markWeaknessImproved(weaknessKey) {
  const db = load();
  const row = db.weaknessPatterns.find((w) => w.weakness_key === weaknessKey);
  if (row) {
    update('weaknessPatterns', row.id, { times_improved: (row.times_improved || 0) + 1 });
  }
}

export function weaknessPatternsSorted() {
  const uid = getCurrentUser()?.id;
  return find('weaknessPatterns', (w) => w.user_id === uid).sort(
    (a, b) => (b.severity * Math.min(b.times_observed, 8)) - (a.severity * Math.min(a.times_observed, 8))
  );
}

export function resetAllData() {
  localStorage.removeItem(DB_KEY);
  cache = null;
}

/* Snapshot the profile after each completed attempt — progress over time. */
export function snapshotProgress(skillScores, note) {
  const snap = insert('progressSnapshots', {
    user_id: getCurrentUser()?.id,
    note: note || '',
    skills: skillScores,
  });
  return snap;
}

export function yesterdaysDateISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}


/* ================= Memory & Automaticity Engine helpers ================= */

export function memoryItemsFor(uid) {
  return find('memoryItems', (m) => m.user_id === uid);
}

export function getMemoryItem(itemId) {
  return first('memoryItems', (m) => m.id === itemId);
}

/* Link a weakness pattern to a memory item (error-based learning). */
export function linkWeaknessMemory(weaknessKey, itemId) {
  const uid = getCurrentUser()?.id;
  const db = load();
  const existing = db.weaknessMemory.find((w) => w.user_id === uid && w.weakness_key === weaknessKey && w.item_id === itemId);
  if (!existing) insert('weaknessMemory', { user_id: uid, weakness_key: weaknessKey, item_id: itemId, linked_date: new Date().toISOString() });
}

export function weaknessMemoryLinks(weaknessKey) {
  const uid = getCurrentUser()?.id;
  return find('weaknessMemory', (w) => w.user_id === uid && w.weakness_key === weaknessKey);
}

/* Record a memory snapshot (end of review session / weekly). */
export function memorySnapshot(items, kind, note) {
  return insert('memorySnapshots', {
    user_id: getCurrentUser()?.id,
    kind,
    note: note || '',
    items: items.map((i) => ({ item_id: i.id, title: i.title, automaticity: i.automaticity, retention: i.retention })),
  });
}
