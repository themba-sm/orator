/*
 * MemoryHome — the dedicated Memory section (spec 21, 22, 23).
 * Shows what you can now do automatically, what is due, what is slipping,
 * and the weekly review that shapes next week's training.
 */

import { useMemo } from 'react';
import { Btn, Eyebrow, Meter } from '../components/ui.jsx';
import { AUTOMATICITY, weeklyReview, automaticityReport } from '../lib/memory.js';
import { find, getCurrentUser, getProfile } from '../lib/store.js';

export default function MemoryHome({ onReview, onPlaybook }) {
  const uid = getCurrentUser()?.id;
  const items = find('memoryItems', (m) => m.user_id === uid);
  const applications = find('memoryApplications', (a) => a.user_id === uid);
  const reviews = find('memoryReviews', (r) => r.user_id === uid);

  const weekly = useMemo(() => weeklyReview(items, applications, applications.filter((a) => a.spontaneous), reviews), [items.length, applications.length]);
  const report = useMemo(() => automaticityReport(items, applications, applications.filter((a) => a.spontaneous)), [items.length, applications.length]);

  const now = Date.now();
  const due = items.filter((i) => new Date(i.next_review).getTime() <= now);
  const automatic = items.filter((i) => i.automaticity >= 7);
  const becoming = items.filter((i) => i.automaticity === 6);
  const struggling = items.filter((i) => i.struggling || (i.recall_fail + i.apply_fail) >= 3);
  const mastered = items.filter((i) => i.automaticity >= 5 && !i.struggling);
  const learned = items.filter((i) => i.automaticity >= 2);

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Memory</Eyebrow>
        <h1 className="display section-title">What you can now do automatically.</h1>
        <p className="faint" style={{ marginBottom: 22 }}>
          Learning is not what you have seen. It is what you can retrieve under pressure and use without being told. Everything here is inferred from demonstrated behaviour.
        </p>

        {/* due today */}
        <div className="today-card" style={{ marginTop: 0 }}>
          <p className="today-kind">Due for retrieval today</p>
          {due.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>Nothing due. Silent tests during training still count.</p>
          ) : (
            <>
              <h2 className="today-title" style={{ fontSize: 22 }}>{due.length} skill{due.length === 1 ? '' : 's'} need your attention</h2>
              {due.slice(0, 4).map((d) => (
                <div className="attempt-row" key={d.id}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{d.title}</span>
                    <br />
                    <span className="faint">{AUTOMATICITY[d.automaticity]?.label}{d.struggling ? ' · rebuilding' : ''}</span>
                  </div>
                  <span className="attempt-date">{AUTOMATICITY[d.automaticity]?.n}/7</span>
                </div>
              ))}
              <Btn block style={{ marginTop: 14 }} onClick={onReview}>Run memory review</Btn>
            </>
          )}
        </div>

        {/* automatic */}
        <div className="stat-strip">
          <div className="stat-cell"><div className="stat-k">Automatic</div><div className="stat-v">{automatic.length}</div></div>
          <div className="stat-cell"><div className="stat-k">Becoming automatic</div><div className="stat-v">{becoming.length}</div></div>
          <div className="stat-cell"><div className="stat-k">Struggling</div><div className="stat-v">{struggling.length}</div></div>
          <div className="stat-cell"><div className="stat-k">In memory</div><div className="stat-v">{items.length} <small>learned: {learned.length}</small></div></div>
        </div>

        {automatic.length > 0 && (
          <>
            <hr className="rule" />
            <Eyebrow>What I can now do automatically</Eyebrow>
            {automatic.map((i) => (
              <div className="weakness-card improved" key={i.id}>
                <div className="wc-top"><span className="wc-name">{i.title}</span><span className="wc-count">automatic · unprompted ×{i.spontaneous_success}</span></div>
                <p className="wc-note">{i.simple}</p>
              </div>
            ))}
          </>
        )}

        {/* becoming automatic report */}
        {report.length > 0 && (
          <>
            <hr className="rule" />
            <Eyebrow dim>Becoming automatic — evidence-based</Eyebrow>
            {report.slice(0, 8).map(({ item, status, attempts, wins }) => (
              <div className="attempt-row" key={item.id}>
                <div>
                  <span style={{ fontWeight: 500 }}>{item.title}</span>
                  <br />
                  <span className="faint">{status === 'consistent' ? 'Consistent — demonstrated reliably'
                    : status === 'improving' ? 'Improving — most applications succeed'
                    : status === 'inconsistent' ? 'Inconsistent — succeeds and slips'
                    : status === 'struggling' ? 'Struggling — applications keep failing'
                    : 'Unevaluated — no recent speaking evidence'}</span>
                </div>
                <span className="attempt-date">{wins}/{attempts}</span>
              </div>
            ))}
          </>
        )}

        {/* weekly review */}
        {(weekly.stuck.length > 0 || weekly.slipping.length > 0 || weekly.needsWork.length > 0 || weekly.becoming.length > 0) && (
          <>
            <hr className="rule" />
            <Eyebrow dim>Weekly memory review</Eyebrow>
            {weekly.stuck.length > 0 && (
              <>
                <p className="skill-group-head">What stuck</p>
                {weekly.stuck.map((i) => <p key={i.id} className="muted" style={{ fontSize: 13.5, marginLeft: 4 }}>{i.title}</p>)}
              </>
            )}
            {weekly.becoming.length > 0 && (
              <>
                <p className="skill-group-head">Becoming automatic</p>
                {weekly.becoming.map((i) => <p key={i.id} className="muted" style={{ fontSize: 13.5, marginLeft: 4 }}>{i.title}</p>)}
              </>
            )}
            {weekly.slipping.length > 0 && (
              <>
                <p className="skill-group-head">What's slipping</p>
                {weekly.slipping.map((i) => <p key={i.id} className="muted" style={{ fontSize: 13.5, marginLeft: 4 }}>{i.title}</p>)}
              </>
            )}
            {weekly.needsWork.length > 0 && (
              <>
                <p className="skill-group-head">What needs work</p>
                {weekly.needsWork.map((i) => <p key={i.id} className="muted" style={{ fontSize: 13.5, marginLeft: 4 }}>{i.title}</p>)}
              </>
            )}
            <p className="faint" style={{ marginTop: 10 }}>This week's evidence shapes next week's training priorities automatically.</p>
          </>
        )}

        {items.length === 0 && (
          <p className="faint" style={{ marginTop: 10 }}>
            Nothing in memory yet — it starts with your first training session, when a weakness becomes a principle to keep.
          </p>
        )}

        <div className="quick-actions" style={{ marginTop: 22 }}>
          <button type="button" className="quick-btn" onClick={onReview}>Review</button>
          <button type="button" className="quick-btn" onClick={onPlaybook}>Playbook</button>
          <div className="quick-btn" style={{ cursor: 'default' }}>{items.length} items</div>
        </div>
      </div>
    </div>
  );
}
