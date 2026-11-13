import React from 'react';
import { niceMax, niceStep, UNITS } from './physics.js';
import { COL } from './roadSim.js';

// Speed-time and distance-time graphs of the run, drawn as it happens. The previous run is a grey ghost.
const GW = 340, GH = 178, ML = 46, MR = 12, MT = 12, MB = 34;

function Axes({ xMax, yMax, xTitle, yTitle }) {
  const pw = GW - ML - MR, ph = GH - MT - MB;
  const xs = niceStep(xMax, 5), ys = niceStep(yMax, 4);
  const out = [];
  for (let x = 0; x <= xMax + 1e-9; x += xs) {
    const px = ML + (x / xMax) * pw;
    out.push(<line key={'gx' + x} className="grid" x1={px} x2={px} y1={MT} y2={MT + ph} />);
    out.push(<text key={'tx' + x} className="tick" x={px} y={MT + ph + 15} textAnchor="middle">{+x.toFixed(2)}</text>);
  }
  for (let y = 0; y <= yMax + 1e-9; y += ys) {
    const py = MT + ph - (y / yMax) * ph;
    out.push(<line key={'gy' + y} className="grid" x1={ML} x2={ML + pw} y1={py} y2={py} />);
    out.push(<text key={'ty' + y} className="tick" x={ML - 6} y={py + 4} textAnchor="end">{+y.toFixed(1)}</text>);
  }
  return (
    <g>
      {out}
      <line className="axis" x1={ML} x2={ML} y1={MT} y2={MT + ph} />
      <line className="axis" x1={ML} x2={ML + pw} y1={MT + ph} y2={MT + ph} />
      <text className="atitle" x={ML + pw / 2} y={GH - 3} textAnchor="middle">{xTitle}</text>
      <text className="atitle" transform={`translate(12 ${MT + ph / 2}) rotate(-90)`} textAnchor="middle">{yTitle}</text>
    </g>
  );
}

function path(pts, X, Y) { return pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(''); }

function OneGraph({ run, ghost, get, yMax0, xTitle, yTitle, k }) {
  const pw = GW - ML - MR, ph = GH - MT - MB;
  const tMax = niceMax(Math.max(run ? run.T : 1, ghost ? ghost.T : 0, 1) * 1.04, 5);
  const yMax = niceMax(Math.max(yMax0(run), ghost ? yMax0(ghost) : 0, 1e-3) * 1.08, 4);
  const X = t => ML + (t / tMax) * pw, Y = y => MT + ph - (y / yMax) * ph;
  const split = r => {
    const a = [], b = [];
    for (const smp of r.samples) { const p = [smp.t, get(smp) / k]; if (smp.t <= r.p.tr + 1e-9) a.push(p); if (smp.t >= r.p.tr - 1e-9) b.push(p); }
    return [a, b];
  };
  let body = null;
  if (run) {
    const [a, b] = split(run);
    const xb = X(run.p.tr);
    body = (
      <g>
        {run.brakeX != null && <>
          <line className="brakeline" x1={xb} x2={xb} y1={MT} y2={MT + ph} />
          <text className="brakelbl" x={xb + 4} y={MT + 12}>brakes on</text>
        </>}
        {a.length > 1 && <path className="gline think" d={path(a, X, Y)} />}
        {b.length > 1 && <path className="gline brake" d={path(b, X, Y)} />}
      </g>
    );
  }
  return (
    <svg className="tgraph" viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label={yTitle + ' against time'}>
      <Axes xMax={tMax} yMax={yMax} xTitle={xTitle} yTitle={yTitle} />
      {ghost && <path className="gline ghost" d={path(ghost.samples.map(s => [s.t, get(s) / k]), X, Y)} />}
      {body}
      {!run && <text className="gempty" x={ML + pw / 2} y={MT + ph / 2} textAnchor="middle">The graph starts when the ducks appear</text>}
    </svg>
  );
}

export function RunGraphs({ snap, unit }) {
  const U = UNITS[unit];
  const run = snap.run, ghost = snap.last;
  return (
    <div className="graphs">
      <div>
        <p className="gtitle">Speed&ndash;time graph</p>
        <OneGraph run={run} ghost={ghost} get={s => s.v} k={U.k} yMax0={r => (r ? r.vmax / U.k : 0)} xTitle="time (s)" yTitle={`speed (${U.label})`} />
      </div>
      <div>
        <p className="gtitle">Distance&ndash;time graph</p>
        <OneGraph run={run} ghost={ghost} get={s => s.s} k={1} yMax0={r => (r ? r.S : 0)} xTitle="time (s)" yTitle="distance (m)" />
      </div>
      <p className="gkey">
        <span className="kk think" /> thinking <span className="kk brake" /> braking {ghost && <><span className="kk ghost" /> last run</>}
      </p>
    </div>
  );
}

// Stacked bar: thinking (blue) + braking (red), against a "normal" bar for the same speed
export function StopBars({ res, base, flash }) {
  const max = Math.max(res.stop, base.stop) * 1.04;
  const W = 340, x0 = 66, pw = W - x0 - 8;
  const bar = (r, y, h, faint, label) => {
    const wt = (r.think / max) * pw, wb = (r.brake / max) * pw;
    return (
      <g className={faint ? 'faint' : ''}>
        <text className="blbl" x={x0 - 8} y={y + h / 2 + 4} textAnchor="end">{label}</text>
        <rect className={'seg-t' + (!faint && flash.t ? ' pulse' : '')} x={x0} y={y} width={Math.max(0, wt)} height={h} rx="3" />
        <rect className={'seg-b' + (!faint && flash.b ? ' pulse' : '')} x={x0 + wt} y={y} width={Math.max(0, wb)} height={h} rx="3" />
        {wt > 34 && <text className="bin" x={x0 + wt / 2} y={y + h / 2 + 4} textAnchor="middle">{r.think.toFixed(1)}</text>}
        {wb > 34 && <text className="bin" x={x0 + wt + wb / 2} y={y + h / 2 + 4} textAnchor="middle">{r.brake.toFixed(1)}</text>}
      </g>
    );
  };
  return (
    <svg className="stopbars" viewBox={`0 0 ${W} 82`} role="img" aria-label="Thinking and braking distance bars">
      {bar(base, 6, 22, true, 'Normal')}
      {bar(res, 40, 34, false, 'Now')}
    </svg>
  );
}
