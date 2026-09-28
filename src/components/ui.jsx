import { useEffect, useRef, useState } from 'react';

export function Eyebrow({ children, dim }) {
  return <p className={`eyebrow${dim ? ' dim' : ''}`}>{children}</p>;
}

export function Btn({ children, onClick, variant = 'primary', block, small, disabled, type }) {
  const cls = ['btn', `btn-${variant}`, block ? 'btn-block' : '', small ? 'btn-sm' : ''].filter(Boolean).join(' ');
  return (
    <button type={type || 'button'} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function TimerRing({ secondsLeft, total, caption, accent = '#C6A15B' }) {
  const pct = total > 0 ? Math.max(0, secondsLeft / total) : 0;
  const r = 74;
  const circ = 2 * Math.PI * r;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  return (
    <div className="timer-ring">
      <svg width="168" height="168" viewBox="0 0 168 168">
        <circle cx="84" cy="84" r={r} stroke="#1D1D21" strokeWidth="3" fill="none" />
        <circle
          cx="84" cy="84" r={r} stroke={accent} strokeWidth="3" fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        />
      </svg>
      <div className="timer-val">
        <div className="timer-num">{mm}:{String(ss).padStart(2, '0')}</div>
        <div className="timer-cap">{caption}</div>
      </div>
    </div>
  );
}

export function Meter({ label, value, max = 100, suffix }) {
  const v = value === null || value === undefined ? null : Math.round(value);
  const width = v === null ? 0 : Math.min(100, (v / max) * 100);
  return (
    <div className="meter">
      <div className="meter-row">
        <span className="meter-label">{label}</span>
        <span className="meter-val">{v === null ? '—' : v}{suffix || ''}</span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill${v !== null && v < 45 ? ' low' : ''}${v !== null && v >= 70 ? ' high' : ''}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function AudioNote({ url }) {
  const ref = useRef(null);
  useEffect(() => () => { if (ref.current) ref.current.src = ''; }, []);
  if (!url) return null;
  return (
    <div className="audio-note">
      <span className="faint" style={{ whiteSpace: 'nowrap' }}>Playback</span>
      <audio ref={ref} controls src={url} preload="metadata" />
    </div>
  );
}

export function useCountdown(seconds, { onDone, autostart = false } = {}) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(autostart);
  useEffect(() => {
    if (!running) return undefined;
    if (left <= 0) { onDone && onDone(); return undefined; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [running, left]); // eslint-disable-line react-hooks/exhaustive-deps
  return { left, setLeft, running, setRunning, start: () => { setLeft(seconds); setRunning(true); }, stop: () => setRunning(false) };
}

export function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function fmtTimeHM(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
