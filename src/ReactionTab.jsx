import React, { useEffect, useRef } from 'react';
import { ReactionTest } from './reactionScene.js';
import { rulerTime, MPH, UNITS, fmtSpeed } from './physics.js';
import { Fig, blur } from './ui.jsx';
import { RULER_DROP_DEFS } from './rulerDropArt.js';

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
  const v30 = 30 * MPH;
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
        <p className="hint">Typical reaction times are between <b>0.2 s and 0.9 s</b>. A real driver is slower than this test: they have to decide what to do and move their foot to the brake. The Highway Code uses <b>0.67 s</b>.</p>
      </Fig>

      <Fig tag="4C" title="The ruler-drop test">
        <div className="ruler">
          <RulerDiagram />
          <div>
            <p className="explain small">You can also measure reaction time with a ruler and two students.</p>
            <ol className="steps small">
              <li>Student A holds a ruler upright, with <b>0 cm</b> level with the gap between Student B&rsquo;s thumb and finger.</li>
              <li>Student A lets go <b>without warning</b>.</li>
              <li>Student B catches it as fast as they can and reads the distance at the top of their thumb.</li>
              <li>Repeat and find the mean.</li>
              <li>Use the table to turn the distance into a time.</li>
            </ol>
            <p className="explain small">The further the ruler falls, the longer the reaction time.</p>
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

// Before and after: the ruler starts with 0 cm level with Student B's open thumb and finger, falls, and is caught
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
// The diagram: a colleague's drawing of the hands (rulerDropArt.js, used exactly as supplied) with the app's own ruler
// in place of theirs, scaled to fill the same strip (14 x 122 units). The "After" ruler is lowered so it falls 18 cm.
const RS = 122 / (32 * PX);                  // ruler scale: our 32 cm-tall ruler drawing -> their 122 units
const CM = PX * RS;                          // units per cm in their drawing (about 3.8)
// x: the middle of the ruler; bottom: the bottom end of the ruler (0 cm is 1 cm above it)
const DropRuler = ({ x, bottom }) => <g transform={`translate(${x} ${bottom}) scale(${RS})`}><Ruler x={0} y0={-PX} /></g>;
function RulerDiagram() {
  const catchY = 170.4;                      // the top of Student B's thumb and finger (0 cm before the drop)
  const fell = 18;                           // how far the ruler falls before it's caught
  const zeroAfter = catchY + fell * CM;      // the 0 cm mark after the drop
  const bottomAfter = zeroAfter + CM, topAfter = bottomAfter - 122;
  const t = rulerTime(fell).toFixed(2);
  return (
    <svg className="rulerdiag art" viewBox="0 -44 304 318" role="img" aria-label={`Before: Student A holds the top of the ruler, with 0 cm level with Student B's open thumb and finger. After: Student A lets go, the ruler falls, and Student B catches it. It fell ${fell} cm.`}>
      <defs dangerouslySetInnerHTML={{ __html: RULER_DROP_DEFS }} />
      <text className="phead" x="76" y="-30" textAnchor="middle">Before</text>
      <text className="phead" x="228" y="-30" textAnchor="middle">After</text>

      {/* LEFT: holding (layer order as in the colleague's drawing) */}
      <use href="#rd-handBack" />
      <DropRuler x={87} bottom={174} />
      <use href="#rd-topHand" />
      <g clipPath="url(#rd-cIdxL)"><DropRuler x={87} bottom={174} /></g>
      <use href="#rd-thumb" />
      <text className="lbl" x="76" y="-16" textAnchor="middle">Student A holds</text>
      <text className="lbl" x="76" y="-7" textAnchor="middle">the top of the ruler</text>
      <text className="lbl" x="104" y="224" textAnchor="middle">Student B&rsquo;s thumb and finger are</text>
      <text className="lbl" x="104" y="233" textAnchor="middle">open, level with 0 cm</text>

      {/* RIGHT: dropped and caught */}
      <use href="#rd-handBack" transform="translate(135 0)" />
      <DropRuler x={224} bottom={bottomAfter} />
      <use href="#rd-topHand" transform="translate(134 0)" />
      <use href="#rd-thumb" transform="translate(135 0) rotate(9 130 172)" />
      {/* the colleague's motion lines, moved down to sit just above the lowered ruler */}
      <g fill="url(#rd-blur)" transform={`translate(0 ${topAfter - 82})`}><rect x="217.8" y="65" width="2.6" height="16" /><rect x="222.3" y="65" width="2.6" height="16" /><rect x="226.8" y="65" width="2.6" height="16" /></g>
      <text className="lbl" x="228" y="-16" textAnchor="middle">Student A lets go</text>
      <text className="lbl" x="228" y="-7" textAnchor="middle">without warning</text>
      <text className="lbl" x="300" y="141" textAnchor="end">Student B</text>
      <text className="lbl" x="300" y="150" textAnchor="end">catches it</text>
      {/* how far it fell: from the 0 cm mark up to the top of Student B's thumb */}
      <g className="dim">
        <line x1="196" x2="205" y1={catchY} y2={catchY} className="tick" />
        <line x1="196" x2="216" y1={zeroAfter} y2={zeroAfter} className="tick" />
        <path d={`M201 ${catchY + 1.5} V${zeroAfter - 1.5} M198 ${catchY + 5} l3 -4 l3 4 M198 ${zeroAfter - 5} l3 4 l3 -4`} />
      </g>
      <text className="lbl dimlbl" x="194" y={(catchY + zeroAfter) / 2 - 1} textAnchor="end">fell</text>
      <text className="lbl dimlbl" x="194" y={(catchY + zeroAfter) / 2 + 8} textAnchor="end">{fell} cm</text>
      <text className="lbl strong" x="228" y={bottomAfter + 13} textAnchor="middle">Read {fell} cm = {t} s</text>
      <text className="lbl" x="228" y={bottomAfter + 22} textAnchor="middle">(use the table in 4D)</text>
    </svg>
  );
}
