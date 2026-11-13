import React, { useEffect, useRef } from 'react';
import { ReactionTest } from './reactionScene.js';
import { rulerTime, MPH, UNITS, fmtSpeed } from './physics.js';
import { Fig, blur } from './ui.jsx';

export function ReactionStage({ testRef, distract, n, rstate }) {
  const cvRef = useRef(null), stageRef = useRef(null), navRef = useRef(null);
  const live = useRef({}); live.current = { distract, n };
  testRef.current.full = () => live.current.n >= 5;
  testRef.current.count = () => live.current.n;
  useEffect(() => {
    const cv = cvRef.current, ctx = cv.getContext('2d');
    const box = { w: 0, h: 0 };
    const measure = () => { box.w = stageRef.current.clientWidth; box.h = stageRef.current.clientHeight; };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(stageRef.current);
    let raf, sized = '';
    const loop = now => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const key = box.w + 'x' + box.h + 'x' + dpr;
      if (sized !== key) { cv.width = Math.round(box.w * dpr); cv.height = Math.round(box.h * dpr); sized = key; }
      const t = testRef.current; t.update(now);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (box.w > 0) t.draw(ctx, box.w, box.h, now);
      if (navRef.current) navRef.current.style.display = t.satnavOn(now) ? 'flex' : 'none';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const key = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); testRef.current.respond(performance.now(), live.current.distract, live.current.n); }
    };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keydown', key); };
  }, []);
  const down = e => { e.preventDefault(); testRef.current.respond(performance.now(), live.current.distract, live.current.n); };
  return (
    <div className="stage reaction" ref={stageRef} onPointerDown={down}>
      <canvas ref={cvRef} role="img" aria-label="Reaction time test: the view through a windscreen. Press the brake when the car ahead's brake lights come on." />
      {/* the brake pedal: the obvious thing to hit. It only works while you're driving. */}
      <button type="button" className={'pedal' + (rstate === 'wait' || rstate === 'go' ? ' live' : '')}
        disabled={!(rstate === 'wait' || rstate === 'go')} aria-label="Brake"
        onPointerDown={e => { e.preventDefault(); e.stopPropagation(); testRef.current.respond(performance.now(), live.current.distract, live.current.n); }}>
        <span className="pedal-pad"><b>BRAKE</b></span>
        <small>or space bar</small>
      </button>
      {/* the sat-nav pops up right on top of the brake pedal (clicks still go through to it) */}
      <div className="satnav" ref={navRef} aria-hidden="true" style={{ display: 'none' }}>
        <span className="satnav-ic">&#10148;</span>
        <span><b>In 200 yards, turn left.</b><br />Then turn right. Then&hellip;</span>
      </div>
    </div>
  );
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

export function ReactionPanel({ testRef, rstate, distract, setDistract, results, setResults, change, unit }) {
  const n = results.none, d = results.distract;
  const mn = n.length ? mean(n) : null, md = d.length ? mean(d) : null;
  const latest = distract ? md : mn;
  const v30 = 30 * MPH, v70 = 70 * MPH;
  const rows = Array.from({ length: 5 }, (_, i) => i);
  return (
    <>
      <Fig tag="4A" title="Test your reactions">
        <ol className="steps">
          <li>Press <b>Drive</b>. Your car pulls away behind the car in front.</li>
          <li>At some point it will brake. The moment its <b>brake lights</b> come on, hit the <b>BRAKE</b> pedal (or press the space bar).</li>
          <li>Do it <b>5 times</b> without distractions, then switch distractions on and do it 5 more times.</li>
        </ol>
        <div className="btnrow">
          <button type="button" className="btn primary big" disabled={rstate === 'wait' || rstate === 'go' || rstate === 'done'}
            onClick={blur(() => testRef.current.respond(performance.now(), distract, (distract ? d : n).length))}>
            {rstate === 'wait' || rstate === 'go' ? 'Driving\u2026' : rstate === 'done' ? 'All 5 done' : rstate === 'idle' ? 'Drive' : 'Next repeat'}</button>
          <label className="swgroup"><span className="insw"><input type="checkbox" checked={distract} disabled={rstate === 'wait' || rstate === 'go'} onChange={e => setDistract(e.target.checked)} /><span className="track" /></span>Distractions</label>
        </div>
      </Fig>

      <Fig tag="4B" title="Your results" actions={<button type="button" className="btn ghost small" onClick={blur(() => setResults({ none: [], distract: [] }))}>Clear</button>}>
        <table className="rtable">
          <thead><tr><th>Repeat</th><th>No distractions</th><th>With distractions</th></tr></thead>
          <tbody>
            {rows.map(i => <tr key={i}><th>{i + 1}</th><td>{n[i] != null ? n[i].toFixed(3) + ' s' : '–'}</td><td>{d[i] != null ? d[i].toFixed(3) + ' s' : '–'}</td></tr>)}
            <tr className="mean"><th>Mean</th><td>{mn != null ? mn.toFixed(3) + ' s' : '–'}</td><td>{md != null ? md.toFixed(3) + ' s' : '–'}</td></tr>
          </tbody>
        </table>
        {latest != null && (
          <div className="calc">
            <p className="cl think">At {fmtSpeed(v30, unit)}: thinking distance = {v30.toFixed(1)} m/s &times; {latest.toFixed(2)} s = <b>{(v30 * latest).toFixed(1)} m</b></p>
            <p className="cl think">At {fmtSpeed(v70, unit)}: thinking distance = {v70.toFixed(1)} m/s &times; {latest.toFixed(2)} s = <b>{(v70 * latest).toFixed(1)} m</b></p>
          </div>
        )}
        {mn != null && md != null && (
          <p className="compare">Distractions changed your mean by <b>{md - mn >= 0 ? '+' : '\u2212'}{Math.abs(md - mn).toFixed(3)} s</b>.
            At {fmtSpeed(v30, unit)}, that is <b>{(Math.abs(md - mn) * v30).toFixed(1)} m</b> {md >= mn ? 'more' : 'less'} thinking distance.</p>
        )}
        <div className="btnrow">
          <button type="button" className="btn" disabled={latest == null}
            onClick={blur(() => change({ baseRT: Math.round(latest * 100) / 100 }, 'Your reaction time (' + latest.toFixed(2) + ' s)'))}>
            Drive with my reaction time
          </button>
        </div>
        <p className="hint">Typical reaction times are between <b>0.2 s and 0.9 s</b>. A real driver is slower than this test: they have to decide what to do and move their foot to the brake. The Highway Code uses <b>0.67 s</b>. If you don't brake within 3 s, it goes down as 3.0 s. A repeat under 0.1 s is a guess and doesn't count.</p>
      </Fig>

      <Fig tag="4C" title="The ruler-drop test">
        <div className="ruler">
          <RulerDiagram />
          <div>
            <p className="explain small">You can also measure reaction time with a ruler and a partner.</p>
            <ol className="steps small">
              <li>Your partner holds a ruler upright, with <b>0 cm</b> level with the gap between your thumb and finger.</li>
              <li>They let go <b>without warning</b>.</li>
              <li>Catch it as fast as you can and read the distance at the top of your thumb.</li>
              <li>Repeat and find the mean. Use the table to turn the distance into a time.</li>
            </ol>
            <p className="explain small">The further the ruler falls, the longer your reaction time.</p>
          </div>
        </div>
      </Fig>

      <Fig tag="4D" title="Ruler distance to reaction time">
        <RulerTable />
        <p className="hint">The times are worked out from how quickly a dropped object speeds up.</p>
      </Fig>
    </>
  );
}

function RulerTable() {
  const cms = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 40, 50, 60, 70, 80];
  return (
    <table className="rtable conv">
      <thead><tr><th>Distance the ruler fell (cm)</th><th>Reaction time (s)</th></tr></thead>
      <tbody>{cms.map(cm => <tr key={cm}><td>{cm}</td><td>{rulerTime(cm).toFixed(2)}</td></tr>)}</tbody>
    </table>
  );
}

// Before and after: the ruler starts with 0 cm level with your open thumb and finger, falls, and is caught at 18 cm
const PX = 6.2;   // pixels per cm
function Ruler({ x, y0 }) {
  const marks = [];
  for (let cm = 0; cm <= 30; cm++) {
    const y = y0 - cm * PX, big = cm % 5 === 0;
    marks.push(<line key={cm} x1={x - 12} x2={x - 12 + (big ? 10 : 5)} y1={y} y2={y} />);
    if (cm % 10 === 0) marks.push(<text key={'t' + cm} x={x + 6} y={y + 3.5} textAnchor="middle">{cm}</text>);
  }
  return (
    <g>
      <rect className="rul" x={x - 12} y={y0 - 31 * PX} width="24" height={32 * PX} rx="2" />
      <g className="mk">{marks}</g>
    </g>
  );
}
// The hands are flat shapes: far fingers in a darker shade, then the hand, then the thumb and index finger in front.
const fing = (d, w, cls, key) => <path key={key} className={cls} d={d} strokeWidth={w} />;
// Your partner's hand: the arm comes in from the top left, the fingers hang down, and the thumb and index finger
// pinch the top of the ruler at (x, y). open: the thumb and finger have sprung apart.
function TopHand({ x, y, open = false }) {
  return (
    <g className="hand partner" transform={`translate(${x} ${y})`}>
      {fing('M46 -62 Q62 -48 60 -26', 10, 'h-far', 'l')}
      {fing('M40 -58 Q55 -40 50 -14', 11, 'h-far', 'r')}
      {fing('M32 -54 Q44 -34 37 -5', 12, 'h-far', 'm')}
      {/* forearm, wrist and the back of the hand */}
      <path className="h-body" d="M-200 -150 L-80 -112 C-40 -104 24 -100 48 -70 L46 -52 L30 -36 L-6 -30 L-38 -36 C-70 -52 -130 -84 -200 -104 Z" />
      {fing(open ? 'M24 -44 Q32 -24 25 -5' : 'M24 -44 Q22 -20 8 -4', 13, 'h-near', 'i')}
      {fing(open ? 'M-28 -42 Q-40 -24 -30 -6' : 'M-28 -42 Q-22 -18 -8 -4', 15, 'h-near', 't')}
      <path className="h-crease" d="M-16 -40 Q-2 -34 12 -42" />
      <ellipse className="h-nail" cx={open ? 24.5 : 9} cy={open ? -8 : -7} rx="3.4" ry="4.4" transform={`rotate(${open ? 8 : 32} ${open ? 24.5 : 9} ${open ? -8 : -7})`} />
      <ellipse className="h-nail" cx={open ? -30.5 : -10} cy={open ? -9 : -7.5} rx="4" ry="5" transform={`rotate(${open ? -14 : -34} ${open ? -30.5 : -10} ${open ? -9 : -7.5})`} />
    </g>
  );
}
// Your hand: the arm comes in from the bottom right. The fingers go behind the ruler (part="back") and the thumb
// comes across the front of it (part="front"). (x, y) is the middle of the ruler, level with the top of your thumb.
// open: the thumb is lifted clear of the ruler, ready to catch.
function CatchHand({ x, y, open = false, part }) {
  const tips = open ? [-34, -35, -32, -25] : [-24, -25, -22, -16];
  return (
    <g className="hand you" transform={`translate(${x} ${y})`}>
      {part === 'back' ? (
        <>
          {[7, 18, 29, 39].map((fy, i) => fing(`M36 ${fy + 2} L${tips[i]} ${fy}`, [12, 12, 11, 10][i], 'h-far', i))}
          <path className="h-body" d="M17 -4 C40 -12 64 -6 80 10 L200 80 L200 150 L42 55 C30 53 19 48 17 42 Z" />
        </>
      ) : (
        <>
          {fing(open ? 'M48 12 Q36 -8 28 -24' : 'M48 12 Q22 0 -5 6', 17, 'h-edge', 'te')}
          {fing(open ? 'M48 12 Q36 -8 28 -24' : 'M48 12 Q22 0 -5 6', 14, 'h-near', 't')}
          <path className="h-patch" d="M40 2 L62 6 L60 26 L42 22 Z" />
          <ellipse className="h-nail" cx={open ? 28 : -5} cy={open ? -24 : 5.5} rx="4.6" ry="4" transform={`rotate(${open ? 62 : -8} ${open ? 28 : -5} ${open ? -24 : 5.5})`} />
        </>
      )}
    </g>
  );
}
function RulerDiagram() {
  const fy = 350, fall = 18;           // fy: the top of your thumb; the ruler falls 18 cm
  const bx = 95, ax = 290;             // the ruler in each picture
  const rtop = fy - 31 * PX;           // the top end of the ruler before it is dropped
  const zeroAfter = fy + fall * PX;    // the 0 cm mark after the fall
  const rulerTopAfter = zeroAfter - 31 * PX;
  return (
    <svg className="rulerdiag" viewBox="0 0 380 516" role="img" aria-label="Before: your partner holds the top of the ruler, with 0 cm level with your open thumb and finger. After: your partner lets go, the ruler falls, and you catch it. It fell 18 cm.">
      <defs>
        <clipPath id="rdL"><rect x="0" y="0" width="189" height="516" /></clipPath>
        <clipPath id="rdR"><rect x="191" y="0" width="189" height="516" /></clipPath>
      </defs>
      <text className="phead" x={bx} y="16" textAnchor="middle">Before</text>
      <text className="phead" x={ax} y="16" textAnchor="middle">After</text>
      <line className="divider" x1="190" x2="190" y1="4" y2="512" />

      {/* BEFORE */}
      <g clipPath="url(#rdL)">
        <CatchHand part="back" x={bx} y={fy} open />
        <Ruler x={bx} y0={fy} />
        <TopHand x={bx} y={rtop + 12} />
        <CatchHand part="front" x={bx} y={fy} open />
      </g>
      <text className="lbl" x="182" y="40" textAnchor="end">Your partner holds</text>
      <text className="lbl" x="182" y="54" textAnchor="end">the top of the ruler</text>
      <text className="lbl" x="8" y={fy + 100}>Your thumb and finger are</text>
      <text className="lbl" x="8" y={fy + 114}>open, level with 0 cm</text>

      {/* AFTER */}
      <g clipPath="url(#rdR)">
        <CatchHand part="back" x={ax} y={fy} />
        <Ruler x={ax} y0={zeroAfter} />
        <g className="motion">
          {[-7, 0, 7].map(dx => <line key={dx} x1={ax + dx} x2={ax + dx} y1={rulerTopAfter - 34} y2={rulerTopAfter - 8} />)}
        </g>
        <TopHand x={ax} y={rtop + 12} open />
        <CatchHand part="front" x={ax} y={fy} />
      </g>
      <text className="lbl" x="374" y="40" textAnchor="end">They let go</text>
      <text className="lbl" x="374" y="54" textAnchor="end">without warning</text>
      <text className="lbl" x="374" y={fy - 22} textAnchor="end">You catch it</text>
      {/* how far it fell: from the 0 cm mark up to the top of your thumb */}
      <g className="dim">
        <line x1={ax - 54} x2={ax - 40} y1={fy} y2={fy} className="tick" />
        <line x1={ax - 54} x2={ax - 14} y1={zeroAfter} y2={zeroAfter} className="tick" />
        <path d={`M${ax - 47} ${fy + 3} V${zeroAfter - 3} M${ax - 52} ${fy + 9} l5 -7 l5 7 M${ax - 52} ${zeroAfter - 9} l5 7 l5 -7`} />
      </g>
      <text className="lbl dimlbl" x={ax - 56} y={zeroAfter - 34} textAnchor="end">fell</text>
      <text className="lbl dimlbl" x={ax - 56} y={zeroAfter - 19} textAnchor="end">18 cm</text>
      <text className="lbl strong" x={ax} y={zeroAfter + 26} textAnchor="middle">Read 18 cm = 0.19 s</text>
      <text className="lbl" x={ax} y={zeroAfter + 41} textAnchor="middle">(use the table in 4D)</text>
    </svg>
  );
}
