import React, { useEffect, useState } from 'react';
import { DRIVER, DISTRACTIONS, ROADS, CAR, UNITS, fmtSpeed, toUnit } from './physics.js';

export const blur = fn => e => { fn(e); e.currentTarget.blur(); };

// A panel with a section label ("1A") so the OneNote can point at it
export function Fig({ tag, title, className, children, actions }) {
  return (
    <figure className={'fig' + (className ? ' ' + className : '')}>
      {(title || actions) && (
        <div className="fighead">
          {title && <h2>{tag && <span className="tag">{tag}</span>}{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </figure>
  );
}

export function Seg({ options, value, onChange, label, className }) {
  return (
    <div className={'segs' + (className ? ' ' + className : '')} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" className={'seg' + (o.value === value ? ' on' : '')} aria-pressed={o.value === value}
          onClick={blur(() => onChange(o.value))} title={o.title}>{o.label}</button>
      ))}
    </div>
  );
}

export function Chip({ on, onClick, children, title }) {
  return <button type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={blur(onClick)} title={title}>{children}</button>;
}

export function FullscreenButton() {
  const [isFull, setIsFull] = useState(false);
  const available = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  useEffect(() => {
    const on = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* some embedded browsers refuse full screen */ }
  };
  if (!available) return null;
  return (
    <button type="button" className="btn iconbtn" onClick={e => { toggle(); e.currentTarget.blur(); }}
      aria-label={isFull ? 'Exit full screen' : 'Enter full screen'} title={isFull ? 'Exit full screen' : 'Full screen'}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={isFull ? 'M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5' : 'M9 4H4v5 M15 4h5v5 M9 20H4v-5 M15 20h5v-5'} />
      </svg>
    </button>
  );
}

// Speed slider in whichever unit is chosen; the speed itself is always kept in m/s
export function SpeedSlider({ speed, unit, onChange, id = 'speed' }) {
  const U = UNITS[unit];
  return (
    <div className="setrow">
      <label className="setlbl" htmlFor={id}>Speed</label>
      <input id={id} type="range" min={U.min} max={U.max} step={U.step} value={toUnit(speed, unit)}
        onChange={e => onChange(+e.target.value * U.k)} />
      <span className="speedv">{fmtSpeed(speed, unit)}</span>
    </div>
  );
}

// All the factors, grouped. The labels never say which distance they change: students find out.
export function Factors({ s, change, yesNoDistraction = false }) {
  return (
    <div className="factors">
      <div className="fgroup">
        <span className="fglbl">Driver</span>
        <div className="chips">
          {DRIVER.map(d => <Chip key={d.key} on={s[d.key]} onClick={() => change({ [d.key]: !s[d.key] }, (s[d.key] ? 'No longer ' : '') + d.label.toLowerCase())}>{d.label}</Chip>)}
        </div>
      </div>
      <div className="fgroup">
        <span className="fglbl">Distraction</span>
        <div className="chips">
          {yesNoDistraction
            ? <>
                <Chip on={s.distraction === 'none'} onClick={() => change({ distraction: 'none' }, 'No distraction')}>No</Chip>
                <Chip on={s.distraction !== 'none'} onClick={() => change({ distraction: 'phone' }, 'Distracted (phone, +0.5 s)')}>Yes</Chip>
              </>
            : DISTRACTIONS.map(d => <Chip key={d.key} on={s.distraction === d.key} onClick={() => change({ distraction: d.key }, d.key === 'none' ? 'No distraction' : 'Distraction: ' + d.label.toLowerCase())}>{d.label}</Chip>)}
        </div>
      </div>
      <div className="fgroup">
        <span className="fglbl">Road</span>
        <Seg className="roadseg" label="Road conditions" value={s.road} options={ROADS.map(r => ({ value: r.key, label: r.label }))}
          onChange={v => change({ road: v }, ROADS.find(r => r.key === v).label + ' road')} />
      </div>
      <div className="fgroup">
        <span className="fglbl">Car</span>
        <div className="chips">
          {CAR.map(c => <Chip key={c.key} on={s[c.key]} onClick={() => change({ [c.key]: !s[c.key] }, (s[c.key] ? 'No more ' : '') + c.label.toLowerCase())}>{c.label}</Chip>)}
        </div>
      </div>
    </div>
  );
}

// "What changed?": shows how the current conditions compare to perfect (dry road, alert driver, good car)
export function ChangeNote({ last, res, base, at }) {
  const d = (cur, perf) => {
    const x = cur - perf;
    if (Math.abs(x) < 0.05) return <span className="nochg">same as ideal</span>;
    return <b>{x > 0 ? '+' : '−'}{Math.abs(x).toFixed(1)} m {x > 0 ? 'longer' : 'shorter'} than ideal</b>;
  };
  if (!last || !res || !base) return <p className="changenote idle">Change a factor to see whether it changes the thinking distance, the braking distance, or both.</p>;
  return (
    <p className="changenote" key={last.id}>
      <span className="cn-what">{last.label}{at && <span className="cn-at"> ({at}, compared with ideal conditions)</span>}</span>
      <span className="cn-t">Thinking distance: {d(res.think, base.think)}</span>
      <span className="cn-b">Braking distance: {d(res.brake, base.brake)}</span>
    </p>
  );
}

export function ResetFactors({ s, reset }) {
  return <button type="button" className="btn ghost small" onClick={blur(reset)}>Reset factors</button>;
}
