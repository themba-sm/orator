/*
 * My Playbook — the user's personal canon of learned principles,
 * organised by domain, with live automaticity levels.
 * Opening an item explains it, but the app always pushes back to retrieval.
 */

import { useState } from 'react';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { AUTOMATICITY } from '../lib/memory.js';
import { find, getCurrentUser } from '../lib/store.js';

const PLAYBOOK_SECTIONS = ['Speaking', 'Conversations', 'Storytelling', 'Persuasion', 'Vocabulary', 'Articulation', 'Presence', 'Thinking', 'Pressure', 'Conciseness'];

export default function Playbook({ onReview, onDrill }) {
  const uid = getCurrentUser()?.id;
  const items = find('memoryItems', (m) => m.user_id === uid);
  const [open, setOpen] = useState(null);

  const sections = PLAYBOOK_SECTIONS
    .map((sec) => ({ sec, items: items.filter((i) => (i.playbook || 'Speaking') === sec) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>My playbook</Eyebrow>
        <h1 className="display section-title">Your canon.</h1>
        <p className="faint" style={{ marginBottom: 20 }}>
          The principles you have learned, and where they actually stand. Opening one explains it — but reading is exposure, not ability. Levels only move when you demonstrate.
        </p>

        {sections.length === 0 && <p className="faint">Empty for now — the first entries appear when training identifies your weaknesses.</p>}

        {sections.map(({ sec, items: secItems }) => (
          <div key={sec} className="skill-group">
            <p className="skill-group-head">{sec}</p>
            {secItems.map((i) => (
              <div key={i.id} style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  className="option-tile"
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
                  onClick={() => setOpen(open === i.id ? null : i.id)}
                >
                  <span className="ot-title" style={{ marginBottom: 2 }}>{i.title}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="chip brass">{AUTOMATICITY[i.automaticity]?.label || 'Exposed'}</span>
                  </span>
                </button>
                {open === i.id && (
                  <div className="panel" style={{ marginTop: 8, borderRadius: 6 }}>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 10 }}>{i.explanation}</p>
                    <p className="faint" style={{ marginBottom: 8 }}>One line: {i.simple}</p>
                    {i.example && <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, marginBottom: 8 }}>{i.example}</p>}
                    <div className="measure-grid" style={{ margin: '10px 0' }}>
                      <div className="measure"><div className="measure-k">Recall</div><div className="measure-v">{i.recall_success}✓ {i.recall_fail}✗</div></div>
                      <div className="measure"><div className="measure-k">Applied</div><div className="measure-v">{i.apply_success}✓ {i.apply_fail}✗</div></div>
                      <div className="measure"><div className="measure-k">Unprompted use</div><div className="measure-v">{i.spontaneous_success}✓ {i.spontaneous_fail}✗</div></div>
                      <div className="measure"><div className="measure-k">Next review</div><div className="measure-v" style={{ fontSize: 12 }}>{i.next_review ? new Date(i.next_review).toLocaleDateString() : '—'}</div></div>
                    </div>
                    <div className="trainer-controls" style={{ marginTop: 8 }}>
                      <Btn small onClick={() => onDrill(i.id)} style={{ flex: 1 }}>Demonstrate it now</Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <div className="trainer-controls" style={{ marginTop: 30 }}>
          <Btn block variant="ghost" onClick={onReview}>Run today's retrieval</Btn>
        </div>
      </div>
    </div>
  );
}
