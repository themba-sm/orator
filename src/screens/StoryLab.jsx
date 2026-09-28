/* StoryLab — tell it, analyse it, compress it, bank it. */

import { useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { analyseAttempt } from '../lib/analysis.js';
import {
  analyseStory, STORY_PROMPTS, COMPRESSION_CHAIN, compressionPrompt, oneSentencePrompt,
  saveStory, storyBank, BANK_CATEGORIES, hookDrill, ENDING_TYPES,
} from '../lib/storylab.js';
import { insert, getCurrentUser } from '../lib/store.js';

export default function StoryLab({ onDone }) {
  const uid = getCurrentUser()?.id;
  const [phase, setPhase] = useState('home');
  const [prompt, setPrompt] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [storyIdea, setStoryIdea] = useState(null);
  const [chainIdx, setChainIdx] = useState(0);
  const [chainTranscripts, setChainTranscripts] = useState([]);
  const [lastStory, setLastStory] = useState(null);
  const [resultText, setResultText] = useState(null);
  function noteResult(t) { setResultText(t); }
  const bank = useMemo(() => storyBank(), [phase]);

  function startStory() {
    const p = STORY_PROMPTS[Math.floor(Math.random() * STORY_PROMPTS.length)];
    setPrompt(p);
    setStoryIdea(p.replace('Tell me about ', '').replace('.', ''));
    setPhase('tell');
  }

  function onStoryCapture({ capture }) {
    if (!capture.transcript) { setPhase('home'); return; }
    const res = analyseAttempt({ transcript: capture.transcript, transcriptSource: capture.transcriptSource, durationMs: capture.durationMs, targetSeconds: 120, prompt, category: 'story' });
    const a = analyseStory(capture.transcript, res.measured, capture.durationMs / 1000);
    insert('storyAttempts', { user_id: uid, prompt, elements: a.found, detail_score: a.detailScore, climax_position: a.climaxPosition, created: new Date().toISOString() });
    setAnalysis(a);
    setLastStory({ prompt, transcript: capture.transcript });
    setPhase('feedback');
  }

  /* ---------- renders ---------- */
  if (phase === 'home') {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Storytelling Lab</Eyebrow>
          <h1 className="display section-title">Stories people want to hear.</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Structure taught, personality preserved. Show the experience; don't only label it.</p>

          <div className="trainer-controls">
            <Btn block onClick={startStory}>Tell a story — two minutes</Btn>
            <Btn block variant="ghost" onClick={() => setPhase('hooks')}>Hook training — three openings</Btn>
            <Btn block variant="ghost" onClick={() => { setChainIdx(0); setChainTranscripts([]); setPhase('compress'); }}>Compression — two minutes to one sentence</Btn>
            <Btn block variant="ghost" onClick={setLastStory ? () => { if (lastStory || bank[0]) { setStoryIdea(lastStory ? lastStory.prompt.replace('Tell me about ', '') : bank[0].title); setChainIdx(0); setChainTranscripts([]); setPhase('compress'); } } : undefined}>Compress a saved story</Btn>
          </div>

          {resultText && <p className="panel" style={{ fontSize: 13.5, color: 'var(--ink-dim)', padding: 12 }}>{resultText}</p>}
          {bank.length > 0 && (
            <>
              <hr className="rule" />
              <Eyebrow dim>My story bank — {bank.length} saved</Eyebrow>
              {bank.map((s) => (
                <div className="attempt-row" key={s.id}>
                  <div><span style={{ fontWeight: 500 }}>{s.title}</span><br /><span className="faint">{s.category} · {(s.elements || []).length} story elements</span></div>
                  <span className="attempt-date">{new Date(s.created).toLocaleDateString()}</span>
                </div>
              ))}
            </>
          )}
          <div className="trainer-controls"><Btn variant="ghost" onClick={onDone}>Back</Btn></div>
        </div>
      </div>
    );
  }

  if (phase === 'tell') {
    return (
      <SpeakRunner
        exercise={{ title: 'Your story', objective: prompt, prompt, prepSeconds: 15, speakSeconds: 120, category: 'story', instructions: ['Authenticity beats performance. Real details beat adjectives.'] }}
        onComplete={onStoryCapture}
        onCancel={() => setPhase('home')}
      />
    );
  }

  if (phase === 'feedback' && analysis) {
    return (
      <div className="screen">
        <div className="wrap">
          <Eyebrow dim>Story analysis</Eyebrow>
          <h1 className="display section-title" style={{ fontSize: 26 }}>What your story had.</h1>
          <div className="panel" style={{ marginTop: 10 }}>
            <p className="fb-head">Elements present ({analysis.found.length})</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-dim)' }}>{analysis.found.join(' · ') || 'No core elements detected — told as a list of events.'}</p>
            <p className="fb-head" style={{ marginTop: 10 }}>Missing where they would matter</p>
            <p className="faint" style={{ fontSize: 13.5 }}>{analysis.missing.slice(0, 5).join(' · ') || '—'}</p>
            <p className="fb-head" style={{ marginTop: 10 }}>Detail: show, don't label</p>
            <p style={{ fontSize: 13.5, color: analysis.labeledOnly ? 'var(--crimson)' : 'var(--ink-dim)' }}>
              {analysis.labeledOnly ? 'You labelled the emotion ("nervous") without showing it. Show the experience: shaking hands, the checked clock.' : `${analysis.shows} specific detail markers. Good.`}
            </p>
            <p className="fb-head" style={{ marginTop: 10 }}>Pacing</p>
            <p className="faint" style={{ fontSize: 13.5 }}>
              {analysis.climaxPosition !== null ? `Turning point landed ${(analysis.climaxPosition * 100).toFixed(0)}% into the story.` : 'No clear turning point found.'}
              {analysis.wpm ? ` ${analysis.wpm} words per minute.` : ''}
            </p>
          </div>

          {analysis.missing.includes('ending') && (
            <div className="panel" style={{ marginTop: 12 }}>
              <p className="fb-head">Endings to try</p>
              {ENDING_TYPES.slice(0, 4).map((e) => <p key={e.key} style={{ fontSize: 13, margin: '4px 0' }}>{e.label}</p>)}
            </div>
          )}

          <div className="trainer-controls" style={{ marginTop: 20 }}>
            <Btn block onClick={() => { setChainIdx(0); setChainTranscripts([]); setPhase('compress'); }}>Compress this story — 60s → 20s → one sentence</Btn>
            <Btn block variant="ghost" onClick={() => { saveStory({ prompt, transcript: lastStory.transcript, analysis, category: 'personal' }); noteResult('Story saved to your bank.'); setPhase('home'); }}>Save to story bank</Btn>
            <Btn block variant="ghost" onClick={onDone}>Done</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'hooks') {
    const d = hookDrill(storyIdea || 'a time you were wrong about something important');
    return (
      <SpeakRunner
        exercise={{ title: 'Hook training', objective: 'Three openings. One decision.', prompt: d.prompt, prepSeconds: 20, speakSeconds: 90, category: 'story', instructions: [`${d.types.length} hook types available: curiosity, surprise, direct statement.`] }}
        onComplete={({ capture }) => {
          const t = capture.transcript || '';
          const used = [];
          if (/\?/.test(t)) used.push('curiosity/question');
          if (/never|best|worst/.test(t.toLowerCase())) used.push('surprise/direct');
          if (/\bi (was|felt|am)\b/i.test(t)) used.push('emotion');
          setResultText(`Hooks detected: ${used.join(', ') || 'none clearly'}. The strongest opening gives the listener a reason to need the next sentence.`);
          setPhase('home');
        }}
        onCancel={() => setPhase('home')}
      />
    );
  }

  if (phase === 'compress') {
    const step = COMPRESSION_CHAIN[chainIdx];
    const isLast = chainIdx >= COMPRESSION_CHAIN.length - 1;
    if (isLast) {
      return (
        <SpeakRunner
          exercise={{ title: 'One sentence', objective: 'The whole story. One sentence.', prompt: oneSentencePrompt(storyIdea || 'your story'), prepSeconds: 10, speakSeconds: 15, category: 'story' }}
          onComplete={({ capture }) => {
            const list = [...chainTranscripts, capture.transcript || ''];
            const first = list[0] || '';
            const core = (capture.transcript || '').toLowerCase().split(/\s+/).filter((w) => first.toLowerCase().includes(w) && w.length > 4);
            const survived = core.length >= 2;
            insert('storyReviews', { user_id: uid, kind: 'compression', survived, chain: list.map((t) => t.slice(0, 200)), created: new Date().toISOString() });
            setResultText(survived ? 'The core meaning survived the compression. That is real clarity.' : 'The meaning thinned out at the end — the core did not survive. Practise finding the irreducible sentence.');
            setPhase('home');
          }}
          onCancel={() => setPhase('home')}
        />
      );
    }
    return (
      <SpeakRunner
        key={chainIdx}
        exercise={{ title: `Compression — step ${chainIdx + 1}`, objective: `Same story, tighter. Meaning survives.`, prompt: compressionPrompt(step, storyIdea || 'your story'), prepSeconds: 8, speakSeconds: step, category: 'story' }}
        onComplete={({ capture }) => { setChainTranscripts((c) => [...c, capture.transcript || '']); setChainIdx((i) => i + 1); }}
        onCancel={() => setPhase('home')}
      />
    );
  }

  if (phase === 'home' && resultText) {
    return null; // unreachable guard
  }
  return null;
}
