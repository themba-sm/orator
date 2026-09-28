/*
 * ConverseHome — choose the conversation. Shows conversational style (spec 25)
 * from real history, and past conversations (spec 27).
 */

import { useMemo, useState } from 'react';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { MODES, DIFFICULTIES, conversationalStyle } from '../lib/simulator.js';
import { find, getProfile } from '../lib/store.js';

export default function ConverseHome({ onStart }) {
  const profile = getProfile();
  const conversations = useMemo(() => find('conversations', () => true).slice(-8).reverse(), []);
  const style = useMemo(() => conversationalStyle(), [conversations.length]);
  const [difficulty, setDifficulty] = useState(profile?.difficulty || 'developing');
  const [coached, setCoached] = useState(false);

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Converse</Eyebrow>
        <h1 className="display section-title">Enter a real conversation.</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          A live partner who listens, remembers, challenges and follows up on what you actually said. Not a chat window — a room.
        </p>

        {/* MY CONVERSATIONAL STYLE (spec 25) */}
        {style && style.traits.length > 0 && (
          <div className="panel" style={{ marginBottom: 22 }}>
            <p className="fb-head">My conversational style</p>
            {style.traits.map((t) => (
              <p key={t.text} style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '6px 0' }}>{t.text} <span className="faint">({t.evidence})</span></p>
            ))}
          </div>
        )}

        {/* difficulty */}
        <p className="skill-group-head">Difficulty</p>
        <div className="option-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
          {Object.entries(DIFFICULTIES).map(([k, d]) => (
            <button key={k} type="button" className={`option-tile${difficulty === k ? ' selected' : ''}`} style={{ padding: '10px 6px', textAlign: 'center' }} onClick={() => setDifficulty(k)}>
              <span className="ot-title" style={{ fontSize: 11 }}>{d.label}</span>
            </button>
          ))}
        </div>

        {/* mode toggle (spec 18) */}
        <p className="skill-group-head">Feedback during the conversation</p>
        <div className="option-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          <button type="button" className={`option-tile${!coached ? ' selected' : ''}`} onClick={() => setCoached(false)}>
            <span className="ot-title" style={{ fontSize: 12 }}>Natural — coach me after</span>
          </button>
          <button type="button" className={`option-tile${coached ? ' selected' : ''}`} onClick={() => setCoached(true)}>
            <span className="ot-title" style={{ fontSize: 12 }}>Coached — stop me and correct</span>
          </button>
        </div>

        {/* modes */}
        <div style={{ display: 'grid', gap: 10 }}>
          {MODES.map((m) => (
            <button key={m.key} type="button" className="option-tile" onClick={() => onStart(m.key, difficulty, coached)}>
              <span className="ot-title">{m.label}</span>
              {m.hint}
            </button>
          ))}
        </div>

        {/* history (spec 27) */}
        {conversations.length > 0 && (
          <>
            <hr className="rule" />
            <Eyebrow dim>Previous conversations</Eyebrow>
            {conversations.map((c) => (
              <div className="attempt-row" key={c.id}>
                <div>
                  <span style={{ fontWeight: 500 }}>{c.mode_label || c.mode}</span>
                  <br />
                  <span className="faint">{c.opportunity ? `Focus was: ${c.opportunity}` : c.status}</span>
                </div>
                <span className="attempt-date">{new Date(c.created_date).toLocaleDateString()}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
