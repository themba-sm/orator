/*
 * Dashboard — TODAY'S TRAINING dominates. Everything else is quiet context.
 */

import { useMemo } from 'react';
import { Btn, Eyebrow } from '../components/ui.jsx';
import { todaysExercise } from '../lib/generator.js';
import { CATEGORIES_META } from '../lib/exercises.js';
import { communicationLevel, strongestSkill, weakestSkill, SKILLS } from '../lib/skills.js';
import {
  getProfile, getCurrentUser, trainingStreak, trainingHistory, completedAttempts, isOnboarded, baselineComplete,
} from '../lib/store.js';
import { WEAKNESS_LIBRARY } from '../lib/analysis.js';
import { todayMemoryReview } from '../lib/memory-integration.js';
import { AUTOMATICITY } from '../lib/memory.js';

export default function Dashboard({ onStart, onPractise, onSpeak, onProgress, onMemoryReview }) {
  const profile = getProfile();
  const memory = useMemo(() => todayMemoryReview(4), []);
  const user = getCurrentUser();
  const exercise = useMemo(() => todaysExercise(), []);
  const streak = trainingStreak();
  const history = trainingHistory(14);
  const attempts = completedAttempts();
  const level = communicationLevel(profile?.skill_scores || {});
  const strong = strongestSkill(profile?.skill_scores || {});
  const weak = weakestSkill(profile?.skill_scores || {});
  const firstName = (user?.name || 'Speaker').split(' ')[0];

  const lastTwo = attempts.slice(-2);
  const recentImprovement = useMemo(() => {
    if (attempts.length < 2) return null;
    const recentWeak = attempts.filter((a) => a.weakness_key).slice(-2);
    if (recentWeak.length === 2 && recentWeak[0].weakness_key === recentWeak[1].weakness_key) {
      const same = recentWeak[1].weakness_key === recentWeak[0].weakness_key;
      if (!same) return `Last session cleared the ${WEAKNESS_LIBRARY[recentWeak[0].weakness_key]?.label} target.`;
    }
    const s = profile?.skill_scores || {};
    const vals = Object.values(s).filter((v) => v !== null);
    if (!vals.length) return null;
    return `Average skill indicator: ${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)} across ${vals.length} measured skills.`;
  }, [attempts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOnboarded() || !baselineComplete()) return null;

  return (
    <div className="screen">
      <div className="wrap">
        <Eyebrow dim>{firstName}, the floor is yours</Eyebrow>

        {/* -------- TODAY'S TRAINING -------- */}
        <div className="today-card">
          <p className="today-kind">Today's training · {CATEGORIES_META[exercise.category]?.label}</p>
          <h1 className="today-title">{exercise.title}</h1>
          <p className="today-prompt">“{exercise.prompt}”</p>
          <p className="faint">
            {exercise.objective} · {exercise.prepSeconds}s preparation · {exercise.speakSeconds}s speaking.
          </p>
          <Btn block onClick={() => onStart(exercise)} style={{ marginTop: 18 }}>Start today's training</Btn>
        </div>

        {/* -------- MEMORY REVIEW (retrieval due today) -------- */}
        <div className="today-card" style={{ marginTop: 14, borderColor: 'rgba(198,161,91,0.28)' }}>
          <p className="today-kind">Memory review{memory.due.length > 0 ? ` — ${memory.due.length} skill${memory.due.length === 1 ? '' : 's'} due` : ' — nothing due'}</p>
          {memory.due.length === 0 ? (
            <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>Previously learned skills are being tested silently during your training. Nothing demands retrieval right now.</p>
          ) : (
            <>
              {memory.due.slice(0, 3).map((d) => (
                <p key={d.item.id} className="muted" style={{ fontSize: 13.5, margin: '7px 0 0' }}>
                  {d.item.title} <span className="faint">· {AUTOMATICITY[d.item.automaticity]?.label}</span>
                </p>
              ))}
              <Btn small variant="ghost" style={{ marginTop: 14 }} onClick={onMemoryReview}>Demonstrate them</Btn>
            </>
          )}
        </div>

        {/* -------- quiet context -------- */}
        <div className="stat-strip">
          <div className="stat-cell">
            <div className="stat-k">Current level</div>
            <div className="stat-v">{level.level}{level.score !== null && <small>{level.score}</small>}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-k">Training streak</div>
            <div className="stat-v">{streak} <small>day{streak === 1 ? '' : 's'}</small></div>
            <div className="streak-row">
              {history.map((d) => (
                <div key={d.date} className={`streak-cell${d.count > 0 ? ' hit' : ''}${d.date === new Date().toISOString().slice(0, 10) && d.count > 0 ? ' today-hit' : ''}`} title={`${d.date}: ${d.count}`} />
              ))}
            </div>
          </div>
          <div className="stat-cell">
            <div className="stat-k">Strongest skill</div>
            <div className="stat-v">{strong ? strong.label : '—'}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-k">Weakest skill</div>
            <div className="stat-v">{weak ? weak.label : '—'}</div>
          </div>
        </div>

        {recentImprovement && <p className="faint" style={{ marginTop: 14 }}>{recentImprovement}</p>}

        {/* -------- secondary actions -------- */}
        <div className="quick-actions">
          <button type="button" className="quick-btn" onClick={onPractise}>Practise</button>
          <button type="button" className="quick-btn" onClick={onSpeak}>Speak</button>
          <button type="button" className="quick-btn" onClick={onProgress}>Progress</button>
        </div>

        {lastTwo.length > 0 && (
          <>
            <hr className="rule" />
            <Eyebrow dim>Recent attempts</Eyebrow>
            {lastTwo.map((a) => (
              <div className="attempt-row" key={a.id}>
                <div>
                  <span style={{ fontWeight: 500 }}>{a.exercise_title || a.exercise_id}</span>
                  <br />
                  <span className="faint">{a.weakness_key ? `Focus: ${WEAKNESS_LIBRARY[a.weakness_key]?.label || a.weakness_key}` : 'No dominant weakness'}</span>
                </div>
                <span className="attempt-date">{a.created_date.slice(0, 10)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
