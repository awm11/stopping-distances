import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './styles.css';
import { DEFAULTS, UNIT_LIST, compute } from './physics.js';
import { RoadSim } from './roadSim.js';
import { ReactionTest } from './reactionScene.js';
import { FullscreenButton, Seg, blur } from './ui.jsx';
import { RoadStage, RoadPanel } from './RoadTab.jsx';
import { ChartBox, ChartPanel } from './ChartTab.jsx';
import { SortStage, SortPanel, useSort } from './SortTab.jsx';
import { ReactionStage, ReactionPanel } from './ReactionTab.jsx';

// Four tabs, one colour each. Blue and red are kept for thinking and braking distance only.
const TABS = [
  { id: 1, hash: 'road', name: 'On the road', sub: 'Stop for the ducks', col: '#ffb81c', ink: '#2a1c00' },
  { id: 2, hash: 'chart', name: 'Highway Code chart', sub: 'Typical stopping distances', col: '#22b45e', ink: '#04210f' },
  { id: 3, hash: 'sort', name: 'Sort the factors', sub: 'Thinking, braking or both?', col: '#2ec4b6', ink: '#032622' },
  { id: 4, hash: 'reaction', name: 'Reaction time test', sub: 'How quick are you?', col: '#b892ff', ink: '#1d0e3a' },
];
const tabFromHash = () => {
  if (typeof window === 'undefined') return null;
  const t = TABS.find(t => t.hash === window.location.hash.replace(/^#\/?/, '').toLowerCase());
  return t ? t.id : null;
};
const FACTOR_KEYS = ['tired', 'impaired', 'distraction', 'road', 'tyres', 'brakes'];

// Always on screen: the two equations (with units under each word) and the classic mistake.
// The definitions open from a button, to leave room for the scene.
const W = ({ c, u, children }) => <span className={'w ' + (c || '')}><span className="wt">{children}</span>{u && <span className="wu">({u})</span>}</span>;
function EquationStrip() {
  const [open, setOpen] = useState(false);
  return (
    <section className={'eqstrip' + (open ? ' open' : '')} aria-label="Key equations and definitions">
      <div className="eqs">
        <p className="eq"><W c="s" u="m">stopping distance</W><span className="op">=</span><W c="t" u="m">thinking distance</W><span className="op">+</span><W c="b" u="m">braking distance</W></p>
        <p className="eq"><W c="t" u="m">thinking distance</W><span className="op">=</span><W u="m/s">speed</W><span className="op">&times;</span><W u="s">reaction time</W></p>
      </div>
      <div className="eqside">
        <p className="mistake"><b>Careful!</b> Thinking distance is a <b>distance</b>, measured in <b>metres</b>.<br />It is not a time. The <b>reaction time</b> is the time.</p>
        <button type="button" className={'btn small defbtn' + (open ? ' on' : '')} aria-expanded={open} onClick={blur(() => setOpen(o => !o))}>
          {open ? 'Hide definitions' : 'Show definitions'}
        </button>
      </div>
      {open && (
        <dl className="defs">
          <div><dt>Reaction time</dt><dd>the <b>time</b> between seeing a hazard and pressing the brake, in s. Usually between <b>0.2 s and 0.9 s</b>.</dd></div>
          <div className="t"><dt>Thinking distance</dt><dd>the <b>distance</b> the car travels during the reaction time, in m</dd></div>
          <div className="b"><dt>Braking distance</dt><dd>the <b>distance</b> the car travels once the brakes are on, until it stops, in m</dd></div>
          <div className="s"><dt>Stopping distance</dt><dd>thinking distance + braking distance, in m</dd></div>
        </dl>
      )}
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState(() => tabFromHash() || 1);
  const [unit, setUnit] = useState('mph');
  const [s, setS] = useState(DEFAULTS);
  const [last, setLast] = useState(null);          // the last change, for "what changed?"
  const slow = false;
  const [pair, setPair] = useState(null);
  const [ghost, setGhost] = useState(true);
  const [distract, setDistract] = useState(false);
  const [results, setResults] = useState({ none: [], distract: [] });
  const sort = useSort();
  const simRef = useRef(null); if (!simRef.current) simRef.current = new RoadSim();
  const testRef = useRef(null);
  if (!testRef.current) testRef.current = new ReactionTest((rt, dis) =>
    setResults(r => { const k = dis ? 'distract' : 'none'; return { ...r, [k]: [...r[k], rt].slice(-5) }; }));
  const [rstate, setRstate] = useState('idle');
  testRef.current.onState = setRstate;
  const [snap, setSnap] = useState(() => simRef.current.snap());
  const M = TABS[tab - 1];
  const changeId = useRef(0);

  // every change goes through here, so the panels can say which distance it affected
  const change = (patch, label) => {
    setS(old => {
      if (Object.keys(patch).every(k => old[k] === patch[k])) return old;
      const nw = { ...old, ...patch };
      if (label) setLast({ id: ++changeId.current, label, before: compute(old), after: compute(nw) });
      const sim = simRef.current;
      if (Object.keys(patch).some(k => k !== 'hazard') && (sim.state === 'think' || sim.state === 'brake')) sim.cancel();
      if (sim.state === 'stopped') sim.clearRun();
      return nw;
    });
  };
  const resetFactors = () => {
    const patch = {}; FACTOR_KEYS.forEach(k => { patch[k] = DEFAULTS[k]; });
    patch.baseRT = DEFAULTS.baseRT;
    change(patch, 'Factors reset');
  };
  const pick = id => { setTab(id); try { history.replaceState(null, '', '#' + TABS[id - 1].hash); } catch { /* ignore */ } };
  useEffect(() => {
    const on = () => { const t = tabFromHash(); if (t) setTab(t); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  // space bar starts the drive on tab 1
  useEffect(() => {
    const kd = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (tab !== 1 || e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      const sim = simRef.current;
      if (sim.state === 'parked' || sim.state === 'stopped') sim.drive();
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [tab, s]);

  // Wide screens: fit the whole page to the window so nothing scrolls
  const [fit, setFit] = useState(false);
  useLayoutEffect(() => {
    const check = () => setFit(window.innerWidth > 900 && window.innerHeight >= 620);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const shared = { s, change, unit, last, resetFactors };
  return (
    <div className={'app tab' + tab + (fit ? ' fit' : '')} style={{ '--mode': M.col, '--mode-ink': M.ink }}>
      <header className="top">
        <h1>Stopping distances</h1>
        <nav className="modes" aria-label="Choose a tab">
          {TABS.map(t => (
            <button key={t.id} type="button" className={'modetab' + (tab === t.id ? ' on' : '')} style={{ '--c': t.col, '--ci': t.ink }}
              aria-pressed={tab === t.id} onClick={blur(() => pick(t.id))}>
              <span className="numeral">{t.id}</span>
              <span className="mtxt"><b>{t.name}</b><small>{t.sub}</small></span>
            </button>
          ))}
        </nav>
        <div className="unitbox">
          <span className="unitlbl">Speed in</span>
          <Seg label="Speed units" value={unit} onChange={setUnit} options={UNIT_LIST.map(u => ({ value: u.key, label: u.label }))} />
        </div>
        <FullscreenButton />
      </header>

      <EquationStrip />

      <main className="layout">
        <section className="spacecol">
          {tab === 1 && <RoadStage simRef={simRef} s={s} unit={unit} slow={slow} onSnap={setSnap} />}
          {tab === 2 && <ChartBox s={s} unit={unit} pair={pair ? { a: [20, 40], b: [30, 60], c: [20, 60] }[pair] : null} ghost={ghost} />}
          {tab === 3 && <SortStage st={sort} />}
          {tab === 4 && <ReactionStage testRef={testRef} distract={distract} rstate={rstate} n={(distract ? results.distract : results.none).length} />}
        </section>
        <aside className="lab">
          {tab === 1 && <RoadPanel simRef={simRef} snap={snap} {...shared} />}
          {tab === 2 && <ChartPanel pair={pair} setPair={setPair} ghost={ghost} setGhost={setGhost} {...shared} />}
          {tab === 3 && <SortPanel st={sort} />}
          {tab === 4 && <ReactionPanel testRef={testRef} rstate={rstate} distract={distract} setDistract={setDistract} results={results} setResults={setResults} change={change} unit={unit} />}
        </aside>
      </main>

      <div className="bottom-block">
        <a className="more-sims" href="/" target="_blank" rel="noopener noreferrer">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="more-sims-icon" />
          <span>See other simulations</span>
        </a>
        <p className="more-sims-note">Click the icon <span className="side-right">on the left</span><span className="side-below">above</span> to explore other interactive physics simulations like this one.</p>
      </div>
    </div>
  );
}
