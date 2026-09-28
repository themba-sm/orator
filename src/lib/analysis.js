/*
 * ORATOR analysis engine — deterministic, evidence-based.
 *
 * Everything reported here is measured from what actually happened:
 * the transcript, the timing, and the audio energy envelope.
 * Where a measurement is unavailable, it is reported as unavailable — never invented.
 */

/* ---------------- word lists ---------------- */

const FILLERS = ['um', 'umm', 'uh', 'uhh', 'erm', 'hmm', 'like', 'you know', 'you see', 'basically', 'literally', 'sort of', 'kind of', 'i mean', 'yeah so', 'or something', 'whatever'];
const STRONG_FILLERS = ['um', 'umm', 'uh', 'uhh', 'erm'];

const VAGUE = {
  thing: 'specific noun', things: 'specific nouns', stuff: 'what exactly?', good: 'what made it good?',
  bad: 'what made it bad?', nice: 'what quality exactly?', big: 'how big?', small: 'how small?',
  'a lot': 'how much, exactly?', 'very': 'a stronger word instead', 'really': 'a stronger word instead',
  great: 'what made it great?', amazing: 'what made it amazing?', important: 'why does it matter?',
};

const STRUCTURE_MARKERS = ['first', 'second', 'third', 'finally', 'to begin', 'my first point', 'my second point', 'next', 'as a result', 'because of that', 'for example', 'for instance', 'in conclusion', 'to sum up', 'the point is', 'the reason is', 'that is why', 'so to close', 'in short', 'on the other hand'];
const CONCLUSION_MARKERS = ['in conclusion', 'to sum up', 'to summarize', 'so the point', 'the point is', 'that is why', 'in short', 'so ultimately', 'my point', 'i believe', 'so in the end', 'so overall'];
const EXAMPLE_MARKERS = ['for example', 'for instance', 'like when', 'such as', 'one time', 'in my experience', 'to illustrate', 'i remember', 'when i', 'a case', 'imagine'];

const STOPWORDS = new Set('the a an and or but of to in on for with is are was were be been am i you he she it we they me my your his her its our their this that these those there here as at by from not no do does did doing have has had having will would can could should may might must so if then than too very just about what which who whom when where why how all any both each few more most other some such only own same s t don now'.split(' '));

const contentWords = (text) => (text.toLowerCase().match(/[a-z']{2,}/g) || []).filter((w) => !STOPWORDS.has(w));

/* ---------------- core metrics ---------------- */

export function analyseAttempt({ transcript, transcriptSource, durationMs, energies, targetSeconds, prompt, category }) {
  const words = transcript ? (transcript.trim().match(/\S+/g) || []) : [];
  const wordCount = words.length;
  const minutes = Math.max(durationMs / 60000, 1 / 60);
  const wpm = wordCount ? Math.round(wordCount / minutes) : null;

  // filler words
  const lower = ` ${transcript.toLowerCase()} `;
  const fillerHits = [];
  FILLERS.forEach((f) => {
    const re = new RegExp(`(?<![a-z])${f.replace(/ /g, '\\s+')}(?![a-z])`, 'g');
    const count = (lower.match(re) || []).length;
    if (count) fillerHits.push({ filler: f, count });
  });
  const fillerCount = fillerHits.reduce((a, f) => a + f.count, 0);
  const fillerRate = wordCount >= 25 ? +((fillerCount / wordCount) * 100).toFixed(1) : null; // per 100 words

  // vague language
  const vagueHits = [];
  Object.keys(VAGUE).forEach((v) => {
    const re = new RegExp(`(?<![a-z])${v.replace(/ /g, '\\s+')}(?![a-z])`, 'g');
    const count = (lower.match(re) || []).length;
    if (count) vagueHits.push({ word: v, count });
  });
  const vagueCount = vagueHits.reduce((a, v) => a + v.count, 0);
  const vagueRate = wordCount >= 25 ? +((vagueCount / wordCount) * 100).toFixed(1) : null;

  // sentences
  const sentenceList = (transcript.match(/[^.!?]+[.!?]*/g) || [transcript]).map((s) => s.trim()).filter(Boolean);
  const sentenceCount = sentenceList.length || (wordCount ? 1 : 0);
  const avgSentenceLen = sentenceCount ? Math.round((wordCount / sentenceCount) * 10) / 10 : null;
  const longSentences = sentenceList.filter((s) => (s.match(/\S+/g) || []).length > 28).length;

  // repetition: repeated 3-word shingles over content words
  const repCounts = {};
  const cw = (transcript.toLowerCase().match(/[a-z']+/g) || []).map((w) => (STOPWORDS.has(w) ? null : w));
  for (let i = 0; i < cw.length - 2; i += 1) {
    if (cw[i] && cw[i + 1] && cw[i + 2]) {
      const sh = `${cw[i]} ${cw[i + 1]} ${cw[i + 2]}`;
      repCounts[sh] = (repCounts[sh] || 0) + 1;
    }
  }
  const repeatedPhrases = Object.entries(repCounts).filter(([, c]) => c > 2).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // structure / opening / conclusion / examples
  const structureHits = STRUCTURE_MARKERS.filter((m) => lower.includes(m)).length;
  const conclusionText = sentenceList.slice(-2).join(' ').toLowerCase();
  const hasConclusion = CONCLUSION_MARKERS.some((m) => conclusionText.includes(m));
  const exampleHits = EXAMPLE_MARKERS.filter((m) => lower.includes(m)).length;

  // opening directness: do the first two sentences engage the actual question?
  const promptCW = new Set(contentWords(prompt || ''));
  const opening = sentenceList.slice(0, 2).join(' ');
  const openingCW = contentWords(opening);
  const overlap = openingCW.filter((w) => promptCW.has(w)).length;
  const directOpeners = /\b(i think|i believe|the reason|my view|yes|no|i would|i am|i'm|the answer|the point|the problem|the key)\b/i.test(opening);
  const openingDirectness = wordCount ? Math.min(1, overlap / Math.min(6, Math.max(2, promptCW.size)) + (directOpeners ? 0.4 : 0)) : null;

  // relevance: share of the whole answer tied to the prompt's content
  const answerCW = contentWords(transcript);
  const answerSet = new Set(answerCW);
  let promptOverlap = 0;
  promptCW.forEach((w) => { if (answerSet.has(w)) promptOverlap += 1; });
  const relevance = promptCW.size ? +(promptOverlap / promptCW.size).toFixed(2) : null;

  return {
    measured: {
      transcript: transcriptSource,
      durationSeconds: Math.round(durationMs / 100) / 10,
      targetSeconds: targetSeconds || null,
      wordCount,
      wpm,
      fillerCount,
      fillerRate,
      fillerHits: fillerHits.sort((a, b) => b.count - a.count).slice(0, 4),
      vagueCount,
      vagueRate,
      vagueHits: vagueHits.sort((a, b) => b.count - a.count).slice(0, 4),
      sentenceCount,
      avgSentenceLen,
      longSentences,
      repeatedPhrases,
      structureHits,
      hasConclusion,
      exampleHits,
      openingDirectness: openingDirectness === null ? null : +openingDirectness.toFixed(2),
      relevance,
    },
    firstSentences: sentenceList.slice(0, 2).join(' '),
    lastSentence: sentenceList[sentenceList.length - 1] || '',
  };
}

/* ---------------- weakness model ---------------- */

/*
 * Each weakness: a detector over measured metrics + coaching content.
 * severity 1-5. The engine picks ONE per attempt: the highest priority,
 * where priority = severity * (1 + 0.25 * historic frequency).
 */

export const WEAKNESS_LIBRARY = {
  organisation: {
    label: 'Thought organisation',
    skill: 'thoughtOrganisation',
    teach: 'Your listener could not follow where your answer was going. Ideas arrived in the order you thought of them, not the order they should land. Without a visible path, good material sounds confused.',
    instead: 'Decide your point before you open your mouth, then walk the listener down a fixed path: POINT → REASON → EXAMPLE → CONCLUSION. Signal each turn with a short marker ("The reason is…", "For example…"). The path is what makes you sound organised.',
    example: 'Instead of circling the topic, open with the destination: "Public speaking matters for one reason: it decides who gets heard. The reason is simple. For example, in most meetings the clearest speaker wins the room. So if you can speak, you are never invisible."',
  },
  fillers: {
    label: 'Filler words',
    skill: 'fluency',
    teach: 'Filler words were doing the work your pauses should do. They made the answer sound uncertain even where your ideas were not.',
    instead: 'Replace filler with silence. A pause of one second reads as thought, not weakness. When you feel an "um" coming, close your mouth and breathe instead.',
    example: 'Instead of "Um, so, like, basically the, you know, the main thing is…" — pause, then: "The main thing is this."',
  },
  pace: {
    label: 'Speaking pace',
    skill: 'clarity',
    teach: 'You spoke faster than your listener could absorb. At that speed, word endings blur and your best lines get lost.',
    instead: 'Target a measured pace: roughly 130-150 words per minute. Land the final consonant of each word. Deliberate speed is a weapon; runaway speed is noise.',
    example: 'Take a phrase you rush and say it three times, 15% slower each time, keeping the meaning intact. That is your natural pace — train back to it.',
  },
  precision: {
    label: 'Word precision',
    skill: 'wordPrecision',
    teach: 'Vague words stood where precise ones should be. "Good", "thing" and "a lot" made your answer feel general, because it was.',
    instead: 'Every time a vague word leaves your mouth, ask: what exactly do I mean? Name the specific thing, quantity or quality. Sound intelligent by being exact — never by decorating.',
    example: 'Instead of "It was a good experience that taught me a lot" — "It was a demanding experience that taught me to plan before I speak."',
  },
  opening: {
    label: 'Weak opening',
    skill: 'clarity',
    teach: 'Your first sentences did not engage the actual question, so the listener spent the first half of your answer guessing where you stood.',
    instead: 'Answer within the first sentence. State your position or your point immediately, then earn it. A strong opening buys attention for everything after it.',
    example: 'Instead of warming up with background, open with the verdict: "Yes — and here is the one condition that matters."',
  },
  conclusion: {
    label: 'Weak conclusion',
    skill: 'clarity',
    teach: 'The answer did not land. It either trailed off or introduced a new idea at the end, which is where the listener most expects closure.',
    instead: 'Reserve your final sentence for the point. Say "So the point is…" and finish clean. Never open a new door in the last five seconds.',
    example: 'Close the loop: "So the point is simple: [your point]." Full stop. Sit down inside the silence.',
  },
  repetition: {
    label: 'Unnecessary repetition',
    skill: 'conciseness',
    teach: 'You circled the same phrase repeatedly. Repetition reads as a search for the next thought — the listener hears the wheels spinning.',
    instead: 'Say the point once, well, then move. If you need a moment to think, pause silently instead of restating.',
    example: 'Notice your crutch phrase, ban it for the attempt, and let the pause carry you to the next idea.',
  },
  sentenceConstruction: {
    label: 'Sentence construction',
    skill: 'sentenceConstruction',
    teach: 'Your sentences ran long and stacked clauses. By the end the listener had lost the subject. Long sentences are not sophisticated — they are hard to follow.',
    instead: 'Shorten. One idea per sentence. If a sentence needs more than two commas, split it.',
    example: 'Instead of one 35-word sentence, give three: "Public speaking is a lever. Most people never learn to use it. You can."',
  },
  specificity: {
    label: 'Lack of examples',
    skill: 'storytelling',
    teach: 'Your answer stayed abstract. Claims without examples do not stick; the listener agrees in the moment and forgets within the hour.',
    instead: 'Anchor every key claim with one concrete example, story or number. One specific beats three generalities.',
    example: 'Instead of "Preparation matters" — "I once rehearsed a pitch eleven times. It was the only one I did not fumble."',
  },
  verbosity: {
    label: 'Verbosity',
    skill: 'conciseness',
    teach: 'You took too long to travel too short a distance. The answer overstayed its target time, and attention sagged on the way.',
    instead: 'Cut the runway. Land the point in the first third of your time and spend the rest earning it, not circling it.',
    example: 'If you have 60 seconds, aim to state your point inside the first 15 and finish at 50. Endings are part of the performance.',
  },
  development: {
    label: 'Insufficient development',
    skill: 'thoughtOrganisation',
    teach: 'Your answer was too thin for the time given — the listener received a headline with no article under it.',
    instead: 'Use the full time deliberately: position, then reason, then one example, then a close. Silence is the only thing that should be left over.',
    example: 'A 60-second answer should carry roughly 120-150 words with a beginning, middle and end. Prepare the skeleton even for impromptu answers.',
  },
  relevance: {
    label: 'Answer relevance',
    skill: 'responseSpeed',
    teach: 'Your answer drifted from the question actually asked. Speaking well about the wrong thing is still the wrong answer.',
    instead: 'Restate the question in your first sentence in your own words, then answer it. Anchor every paragraph back to it.',
    example: '"The question is whether X matters — and it does, for one reason…" Everything after that must serve that sentence.',
  },
  vocalDelivery: {
    label: 'Vocal delivery',
    skill: 'vocalDelivery',
    teach: 'Your delivery was flat — the loudness of your voice barely moved. Flat delivery makes even strong content sound rehearsed or tired.',
    instead: 'Push key words up and let supporting words fall. Change gears at your main point: slightly slower, slightly louder, then land it.',
    example: 'Say your central sentence three ways: flat, then over-emphasised, then natural with the key word lifted. Train the third.',
  },
};

function detectCandidates(m, audio, ctx) {
  const c = [];
  const has = (x) => x !== null && x !== undefined;
  // structure
  if (m.wordCount >= 40) {
    if (m.structureHits === 0 && ['opinion', 'persuasion', 'explain', 'question'].includes(ctx.category)) {
      c.push({ weakness: 'organisation', severity: 4.5, evidence: 'No structure markers anywhere in the answer — ideas arrived unordered.' });
    } else if (m.structureHits <= 1 && ctx.category === 'opinion') {
      c.push({ weakness: 'organisation', severity: 3, evidence: 'Barely any signposting ("the reason is", "for example") to guide the listener.' });
    }
  }
  // fillers
  if (has(m.fillerRate) && m.fillerRate >= 2.8) {
    const top = m.fillerHits[0];
    c.push({
      weakness: 'fillers', severity: Math.min(5, 2.2 + m.fillerRate / 2.5),
      evidence: `"${(top ? top.filler : 'um')}" and friends appeared about ${m.fillerRate} times per 100 words (${m.fillerCount} total).`,
    });
  }
  // pace
  if (has(m.wpm) && m.wpm >= 175) c.push({ weakness: 'pace', severity: Math.min(5, 2 + (m.wpm - 175) / 25), evidence: `Around ${m.wpm} words per minute — comfortably past the 130-150 clarity range.` });
  if (has(m.wpm) && m.wordCount >= 80 && m.wpm <= 95) c.push({ weakness: 'pace', severity: 2.5, evidence: `Around ${m.wpm} words per minute — slow enough that the energy drains from the answer.` });
  // precision
  if (has(m.vagueRate) && m.vagueRate >= 2.5) {
    const top = m.vagueHits[0];
    c.push({ weakness: 'precision', severity: Math.min(5, 2 + m.vagueRate / 2), evidence: `Vague words like "${top ? top.word : 'good'}" appeared about ${m.vagueRate} times per 100 words.` });
  }
  // opening
  if (m.wordCount >= 40 && has(m.openingDirectness) && m.openingDirectness < 0.35) {
    c.push({ weakness: 'opening', severity: 3.6, evidence: 'The first two sentences did not address the question directly — you warmed up before you spoke.' });
  }
  // conclusion
  if (m.wordCount >= 60 && !m.hasConclusion && ['opinion', 'persuasion', 'explain', 'story'].includes(ctx.category)) {
    c.push({ weakness: 'conclusion', severity: 3.2, evidence: 'No closing statement — the answer ran out of road instead of arriving.' });
  }
  // repetition
  if (m.repeatedPhrases.length && m.repeatedPhrases[0][1] >= 3) {
    c.push({ weakness: 'repetition', severity: 3 + m.repeatedPhrases[0][1] / 4, evidence: `The phrase "${m.repeatedPhrases[0][0]}" was repeated ${m.repeatedPhrases[0][1]} times.` });
  }
  // sentence construction
  if (m.wordCount >= 50 && ((m.avgSentenceLen || 0) >= 24 || m.longSentences >= 2)) {
    c.push({ weakness: 'sentenceConstruction', severity: m.longSentences >= 2 ? 3.8 : 3, evidence: `Average sentence length was ${m.avgSentenceLen} words with ${m.longSentences} long, stacked sentences.` });
  }
  // examples
  if (m.wordCount >= 60 && m.exampleHits === 0 && ['story', 'persuasion', 'explain'].includes(ctx.category)) {
    c.push({ weakness: 'specificity', severity: 3.4, evidence: 'No concrete example or story anywhere — the entire answer stayed abstract.' });
  }
  // verbosity / development
  if (m.targetSeconds && m.durationSeconds > m.targetSeconds * 1.35 && (m.relevance === null || m.relevance < 0.5)) {
    c.push({ weakness: 'verbosity', severity: 3, evidence: `You used ${Math.round(m.durationSeconds)}s of a ${m.targetSeconds}s target and much of it was not pointed at the question.` });
  }
  if (m.targetSeconds && m.durationSeconds >= 8 && m.durationSeconds < m.targetSeconds * 0.45 && m.wordCount < m.targetSeconds * 1.5) {
    c.push({ weakness: 'development', severity: 3.5, evidence: `The answer used only ${Math.round(m.durationSeconds)}s of a ${m.targetSeconds}s challenge — a headline without an article.` });
  }
  // relevance
  if (has(m.relevance) && m.relevance < 0.22 && m.wordCount >= 50) {
    c.push({ weakness: 'relevance', severity: 3.8, evidence: 'Large parts of the answer were not connected to the words of the question actually asked.' });
  }
  // vocal delivery (only when actually measured)
  if (audio && audio.measured && audio.spokeEnough && audio.loudnessVariation < 0.35) {
    c.push({ weakness: 'vocalDelivery', severity: 3, evidence: 'Voice loudness stayed nearly constant through the whole answer — flat delivery.', audioOnly: true });
  }
  return c;
}

/* Pick THE one most important thing, weighting recurring history. */
export function selectKeyWeakness(measuredOrAnalysis, audio, ctx, patterns = []) {
  const measured = measuredOrAnalysis && measuredOrAnalysis.measured ? measuredOrAnalysis.measured : measuredOrAnalysis;
  const candidates = detectCandidates(measured, audio, ctx);
  if (!candidates.length) {
    return {
      weaknessKey: null,
      candidates,
      verdict: 'clean',
      note: 'No dominant weakness crossed the bar on this attempt. Nothing forced itself into the red — so the standard rises next time.',
    };
  }
  const freq = {};
  patterns.forEach((p) => { freq[p.weakness_key] = p.times_observed; });
  candidates.forEach((cand) => {
    const lib = WEAKNESS_LIBRARY[cand.weakness];
    cand.priority = cand.severity * (1 + 0.25 * Math.min(6, freq[cand.weakness] || 0)) + (cand.audioOnly ? -0.2 : 0);
    cand.label = lib.label;
    cand.skillKey = lib.skill;
  });
  candidates.sort((a, b) => b.priority - a.priority);
  const winner = candidates[0];
  return { weaknessKey: winner.weakness, winner, candidates, verdict: 'weakness' };
}

/* Retry: same challenge, one targeted constraint. */
export function buildRetryConstraint(weaknessKey, basePrompt, speakSeconds) {
  const seconds = Math.max(30, Math.round((speakSeconds || 60) * 0.75));
  const map = {
    organisation: { instruction: 'Give the same answer again, this time inside a fixed path: POINT → REASON → EXAMPLE → CONCLUSION. Say each stage marker out loud.', seconds },
    fillers: { instruction: 'Answer again. Every time you feel a filler coming, close your mouth and pause instead. Silence counts in your favour.', seconds },
    pace: { instruction: 'Answer again at a controlled pace: roughly 140 words per minute. Finish every word — especially its ending.', seconds },
    precision: { instruction: 'Answer again with zero vague words. Ban "good, bad, thing, stuff, nice, big, a lot". Name everything exactly.', seconds },
    opening: { instruction: 'Answer again. Your very first sentence must state your position on the question. No warm-up.', seconds },
    conclusion: { instruction: 'Answer again. Your final sentence must begin "So the point is…" and close the answer. Open no new ideas at the end.', seconds },
    repetition: { instruction: 'Answer again without repeating any phrase you used the first time. One clean pass, then stop.', seconds },
    sentenceConstruction: { instruction: 'Answer again in short sentences: one idea per sentence, nothing over about 15 words.', seconds },
    specificity: { instruction: 'Answer again and land at least one concrete example or story. Make the listener see it.', seconds },
    verbosity: { instruction: 'Answer again in less time, hitting the point in the first third. Stop before the timer does.', seconds },
    development: { instruction: 'Answer again and use the time properly: position → reason → one example → close. Fill the space deliberately.', seconds: speakSeconds || 60 },
    relevance: { instruction: 'Answer again. Open by restating the question in your own words, then answer only that.', seconds },
    vocalDelivery: { instruction: 'Answer again with deliberate contrast: lift the key words, let the rest fall, and slow down on your main point.', seconds },
  };
  return map[weaknessKey] || { instruction: 'Answer again — cleaner, tighter, calmer.', seconds };
}

/* Compare two attempts against the targeted weakness + headline metrics. */
export function compareAttempts(a1, a2, weaknessKey) {
  const m1 = a1.measured;
  const m2 = a2.measured;
  const items = [];
  const add = (label, v1, v2, better, worse, format) => {
    if (v1 === null || v1 === undefined || v2 === null || v2 === undefined) return;
    let delta = v2 - v1;
    let dir = 'same';
    if (better === 'lower') dir = delta < -Math.abs(format.threshold || 0.3) ? 'improved' : delta > (format.threshold || 0.3) ? 'worse' : 'same';
    else dir = delta > (format.threshold || 0.3) ? 'improved' : delta < -(format.threshold || 0.3) ? 'worse' : 'same';
    items.push({ label, before: v1, after: v2, dir, text: format.text(v1, v2, delta) });
  };

  const per100 = (key, label, better, fmt, threshold) => {
    add(label, m1[key], m2[key], better, better === 'lower' ? 'higher' : 'lower',
      { threshold, text: (v1, v2, d) => fmt(v1, v2, d) });
  };

  // headline metrics
  if (m1.fillerRate !== null && m2.fillerRate !== null) add('Filler rate', m1.fillerRate, m2.fillerRate, 'lower', 'higher', { threshold: 0.6, text: (v1, v2) => `${v1} → ${v2} per 100 words` });
  if (m1.wpm && m2.wpm) add('Pace', m1.wpm, m2.wpm, (m1.wpm > 175 || m1.wpm < 110) ? 'target' : 'same', '', { threshold: 8, text: (v1, v2) => `${v1} → ${v2} words per minute` });
  if (m1.avgSentenceLen && m2.avgSentenceLen) add('Sentence length', m1.avgSentenceLen, m2.avgSentenceLen, 'lower', 'higher', { threshold: 2, text: (v1, v2) => `average ${v1} → ${v2} words` });
  add('Structure signposts', m1.structureHits, m2.structureHits, 'higher', 'lower', { threshold: 0.4, text: (v1, v2) => `${v1} → ${v2} markers` });
  add('Examples', m1.exampleHits, m2.exampleHits, 'higher', 'lower', { threshold: 0.4, text: (v1, v2) => `${v1} → ${v2} concrete anchors` });

  // targeted metric for the weakness
  const targeted = {
    organisation: () => add('Organisation', m1.structureHits, m2.structureHits, 'higher', 'lower', { threshold: 0.4, text: (v1, v2) => `${v1} → ${v2} structure markers` }),
    fillers: () => add('Fillers', m1.fillerCount, m2.fillerCount, 'lower', 'higher', { threshold: 1, text: (v1, v2) => `${v1} → ${v2} filler words` }),
    pace: () => add('Pace control', m1.wpm, m2.wpm, m1.wpm > 175 ? 'lower' : 'higher', '', { threshold: 8, text: (v1, v2) => `${v1} → ${v2} words per minute` }),
    precision: () => add('Vague words', m1.vagueCount, m2.vagueCount, 'lower', 'higher', { threshold: 1, text: (v1, v2) => `${v1} → ${v2} vague words` }),
    opening: () => add('Opening directness', m1.openingDirectness, m2.openingDirectness, 'higher', 'lower', { threshold: 0.15, text: (v1, v2) => `directness ${Math.round(v1 * 100)}% → ${Math.round(v2 * 100)}%` }),
    conclusion: () => add('Conclusion', m1.hasConclusion ? 1 : 0, m2.hasConclusion ? 1 : 0, 'higher', 'lower', { threshold: 0.4, text: (v1, v2) => (v1 ? 'present' : 'absent') + ' → ' + (v2 ? 'present' : 'absent') }),
    repetition: () => add('Repetition', a1.measured.repeatedPhrases.length ? a1.measured.repeatedPhrases[0][1] : 0, a2.measured.repeatedPhrases.length ? a2.measured.repeatedPhrases[0][1] : 0, 'lower', 'higher', { threshold: 1, text: (v1, v2) => `worst phrase repeated ${v1} → ${v2} times` }),
    sentenceConstruction: () => add('Long sentences', m1.longSentences, m2.longSentences, 'lower', 'higher', { threshold: 0.4, text: (v1, v2) => `${v1} → ${v2} long stacked sentences` }),
    specificity: () => add('Examples', m1.exampleHits, m2.exampleHits, 'higher', 'lower', { threshold: 0.4, text: (v1, v2) => `${v1} → ${v2} concrete anchors` }),
    verbosity: () => add('Economy', m1.durationSeconds, m2.durationSeconds, 'lower', 'higher', { threshold: 4, text: (v1, v2) => `${v1}s → ${v2}s of speaking` }),
    development: () => add('Development', m1.wordCount, m2.wordCount, 'higher', 'lower', { threshold: 15, text: (v1, v2) => `${v1} → ${v2} words used` }),
    relevance: () => add('Relevance', m1.relevance, m2.relevance, 'higher', 'lower', { threshold: 0.1, text: (v1, v2) => `on-topic ${Math.round(v1 * 100)}% → ${Math.round(v2 * 100)}%` }),
    vocalDelivery: () => {
      if (a1.audio && a2.audio && a1.audio.measured && a2.audio.measured && a1.audio.spokeEnough && a2.audio.spokeEnough) {
        add('Delivery contrast', a1.audio.loudnessVariation, a2.audio.loudnessVariation, 'higher', 'lower', { threshold: 0.06, text: (v1, v2) => `loudness variation ${(Math.round(v1 * 100) / 100).toFixed(2)} → ${(Math.round(v2 * 100) / 100).toFixed(2)}` });
      }
    },
  };
  (targeted[weaknessKey] || (() => {}))();

  const improved = items.filter((i) => i.dir === 'improved');
  const worse = items.filter((i) => i.dir === 'worse');
  const same = items.filter((i) => i.dir === 'same');

  let headline;
  if (!improved.length && !worse.length) headline = 'This attempt landed in the same place as the first. Same habits, same result — the constraint did not yet change the behaviour.';
  else if (improved.length && !worse.length) headline = 'The targeted weakness responded. ' + (improved[0] ? `${improved[0].label} moved: ${improved[0].text}.` : '');
  else if (!improved.length && worse.length) headline = 'The retry traded one problem for another. Focused on the new constraint, an old habit crept back.';
  else headline = `Real progress on ${improved.map((i) => i.label.toLowerCase()).join(', ')}, but ${worse.map((i) => i.label.toLowerCase()).join(', ')} slipped. Progress is rarely clean — but it must be tracked honestly.`;

  const nextStep = improved.length
    ? `Keep the constraint "${WEAKNESS_LIBRARY[weaknessKey]?.label || weaknessKey}" in your next session — it is moving.`
    : 'Repeat this exact exercise tomorrow. Same constraint. Nothing changes until the behaviour changes.';

  return { items, improved, worse, same, headline, nextStep };
}
