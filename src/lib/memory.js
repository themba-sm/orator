/*
 * ORATOR Memory & Automaticity Engine.
 *
 * LEARN → RETRIEVE → APPLY → FORGET → RETRIEVE AGAIN → APPLY DIFFERENTLY → AUTOMATE
 *
 * Memory must always lead back to speaking. This engine seeds communication
 * principles as Memory Items, schedules spaced retrieval (adaptive), rates
 * recalls and applications from real measured evidence, infers an Automaticity
 * Level (1-7) from demonstrated behaviour only, and feeds the daily training
 * engine, dashboard and playbook.
 */

/* ================= Automaticity levels ================= */

export const AUTOMATICITY = [
  null,
  { n: 1, key: 'EXPOSED', label: 'Exposed', meaning: 'Seen it once. Nothing proven yet.' },
  { n: 2, key: 'UNDERSTOOD', label: 'Understood', meaning: 'You can explain it back. Not yet shown under pressure.' },
  { n: 3, key: 'RECALLABLE', label: 'Recallable', meaning: 'You retrieve it unaided, including after a delay.' },
  { n: 4, key: 'APPLICABLE', label: 'Applicable', meaning: 'You can use it when asked, in more than one context.' },
  { n: 5, key: 'CONSISTENT', label: 'Consistent', meaning: 'You apply it reliably across sessions.' },
  { n: 6, key: 'NATURAL', label: 'Natural', meaning: 'You have used it unprompted at least once.' },
  { n: 7, key: 'AUTOMATIC', label: 'Automatic', meaning: 'You use it without thinking, across contexts and weeks.' },
];

/* ================= The principle catalog =================
   Each item maps to a measurable signature where possible, so applications
   and spontaneous use can be rated from real evidence, never self-report. */

export const PRINCIPLE_CATALOG = [
  {
    cat_key: 'prep',
    playbook: 'Thinking',
    title: 'The PREP path',
    category: 'Speech structure',
    explanation: 'A spoken answer needs a visible path: POINT, REASON, EXAMPLE, POINT. Announce the destination, earn it, close the loop. Listeners follow order, not volume.',
    simple: 'Say what you think, why, prove it with one example, say it again at the end.',
    example: '"Public speaking pays for one reason: it decides who gets heard. The reason is simple — clarity wins rooms. For example, the clearest pitch I ever saw beat the smarter one. So the point is: learn to speak and you stop being invisible."',
    badExample: '"There are many factors to consider with public speaking, and it depends on the context, and also on the person…"',
    application: 'Answer any opinion question by walking POINT → REASON → EXAMPLE → POINT, saying the stage markers out loud.',
    weakness: ['organisation', 'development'],
    signature: { metric: 'structureHits', op: 'gte', value: 2 },
    applyPrompt: { category: 'opinion', title: 'Answer with PREP', prompt: 'Is discipline more important than motivation? Answer on the PREP path — out loud markers welcome.', prepSeconds: 15, speakSeconds: 60 },
  },
  {
    cat_key: 'central-idea',
    playbook: 'Speaking',
    title: 'Lead with the actual point',
    category: 'Speaking principles',
    explanation: 'One clear central idea, stated first. Warm-ups bury your best material; the listener should never guess where you stand.',
    simple: 'Say the point in your first sentence. Everything after it earns it.',
    example: '"Yes — and here is the one condition that matters."',
    badExample: '"So I think, basically, when it comes to this topic, there are several things to say…"',
    application: 'Open every answer with your position. No runway.',
    weakness: ['opening', 'development'],
    signature: { metric: 'openingDirectness', op: 'gte', value: 0.5 },
    applyPrompt: { category: 'opinion', title: 'Point first', prompt: 'Should companies allow pets in offices? Your first sentence must be your position.', prepSeconds: 15, speakSeconds: 45 },
  },
  {
    cat_key: 'conclusions',
    playbook: 'Speaking',
    title: 'Land the ending',
    category: 'Speaking principles',
    explanation: 'Reserve your final sentence for the point. "So the point is…" and stop. Never open a new door in the last five seconds.',
    simple: 'End by repeating your one idea. Full stop.',
    example: '"So the point is simple: structure is what makes ideas land."',
    badExample: '"…and also that reminds me of another thing which is that we should probably also consider…"',
    application: 'Close every answer with a conclusion sentence that restates the central idea.',
    weakness: ['conclusion'],
    signature: { metric: 'hasConclusion', op: 'truthy' },
    applyPrompt: { category: 'persuasion', title: 'Close it properly', prompt: 'Convince a friend to read more books. End with a sentence that begins "So the point is…".', prepSeconds: 15, speakSeconds: 45 },
  },
  {
    cat_key: 'pause',
    playbook: 'Articulation',
    title: 'Pause instead of filler',
    category: 'Articulation principles',
    explanation: 'Filler words do the work pauses should do. A one-second silence reads as thought; an "um" reads as doubt. Close your mouth and breathe.',
    simple: 'When you feel an "um" coming, say nothing for a second instead.',
    example: '"The main thing is this. (Silence.) It decides who gets heard."',
    badExample: '"Um, so, like, basically the, you know, the main thing is…"',
    application: 'Answer with deliberate pauses between sentences; zero filler required for a clean pass.',
    weakness: ['fillers'],
    signature: { metric: 'fillerRate', op: 'lt', value: 1.5 },
    applyPrompt: { category: 'fillers', title: 'The clean pass', prompt: 'Tell someone what you would do with one completely free Saturday and why. No fillers — silence is allowed.', prepSeconds: 15, speakSeconds: 45 },
  },
  {
    cat_key: 'precision',
    playbook: 'Vocabulary',
    title: 'Name it exactly',
    category: 'Vocabulary',
    explanation: 'Vague words ("good", "thing", "a lot") stand where precise ones should be. Sound intelligent by being exact, never by decorating.',
    simple: 'Every vague word you notice, replace with the specific thing you mean.',
    example: '"It was a demanding experience that taught me to plan before I speak." (not "a good experience")',
    badExample: '"It was a good experience that taught me a lot of stuff."',
    application: 'Ban the vague list — good, bad, nice, thing, stuff, big, a lot — for a full answer.',
    weakness: ['precision'],
    signature: { metric: 'vagueRate', op: 'lt', value: 1.2 },
    applyPrompt: { category: 'precision', title: 'The vague ban', prompt: 'Describe the best meal you have ever eaten without "good, nice, amazing or delicious".', prepSeconds: 15, speakSeconds: 45 },
  },
  {
    cat_key: 'short-sentences',
    playbook: 'Speaking',
    title: 'One idea per sentence',
    category: 'Speaking principles',
    explanation: 'Long sentences are not sophisticated — they are hard to follow. If a sentence needs more than two commas, split it.',
    simple: 'Short sentences. One idea each. The listener keeps up.',
    example: '"Public speaking is a lever. Most people never learn to use it. You can."',
    badExample: 'One 35-word sentence with three "and"s and a "which" halfway through.',
    application: 'Answer with no sentence over about 15 words.',
    weakness: ['sentenceConstruction'],
    signature: { metric: 'avgSentenceLen', op: 'lt', value: 20 },
    applyPrompt: { category: 'precision', title: 'Short and sharp', prompt: 'Explain why most meetings waste time — in short sentences only.', prepSeconds: 15, speakSeconds: 45 },
  },
  {
    cat_key: 'examples',
    playbook: 'Storytelling',
    title: 'Anchor with one concrete example',
    category: 'Storytelling principles',
    explanation: 'Claims without examples do not stick. One specific beats three generalities: a moment, a number, a name, a scene.',
    simple: 'Every big claim gets one example the listener can see.',
    example: '"I once rehearsed a pitch eleven times. It was the only one I did not fumble."',
    badExample: '"Preparation matters in many ways for many types of situations."',
    application: 'Deliver at least one concrete example, story or number per answer.',
    weakness: ['specificity'],
    signature: { metric: 'exampleHits', op: 'gte', value: 1 },
    applyPrompt: { category: 'story', title: 'Make them see it', prompt: 'Argue that small habits beat big plans. Land at least one concrete example the listener can picture.', prepSeconds: 20, speakSeconds: 60 },
  },
  {
    cat_key: 'pace',
    playbook: 'Articulation',
    title: 'The clarity pace',
    category: 'Articulation principles',
    explanation: 'Target roughly 130-150 words per minute. Deliberate speed is a weapon; runaway speed is noise. Finish every word — especially its ending.',
    simple: 'About 140 words a minute. Land the endings.',
    example: 'A sentence said three times, 15% slower each time, keeping the meaning intact.',
    badExample: 'A 60-second answer delivered in 40 seconds with the last syllables of every word missing.',
    application: 'Answer at a controlled pace with every word completed.',
    weakness: ['pace'],
    signature: { metric: 'wpm', op: 'between', value: [110, 165] },
    applyPrompt: { category: 'pace', title: 'The metronome', prompt: 'Explain what "public speaking is a skill, not a gift" means to you — at a controlled pace, every word complete.', prepSeconds: 15, speakSeconds: 45 },
  },
  {
    cat_key: 'economy',
    playbook: 'Conciseness',
    title: 'Point in the first third',
    category: 'Speaking principles',
    explanation: 'Cut the runway. State the point inside the first third of your time and spend the rest earning it. Endings are part of the performance.',
    simple: 'Say it early. Stop before the timer does.',
    example: 'A 60-second answer that lands the point at second 15 and closes at second 50.',
    badExample: 'A 75-second answer that reaches the actual point at second 60.',
    application: 'Answer inside the target time, finishing before the timer.',
    weakness: ['verbosity'],
    signature: { metric: 'durationVsTarget', op: 'lte', value: 1.1 },
    applyPrompt: { category: 'concise', title: 'The halfway cut', prompt: 'You have 60 seconds on "What makes advice useful?" Use about 40 and stop deliberately.', prepSeconds: 15, speakSeconds: 60 },
  },
  {
    cat_key: 'answer-question',
    playbook: 'Conversations',
    title: 'Answer the question asked',
    category: 'Conversation techniques',
    explanation: 'Restate the question in your own words in the first sentence, then answer only that. Speaking well about the wrong thing is still the wrong answer.',
    simple: 'Repeat their question your way. Answer that. Nothing else.',
    example: '"The question is whether X matters — and it does, for one reason…"',
    badExample: 'A fluent answer about a related but different question.',
    application: 'Open by restating the question, and keep every paragraph tied to it.',
    weakness: ['relevance'],
    signature: { metric: 'relevance', op: 'gte', value: 0.4 },
    applyPrompt: { category: 'pressure', title: 'On target', prompt: 'Answer exactly this and nothing else: is it better to be respected or liked? Restate it first.', prepSeconds: 10, speakSeconds: 45 },
  },
  {
    cat_key: 'repetition',
    playbook: 'Speaking',
    title: 'Say it once, well',
    category: 'Speaking principles',
    explanation: 'Repeating a phrase reads as a search for the next thought. Say the point once, cleanly; pause to think instead of restating.',
    simple: 'One clean pass. Silence between ideas, not echoes.',
    example: 'Point. Pause. Next idea.',
    badExample: '"I think, I think the main thing, the main thing here is…"',
    application: 'Answer without repeating any phrase.',
    weakness: ['repetition'],
    signature: { metric: 'repeatedPhrases', op: 'empty' },
    applyPrompt: { category: 'concise', title: 'One pass', prompt: 'Explain why silence is underrated in conversation — without repeating any phrase you use.', prepSeconds: 15, speakSeconds: 40 },
  },
  {
    cat_key: 'voice-contrast',
    playbook: 'Presence',
    title: 'Contrast makes it land',
    category: 'Presence',
    explanation: 'Flat delivery makes strong content sound rehearsed. Push key words up, let supporting words fall, slow down on your main point.',
    simple: 'Lift the important words. Let the rest fall.',
    example: 'Your central sentence said three ways: flat, over-emphasised, then natural with the key word lifted.',
    badExample: 'A whole answer delivered at one unbroken volume and pace.',
    application: 'Deliver an answer with deliberate loudness contrast on key words.',
    weakness: ['vocalDelivery'],
    signature: { metric: 'loudnessVariation', op: 'gte', value: 0.4 },
    applyPrompt: { category: 'pace', title: 'The gear change', prompt: 'Describe a moment you were proud of. Slow down and lift the most important sentence.', prepSeconds: 15, speakSeconds: 60 },
  },
  {
    cat_key: 'contrast-ideas',
    playbook: 'Persuasion',
    title: 'Before / after framing',
    category: 'Persuasion techniques',
    explanation: 'People remember contrast. Show the world without your idea, then with it. "Before… after…" gives the listener a reason to move.',
    simple: 'Show what happens without it. Then with it.',
    example: '"Without preparation, you improvise and it shows. With it, you look like you were born ready."',
    application: 'Make one argument using explicit before / after contrast.',
    weakness: [],
    signature: null,
    applyPrompt: { category: 'persuasion', title: 'Before and after', prompt: 'Persuade someone to keep a daily journal using explicit before/after contrast.', prepSeconds: 20, speakSeconds: 60 },
  },
  {
    cat_key: 'listening-hook',
    playbook: 'Conversations',
    title: 'The callback',
    category: 'Conversation techniques',
    explanation: 'Reuse the other person\'s exact words when you answer them. It proves you listened and makes your answer feel made for them.',
    simple: 'Use their words back at them.',
    example: '"You said this feels risky — here is exactly why the risk is smaller than waiting."',
    application: 'Answer a challenge by quoting the challenger\'s own words first.',
    weakness: [],
    signature: null,
    applyPrompt: { category: 'pressure', title: 'Their words', prompt: 'Someone tells you: "This plan is too risky." Answer using their own words.', prepSeconds: 10, speakSeconds: 45 },
  },
];

/* ================= Vocabulary catalog ================= */

export const VOCAB_CATALOG = [
  { word: 'concise', meaning: 'short and clear, with nothing wasted', fits: 'describing an answer or message', example: 'Her answer was concise — one sentence, no padding.' },
  { word: 'articulate', meaning: 'able to express ideas clearly and effectively', fits: 'describing a speaker', example: 'He is articulate even when interrupted.' },
  { word: 'compelling', meaning: 'so convincing or interesting you cannot ignore it', fits: 'describing an argument or case', example: 'It was a compelling case for changing the process.' },
  { word: 'deliberate', meaning: 'done consciously and intentionally, not by accident', fits: 'describing a technique or choice', example: 'The pause was deliberate, not nervous.' },
  { word: 'nuanced', meaning: 'understanding small but important differences', fits: 'describing an opinion or analysis', example: 'Her view is more nuanced than a simple yes or no.' },
  { word: 'credible', meaning: 'believable and worth trusting', fits: 'describing a person or claim', example: 'That source is not credible.' },
  { word: 'tangible', meaning: 'real and touchable, not vague', fits: 'describing results or benefits', example: 'The training had tangible results: two promotions.' },
  { word: 'succinct', meaning: 'expressed briefly but completely', fits: 'describing a summary', example: 'Keep the summary succinct — three lines.' },
  { word: 'resonate', meaning: 'to connect deeply with someone', fits: 'describing how a message landed', example: 'That story will resonate with parents.' },
  { word: 'coherent', meaning: 'logical, consistent and holding together', fits: 'describing an argument', example: 'The argument was coherent from start to finish.' },
];

/* ================= Context variation (spec 9) ================= */

export const CONTEXTS = [
  { key: 'business', hint: 'a business or work setting' },
  { key: 'relationships', hint: 'a personal relationship' },
  { key: 'growth', hint: 'personal development' },
  { key: 'interview', hint: 'a job interview' },
  { key: 'storytelling', hint: 'a story' },
  { key: 'casual', hint: 'a casual conversation' },
  { key: 'presentation', hint: 'a presentation to a group' },
  { key: 'persuasive', hint: 'persuading someone' },
];

export function transferPromptFor(item, contextKey) {
  const ctx = (CONTEXTS.find((c) => c.key === contextKey) || CONTEXTS[Math.floor(Math.random() * CONTEXTS.length)]).hint;
  return {
    category: 'memory-transfer',
    title: `Transfer: ${item.title}`,
    prompt: `Use the principle of "${item.title.toLowerCase()}", but not in a business setting — place it in ${ctx}. Speak for 45 seconds.`,
    prepSeconds: 15,
    speakSeconds: 45,
  };
}

/* ================= Item creation & scheduling ================= */

const DAY = 86400000;

function nextInterval(item, rating) {
  // progression (days): same-session handled as minutes; then 1, 3, 7, 14, 30, 60, 90+
  const ladder = [1, 3, 7, 14, 30, 60, 90];
  const idx = ladder.findIndex((d) => d >= (item.review_interval || 0));
  if (rating === 'again') {
    // forgot: back to a short interval, recovery path scheduled
    return Math.max(1, Math.round((item.review_interval || 1) / 4));
  }
  if (rating === 'hard') return Math.max(1, Math.round((item.review_interval || 1) * 0.6));
  if (rating === 'easy') return Math.round((item.review_interval || 1) * 1.5) || 3;
  const nextIdx = Math.min(ladder.length - 1, (idx === -1 ? 0 : idx) + 1);
  return ladder[nextIdx];
}

export function scheduleNext(item, rating) {
  const now = new Date();
  const intervalDays = nextInterval(item, rating);
  const sameSession = rating === 'again' && (item.review_interval || 1) <= 1;
  const nextAt = new Date(now.getTime() + (sameSession ? 2 * 60 * 1000 : intervalDays * DAY));
  return {
    review_interval: intervalDays,
    next_review: nextAt.toISOString(),
    retention: rating === 'again' ? 0 : rating === 'hard' ? Math.min(1, (item.retention || 0.4) + 0.1) : Math.min(1, (item.retention || 0.4) + 0.25),
  };
}

/* Create the persistent MemoryItem record from a catalog entry. */
export function createMemoryItem(user, cat, kind = 'principle') {
  return {
    user_id: user.id,
    kind,
    cat_key: cat.cat_key,
    title: cat.title,
    playbook: cat.playbook || 'Speaking',
    category: cat.category,
    explanation: cat.explanation,
    simple: cat.simple || cat.explanation,
    example: cat.example || '',
    bad_example: cat.badExample || '',
    application: cat.application,
    weakness: cat.weakness || [],
    signature: cat.signature || null,
    apply_prompt: cat.applyPrompt || null,
    date_learned: new Date().toISOString(),
    last_reviewed: null,
    next_review: new Date().toISOString(),
    review_interval: 0,
    retention: 0.3,
    recall_success: 0,
    recall_fail: 0,
    apply_success: 0,
    apply_fail: 0,
    spontaneous_success: 0,
    spontaneous_fail: 0,
    automaticity: 1,
    last_contexts: [],
    struggling: false,
  };
}

export function createVocabItem(user, v) {
  return {
    ...createMemoryItem(user, { cat_key: 'vocab-' + v.word, title: v.word, playbook: 'Vocabulary', category: 'Vocabulary', explanation: `"${v.word}" — ${v.meaning}.`, simple: v.meaning, example: v.example, application: `Use "${v.word}" naturally in an answer.`, weakness: [], signature: null, applyPrompt: { category: 'precision', title: 'Say it naturally', prompt: `Use the word "${v.word}" naturally in a 30-second answer about your work or interests.`, prepSeconds: 10, speakSeconds: 30 } }, 'vocabulary'),
    vocab: v,
  };
}

/* ================= Signature evaluation ================= */

/* Evaluate an item's signature against measured metrics. Returns
   true / false / null (null = not measurable on this attempt). */
export function evaluateSignature(item, measured, audio) {
  if (!item.signature) return null;
  const sig = item.signature;
  let v;
  if (sig.metric === 'loudnessVariation') v = audio && audio.measured && audio.spokeEnough ? audio.loudnessVariation : null;
  else if (sig.metric === 'durationVsTarget') v = measured.targetSeconds ? +(measured.durationSeconds / measured.targetSeconds).toFixed(2) : null;
  else v = measured[sig.metric] !== undefined ? measured[sig.metric] : null;
  if (v === null || v === undefined) return null;
  if (sig.op === 'gte') return v >= sig.value;
  if (sig.op === 'lt') return v < sig.value;
  if (sig.op === 'between') return v >= sig.value[0] && v <= sig.value[1];
  if (sig.op === 'lte') return v <= sig.value;
  if (sig.op === 'truthy') return !!v;
  if (sig.op === 'empty') return !v || v.length === 0;
  return null;
}

/* ================= Automaticity inference (spec 7) ================= */

/* Recompute the Automaticity Level from stored evidence. Never manual. */
export function recomputeAutomaticity(item, { reviews, applications, spontaneous }) {
  const now = Date.now();
  const recentApps = applications.slice(-6);
  const appSuccessRate = recentApps.length ? recentApps.filter((a) => a.success).length / recentApps.length : 0;
  const recallOK = reviews.filter((r) => r.kind === 'recall' && r.rating !== 'again');
  const delayedRecallOK = recallOK.filter((r) => r.item_interval_days >= 1);
  const distinctContexts = new Set(applications.map((a) => a.context).filter(Boolean)).size;

  let level = 1;
  if (recallOK.length >= 1 || applications.some((a) => a.success)) level = 2;
  if (level === 2 && recallOK.length >= 2 && delayedRecallOK.length >= 1) level = 3;
  if (level === 3 && recentApps.filter((a) => a.success).length >= 2 && distinctContexts >= 2) level = 4;
  if (level === 4 && recentApps.length >= 4 && appSuccessRate >= 0.75) level = 5;
  if (level === 5 && spontaneous.filter((s) => s.success).length >= 1) level = 6;
  if (level === 6 && spontaneous.filter((s) => s.success).length >= 3 && distinctContexts >= 3
    && spontaneous.filter((s) => s.success).some((s) => now - new Date(s.date).getTime() > 6 * DAY)) level = 7;

  // De-elect on recent failure: if last 3 applications all failed, drop a level (floor 3).
  const lastThree = recentApps.slice(-3);
  if (lastThree.length === 3 && lastThree.every((a) => !a.success)) level = Math.max(3, level - 1);
  return level;
}

/* ================= Priority & due items (specs 4, 11, 17) ================= */

export function dueItems(items, links, profile, limit = 4) {
  const now = Date.now();
  const goalKeys = new Set((profile?.goals || []));
  const weakAreas = new Set(profile?.weak_areas || []);
  const candidates = items.filter((i) => new Date(i.next_review).getTime() <= now);
  const scored = candidates.map((i) => {
    const failRate = (i.recall_fail + i.apply_fail) / Math.max(1, i.recall_success + i.recall_fail + i.apply_success + i.apply_fail);
    const weaknessBoost = (i.weakness || []).some((w) => weakAreas.has(w)) ? 2.5 : 0;
    const strugglingBoost = i.struggling ? 2 : 0;
    const retentionBoost = (1 - (i.retention || 0.5)) * 1.5;
    const overdueDays = (now - new Date(i.next_review).getTime()) / DAY;
    const overdueness = Math.min(3, overdueDays);
    const priority = 1 + failRate * 3 + weaknessBoost + strugglingBoost + retentionBoost + overdueness
      - i.automaticity * 0.6; // automatic skills step aside for struggling ones
    return { item: i, priority };
  });
  scored.sort((a, b) => b.priority - a.priority);
  return scored.slice(0, limit);
}

/* Items worth linking to a weakness, in error-based learning (spec 12, 13). */
export function catalogItemForWeakness(weaknessKey) {
  return PRINCIPLE_CATALOG.find((c) => (c.weakness || []).includes(weaknessKey)) || null;
}

/* ================= Weekly review (spec 23) ================= */

export function weeklyReview(items, applications, spontaneous, reviews) {
  const now = Date.now();
  const week = 7 * DAY;
  const inWeek = (d) => now - new Date(d).getTime() <= week;
  const stuck = [];
  const slipping = [];
  const needsWork = [];
  const becoming = [];
  items.forEach((i) => {
    const apps = applications.filter((a) => a.item_id === i.id);
    const spont = spontaneous.filter((s) => s.item_id === i.id);
    const recentApps = apps.filter((a) => inWeek(a.date));
    const recentSpont = spont.filter((s) => inWeek(s.date));
    const successes = recentApps.filter((a) => a.success).length + recentSpont.filter((s) => s.success).length;
    const failures = recentApps.filter((a) => !a.success).length + recentSpont.filter((s) => !s.success).length;
    if (recentSpont.some((s) => s.success)) becoming.push(i);
    if (recentApps.length + recentSpont.length >= 2 && failures === 0 && successes >= 2) stuck.push(i);
    else if (failures >= 2) needsWork.push(i);
    else if (failures >= 1 && i.automaticity >= 4 && successes === 0) slipping.push(i);
  });
  return { stuck, slipping, needsWork, becoming, generated: new Date().toISOString() };
}

/* ================= Automaticity report (spec 22) ================= */

export function automaticityReport(items, applications, spontaneous) {
  const now = Date.now();
  const month = 30 * DAY;
  return items
    .filter((i) => i.automaticity >= 2)
    .map((i) => {
      const apps = applications.filter((a) => a.item_id === i.id && now - new Date(a.date).getTime() <= month);
      const spont = spontaneous.filter((s) => s.item_id === i.id && now - new Date(s.date).getTime() <= month);
      const attempts = apps.length + spont.length;
      const wins = apps.filter((a) => a.success).length + spont.filter((s) => s.success).length;
      let status = 'developing';
      if (!attempts) status = 'unevaluated';
      else if (wins / attempts >= 0.8) status = 'consistent';
      else if (wins / attempts >= 0.6) status = 'improving';
      else if (wins / attempts >= 0.35) status = 'inconsistent';
      else status = 'struggling';
      return { item: i, status, attempts, wins };
    })
    .sort((a, b) => b.item.automaticity - a.item.automaticity);
}
