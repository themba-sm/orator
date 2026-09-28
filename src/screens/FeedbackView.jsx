/*
 * Analysis + Feedback view — THE ONE MOST IMPORTANT THING TO IMPROVE,
 * taught plainly, then the immediate retry.
 */

import { Btn, Eyebrow, AudioNote } from '../components/ui.jsx';
import { WEAKNESS_LIBRARY } from '../lib/analysis.js';

export default function FeedbackView({ analysis, audioUrl, onRetry, onDone, retrySeconds }) {
  const { measured, weakness, candidates, verdictNote } = analysis;
  const hasWeakness = !!weakness;

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>Analysis — attempt {analysis.attemptNumber}</Eyebrow>

        {audioUrl && <AudioNote url={audioUrl} />}

        {/* -------- the one thing -------- */}
        {hasWeakness ? (
          <div className="key-weakness">
            <p className="fb-head">The one most important thing to improve</p>
            <h2 className="kw-label">{weakness.label}</h2>
            <div className="kw-block">
              <span className="kw-tag">What happened</span>
              <p>{weakness.evidence}</p>
            </div>
            <div className="kw-block">
              <span className="kw-tag">Why it weakened the answer</span>
              <p>{WEAKNESS_LIBRARY[weakness.weaknessKey].teach}</p>
            </div>
            <div className="kw-block">
              <span className="kw-tag">What to do instead</span>
              <p>{WEAKNESS_LIBRARY[weakness.weaknessKey].instead}</p>
            </div>
            <div className="kw-block example">
              <span className="kw-tag">Example</span>
              <p>{WEAKNESS_LIBRARY[weakness.weaknessKey].example}</p>
            </div>
          </div>
        ) : (
          <div className="key-weakness" style={{ borderColor: 'var(--line)' }}>
            <p className="fb-head">The one most important thing to improve</p>
            <h2 className="kw-label" style={{ fontSize: 19, lineHeight: 1.4 }}>Nothing crossed the bar this time.</h2>
            <p style={{ color: 'var(--ink-dim)', fontSize: 14 }}>{verdictNote}</p>
          </div>
        )}

        {/* -------- what was measured -------- */}
        <hr className="rule rule-tight" />
        <p className="fb-head">Measured on this attempt</p>
        <div className="measure-grid">
          <Measure k="Duration" v={`${measured.durationSeconds}s${measured.targetSeconds ? ` / ${measured.targetSeconds}s` : ''}`} />
          <Measure k="Words" v={measured.wordCount || '—'} />
          {measured.wpm !== null && <Measure k="Pace" v={`${measured.wpm} wpm`} />}
          {measured.fillerRate !== null && <Measure k="Fillers" v={`${measured.fillerCount} · ${measured.fillerRate}/100w`} />}
          {measured.vagueRate !== null && <Measure k="Vague words" v={`${measured.vagueCount} · ${measured.vagueRate}/100w`} />}
          <Measure k="Structure markers" v={measured.structureHits} />
          <Measure k="Concrete examples" v={measured.exampleHits} />
          {measured.relevance !== null && <Measure k="On the question" v={`${Math.round(measured.relevance * 100)}%`} />}
          {measured.avgSentenceLen && <Measure k="Avg sentence" v={`${measured.avgSentenceLen} words`} />}
          {analysis.audio && analysis.audio.measured && analysis.audio.spokeEnough && (
            <Measure k="Delivery contrast" v={analysis.audio.loudnessVariation.toFixed(2)} />
          )}
          {measured.hasConclusion && <Measure k="Conclusion" v="present" />}
        </div>
        {measured.transcript === 'unavailable' && (
          <p className="faint">
            Live transcription was unavailable for this attempt — pacing, fillers and structure above are estimated from
            the transcript you provided, not from speech recognition. Nothing here is invented.
          </p>
        )}

        {/* -------- also noticed -------- */}
        {candidates && candidates.length > 1 && (
          <>
            <hr className="rule rule-tight" />
            <p className="fb-head">Also noticed (lower priority)</p>
            <ul className="candidates-list">
              {candidates.slice(1, 4).map((c) => (
                <li key={c.weakness}>
                  <strong style={{ color: 'var(--ink)' }}>{c.label}</strong> — {c.evidence}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="trainer-controls" style={{ marginTop: 26 }}>
          {hasWeakness && onRetry && (
            <Btn onClick={onRetry}>Retry with one constraint</Btn>
          )}
          {onDone && <Btn variant="ghost" onClick={onDone}>Save & finish</Btn>}
        </div>
      </div>
    </div>
  );
}

function Measure({ k, v }) {
  return (
    <div className="measure">
      <div className="measure-k">{k}</div>
      <div className="measure-v">{v}</div>
    </div>
  );
}
