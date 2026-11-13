import React, { useEffect, useRef, useState } from 'react';
import { compute, DEFAULTS, MPH, UNITS, CAR_LEN, fmtSpeed, activeFactors, niceMax, niceStep } from './physics.js';
import { Fig, Factors, blur } from './ui.jsx';

// Tab 2: the Highway Code chart, drawn from the physics
const SPEEDS = [20, 30, 40, 50, 60, 70];
const HC = [[6, 6], [9, 14], [12, 24], [15, 38], [18, 55], [21, 75]];   // the printed Highway Code figures (m)

// Bars glide to their new lengths
function useTween(target) {
  const [val, setVal] = useState(target);
  const cur = useRef(target), tgt = useRef(target);
  tgt.current = target;
  useEffect(() => {
    let raf;
    const step = () => {
      const t = tgt.current, c = cur.current;
      const n = t.map((x, i) => c[i] + (x - c[i]) * 0.18);
      const done = n.every((y, i) => Math.abs(t[i] - y) < 0.02);
      cur.current = done ? t : n; setVal(cur.current);
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.join(',')]);
  return val;
}

function speedLabel(mph, unit) {
  const v = mph * MPH;
  if (unit === 'mph') return [mph + ' mph', ''];
  return [fmtSpeed(v, unit), mph + ' mph'];
}

// The chart's height follows the panel's shape, so it fills the panel instead of sitting in a letterbox
export function ChartBox(props) {
  const ref = useRef(null);
  const [ratio, setRatio] = useState(0.62);
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => { if (el.clientWidth) setRatio(el.clientHeight / el.clientWidth); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div className="stage chart" ref={ref}><ChartStage {...props} ratio={ratio} /></div>;
}

function ChartStage({ s, unit, pair, ghost, ratio = 0.62 }) {
  const rows = SPEEDS.map(m => compute(s, m * MPH));
  const flat = useTween(rows.flatMap(r => [r.think, r.brake]));
  const maxStop = Math.max(...rows.map(r => r.stop), 96);
  const W = 1000, H = Math.max(500, Math.min(900, W * ratio)), x0 = 150, top = 112;
  const rowH = (H - top - 64) / 6, barH = Math.min(60, rowH * 0.8);
  const pw = W - x0 - 175;   // room for the longest "= N metres / or N car lengths" label after the bar
  const sc = pw / maxStop;
  const hiRows = pair ? [SPEEDS.indexOf(pair[0]), SPEEDS.indexOf(pair[1])] : [];
  const changed = activeFactors(s);
  const differs = rows.some((r, i) => Math.abs(r.stop - (HC[i][0] + HC[i][1])) > 1.5);
  const rt = Math.abs(s.baseRT - DEFAULTS.baseRT) > 0.001 ? [`reaction time ${s.baseRT.toFixed(2)} s`] : [];
  const sub = changed.length || rt.length ? 'Changed: ' + [...rt, ...changed.map(c => c.toLowerCase())].join(', ') : 'Alert driver, dry road, car in good condition';
  // the scale along the bottom
  const step = niceStep(maxStop, 6), ticks = [];
  for (let m = 0; m <= maxStop + 1e-9; m += step) ticks.push(m);
  const arrow = (x, y, w, h, cls, tip = 16) => {
    const t = Math.min(tip, Math.max(0, w));
    return <path className={cls} d={`M${x} ${y}h${Math.max(0, w)}l${t} ${h / 2}l${-t} ${h / 2}h${-Math.max(0, w)}z`} />;
  };
  return (
    <svg className="chartsvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Typical stopping distances chart">
      <rect width={W} height={H} fill="#f5f3ee" />
      <text className="ch-title" x="30" y="48">Typical stopping distances</text>
      <text className="ch-sub" x="30" y="76">{sub}</text>
      <g transform="translate(626 24)">
        <rect width="168" height="34" rx="5" fill="#2f86d6" /><text className="ch-leg" x="84" y="22.5" textAnchor="middle">Thinking distance</text>
        <rect x="174" width="168" height="34" rx="5" fill="#e5412f" /><text className="ch-leg" x="258" y="22.5" textAnchor="middle">Braking distance</text>
        <text className="ch-note" x="342" y="56" textAnchor="end">Average car length = {CAR_LEN} m</text>
      </g>
      {rows.map((r, i) => {
        const y = top + i * rowH, wt = flat[2 * i] * sc, wb = flat[2 * i + 1] * sc;
        const [l1, l2] = speedLabel(SPEEDS[i], unit);
        const tot = flat[2 * i] + flat[2 * i + 1];
        const hi = hiRows.includes(i);
        const hc = HC[i], ideal = compute({ ...DEFAULTS }, SPEEDS[i] * MPH).stop;   // dotted outline: the exact ideal value (the HC chart rounds)
        return (
          <g key={i}>
            {hi && <rect x="14" y={y - 10} width={W - 28} height={barH + 20} rx="10" className="ch-hi" />}
            <text className="ch-speed" x="30" y={y + barH / 2 + (l2 ? -2 : 8)}>{l1}</text>
            {l2 && <text className="ch-speed2" x="30" y={y + barH / 2 + 18}>({l2})</text>}
            {arrow(x0 + wt, y, wb, barH, 'ch-b')}
            {arrow(x0, y, wt, barH, 'ch-t')}
            {ghost && <path className="ch-ghost" d={`M${x0} ${y}h${ideal * sc}l16 ${barH / 2}l-16 ${barH / 2}h${-ideal * sc}z`} />}
            {ghost && differs && i === 5 && (
              <text className="ch-ghostlbl" x={x0 + ideal * sc} y={y + barH + 17} textAnchor="middle">{'\u25B2'} Highway Code: {hc[0] + hc[1]} m</text>
            )}
            {wt > 40 && <text className="ch-in" x={x0 + wt / 2} y={y + barH / 2 + 7} textAnchor="middle">{Math.round(flat[2 * i])} m</text>}
            {wb > 40 && <text className="ch-in" x={x0 + wt + wb / 2 + 6} y={y + barH / 2 + 7} textAnchor="middle">{Math.round(flat[2 * i + 1])} m</text>}
            <text className="ch-tot" x={x0 + wt + wb + 26} y={y + barH / 2 - 2}>= {Math.round(tot)} metres</text>
            <text className="ch-cars" x={x0 + wt + wb + 26} y={y + barH / 2 + 18}>or {Math.round(tot / CAR_LEN)} car lengths</text>
          </g>
        );
      })}
      <g className="ch-scale">
        <line x1={x0} x2={x0 + maxStop * sc} y1={H - 44} y2={H - 44} />
        {ticks.map(m => <g key={m}><line x1={x0 + m * sc} x2={x0 + m * sc} y1={H - 50} y2={H - 38} /><text x={x0 + m * sc} y={H - 20} textAnchor="middle">{m} m</text></g>)}
      </g>

    </svg>
  );
}

const PAIRS = [
  { id: 'a', a: 20, b: 40, k: 2 },
  { id: 'b', a: 30, b: 60, k: 2 },
  { id: 'c', a: 20, b: 60, k: 3 },
];

export function ChartPanel({ s, change, unit, pair, setPair, ghost, setGhost, last, resetFactors }) {
  const P = PAIRS.find(p => p.id === pair);
  const lab = m => speedLabel(m, unit)[0];
  let table = null;
  if (P) {
    const ra = compute(s, P.a * MPH), rb = compute(s, P.b * MPH);
    table = (
      <>
        <table className="ptable">
          <thead><tr><th></th><th>{lab(P.a)}</th><th>{lab(P.b)}</th><th>change</th></tr></thead>
          <tbody>
            <tr className="think"><th>Thinking</th><td>{ra.think.toFixed(1)} m</td><td>{rb.think.toFixed(1)} m</td><td><b>&times;{(rb.think / ra.think).toFixed(1)}</b></td></tr>
            <tr className="brake"><th>Braking</th><td>{ra.brake.toFixed(1)} m</td><td>{rb.brake.toFixed(1)} m</td><td><b>&times;{(rb.brake / ra.brake).toFixed(1)}</b></td></tr>
          </tbody>
        </table>
        <p className="explain small">The speed is <b>&times;{P.k}</b>. The thinking distance goes up by the same amount (&times;{P.k}), but the braking distance goes up by much more (&times;{P.k * P.k}).</p>
      </>
    );
  }
  return (
    <>
      <Fig tag="2A" title="Reading the chart">
        <p className="explain">Each bar is the <b>stopping distance</b> at one speed. The <b className="t">blue</b> part is the <b>thinking distance</b> and the <b className="b">red</b> part is the <b>braking distance</b>.</p>
        <label className="swgroup" style={{ marginTop: 10 }}><span className="insw"><input type="checkbox" checked={ghost} onChange={e => setGhost(e.target.checked)} /><span className="track" /></span>Show the Highway Code values</label>
      </Fig>
      <Fig tag="2B" title="Factors" actions={<button type="button" className="btn ghost small" onClick={blur(resetFactors)}>Reset</button>}>
        <div className="setrow">
          <label className="setlbl" htmlFor="rt">Reaction</label>
          <input id="rt" type="range" min="0.2" max="1.5" step="0.01" value={s.baseRT} onChange={e => change({ baseRT: +e.target.value }, 'Reaction time ' + (+e.target.value).toFixed(2) + ' s')} />
          <span className="speedv">{s.baseRT.toFixed(2)} s</span>
        </div>
        <Factors s={s} change={change} yesNoDistraction />
      </Fig>
      <Fig tag="2C" title="Spot the pattern">
        <p className="explain small">Pick two speeds to compare.</p>
        <div className="btnrow">
          {PAIRS.map(p => (
            <button key={p.id} type="button" className={'btn' + (pair === p.id ? ' primary' : '')} onClick={blur(() => setPair(pair === p.id ? null : p.id))}>
              {lab(p.a)} &rarr; {lab(p.b)}
            </button>
          ))}
        </div>
        {table}
      </Fig>
      <Fig tag="2D" title="Distance against speed">
        <SpeedGraph s={s} unit={unit} />
      </Fig>
    </>
  );
}

// Thinking distance is a straight line; braking distance curves upwards
function SpeedGraph({ s, unit }) {
  const U = UNITS[unit];
  const GW = 340, GH = 200, ML = 46, MR = 12, MT = 12, MB = 34, pw = GW - ML - MR, ph = GH - MT - MB;
  const vMax = 70 * MPH, xMax = niceMax(vMax / U.k, 5);
  const yMax = niceMax(compute(s, xMax * U.k).stop, 4);
  const X = v => ML + (v / U.k / xMax) * pw, Y = d => MT + ph - (d / yMax) * ph;
  const line = f => { let d = ''; for (let i = 0; i <= 50; i++) { const v = (xMax * U.k * i) / 50; d += (i ? 'L' : 'M') + X(v).toFixed(1) + ' ' + Y(f(compute(s, v))).toFixed(1); } return d; };
  const xs = niceStep(xMax, 5), ys = niceStep(yMax, 4), g = [];
  for (let x = 0; x <= xMax + 1e-9; x += xs) { const px = ML + (x / xMax) * pw; g.push(<line key={'a' + x} className="grid" x1={px} x2={px} y1={MT} y2={MT + ph} />, <text key={'b' + x} className="tick" x={px} y={MT + ph + 15} textAnchor="middle">{+x.toFixed(1)}</text>); }
  for (let y = 0; y <= yMax + 1e-9; y += ys) { const py = Y(y); g.push(<line key={'c' + y} className="grid" x1={ML} x2={ML + pw} y1={py} y2={py} />, <text key={'d' + y} className="tick" x={ML - 6} y={py + 4} textAnchor="end">{y}</text>); }
  return (
    <>
      <svg className="tgraph" viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label="Distance against speed graph">
        {g}
        <line className="axis" x1={ML} x2={ML} y1={MT} y2={MT + ph} /><line className="axis" x1={ML} x2={ML + pw} y1={MT + ph} y2={MT + ph} />
        <path className="gline stop" d={line(r => r.stop)} />
        <path className="gline brake" d={line(r => r.brake)} />
        <path className="gline think" d={line(r => r.think)} />
        <text className="atitle" x={ML + pw / 2} y={GH - 3} textAnchor="middle">speed ({U.label})</text>
        <text className="atitle" transform={`translate(12 ${MT + ph / 2}) rotate(-90)`} textAnchor="middle">distance (m)</text>
      </svg>
      <p className="gkey"><span className="kk think" /> thinking <span className="kk brake" /> braking <span className="kk stop" /> stopping</p>
    </>
  );
}
