/*
 * ConversationReport — WHAT I NOTICED / YOUR BIGGEST OPPORTUNITY /
 * WHAT YOU DID WELL / TRY THIS AGAIN / MEMORY UPDATED, plus replay,
 * "say it again" per weak turn, and the conversation score (specs 19-24, 30).
 */

import { useEffect, useMemo, useState } from 'react';
import SpeakRunner from './SpeakRunner.jsx';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { analyseAttempt, compareAttempts } from '../lib/analysis.js';
import { audioDeliveryMetrics } from '../lib/speech.js';
import { betterVersion } from '../lib/simulator.js';
import { ensureItemForWeakness, recordApplication } from '../lib/memory-integration.js';
import { PRINCIPLE_CATALOG, AUTOMATICITY } from '../lib/memory.js';
import { find, getCurrentUser, insert, update } from '../lib/store.js';

export default function ConversationReport({ convRecord, scenario, turns, report, elapsed, onExit }) {
  const [memoryUpdates, setMemoryUpdates] = useState(null);
  const [retryTurn, setRetryTurn] = useState(null);
  const [retryResult, setRetryResult] = useState(null);

  /* memory integration (spec 24) — once, from real turn evidence */
  useEffect(() => {
    if (!report || memoryUpdates) return;
    const updates = [];
    const userTurns = turns.filter((t) => t.speaker === 'user' && t.analysis);

    // success on existing learned skills → application evidence
    const uid = getCurrentUser()?.id;
    find('memoryItems', (m) => m.user_id === uid && m.automaticity >= 3 && m.signature).forEach((item) => {
      let wins = 0; let measurable = 0;
      userTurns.forEach((t) => {
        const m = t.analysis.measured;
        const sig = item.signature;
        let v;
        if (sig.metric === 'loudnessVariation') v = null;
        else if (sig.metric === 'durationVsTarget') v = null;
        else v = m[sig.metric] !== undefined ? m[sig.metric] : null;
        if (v === null || v === undefined) return;
        measurable += 1;
        const ok = sig.op === 'gte' ? v >= sig.value : sig.op === 'lt' ? v < sig.value : sig.op === 'between' ? (v >= sig.value[0] && v <= sig.value[1]) : sig.op === 'truthy' ? !!v : sig.op === 'empty' ? (!v || v.length === 0) : false;
        if (ok) wins += 1;
      });
      if (measurable >= 2) {
        const success = wins / measurable >= 0.5;
        recordApplication(item.id, { success, context: 'conversation', spontaneous: true, told: false, measured: { wordCount: 60 } });
        if (success) updates.push(`${item.title} — demonstrated unprompted in live conversation (${wins}/${measurable} turns).`);
      }
    });

    // biggest opportunity → create/boost its memory item
    if (report.weakest) {
      const item = ensureItemForWeakness(report.weakest.weaknessKey);
      if (item) {
        const label = AUTOMATICITY[item.automaticity]?.label || 'Exposed';
        updates.push(`${item.title} — added to memory from this conversation (${label}). It will return in reviews.`);
      }
    }
    setMemoryUpdates(updates.length ? updates : ['Memory held steady — nothing new claimed from this conversation.']);
    if (convRecord) {
      update('conversations', convRecord.id, {
        opportunity: report.weakest?.label || null,
        report_note: report.weakest ? `${report.weakest.label}: ${report.weakest.evidence}` : null,
      });
      insert('conversationReports', {
        conversation_id: convRecord.id,
        dims: report.dims.map((d) => ({ key: d.key, band: d.b.band, n: d.b.n })),
        opportunity: report.weakest?.label,
        strongest: report.strongest?.label,
        memory_updates: updates,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* retry comparison (spec 22) */
  function onRetryCapture({ capture }) {
    const transcript = capture.transcript || '';
    if (!transcript) { setRetryResult({ error: 'No transcript captured — nothing claimed.' }); return; }
    const measured = analyseAttempt({
      transcript, transcriptSource: capture.transcriptSource, durationMs: capture.durationMs,
      targetSeconds: 30, prompt: retryTurn.turn.text, category: 'conversation',
    }).measured;
    const cmp = compareAttempts(
      { measured: retryTurn.turn.analysis.measured, audio: null },
      { measured, audio: audioDeliveryMetrics(capture.energies, capture.durationMs) },
      report.weakest?.weaknessKey || 'organisation',
    );
    setRetryResult({ cmp });
  }

  if (!report) {
    return (
      <div className="screen"><div className="wrap center-note">
        <p className="muted">Not enough spoken turns to report on. No analysis invented — speak more next time.</p>
        <Btn onClick={onExit}>Back</Btn>
      </div></div>
    );
  }

  const weakTurns = turns.filter((t) => t.speaker === 'user' && t.analysis)
    .filter((t) => (t.analysis.measured.relevance ?? 1) < 0.3 || t.analysis.signals.wordCount > 110 || (t.analysis.measured.fillerRate ?? 0) > 4)
    .slice(0, 3);

  const bandLabel = { strong: 'Strong', developing: 'Developing', inconsistent: 'Inconsistent', weak: 'Needs work', unevaluated: 'Not enough evidence' };

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>{scenario.persona.name} · {Math.floor(elapsed / 60)}m {elapsed % 60}s · {report.counts.N} answers</Eyebrow>

        {/* WHAT I NOTICED */}
        <h1 className="display section-title">What I noticed.</h1>
        <div className="panel" style={{ marginTop: 10 }}>
          {report.dims.filter((d) => d.b.n > 0).map((d) => (
            <div className="attempt-row" key={d.key}>
              <div>
                <span style={{ fontWeight: 500 }}>{d.label}</span>
                <br />
                <span className="faint">{d.evidence}</span>
              </div>
              <span className="chip brass" style={{ textTransform: 'none' }}>{bandLabel[d.b.band]}</span>
            </div>
          ))}
        </div>

        {/* BIGGEST OPPORTUNITY (spec 20) */}
        {report.weakest && (
          <>
            <hr className="rule" />
            <Eyebrow>Your biggest opportunity</Eyebrow>
            <h2 className="display" style={{ fontSize: 22, marginTop: 6 }}>{report.weakest.label}</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-dim)' }}>{report.weakest.evidence}. {report.recurring ? 'This is not new — it has appeared in your training before.' : ''} Your next focus is {report.weakest.label.toLowerCase()}.</p>
          </>
        )}

        {/* WHAT YOU DID WELL (spec 30) */}
        {report.strongest && (
          <>
            <hr className="rule" />
            <Eyebrow>What you did well</Eyebrow>
            <div className="weakness-card improved">
              <div className="wc-top"><span className="wc-name">{report.strongest.label}</span><span className="wc-count" style={{ color: 'var(--ok)' }}>{bandLabel[report.strongest.b.band]}</span></div>
              <p className="wc-note">{report.strongest.evidence}.</p>
            </div>
            {report.counts.questions > 0 && <p className="faint" style={{ marginTop: 8 }}>You asked {report.counts.questions} follow-up question{report.counts.questions === 1 ? '' : 's'} — conversation, not monologue. Keep that.</p>}
            {report.counts.recovered > 0 && <p className="faint">After being interrupted, you recovered tightly {report.counts.recovered} of {report.counts.afterInterrupt} time{report.counts.afterInterrupt === 1 ? '' : 's'}.</p>}
          </>
        )}

        {/* CONVERSATION SCORE (spec 23) */}
        <hr className="rule" />
        <Eyebrow dim>Conversation score</Eyebrow>
        <div className="panel">
          <ScoreRow k="Strongest behaviour" v={report.strongest?.label} />
          <ScoreRow k="Weakest behaviour" v={report.weakest?.label} />
          <ScoreRow k="Recurring pattern" v={report.recurring ? `${report.recurring.weakness_key} (seen ${report.recurring.times_observed}× in training)` : 'None recurring yet'} />
          <ScoreRow k="One skill to practise" v={report.weakest?.label || 'Keep training'} />
          <ScoreRow k="Successful technique" v={report.bestTurn ? 'Your most on-target answer: "' + (report.bestTurn.text || '').slice(0, 90) + (report.bestTurn.text.length > 90 ? '…' : '"') : '—'} />
          {(() => {
            const cat = report.weakest && PRINCIPLE_CATALOG.find((c) => (c.weakness || []).includes(report.weakest.weaknessKey));
            return <ScoreRow k="Recommended memory item" v={cat ? cat.title : '—'} />;
          })()}
        </div>

        {/* REPLAY (spec 21) */}
        <hr className="rule" />
        <Eyebrow dim>Replay</Eyebrow>
        {turns.map((t, i) => {
          if (t.speaker === 'ai') {
            return (
              <div key={i} className="conv-line ai" style={{ marginBottom: 8 }}>
                <span className="conv-who">{scenario.persona.name.split(' ')[1] || scenario.persona.name}</span>
                <p className="conv-text">{t.text}</p>
              </div>
            );
          }
          const weak = weakTurns.includes(t);
          const improved = betterVersion(t.text, t.analysis.measured);
          return (
            <div key={i} className="conv-line user" style={{ marginBottom: 10 }}>
              <span className="conv-who">You</span>
              <p className="conv-text">{t.text}</p>
              {t.meta?.interrupt && <span className="conv-flag">after interruption</span>}
              {weak && (
                <div className="panel" style={{ marginTop: 8, borderRadius: 6 }}>
                  <p className="fb-head">What could be better</p>
                  <p className="faint" style={{ fontSize: 13 }}>
                    {(t.analysis.measured.relevance ?? 1) < 0.3 ? 'This drifted from the question asked.' : t.analysis.signals.wordCount > 110 ? 'This ran long — the point arrived late.' : 'Fillers weakened the delivery.'}
                  </p>
                  {improved && (
                    <>
                      <p className="fb-head" style={{ marginTop: 8 }}>A clearer version — your words, restructured</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13.5 }}>{improved}</p>
                    </>
                  )}
                  <Btn small variant="ghost" style={{ marginTop: 10 }} onClick={() => setRetryTurn({ turn: t, prompt: 'Again — ' + (turns[i - 1]?.text || '') })}>Say it again</Btn>
                </div>
              )}
            </div>
          );
        })}

        {/* SAY IT AGAIN runner (spec 22) */}
        {retryTurn && (
          <div style={{ marginTop: 16 }}>
            <Eyebrow>Say it again</Eyebrow>
            <p className="muted" style={{ margin: '6px 0 12px' }}>Same moment, slightly modified prompt. Then ORATOR compares your two versions honestly.</p>
            <SpeakRunner
              exercise={{ title: 'Say it again', objective: 'Same moment as the conversation. Tighter.', prompt: retryTurn.prompt, prepSeconds: 10, speakSeconds: 30, category: 'conversation', instructions: ['Point first, then support, then stop.'] }}
              onComplete={onRetryCapture}
              onCancel={() => setRetryTurn(null)}
            />
          </div>
        )}
        {retryResult?.cmp && (
          <div className="panel" style={{ marginTop: 10 }}>
            <p className="fb-head">What changed</p>
            <p style={{ fontSize: 14 }}>{retryResult.cmp.headline}</p>
            {retryResult.cmp.items.map((it) => (
              <p key={it.label} className="faint" style={{ fontSize: 13 }}>{it.label}: {it.text} ({it.dir})</p>
            ))}
            <div className="trainer-controls" style={{ marginTop: 10 }}>
              <Btn small variant="ghost" onClick={() => { setRetryTurn(null); setRetryResult(null); }}>Close comparison</Btn>
            </div>
          </div>
        )}
        {retryResult?.error && <p className="faint">{retryResult.error}</p>}

        {/* MEMORY UPDATED (specs 24, 30) */}
        <hr className="rule" />
        <Eyebrow dim>Memory updated</Eyebrow>
        {(memoryUpdates || []).map((u, i) => (
          <p key={i} style={{ fontSize: 13.5, color: 'var(--ink-dim)', margin: '6px 0' }}>{u}</p>
        ))}

        <div className="trainer-controls" style={{ marginTop: 30 }}>
          <Btn block onClick={onExit}>Done</Btn>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ k, v }) {
  return (
    <div className="attempt-row">
      <div><span style={{ fontWeight: 500 }}>{k}</span></div>
      <span className="faint" style={{ maxWidth: '60%', textAlign: 'right' }}>{v || '—'}</span>
    </div>
  );
}
