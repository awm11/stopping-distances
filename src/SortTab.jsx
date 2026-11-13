import React, { useRef, useState } from 'react';
import { Fig, blur } from './ui.jsx';

// Tab 3: sort the factors into Thinking / Braking / Both / Neither
const CARDS = [
  { id: 'tired', text: 'Being tired', ans: 'think', why: 'A tired driver reacts more slowly, so the reaction time is longer and the car goes further before the brakes go on.' },
  { id: 'alcohol', text: 'Drinking alcohol', ans: 'think', why: 'Alcohol slows reactions, so the reaction time and the thinking distance increase.' },
  { id: 'drugs', text: 'Taking drugs', ans: 'think', why: 'Many drugs (including some medicines) slow reactions, so the thinking distance increases.' },
  { id: 'phone', text: 'Using a mobile phone', ans: 'think', why: 'A distracted driver takes longer to notice the hazard, so the thinking distance increases.' },
  { id: 'music', text: 'Loud music or chatty passengers', ans: 'think', why: 'Distractions make the reaction time longer, so the thinking distance increases.' },
  { id: 'wet', text: 'A wet road', ans: 'brake', why: 'Water means less friction between the tyres and the road, so the car slides further once the brakes are on.' },
  { id: 'icy', text: 'An icy road', ans: 'brake', why: 'Ice means very little friction, so the braking distance can be up to ten times longer.' },
  { id: 'leaves', text: 'Wet leaves or gravel on the road', ans: 'brake', why: 'A slippery surface means less friction, so the braking distance increases.' },
  { id: 'tyres', text: 'Worn (bald) tyres', ans: 'brake', why: 'Worn tyres grip the road less, so the braking distance increases.' },
  { id: 'brakes', text: 'Worn brakes', ans: 'brake', why: 'Worn brakes cannot produce as big a braking force, so the braking distance increases.' },
  { id: 'speed', text: 'Driving faster', ans: 'both', why: 'A faster car goes further during the reaction time AND takes further to stop once braking.' },
  { id: 'colour', text: 'The colour of the car', ans: 'neither', why: 'The colour makes no difference to how quickly the driver reacts or how well the car brakes.' },
  { id: 'day', text: 'The day of the week', ans: 'neither', why: 'The day of the week does not change the driver’s reactions or the car’s brakes.' },
];
export const BINS = [
  { id: 'think', title: 'Thinking distance', sub: 'changes the reaction time' },
  { id: 'brake', title: 'Braking distance', sub: 'changes how the car stops' },
  { id: 'both', title: 'Both', sub: 'changes both distances' },
  { id: 'neither', title: 'Neither', sub: 'makes no difference' },
];
// A nudge for a card in the wrong box, without giving the answer away
const NUDGE = {
  think: 'Does this change how quickly the driver reacts?',
  brake: 'Does this change the car\u2019s tyres or brakes, or the road surface?',
  both: 'Think about the distance travelled while reacting AND while braking.',
  neither: 'Would this really change the driver or how well the car stops?',
};
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export function useSort() {
  const [order] = useState(() => shuffle(CARDS.map(c => c.id)));
  const [place, setPlace] = useState({});      // card id -> bin id
  const [checked, setChecked] = useState(false);
  const [sel, setSel] = useState(null);
  return { order, place, setPlace, checked, setChecked, sel, setSel };
}

export function SortStage({ st }) {
  const { order, place, setPlace, checked, setChecked, sel, setSel } = st;
  const [drag, setDrag] = useState(null);   // { id, x, y, dx, dy, moved }
  const stageRef = useRef(null);
  const put = (id, bin) => { setPlace(p => { const n = { ...p }; if (bin) n[id] = bin; else delete n[id]; return n; }); setChecked(false); setSel(null); };
  const down = (e, id) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ id, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, moved: false, sx: e.clientX, sy: e.clientY });
  };
  const move = e => { if (!drag) return; const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6; setDrag({ ...drag, x: e.clientX, y: e.clientY, moved }); };
  const up = e => {
    if (!drag) return;
    if (drag.moved) {
      const el = document.elementsFromPoint(e.clientX, e.clientY).find(n => n.dataset && n.dataset.bin);
      if (el) put(drag.id, el.dataset.bin === 'pool' ? null : el.dataset.bin);
    } else setSel(sel === drag.id ? null : drag.id);   // a tap selects; tap a box to drop it there
    setDrag(null);
  };
  const tapBin = bin => { if (sel) put(sel, bin === 'pool' ? null : bin); };
  const card = id => {
    const c = CARDS.find(k => k.id === id), b = place[id];
    const mark = checked && b ? (c.ans === b ? 'right' : 'wrong') : '';
    const dragging = drag && drag.id === id && drag.moved;
    return (
      <button key={id} type="button" className={'scard ' + mark + (sel === id ? ' sel' : '') + (dragging ? ' lifting' : '')}
        onClick={e => e.stopPropagation()} onPointerDown={e => down(e, id)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(sel === id ? null : id); } }}
        style={dragging ? { position: 'fixed', left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w, zIndex: 50, pointerEvents: 'none' } : undefined}>
        {mark === 'right' && <span className="mk">{'✓'}</span>}{mark === 'wrong' && <span className="mk">{'✗'}</span>}
        {c.text}
      </button>
    );
  };
  const pool = order.filter(id => !place[id]);
  return (
    <div className="stage sortstage" ref={stageRef}>
      <div className={'pool' + (sel ? ' target' : '')} data-bin="pool" onClick={e => { if (e.target === e.currentTarget) tapBin('pool'); }}>
        <p className="pooltitle" data-bin="pool">{pool.length ? 'Drag each card into a box (or tap a card, then tap a box).' : 'All sorted! Now press Check in section 3B.'}</p>
        <div className="cards" data-bin="pool">{pool.map(card)}</div>
      </div>
      <div className="bins">
        {BINS.map(b => (
          <div key={b.id} className={'bin ' + b.id + (sel ? ' target' : '')} data-bin={b.id} onClick={() => tapBin(b.id)}
            tabIndex={sel ? 0 : -1} role="button" aria-label={'Put the selected card in ' + b.title}
            onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tapBin(b.id); } }}>
            <div className="binhead" data-bin={b.id}><b>{b.title}</b><small>{b.sub}</small></div>
            <div className="cards" data-bin={b.id}>{order.filter(id => place[id] === b.id).map(card)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SortPanel({ st }) {
  const { place, setPlace, checked, setChecked, setSel } = st;
  const placed = Object.keys(place);
  const right = placed.filter(id => CARDS.find(c => c.id === id).ans === place[id]);
  const wrong = placed.filter(id => CARDS.find(c => c.id === id).ans !== place[id]);
  const done = placed.length === CARDS.length;
  return (
    <>
      <Fig tag="3A" title="What to do">
        <ol className="steps">
          <li>Read each card. Does it change the <b className="t">thinking distance</b>, the <b className="b">braking distance</b>, <b>both</b> or <b>neither</b>?</li>
          <li>Drag it into the right box. On a touch screen, tap a card and then tap a box.</li>
          <li>When every card is in a box, press <b>Check</b>.</li>
        </ol>
        <p className="hint">Stuck? The thinking distance depends on the <b>driver</b> (their reaction time). The braking distance depends on the <b>car and the road</b>.</p>
      </Fig>
      <Fig tag="3B" title="Check your answers">
        <div className="btnrow" style={{ marginTop: 0 }}>
          <button type="button" className="btn primary" disabled={!placed.length} onClick={blur(() => setChecked(true))}>Check</button>
          <button type="button" className="btn" disabled={!checked || !wrong.length} onClick={blur(() => { setPlace(p => { const n = { ...p }; wrong.forEach(id => delete n[id]); return n; }); setChecked(false); setSel(null); })}>Try the wrong ones again</button>
          <button type="button" className="btn ghost" onClick={blur(() => { setPlace({}); setChecked(false); setSel(null); })}>Start again</button>
        </div>
        {checked && (
          <div className="score">
            <p className="scoreline"><b>{right.length}</b> out of <b>{CARDS.length}</b> correct{!done ? ` (${CARDS.length - placed.length} still to sort)` : ''}.{right.length === CARDS.length ? ' Brilliant!' : ''}</p>
            {wrong.length > 0 && <p className="hint">Cards with a {'✗'} are in the wrong box. Think again, then press <b>Try the wrong ones again</b>.</p>}
          </div>
        )}
      </Fig>
      {checked && wrong.length > 0 && (
        <Fig tag="3C" title="Think again">
          <ul className="whys nudges">{wrong.map(id => { const c = CARDS.find(k => k.id === id); return <li key={id}><b>{c.text}:</b> {NUDGE[c.ans]}</li>; })}</ul>
        </Fig>
      )}
      {checked && right.length > 0 && (
        <Fig tag={wrong.length ? '3D' : '3C'} title="Why?">
          <ul className="whys">{right.map(id => { const c = CARDS.find(k => k.id === id); return <li key={id} className={c.ans}><b>{c.text}:</b> {c.why}</li>; })}</ul>
        </Fig>
      )}
    </>
  );
}
