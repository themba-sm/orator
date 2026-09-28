import { useEffect, useState } from 'react';
import Onboarding from './screens/Onboarding.jsx';
import Baseline from './screens/Baseline.jsx';
import Dashboard from './screens/Dashboard.jsx';
import TrainSession from './screens/TrainSession.jsx';
import Profile from './screens/Profile.jsx';
import Progress from './screens/Progress.jsx';
import Practise, { SpeakNow, Settings } from './screens/Practise.jsx';
import MemoryHome from './screens/MemoryHome.jsx';
import ConverseHome from './screens/ConverseHome.jsx';
import Conversation from './screens/Conversation.jsx';
import LabHome from './screens/LabHome.jsx';
import PressureHome from './screens/PressureHome.jsx';
import PressureRun from './screens/PressureRun.jsx';
import SpeechLabHome from './screens/SpeechLabHome.jsx';
import SpeechLabRun from './screens/SpeechLabRun.jsx';
import MemoryReview from './screens/MemoryReview.jsx';
import Playbook from './screens/Playbook.jsx';
import { todayMemoryReview } from './lib/memory-integration.js';
import { first } from './lib/store.js';
import { isOnboarded, baselineComplete, getProfile, update, resetAllData } from './lib/store.js';
import { todaysExercise, practiseExercise } from './lib/generator.js';

function useHashRoute() {
  const parse = () => (window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'home');
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = (to) => { window.location.hash = `#/${to}`; };
  return [route, navigate];
}

function NavBar({ route, navigate }) {
  const items = [
    { key: 'home', label: 'Home', glyph: '·' },
    { key: 'train', label: 'Train', glyph: '»' },
    { key: 'converse', label: 'Converse', glyph: '@' },
    { key: 'lab', label: 'Lab', glyph: '▣' },
    { key: 'memory', label: 'Memory', glyph: '◆' },
    { key: 'profile', label: 'Patterns', glyph: '≡' },
    { key: 'progress', label: 'Progress', glyph: '↗' },
    { key: 'settings', label: 'Rules', glyph: '§' },
  ];
  return (
    <nav className="navbar">
      {items.map((it) => (
        <a key={it.key} className={`nav-item${route === it.key ? ' on' : ''}`} href={`#/${it.key}`}>
          <span className="ni-glyph">{it.glyph}</span>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

export default function App() {
  const [route, navigate] = useHashRoute();
  const [activeExercise, setActiveExercise] = useState(null); // for the training runner
  const [drawn, setDrawn] = useState(null); // for the Speak action
  const [sessionKind, setSessionKind] = useState('daily');
  const [conversation, setConversation] = useState(null); // { mode, difficulty, coached }
  const [pressureRun, setPressureRun] = useState(null); // { mode, level }
  const [speechRun, setSpeechRun] = useState(null); // config

  const ready = isOnboarded() && baselineComplete();

  useEffect(() => {
    if (!isOnboarded() && route !== 'start') navigate('start');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goHome = () => navigate('home');
  const startExercise = (ex, kind) => { setActiveExercise(ex); setSessionKind(kind); navigate('train'); };

  function difficultyChange(d) {
    const p = getProfile();
    if (p) update('userProfiles', p.id, { difficulty: d });
    setDrawn(null);
    navigate('settings');
    // force re-render
    window.dispatchEvent(new Event('orator:refresh'));
  }

  function hardReset() {
    if (window.confirm('Erase your entire training history? This cannot be undone.')) {
      resetAllData();
      window.location.hash = '#/start';
      window.location.reload();
    }
  }

  function drawSpeak() {
    setDrawn(practiseExercise(null)); // weighted random across categories
  }

  let screen = null;
  if (!isOnboarded()) {
    screen = <Onboarding onDone={() => navigate('baseline')} />;
  } else if (!baselineComplete()) {
    screen = <Baseline onDone={goHome} />;
  } else if (route === 'train' && activeExercise) {
    screen = <TrainSession exercise={activeExercise} kind={sessionKind} onDone={goHome} onExit={goHome} />;
  } else if (route === 'train') {
    screen = (
      <div className="screen">
        <div className="wrap center-note">
          <p className="eyebrow dim">Today's training</p>
          <h2 className="display section-title" style={{ fontSize: 24 }}>Ready when you are.</h2>
          <button type="button" className="btn btn-primary" onClick={() => startExercise(todaysExercise(), 'daily')}>Start today's training</button>
        </div>
      </div>
    );
  } else if (route === 'converse' && conversation) {
    screen = (
      <Conversation
        key={conversation.mode + conversation.difficulty + conversation.ts}
        mode={conversation.mode}
        difficulty={conversation.difficulty}
        coached={conversation.coached}
        onExit={() => { setConversation(null); navigate('converse'); }}
      />
    );
  } else if (route === 'converse') {
    screen = (
      <ConverseHome
        onStart={(mode, difficulty, coached) => {
          setConversation({ mode, difficulty, coached, ts: Date.now() });
          navigate('converse');
        }}
      />
    );
  } else if (route === 'pressure' && pressureRun) {
    screen = (
      <PressureRun
        mode={pressureRun.mode}
        level={pressureRun.level}
        onExit={() => { setPressureRun(null); navigate('pressure'); }}
        onDone={() => { setPressureRun(null); navigate('lab'); }}
      />
    );
  } else if (route === 'pressure') {
    screen = (
      <PressureHome
        onStart={(modeKey, level) => { setPressureRun({ mode: modeKey, level }); navigate('pressure'); }}
      />
    );
  } else if (route === 'speechlab' && speechRun) {
    screen = (
      <SpeechLabRun
        config={speechRun}
        onExit={() => { setSpeechRun(null); navigate('speechlab'); }}
        onDone={() => { setSpeechRun(null); navigate('lab'); }}
      />
    );
  } else if (route === 'speechlab') {
    screen = (
      <SpeechLabHome
        preset={null}
        onStart={(cfg) => { setSpeechRun(cfg); navigate('speechlab'); }}
      />
    );
  } else if (route === 'lab') {
    screen = (
      <LabHome
        onPressure={() => navigate('pressure')}
        onSpeech={() => navigate('speechlab')}
        onChallenge={(c) => {
          setSpeechRun({ type: c.type, seconds: c.seconds, prep: 180, audience: { key: 'neutral', label: 'Neutral', hint: 'Quiet. Difficult to read.', weights: {}, qaStyle: '' }, prompt: '', isChallenge: true, coach: null });
          navigate('speechlab');
        }}
      />
    );
  } else if (route === 'memory') {
    screen = <MemoryHome onReview={() => navigate('review')} onPlaybook={() => navigate('playbook')} />;
  } else if (route === 'review') {
    screen = <MemoryReview onDone={() => navigate('memory')} />;
  } else if (route === 'playbook') {
    screen = (
      <Playbook
        onReview={() => navigate('review')}
        onDrill={(itemId) => {
          const mi = first('memoryItems', (m) => m.id === itemId);
          if (mi && mi.apply_prompt) startExercise({ ...mi.apply_prompt, category: mi.apply_prompt.category || 'memory' }, 'memory-apply');
          else navigate('review');
        }}
      />
    );
  } else if (route === 'practise') {
    screen = <Practise onPick={(cat) => startExercise(practiseExercise(cat), 'practise')} />;
  } else if (route === 'speak') {
    if (!drawn) { drawSpeak(); }
    screen = drawn ? (
      <SpeakNow
        exercise={drawn}
        onStart={(ex) => startExercise(ex, 'speak')}
        onBack={drawSpeak}
      />
    ) : (
      <div className="center-note"><p className="muted">Drawing a challenge…</p></div>
    );
  } else if (route === 'profile') {
    screen = <Profile onDrill={(wk) => startExercise(practiseExercise(weaknessToCategory(wk)), 'practise')} />;
  } else if (route === 'progress') {
    screen = <Progress onTrain={() => startExercise(todaysExercise(), 'daily')} />;
  } else if (route === 'settings') {
    screen = <Settings onDifficultyChange={difficultyChange} onReset={hardReset} />;
  } else {
    // home — allow a hard refresh to re-pick today's exercise deterministically
    screen = (
      <Dashboard
        onStart={(ex) => startExercise(ex, 'daily')}
        onPractise={() => navigate('practise')}
        onSpeak={() => navigate('speak')}
        onProgress={() => navigate('progress')}
        onMemoryReview={() => navigate('review')}
        onConverse={() => navigate('converse')}
      />
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="brand" href="#/home">ORATOR<span className="amp">.</span></a>
          {ready && <span className="topbar-level">Private communication academy</span>}
        </div>
      </header>
      <main className="shell">{screen}</main>
      {ready && <NavBar route={route} navigate={navigate} />}
    </div>
  );
}

function weaknessToCategory(wk) {
  const map = {
    organisation: 'organisation', fillers: 'fillers', pace: 'pace', precision: 'precision',
    opening: 'concise', conclusion: 'concise', repetition: 'concise', sentenceConstruction: 'precision',
    specificity: 'story', verbosity: 'concise', development: 'organisation', relevance: 'opinion', vocalDelivery: 'pace',
  };
  return map[wk] || 'organisation';
}
