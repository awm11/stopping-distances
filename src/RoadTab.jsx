import React, { useEffect, useRef, useState } from 'react';
import { RoadSim } from './roadSim.js';
import { compute, baseline, UNITS, fmtSpeed } from './physics.js';
import { Fig, Factors, ChangeNote, SpeedSlider, blur } from './ui.jsx';
import { RunGraphs } from './Graphs.jsx';

// Tab 1: the road. The canvas sits on the left; sections 1A-1C on the right.
export function RoadStage({ simRef, s, unit, slow, onSnap }) {
  const cvRef = useRef(null), stageRef = useRef(null);
  const live = useRef({}); live.current = { s, unit, slow };
  useEffect(() => {
    const cv = cvRef.current, ctx = cv.getContext('2d');
    const box = { w: 0, h: 0 };
    const measure = () => { box.w = stageRef.current.clientWidth; box.h = stageRef.current.clientHeight; };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(stageRef.current);
    let raf, last = performance.now(), sized = '';
    const loop = now => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const key = box.w + 'x' + box.h + 'x' + dpr;
      if (sized !== key) { cv.width = Math.round(box.w * dpr); cv.height = Math.round(box.h * dpr); sized = key; }
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      const { s: st, unit: u, slow: sl } = live.current;
      const sim = simRef.current, p = compute(st);
      sim.update(dt, p, sl, st.hazard);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (box.w > 0) sim.draw(ctx, box.w, box.h, { ...st, _unit: UNITS[u] }, dt);
      onSnap(sim.snap());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return (
    <div className="stage road" ref={stageRef}>
      <canvas ref={cvRef} role="img" aria-label="A car on a road. When ducks step out, the driver reacts and then brakes." />
    </div>
  );
}

export function RoadPanel({ simRef, snap, s, change, unit, slow, setSlow, last, resetFactors }) {
  const res = compute(s), base = baseline(s);
  const sim = simRef.current;
  const running = snap.state === 'armed' || snap.state === 'think' || snap.state === 'brake';
  const go = () => { sim.drive(); };
  return (
    <>
      <Fig tag="1A" title="Drive">
        <SpeedSlider speed={s.speed} unit={unit} onChange={v => change({ speed: v }, 'Speed ' + fmtSpeed(v, unit))} />
        <div className="btnrow">
          <button type="button" className="btn primary big" onClick={blur(go)} disabled={running}>{running ? 'Driving\u2026' : snap.state === 'stopped' ? 'Drive again' : 'Drive'}</button>
          {running && <button type="button" className="btn big" onClick={blur(() => sim.skip(compute(s), s.hazard))}>Skip &#9197;</button>}
        </div>
      </Fig>

      <Fig tag="1B" title="Factors" actions={<button type="button" className="btn ghost small" onClick={blur(resetFactors)}>Reset</button>}>
        <Factors s={s} change={change} />
        <ChangeNote last={last} res={res} base={base} />
      </Fig>

      <Fig tag="1C" title="Graphs of the run">
        <RunGraphs snap={snap} unit={unit} />
      </Fig>
    </>
  );
}
