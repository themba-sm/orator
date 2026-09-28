/*
 * ORATOR Conversation Simulator.
 * LISTEN → THINK → RESPOND → ADAPT → HANDLE FOLLOW-UP → REPEAT.
 *
 * A deterministic conversational engine: it analyses each spoken turn with
 * the existing analysis engine, extracts signals (vague words, claims,
 * questions, stories, emotions, length, structure), remembers what the user
 * said earlier, and picks the next line from persona-specific follow-up
 * strategies. It responds to what the user actually said — no fixed script.
 */

import { analyseAttempt } from './analysis.js';
import { find, insert, getCurrentUser, getProfile, weaknessPatternsSorted } from './store.js';

/* ================= Difficulty (spec 26) ================= */

export const DIFFICULTIES = {
  foundation: { label: 'FOUNDATION', turns: 4, interruptP: 0.04, challenge: 0.5, prepScale: 1.5, vagueTolerance: 2, rapidCount: 5 },
  developing: { label: 'DEVELOPING', turns: 5, interruptP: 0.10, challenge: 0.8, prepScale: 1.0, vagueTolerance: 1, rapidCount: 6 },
  advanced: { label: 'ADVANCED', turns: 6, interruptP: 0.18, challenge: 1.1, prepScale: 0.6, vagueTolerance: 0, rapidCount: 7 },
  elite: { label: 'ELITE', turns: 7, interruptP: 0.28, challenge: 1.4, prepScale: 0.3, vagueTolerance: 0, rapidCount: 8 },
};

/* ================= Modes (specs 2, 30) ================= */

export const MODES = [
  { key: 'interview', label: 'Interview me', persona: 'interviewer', hint: 'Professional, curious, unpredictable.' },
  { key: 'challenge', label: 'Challenge me', persona: 'difficult', hint: 'Pressure, pushback, interruptions.' },
  { key: 'network', label: 'Network with me', persona: 'networker', hint: 'Introduce yourself, connect, keep it flowing.' },
  { key: 'persuade', label: 'Persuade me', persona: 'client', hint: 'Sell the idea, handle the objection.' },
  { key: 'debate', label: 'Debate me', persona: 'debater', hint: 'Reason, rebut, hold your ground.' },
  { key: 'spotlight', label: 'Put me on the spot', persona: 'interviewer', hint: 'Rapid-fire. Think on your feet.' },
  { key: 'casual', label: 'Casual conversation', persona: 'friend', hint: 'Everyday talk. Skills transfer here or nowhere.' },
  { key: 'random', label: 'Random', persona: null, hint: 'A conversation chosen from your history and weaknesses.' },
  { key: 'journalism', label: 'Press me', persona: 'journalist', hint: 'Persistent, specific, unsatisfied with vague.' },
  { key: 'executive', label: 'Brief my executive', persona: 'executive', hint: 'Bottom line first. Time is money.' },
  { key: 'business', label: 'Client meeting', persona: 'client', hint: 'Explain, manage expectations, resolve.' },
  { key: 'story', label: 'Tell me a story', persona: 'friend', hint: 'Real stories, natural follow-ups.' },
];

/* ================= Personas (spec 3) ================= */

const GENERIC = {
  why: ['Why do you say that?', 'That is a claim, not a reason yet. Why?', 'Say more about why that is true.'],
  how: ['How does that work in practice?', 'Walk me through how that actually happens.'],
  example: ['Give me one concrete example.', 'Can you show me what that looks like in real life?'],
  evidence: ['How do you know that? What is it based on?', 'What backs that up?'],
  specifics: ['Be more specific. What exactly do you mean?', 'That is still general. Name the specifics.'],
  clarification: ['I am not sure I follow. Can you put that more clearly?', 'What do you mean by that, exactly?'],
  challenge: ['Let me push back on that for a second.', 'I am not convinced. Make the case again, tighter.'],
  deeper: ['What is behind that for you?', 'There is more under that answer. What?'],
  emotional: ['How did that actually feel?', 'What was going through your head when that happened?'],
  personal: ['And you? Where do you sit in all this?', 'What is your part in that story?'],
  practical: ['What would you do about it tomorrow?', 'How would that play out in the real world?'],
  consequence: ['And what happens if that does not work?', 'What is the cost of being wrong about that?'],
  comparison: ['How does that compare with the usual way of doing it?', 'What is different about that approach?'],
  pivot: ['Let me shift direction for a moment.', 'New angle for a second.'],
  respond: ['Fair question. I will get to that — but first: ', 'You get your question at the end. First: '],
  callback: ['Earlier you told me: "{fact}". {followup}'],
  acknowledge: ['Good. ', 'Right. ', 'Okay. ', 'I hear you. '],
};

export const PERSONAS = {
  interviewer: {
    key: 'interviewer', name: 'The Interviewer', role: 'Professional, curious, unpredictable',
    weights: { why: 1.3, example: 1.2, clarification: 1.1, deeper: 1.0, specifics: 1.0, evidence: 0.9, how: 0.9 },
    followUps: {
      why: ['Why? Take me to the reason underneath.', 'Why do you think that is?'],
      example: ['Give me a specific example of that.', 'Can you point to a time that actually happened?'],
      clarification: ['I want to make sure I understand. Say that again, more precisely.', 'That was a bit vague. What exactly do you mean?'],
      deeper: ['Interesting. What is underneath that for you?', 'What made you see it that way?'],
      respond: ['Fair question. Let me answer that after — first: '],
    },
    interrupt: {
      p: 0.12,
      lines: ['Sorry to interrupt — what is your main point?', 'Hold on. Bottom line, please.', 'Let me stop you there. What are you actually saying?'],
    },
    wrap: ['Last question, then we are done.', 'One final thing.'],
  },
  executive: {
    key: 'executive', name: 'The Executive', role: 'Concise, direct, time-conscious',
    weights: { specifics: 1.4, clarification: 1.2, example: 0.8, why: 1.0, consequence: 1.2, evidence: 0.9 },
    followUps: {
      specifics: ['Be specific. What exactly do you recommend?', 'Get to the point. What is the actual recommendation?'],
      why: ['Why? I have two minutes.', 'Why should I care about that?'],
      clarification: ['You have given me background. What is your actual point?', 'That is a lot of words. What is the decision?'],
      consequence: ['What happens if we do nothing?', 'And if it fails? What does it cost me?'],
      how: ['Fine. How? In one sentence.', 'How would that work? Briefly.'],
      example: ['One example. Quickly.'],
      respond: ['You can ask me that at the end. First: '],
    },
    interrupt: {
      p: 0.22,
      lines: ['Can you get to the point?', 'You have had the background. The point, please.', 'I have a meeting in four minutes. Bottom line?', 'Sorry — I do not follow. Give me the one sentence version.'],
    },
    wrap: ['Last one. Make it count.', 'Wrap it up. Final point.'],
  },
  journalist: {
    key: 'journalist', name: 'The Journalist', role: 'Curious, persistent, allergic to vague',
    weights: { specifics: 1.4, evidence: 1.3, example: 1.2, clarification: 1.1, why: 1.0, deeper: 0.9, consequence: 0.9 },
    followUps: {
      specifics: ['You said "{quote}". What does that actually mean?', 'That sounds good, but it is vague. Specifics, please.'],
      evidence: ['How do you know that? Show me the evidence.', 'Is that a fact or a feeling? What is it based on?'],
      example: ['Give me a real example I can picture.', 'Who exactly? Where exactly?'],
      clarification: ['Let me quote you back: "{quote}". Is that what you want on record?', 'I think you said more than you explained. Clarify?'],
      why: ['Why? I need more than an assertion.', 'Why should my readers believe that?'],
      deeper: ['What is the story underneath that?', 'There is something you are not saying. What?'],
      respond: ['I will come back to that. My interview, my questions — first: '],
    },
    interrupt: {
      p: 0.10,
      lines: ['Stop for a second — that is a big claim. Can you back it up?', 'Sorry — you did not answer the question. The actual question.'],
    },
    wrap: ['One last thing before we run out of tape.', 'Final question.'],
  },
  skeptic: {
    key: 'skeptic', name: 'The Skeptic', role: 'Does not accept claims easily',
    weights: { why: 1.5, challenge: 1.4, evidence: 1.3, consequence: 1.0, comparison: 0.9, counter: 1.2 },
    followUps: {
      why: ['Why? Genuinely — convince me.', 'Why should I believe that?'],
      challenge: ['I do not buy it. Here is the weakness I see: it assumes everything goes right. What if it does not?', 'That sounds nice in theory. Reality is messier. Why is your version different?'],
      counter: ['Someone would say the opposite: that this creates more problems than it solves. Your response?', 'I can name three people who would disagree with you. What would you tell them?'],
      evidence: ['What evidence supports that? Anything concrete?', 'Have you actually tested that, or is it a theory?'],
      consequence: ['And if you are wrong, what then?', 'What is the failure mode here?'],
      why2: ['Why though?'],
      respond: ['Answer mine first, then yours: '],
    },
    interrupt: {
      p: 0.14,
      lines: ['I disagree. Keep going anyway — tell me why I am wrong.', 'Hold on. That does not follow. Explain the logic.'],
    },
    wrap: ['Last chance to change my mind.', 'One final attempt to convince me.'],
  },
  debater: {
    key: 'debater', name: 'The Debater', role: 'Takes the other side, adapts to your argument',
    weights: { counter: 1.5, challenge: 1.3, comparison: 1.1, why: 1.1, evidence: 1.0, clarification: 0.8 },
    followUps: {
      counter: ['Here is the counter: {counterarg}. Your response?', 'I will argue the opposite: {counterarg}. Go.', 'Someone in the audience just said: "{counterarg}". Rebut it.'],
      challenge: ['That is your position. Defend the weak part of it.', 'I see two holes in that. Start with the bigger one.'],
      comparison: ['Compared to what? Give me the alternative you rejected and why.', 'Better than what, exactly?'],
      why: ['Why is your side the stronger one?'],
      evidence: ['Ground it. What supports your case?'],
      respond: ['Debate me first, then I will answer. Go: '],
    },
    interrupt: {
      p: 0.12,
      lines: ['I disagree — and you have twenty seconds to respond.', 'Point of order. That argument is not relevant. Refocus.'],
    },
    wrap: ['Closing statement. Thirty seconds.', 'Final word. Make it land.'],
  },
  client: {
    key: 'client', name: 'The Client', role: 'Business-minded, practical, politely demanding',
    weights: { practical: 1.3, how: 1.2, consequence: 1.1, evidence: 1.0, specifics: 1.1, example: 0.9 },
    followUps: {
      practical: ['What would that look like for us, practically?', 'Fine in theory. What do we actually do on Monday?'],
      how: ['How would you make that happen with our team?', 'Walk me through the how.'],
      consequence: ['And if it does not work out, what have we lost?', 'What is the risk here?'],
      objection: ['Honestly? That sounds expensive. Why is it worth it?', 'We tried something like this before. It flopped. Why is yours different?'],
      specifics: ['Put a number or a timeline on that for me.', 'Be specific about what we get.'],
      respond: ['Good question — I will answer, but first tell me: '],
    },
    interrupt: {
      p: 0.10,
      lines: ['Sorry to cut in — what does that mean in money and time?', 'Stop. Are you saying we should spend more? Clarify that.'],
    },
    wrap: ['Alright, last question before I decide.', 'One more thing and then we are done.'],
  },
  networker: {
    key: 'networker', name: 'The Contact', role: 'Warm, curious, natural',
    weights: { personal: 1.3, deeper: 1.1, how: 0.9, example: 0.8, pivot: 0.8, emotional: 0.9 },
    followUps: {
      personal: ['So what is your side of that?', 'And where do you fit into all this?'],
      deeper: ['What got you into that in the first place?', 'That is not the usual path. What is the story?'],
      how: ['How does that work day to day?', 'What does that actually involve?'],
      pivot: ['By the way — changing topics completely: ', 'Okay, new thread — '],
      example: ['Like what? Give me a flavour of it.'],
      respond: ['Ha — I owe you an answer for that. But you first: ', 'Good question. You get my answer after: '],
    },
    interrupt: { p: 0.02, lines: ['Sorry — quick tangent. That thing you said thirty seconds ago — tell me more about that.'] },
    wrap: ['This has been good. One last question before we swap details.', 'Okay — final one, then I should circulate.'],
  },
  friend: {
    key: 'friend', name: 'The Friend', role: 'Casual, natural, human',
    weights: { emotional: 1.2, personal: 1.2, deeper: 1.0, how: 0.8, pivot: 0.9, example: 0.7 },
    followUps: {
      emotional: ['How did that feel, honestly?', 'That sounds like it was a lot. What was going on for you?'],
      personal: ['What about you though? What did you do?', 'Where were you in all that?'],
      deeper: ['What was that like for you?', 'What made you go for it?'],
      how: ['Wait, how does that even work?', 'How did that happen?'],
      pivot: ['Completely different topic — ', 'Okay, random question — '],
      example: ['Like what? Give me an example.'],
      respond: ['Ha! You first though — ', 'I will answer, promise. First: '],
    },
    interrupt: { p: 0.02, lines: ['Sorry, quick one — what did you mean by that just now?'] },
    wrap: ['Last thing and then I have to run.', 'One more question and then we should get going.'],
  },
  difficult: {
    key: 'difficult', name: 'The Difficult One', role: 'Impatient, skeptical, interrupting — never abusive',
    weights: { challenge: 1.4, specifics: 1.3, clarification: 1.2, why: 1.1, counter: 1.0, evidence: 1.0 },
    followUps: {
      challenge: ['I have heard better pitches today, honestly. What else have you got?', 'You are losing me. Why should I care?'],
      specifics: ['Vague. Again, but specific this time.', 'None of that means anything. Numbers, names, facts.'],
      clarification: ['I do not understand what you just said. Say it more simply.', 'What are you even asking me for? Be clear.'],
      why: ['Why? Give me one good reason.', 'Why though? Actually why?'],
      counter: ['I think you are wrong, and I am not sure you have thought this through. Convince me.', 'That has holes in it. Defend it.'],
      evidence: ['Based on what? Show me something real.', 'Prove it.'],
      respond: ['My questions first. Then maybe yours: '],
    },
    interrupt: {
      p: 0.26,
      lines: ['Sorry to interrupt — what is your main point?', 'Can you get to the point?', 'I do not understand what you are saying. Again, clearly.', 'Give me an example. Right now.', 'You have got twenty seconds for this.', 'I disagree. Continue anyway.'],
    },
    wrap: ['Fine. Last question.', 'One more and then I am done listening.'],
  },
};

/* ================= Scenario library (specs 4, 12, 13, 14, 15) ================= */

export const SCENARIOS = [
  { id: 'iv-job', mode: 'interview', persona: 'interviewer', category: 'interview',
    context: 'You are in a job interview for a role you want. The interviewer has your CV and no patience for rehearsed answers.',
    userRole: 'Candidate', objective: 'Present yourself clearly and handle probing follow-ups.',
    hiddenSkills: ['clarity', 'structure', 'specificity', 'composure'], prep: 30, turns: null,
    opener: 'Thanks for coming in. First thing: tell me why this role, and skip the generic version.', },
  { id: 'iv-podcast', mode: 'interview', persona: 'journalist', category: 'interview',
    context: 'You are a guest on a podcast. The host is curious and will dig into whatever you say.',
    userRole: 'Guest', objective: 'Be engaging, specific, and keep the thread of the conversation.',
    hiddenSkills: ['storytelling', 'specificity', 'flow'], prep: 20, turns: null,
    opener: 'Welcome. Let us start simple: what do you do, and why does it matter?', },
  { id: 'net-event', mode: 'network', persona: 'networker', category: 'networking',
    context: 'A business event. You have approached a successful entrepreneur you want to know. You have about 90 seconds to make it a conversation, not a pitch.',
    userRole: 'Yourself', objective: 'Introduce yourself and build a real exchange.',
    hiddenSkills: ['concise introduction', 'curiosity', 'follow-up questions', 'conversational balance'], prep: 15, turns: null,
    opener: 'Hey — good event, right? I do not think we have met. What brings you here?', },
  { id: 'net-hero', mode: 'network', persona: 'networker', category: 'networking',
    context: 'You accidentally find yourself next to someone you admire at a conference coffee break.',
    userRole: 'Yourself', objective: 'Say something worth their time without monologuing.',
    hiddenSkills: ['confidence', 'listening', 'question quality'], prep: 10, turns: null,
    opener: 'Oh hi — you are in the AI track too? What did you think of that last talk?', },
  { id: 'ex-budget', mode: 'executive', persona: 'executive', category: 'executive',
    context: 'You have five minutes with a senior executive to recommend a significant investment.',
    userRole: 'Advisor', objective: 'Deliver the recommendation, bottom line first, and survive scrutiny.',
    hiddenSkills: ['conciseness', 'structure', 'clarity under pressure'], prep: 30, turns: null,
    opener: 'You have five minutes. What are you recommending, and what does it cost?', },
  { id: 'ex-update', mode: 'executive', persona: 'executive', category: 'executive',
    context: 'A project you lead is behind schedule. The executive wants the status, not the story.',
    userRole: 'Project lead', objective: 'Own the situation with clarity and brevity.',
    hiddenSkills: ['clarity', 'composure', 'structure'], prep: 25, turns: null,
    opener: 'I have four minutes between meetings. Where is the project, really?', },
  { id: 'df-criticism', mode: 'challenge', persona: 'difficult', category: 'difficult',
    context: 'A senior colleague has just criticised your work in a meeting, and now you are alone with them.',
    userRole: 'Colleague', objective: 'Respond calmly, engage the criticism honestly, keep respect on both sides.',
    hiddenSkills: ['composure', 'listening', 'firmness with respect'], prep: 20, turns: null,
    opener: 'So. You want to explain what happened in there?', },
  { id: 'df-no', mode: 'challenge', persona: 'difficult', category: 'difficult',
    context: 'Someone is making an unreasonable request and will not take no for an answer.',
    userRole: 'Yourself', objective: 'Say no clearly, stay firm and respectful, explain your reasons once.',
    hiddenSkills: ['firmness', 'clarity', 'emotional control'], prep: 15, turns: null,
    opener: 'Look, I am going to be direct: I need this from you, and I need it this week.', },
  { id: 'ps-website', mode: 'persuade', persona: 'client', category: 'persuasion',
    context: 'You believe the business should invest in a new website. The current one "works fine".',
    userRole: 'Advocate', objective: 'Make the case with evidence and handle the objections.',
    hiddenSkills: ['persuasion', 'evidence', 'conclusions'], prep: 30, turns: null,
    opener: 'You wanted to talk about the website. The current one works. Why are we spending money?', },
  { id: 'ps-idea', mode: 'persuade', persona: 'skeptic', category: 'persuasion',
    context: 'You are convincing someone to try something new — a method, a tool, a way of working. They are skeptical by nature.',
    userRole: 'Persuader', objective: 'Persuade without overselling, and stay composed under challenge.',
    hiddenSkills: ['persuasion', 'composure', 'precision'], prep: 25, turns: null,
    opener: 'Alright, sell me on it. And I warn you — I have heard pitches before.', },
  { id: 'db-remote', mode: 'debate', persona: 'debater', category: 'debate',
    context: 'A friendly debate: should companies go fully remote? You take a side; the debater takes the other.',
    userRole: 'Debater', objective: 'Argue, rebut, and keep your structure under pressure.',
    hiddenSkills: ['reasoning', 'rebuttal', 'composure', 'conciseness'], prep: 30, turns: null,
    opener: 'Pick your side — remote work is better, or it is worse. Then defend it. Go.', },
  { id: 'db-education', mode: 'debate', persona: 'skeptic', category: 'debate',
    context: 'The topic: is formal education still worth it? The skeptic will not accept weak reasoning.',
    userRole: 'Debater', objective: 'Build a reasoned case and hold it while it is attacked.',
    hiddenSkills: ['reasoning', 'evidence', 'structure'], prep: 30, turns: null,
    opener: 'Simple question with a hard answer: is formal education still worth the money? Yes or no, and why.', },
  { id: 'jr-explain', mode: 'journalism', persona: 'journalist', category: 'journalism',
    context: 'A journalist is writing a piece about your field and wants you to explain it to their readers.',
    userRole: 'Expert', objective: 'Be precise, concrete, and quotable. No vague claims survive.',
    hiddenSkills: ['precision', 'clarity', 'specificity'], prep: 20, turns: null,
    opener: 'Thanks for the time. Start by telling me plainly: what is it that you actually do?', },
  { id: 'bs-client', mode: 'business', persona: 'client', category: 'business',
    context: 'A client meeting. They have a problem, you have a service, and they are comparing you to two other providers.',
    userRole: 'Provider', objective: 'Explain what you do, manage expectations, and handle the objection coming.',
    hiddenSkills: ['explaining', 'listening', 'objection handling'], prep: 20, turns: null,
    opener: 'So — a friend said you were good. Convince me. What is it exactly that you do for people like me?', },
  { id: 'bs-misunderstanding', mode: 'business', persona: 'client', category: 'business',
    context: 'A misunderstanding has developed on a project. The client thinks you promised something you did not.',
    userRole: 'Provider', objective: 'Correct the record without blame, keep the relationship, be clear.',
    hiddenSkills: ['diplomacy', 'clarity', 'composure'], prep: 25, turns: null,
    opener: 'We need to talk about this project, because what I understood and what you understood are two different things.', },
  { id: 'st-wrong', mode: 'story', persona: 'friend', category: 'storytelling',
    context: 'A natural conversation. You are asked about a time something went completely wrong.',
    userRole: 'Yourself', objective: 'Tell a real story with a hook, conflict, and a lesson — then survive the follow-ups.',
    hiddenSkills: ['storytelling', 'detail', 'pacing'], prep: 20, turns: null,
    opener: 'Okay, real question: tell me about something that went completely wrong for you.', },
  { id: 'st-mind', mode: 'story', persona: 'networker', category: 'storytelling',
    context: 'Someone you just met is genuinely curious about you.',
    userRole: 'Yourself', objective: 'Tell the story of a time you changed your mind about something important.',
    hiddenSkills: ['storytelling', 'reflection', 'authenticity'], prep: 20, turns: null,
    opener: 'Interesting person, apparently. So — tell me about a time you completely changed your mind about something.', },
  { id: 'cs-weekend', mode: 'casual', persona: 'friend', category: 'casual',
    context: 'A friend over coffee. No agenda, no pressure — just talk.',
    userRole: 'Yourself', objective: 'Be natural. This is where trained skills become real ones.',
    hiddenSkills: ['naturalness', 'conversational balance', 'question quality'], prep: 0, turns: null,
    opener: 'Hey, how has your week actually been? Not the polite version.', },
  { id: 'cs-admire', mode: 'casual', persona: 'friend', category: 'casual',
    context: 'Someone at a braai asks what you are working on these days.',
    userRole: 'Yourself', objective: 'Explain what you do in ordinary language, and keep it a conversation.',
    hiddenSkills: ['plain language', 'brevity', 'curiosity'], prep: 0, turns: null,
    opener: 'So what have you been up to lately? I feel like you are always building something.', },
];

/* Rapid-fire question chains (spec 9) */
export const RAPID_CHAINS = {
  foundation: ['What do you value most in your work?', 'Why that?', 'Give me one example.', 'What would someone who disagrees say?', 'Summarise your position in one sentence.'],
  developing: ['What do you value most?', 'Why?', 'Example — now.', 'What would a skeptic say?', 'Your response to the skeptic?', 'One sentence. Your position.'],
  advanced: ['What is the one principle you refuse to compromise?', 'Why that one?', 'Prove it with an example.', 'Now argue against yourself for a second.', 'Rebuild your case in two sentences.', 'What would you never say out loud about this? Say it.', 'One line. Your position.'],
  elite: ['What is the one principle you refuse to compromise?', 'Why that one?', 'Evidence.', 'Argue the opposite side now.', 'Back to your side — rebuild it in two sentences.', 'The weakest part of your own argument?', 'Fix that weakness out loud.', 'One sentence. Final position.'],
};

/* ================= Signal extraction (specs 1, 5, 11) ================= */

const VAGUE_WATCH = ['good', 'nice', 'stuff', 'things', 'a lot', 'big', 'great', 'amazing', 'sort of', 'kind of', 'very', 'really'];
const EMOTION_POS = ['proud', 'happy', 'excited', 'love', 'grateful', 'thrilled'];
const EMOTION_NEG = ['hard', 'difficult', 'scared', 'frustrated', 'angry', 'tired', 'nervous', 'struggled', 'worried'];
const ACK_RE = /\b(you mentioned|you said|good point|fair|that makes sense|i see|right,|agreed|i hear you|interesting)\b/i;
const STORY_RE = /\b(when i|once|at the time|years ago|back then|one time|last year|that day)\b/i;
const CLAIM_RE = /\b(i think|i believe|i feel|i found|i reckon|i suppose|in my opinion)\b/i;
const STOPWORDS = new Set('the and but for you that this with have are was were been being have has had will would could should from they them their there here what when where which while about into over after before then than more most some just also very really much many like know want need make made take takes get got got go going went say said says said one two because not now new old time year day way thing things lot lots i me my we our us it its a an of in on at to by as is am do does did so if or'.split(' '));

export function extractSignals(measured, transcript) {
  const t = (transcript || '').trim();
  const lower = t.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  const topics = {};
  words.forEach((w) => {
    const clean = w.toLowerCase().replace(/[^a-z'-]/g, '');
    if (clean.length > 3 && !STOPWORDS.has(clean) && !VAGUE_WATCH.includes(clean)) {
      topics[clean] = (topics[clean] || 0) + 1;
    }
  });
  const topTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);
  const vagueHit = (measured.vagueHits || [])[0];
  const sentences = t.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const longestRun = sentences.slice().sort((a, b) => b.length - a.length)[0] || '';

  return {
    topics: topTopics,
    topic: topTopics[0] || null,
    vague: measured.vagueCount > 0,
    vagueWord: vagueHit ? vagueHit.word : null,
    quote: longestRun.split(/\s+/).slice(0, 9).join(' '),
    noExample: measured.exampleHits === 0 && words.length > 25,
    claim: CLAIM_RE.test(lower),
    questionAsked: t.includes('?'),
    longAnswer: words.length > 90,
    shortAnswer: words.length > 0 && words.length < 15,
    story: STORY_RE.test(lower),
    emotional: EMOTION_POS.some((w) => lower.includes(w)) || EMOTION_NEG.some((w) => lower.includes(w)),
    acknowledged: ACK_RE.test(lower),
    disagreement: /\b(but|however|disagree|not really|i don't think|no,)\b/i.test(lower),
    numbers: /\d/.test(t),
    fillerHeavy: measured.fillerRate !== null && measured.fillerRate > 4,
    structured: measured.structureHits >= 2,
    hasConclusion: !!measured.hasConclusion,
    wpm: measured.wpm,
    wordCount: words.length,
    sentenceCount: sentences.length,
  };
}

/* ================= Conversational memory (spec 6) ================= */

function rememberFacts(mem, transcript) {
  const facts = [];
  const re = /\b(i started|my|our|i built|i created|i run|i work|i learned|i realised|i realized|i saw|i noticed|i began)\b[^.!?]{6,90}/gi;
  let m;
  while ((m = re.exec(transcript)) && facts.length < 2) {
    const frag = m[0].replace(/\s+/g, ' ').trim();
    if (frag.split(/\s+/).length >= 5) facts.push(frag.slice(0, 110));
  }
  mem.facts = [...(mem.facts || []), ...facts].slice(-6);
  return facts;
}

/* ================= Scenario selection (specs 16, 26) ================= */

const WEAKNESS_MODE_BOOST = {
  verbosity: ['executive', 'challenge'], organisation: ['interview', 'debate'],
  fillers: ['challenge', 'persuade'], precision: ['journalism'],
  specificity: ['story', 'journalism'], development: ['story', 'interview'],
  relevance: ['journalism', 'interview'], opening: ['network', 'interview'],
  conclusion: ['persuade', 'debate'], pace: ['spotlight'], sentenceConstruction: ['interview'],
  repetition: ['challenge'], vocalDelivery: ['persuade', 'story'],
};

export function pickScenario(modeKey, difficulty, profile) {
  const patterns = weaknessPatternsSorted();
  let pool = SCENARIOS.filter((s) => s.mode === modeKey);
  if (modeKey === 'random') {
    const boosts = new Set();
    patterns.slice(0, 3).forEach((p) => (WEAKNESS_MODE_BOOST[p.weakness_key] || []).forEach((mk) => boosts.add(mk)));
    const scored = SCENARIOS.map((s) => {
      let score = 1;
      if (boosts.has(s.mode)) score += 2;
      const recency = find('conversations', (c) => c.scenario_id === s.id);
      if (recency.length) score -= 1.5; // avoid replaying the same scenario back to back
      return { s, score };
    }).sort((a, b) => b.score - a.score);
    pool = [scored[0].s, ...scored.slice(1, 5).map((x) => x.s)].sort(() => Math.random() - 0.5);
  }
  const scenario = pool[Math.floor(Math.random() * pool.length)];
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.developing;
  return {
    ...scenario,
    personaKey: scenario.persona,
    persona: PERSONAS[scenario.persona],
    difficulty,
    diff,
    targetTurns: diff.turns,
    prepSeconds: modeKey === 'spotlight' ? 0 : Math.max(5, Math.round((scenario.prep || 20) * diff.prepScale)),
  };
}

/* Rapid-fire scenario */
export function rapidScenario(difficulty) {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.developing;
  return {
    id: 'spotlight-' + difficulty, mode: 'spotlight', persona: 'interviewer', category: 'rapid',
    context: 'Rapid fire. One question after another. No warm-ups, no mercy, but no tricks either.',
    userRole: 'Yourself', objective: 'Think fast, answer tight, stay composed.',
    hiddenSkills: ['thinking speed', 'verbal agility', 'composure', 'conciseness'],
    prep: 0, turns: diff.rapidCount, difficulty, diff, targetTurns: diff.rapidCount,
    prepSeconds: 0, personaKey: 'interviewer', persona: PERSONAS.interviewer,
    opener: 'Rapid fire. No preparation. First question in three seconds. Ready or not, here it comes.',
  };
}

/* ================= The next-line engine (specs 5, 7, 8) ================= */

const COUNTERARGS = {
  remote: ['remote work kills mentorship and culture', 'the office exists for a reason'],
  education: ['most graduates never use their degree', 'self-taught people out-earn them'],
  default: ['your plan assumes everything goes right', 'the cost of being wrong is higher than you admit'],
};

function fill(tpl, signals, mem, asked) {
  let out = tpl;
  const topic = signals.topic || mem.lastTopic || 'that';
  out = out.replace(/\{topic\}/g, topic);
  out = out.replace(/\{quote\}/g, signals.quote || topic);
  out = out.replace(/\{vague\}/g, signals.vagueWord || 'that');
  const fact = (mem.facts || [])[Math.floor(Math.random() * Math.max(1, (mem.facts || []).length))] || '';
  out = out.replace(/\{fact\}/g, fact.slice(0, 80) || 'something you said earlier');
  const counter = COUNTERARGS[topic] ? COUNTERARGS[topic][0] : COUNTERARGS.default[Math.floor(Math.random() * COUNTERARGS.default.length)];
  out = out.replace(/\{counterarg\}/g, counter);
  return out;
}

function pickTemplate(type, persona) {
  const pool = (persona.followUps && persona.followUps[type]) || GENERIC[type] || GENERIC.deeper;
  return pool[Math.floor(Math.random() * pool.length)];
}

/*
 * Choose the next AI line based on what the user actually said.
 * Returns { line, followUpType, interrupt, end, meta }
 */
export function nextLine(conv, turnIndex, lastSignals, lastTranscript, askedTypes, mem) {
  const persona = conv.persona;
  const diff = conv.diff;

  if (turnIndex === 0) return { line: conv.opener, followUpType: 'opener', interrupt: false, end: false };

  rememberFacts(mem, lastTranscript || '');
  mem.lastTopic = lastSignals.topic || mem.lastTopic;

  /* rapid-fire chain */
  if (conv.mode === 'spotlight') {
    const chain = RAPID_CHAINS[diff.label ? diff.label.toLowerCase() : 'developing'] || RAPID_CHAINS.developing;
    if (turnIndex > conv.targetTurns) return { line: 'That is time. Well held.', followUpType: 'wrap', interrupt: false, end: true };
    let q = chain[Math.min(turnIndex - 1, chain.length - 1)];
    if (lastSignals.vague && Math.random() < 0.6) q = 'Specifics — give me a concrete one.';
    else if (lastSignals.shortAnswer && turnIndex > 1 && Math.random() < 0.4) q = 'More than that. Why?';
    return { line: q, followUpType: 'rapid', interrupt: false, end: false, seconds: 30 };
  }

  /* wrap-up */
  if (turnIndex > conv.targetTurns) {
    return { line: (persona.wrap[0] || 'One last thing.') + ' ' + fill(pickTemplate('deeper', persona), lastSignals, mem, askedTypes), followUpType: 'wrap', interrupt: false, end: true };
  }
  const wrapping = turnIndex === conv.targetTurns;
  if (wrapping) {
    return { line: persona.wrap[Math.floor(Math.random() * persona.wrap.length)] + ' ' + fill(pickTemplate('deeper', persona), lastSignals, mem, askedTypes), followUpType: 'wrap', interrupt: false, end: false };
  }

  /* interruptions (spec 8) — triggered by over-length answers */
  if (lastSignals.longAnswer && Math.random() < persona.interrupt.p * (0.5 + diff.challenge)) {
    const line = persona.interrupt.lines[Math.floor(Math.random() * persona.interrupt.lines.length)];
    return { line, followUpType: 'interrupt', interrupt: true, end: false, meta: { recoveryTarget: true } };
  }

  /* score follow-up types against signals × persona weights × difficulty */
  const s = lastSignals;
  const triggers = {
    clarification: (s.vague ? 2 : 0) + (s.fillerHeavy ? 0.5 : 0) + diff.challenge * (s.vague ? 1 : 0),
    specifics: (s.vague ? 2.2 : 0) + (s.wordCount > 60 && s.topics.length === 0 ? 1 : 0),
    example: s.noExample ? 1.8 : 0,
    why: s.claim ? 1.9 : 0.2,
    evidence: (s.claim && s.noExample ? 1.2 : 0) + (s.numbers ? -0.5 : 0.3),
    how: s.story ? 0.8 : 0.4,
    emotional: s.story && s.emotional ? 1.6 : 0,
    deeper: s.story ? 1.1 : 0.3,
    personal: s.story && !s.emotional ? 1.0 : 0.2,
    consequence: s.claim ? 0.7 : 0.2,
    comparison: s.numbers ? 0.6 : 0.3,
    challenge: (diff.challenge * (s.longAnswer || s.vague ? 1.2 : 0.5)),
    counter: (persona.key === 'debater' || persona.key === 'skeptic') ? 0.9 * diff.challenge : 0.1,
    pivot: turnIndex >= 3 && Math.random() < 0.2 ? 0.9 : 0.1,
    practical: s.story ? 0.8 : 0.5,
  };

  let best = null;
  Object.entries(triggers).forEach(([type, base]) => {
    const w = (persona.weights && persona.weights[type]) !== undefined ? persona.weights[type] : 1;
    const askedPenalty = askedTypes.includes(type) ? 1.4 : 0;
    const jitter = Math.random() * 0.6;
    const score = (base * w) - askedPenalty + jitter;
    if (score > 0 && (!best || score > best.score)) best = { type, score };
  });
  const type = best ? best.type : 'deeper';
  askedTypes.push(type);

  /* respond to the user's question if they asked one — conversation, not interrogation (spec 11) */
  if (s.questionAsked && Math.random() < 0.65) {
    const resp = (persona.followUps && persona.followUps.respond) || GENERIC.respond;
    const followup = fill(pickTemplate(type, persona), lastSignals, mem, askedTypes);
    return { line: resp[Math.floor(Math.random() * resp.length)] + followup, followUpType: type, interrupt: false, end: false, acknowledged: true };
  }

  /* conversational memory callback (spec 6) */
  if ((mem.facts || []).length > 0 && turnIndex >= 3 && !mem.usedFact && Math.random() < 0.3) {
    mem.usedFact = true;
    const cb = fill(GENERIC.callback[0], lastSignals, mem, askedTypes);
    return { line: cb.replace('{followup}', fill(pickTemplate(type, persona), lastSignals, mem, askedTypes)), followUpType: type, interrupt: false, end: false, callback: true };
  }

  const line = fill(pickTemplate(type, persona), lastSignals, mem, askedTypes);
  const ack = s.acknowledged && Math.random() < 0.3 ? (GENERIC.acknowledge[Math.floor(Math.random() * GENERIC.acknowledge.length)]) : '';
  return { line: ack + line, followUpType: type, interrupt: false, end: false };
}

/* ================= Per-turn analysis ================= */

export function analyseTurn(transcript, transcriptSource, durationMs, aiLine, category) {
  const measured = analyseAttempt({
    transcript,
    transcriptSource,
    durationMs,
    targetSeconds: null,
    prompt: aiLine,
    category: category || 'conversation',
  });
  const signals = extractSignals(measured, transcript);
  return { measured, signals };
}

/* ================= Post-conversation report (specs 19, 20, 23) ================= */

function band(rate, n, thresholds = [0.75, 0.5, 0.3]) {
  if (n === 0) return { band: 'unevaluated', n };
  if (rate >= thresholds[0]) return { band: 'strong', n };
  if (rate >= thresholds[1]) return { band: 'developing', n };
  if (rate >= thresholds[2]) return { band: 'inconsistent', n };
  return { band: 'weak', n };
}

export function computeReport(conv, turns) {
  const userTurns = turns.filter((t) => t.speaker === 'user' && t.analysis);
  const N = userTurns.length;
  if (!N) return null;

  const avg = (f) => userTurns.reduce((a, t) => a + (t.analysis.measured[f] ?? 0), 0) / N;
  const nOf = (f) => userTurns.filter((t) => t.analysis.measured[f] !== null && t.analysis.measured[f] !== undefined).length;

  const vagueClean = userTurns.filter((t) => (t.analysis.measured.vagueRate ?? 99) < 1.2).length;
  const fillerClean = userTurns.filter((t) => (t.analysis.measured.fillerRate ?? 99) < 1.5).length;
  const onTopic = userTurns.filter((t) => (t.analysis.measured.relevance ?? 0) >= 0.35).length;
  const withExamples = userTurns.filter((t) => (t.analysis.measured.exampleHits ?? 0) >= 1).length;
  const withConclusions = userTurns.filter((t) => t.analysis.measured.hasConclusion).length;
  const wellPaced = userTurns.filter((t) => t.analysis.measured.wpm !== null && t.analysis.measured.wpm >= 110 && t.analysis.measured.wpm <= 170).length;
  const pacedN = userTurns.filter((t) => t.analysis.measured.wpm !== null).length;

  const questions = userTurns.filter((t) => t.analysis.signals.questionAsked).length;
  const acknowledgments = userTurns.filter((t) => t.analysis.signals.acknowledged).length;
  const avgWords = userTurns.reduce((a, t) => a + t.analysis.signals.wordCount, 0) / N;

  /* interruption recovery: turns following an interruption */
  const afterInterrupt = [];
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].interrupt && turns[i + 1] && turns[i + 1].speaker === 'user' && turns[i + 1].analysis) afterInterrupt.push(turns[i + 1]);
  }
  const recovered = afterInterrupt.filter((t) => t.analysis.signals.wordCount <= 70).length;

  /* weakness mapping: the weakest dimension with real evidence */
  const dims = [
    { key: 'precision', label: 'Precision', weaknessKey: 'precision', b: band(vagueClean, N), evidence: `${vagueClean}/${N} turns free of vague language` },
    { key: 'articulation', label: 'Articulation', weaknessKey: 'fillers', b: band(fillerClean, N), evidence: `${fillerClean}/${N} turns clean of fillers` },
    { key: 'responsiveness', label: 'Answering the actual question', weaknessKey: 'relevance', b: band(onTopic, N), evidence: `${onTopic}/${N} turns engaged the question asked` },
    { key: 'structure', label: 'Structure', weaknessKey: 'organisation', b: band(withExamples, N, [0.75, 0.45, 0.2]), evidence: `${withExamples}/${N} turns carried a concrete example or marker` },
    { key: 'conclusions', label: 'Strong endings', weaknessKey: 'conclusion', b: band(withConclusions, N, [0.6, 0.35, 0.15]), evidence: `${withConclusions}/${N} turns landed a closing point` },
    { key: 'conciseness', label: 'Conciseness', weaknessKey: 'verbosity', b: band(userTurns.filter((t) => t.analysis.signals.wordCount <= 80).length, N), evidence: `average ${Math.round(avgWords)} words per answer` },
    { key: 'questionQuality', label: 'Conversational curiosity', weaknessKey: null, b: band(questions, Math.max(1, N - 1), [0.5, 0.25, 0.1]), evidence: `${questions} follow-up question${questions === 1 ? '' : 's'} asked` },
    { key: 'composure', label: 'Composure under pressure', weaknessKey: null, b: band(recovered, afterInterrupt.length || (fillerClean >= N * 0.7 ? N : 0), [0.7, 0.5, 0.3]), evidence: afterInterrupt.length ? `${recovered}/${afterInterrupt.length} recovery turns stayed tight` : `${fillerClean}/${N} clean turns under pressure` },
  ];
  if (pacedN) dims.push({ key: 'pace', label: 'Pace', weaknessKey: 'pace', b: band(wellPaced, pacedN), evidence: `${wellPaced}/${pacedN} turns in the clarity pace range` });

  const weakest = dims.filter((d) => d.weaknessKey && d.b.n >= 2).sort((a, b) => rank(a.b.band) - rank(b.b.band))[0] || null;
  const strongest = dims.filter((d) => d.b.n >= 2).sort((a, b) => rank(b.b.band) - rank(a.b.band))[0] || null;

  const patterns = weaknessPatternsSorted();
  const recurring = patterns.find((p) => weakest && p.weakness_key === weakest.weaknessKey);

  return {
    dims, weakest, strongest, recurring,
    counts: { N, questions, acknowledgments, avgWords: Math.round(avgWords), interruptions: turns.filter((t) => t.interrupt).length, recovered, afterInterrupt: afterInterrupt.length },
    bestTurn: userTurns.slice().sort((a, b) => (b.analysis.measured.relevance ?? 0) - (a.analysis.measured.relevance ?? 0))[0] || null,
    worstTurn: userTurns.slice().sort((a, b) => (a.analysis.measured.relevance ?? 1) - (b.analysis.measured.relevance ?? 1))[0] || null,
  };
}

function rank(bandName) { return { strong: 4, developing: 3, inconsistent: 2, weak: 1, unevaluated: 0 }[bandName] || 0; }

/* Better version: same words, clearer order (spec 21). Honest, no personality rewrite. */
export function betterVersion(transcript, measured) {
  const sentences = (transcript || '').split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
  if (sentences.length < 2) return null;
  const cleaned = sentences.map((s) => s
    .replace(/\b(um|uh|like|you know|basically|sort of|kind of)\b,?/gi, '')
    .replace(/^[,\s]+/, '')
    .replace(/\s+/g, ' ').trim());
  // the point sentence: conclusion marker, else the shortest declarative with a topic
  let pointIdx = cleaned.findIndex((s) => /\b(so the point|the point is|in short|bottom line|what matters|what i am saying)\b/i.test(s));
  if (pointIdx === -1) {
    const withStructure = cleaned.findIndex((s) => /\b(the reason|because|for example|for instance)\b/i.test(s));
    pointIdx = withStructure > 0 ? withStructure : 0;
  }
  const point = cleaned.splice(pointIdx, 1)[0];
  const support = cleaned.filter((s) => s.split(/\s+/).length >= 4).slice(0, 2);
  if (!point) return null;
  return [point, ...support].join(' ');
}

/* ================= My conversational style (spec 25) ================= */
/* Only observations supported by >= 2 completed conversations. No invented traits. */
export function conversationalStyle() {
  const convs = find('conversations', (c) => c.status === 'completed');
  if (convs.length < 2) return null;
  const ids = new Set(convs.map((c) => c.id));
  const turns = find('conversationTurns', (t) => ids.has(t.conversation_id) && t.speaker === 'user');
  if (turns.length < 6) return null;
  const metas = turns.filter((t) => t.meta);
  const words = metas.map((t) => (t.text || '').split(/\s+/).length);
  const avgWords = words.reduce((a, b) => a + b, 0) / words.length;
  const cleanFiller = metas.filter((t) => (t.meta.fillerRate ?? 99) < 1.5).length / metas.length;
  const cleanVague = metas.filter((t) => (t.meta.vagueRate ?? 99) < 1.2).length / metas.length;
  const onTopic = metas.filter((t) => (t.meta.relevance ?? 0) >= 0.35).length / metas.length;
  const questions = turns.filter((t) => (t.text || '').includes('?')).length;
  const qRate = questions / turns.length;

  const traits = [];
  if (avgWords > 85) traits.push({ text: 'Tends to speak at length before reaching the point.', evidence: `average ${Math.round(avgWords)} words per answer across ${convs.length} conversations` });
  if (avgWords < 35 && avgWords > 0) traits.push({ text: 'Gives concise answers — watch that they do not become thin ones.', evidence: `average ${Math.round(avgWords)} words per answer` });
  if (qRate >= 0.25) traits.push({ text: 'Develops conversations with their own questions.', evidence: `${questions} questions in ${turns.length} answers` });
  if (qRate < 0.08) traits.push({ text: 'Rarely asks follow-up questions — conversations stay one-sided.', evidence: `${questions} questions in ${turns.length} answers` });
  if (cleanFiller >= 0.75) traits.push({ text: 'Speaks cleanly under pressure — fillers are under control.', evidence: `${Math.round(cleanFiller * 100)}% of turns filler-free` });
  if (cleanFiller < 0.4) traits.push({ text: 'Filler words still appear under pressure.', evidence: `only ${Math.round(cleanFiller * 100)}% of turns filler-free` });
  if (cleanVague >= 0.75) traits.push({ text: 'Keeps language precise in live conversation.', evidence: `${Math.round(cleanVague * 100)}% of turns vague-free` });
  if (cleanVague < 0.4) traits.push({ text: 'Reaches for vague words when speaking live.', evidence: `only ${Math.round(cleanVague * 100)}% of turns vague-free` });
  if (onTopic >= 0.7) traits.push({ text: 'Answers the question actually asked.', evidence: `${Math.round(onTopic * 100)}% of turns on target` });
  return { traits: traits.slice(0, 5), conversations: convs.length };
}
