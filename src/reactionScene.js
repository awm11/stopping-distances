// Tab 4: a reaction-time test. The view is through a windscreen; click as soon as the car ahead brakes.
// With distractions on, all sorts of things try to catch your eye while you wait.
import { roundRect, pill } from './roadSim.js';

const FONT = '"Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif';
const HEAD = '"Bricolage Grotesque","Atkinson Hyperlegible",system-ui,sans-serif';
const TAU = Math.PI * 2;
const MESSAGES = ['Mum: what time are you home?', 'Group chat (47 new messages)', 'Your pizza is on its way!', 'Gran sent you a photo', 'Low battery: 5%', 'Sam: did you do the homework??'];
const KINDS = ['gorilla', 'phone', 'bee', 'billboard', 'satnav'];   // each one at most once per repeat

// Flow: parked -> Drive: you pull away behind the car in front -> a random 2-5 s at speed -> its brake lights
// come on and it slows (gets closer) -> you click -> both cars stop and your time is shown.
export class ReactionTest {
  constructor(onResult) { this.onResult = onResult; this.state = 'idle'; this.events = []; this.rt = null; this.scroll = 0; this.speed = 0; this.closer = 0; }
  set(st) { this.state = st; if (this.onState) this.onState(st); }
  arm(now, distract) {
    this.set('wait'); this.distract = distract; this.closer = 0;
    this.armT = now; this.goAt = now + 1300 + 2000 + Math.random() * 3000;   // pull away, then a random wait
    this.events = [];
    if (distract) {
      // the gorilla turns up in only 2 of the 5 repeats (picked at random at the start of each set of 5)
      const idx = this.count ? this.count() : 0;
      if (!this.gorillaPlan || (idx === 0 && this.planIdx !== 0)) {
        const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        this.gorillaPlan = order.slice(0, 2);
      }
      this.planIdx = idx;
      const gorilla = this.gorillaPlan.includes(idx);
      const mk = (kind, at, dur) => ({ kind, at, dur, msg: MESSAGES[Math.floor(Math.random() * MESSAGES.length)], seed: Math.random() });
      // if it comes, it's early in the run: soon after pulling away
      if (gorilla) this.events.push(mk('gorilla', now + 1500 + Math.random() * 800, 3500));
      const kinds = KINDS.filter(k => k !== 'gorilla').sort(() => Math.random() - 0.5);
      const n = gorilla ? 2 : 3;
      for (let i = 0; i < n; i++) this.events.push(mk(kinds[i], now + 600 + Math.random() * (this.goAt - now - 600), 3000 + Math.random() * 1500));
      // something always happens just before the brake lights come on
      this.events.push(mk(kinds[n % kinds.length], this.goAt - 350 - Math.random() * 300, 3500));
    }
  }
  // n: how many results there already are for this condition (5 is a full set)
  respond(now, distract, n) {
    if (this.state === 'wait') { this.set('early'); this.missed = false; this.endT = now; return; }
    if (this.state === 'go') {
      this.rt = (now - this.goT) / 1000; this.endT = now;
      if (this.rt < 0.1) { this.set('slow'); return; }   // faster than any human: a guess, so it doesn't count
      this.goNum = n + 1; this.set('result');
      this.onResult(this.rt, this.distract);
      return;
    }
    if (n >= 5) { this.distract = distract; this.set('done'); return; }
    this.goNum = n + 1;
    this.arm(now, distract);
  }
  update(now) {
    if (this.state === 'wait' && now >= this.goAt) { this.goT = now; this.set('go'); }
    if (this.state === 'done' && this.full && !this.full()) this.set('idle');   // cleared, or switched condition
    if (this.state === 'go' && now - this.goT > 3000) {
      // too slow: it still counts, as 3.0 s, and you swerve out of the way
      this.missed = true; this.honkSeed = Math.random() * 100; this.endT = now; this.rt = 3;
      this.goNum = (this.count ? this.count() : 0) + 1;
      this.set('early');
      this.onResult(3, this.distract);
    }
  }
  draw(ctx, W, H, now) {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0; this.last = now;
    const st = this.state;
    // your speed: pull away while waiting, brake once you click
    const moving = st === 'wait' || st === 'go';
    this.speed = moving ? Math.min(1, this.speed + dt * 0.8) : Math.max(0, this.speed - dt * 1.4);
    this.scroll += dt * 1.3 * this.speed;
    // the car in front slows down once its brakes are on, so it comes closer until you react
    // ...right up to the 3 s limit, so a miss swerves at the last moment, with no pause
    if (st === 'go') this.closer = Math.min(1, (now - this.goT) / 3000) ** 1.3;
    const hz = H * 0.44, cx = W / 2;
    // Missed it: straight away you swerve left (the view outside slides right and tilts) and the car in front swerves right
    const easeOut = u => { u = Math.max(0, Math.min(1, u)); return 1 - (1 - u) * (1 - u); };
    const mt = st === 'early' && this.missed ? (now - this.endT) / 1000 : -1;
    const youSw = mt >= 0 ? easeOut(mt / 0.9) : 0, carSw = mt >= 0 ? easeOut(mt / 0.9) : 0;   // both swerves take 0.9 s
    ctx.save();
    if (mt >= 0) {
      ctx.translate(cx, H * 0.6); ctx.rotate(-0.05 * Math.sin(Math.PI * Math.min(1, mt / 1.1))); ctx.translate(-cx, -H * 0.6);
      ctx.translate(W * 0.14 * youSw, 0);
    }
    // sky and ground (drawn wider than the screen so the swerve never shows an edge)
    let g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#7fc4ea'); g.addColorStop(1, '#d4ecf7');
    ctx.fillStyle = g; ctx.fillRect(-W, -H, 3 * W, hz + H);
    ctx.fillStyle = '#7fae6a'; ctx.beginPath(); ctx.moveTo(-W, hz);
    for (let x = -W; x <= 2 * W; x += 20) ctx.lineTo(x, hz - 18 - 14 * Math.sin(x / 90) - 8 * Math.sin(x / 37));
    ctx.lineTo(2 * W, hz); ctx.fill();
    ctx.fillStyle = '#6aa84f'; ctx.fillRect(-W, hz, 3 * W, 2 * H);
    // road in perspective
    ctx.fillStyle = '#474b4f'; ctx.beginPath(); ctx.moveTo(cx - W * 0.02, hz); ctx.lineTo(cx + W * 0.02, hz); ctx.lineTo(cx + W * 0.75, H); ctx.lineTo(cx - W * 0.75, H); ctx.fill();
    ctx.fillStyle = '#f2f2ee';
    for (let i = 0; i < 12; i++) {   // centre dashes coming towards you
      const z0 = ((i / 12 + this.scroll) % 1), z1 = z0 + 0.035;
      const y0 = hz + (H - hz) * z0 ** 2.2, y1 = hz + (H - hz) * Math.min(1, z1) ** 2.2;
      const w0 = 1 + 7 * z0 ** 2.2;
      ctx.fillRect(cx - w0 / 2, y0, w0, y1 - y0);
    }
    // events behind the car ahead (gorilla, billboard)
    for (const e of this.active(now)) if (e.kind === 'billboard') this.billboard(ctx, W, H, hz, now, e);
    for (const e of this.active(now)) if (e.kind === 'gorilla') this.gorilla(ctx, W, H, hz, now, e);
    // the car ahead
    ctx.save(); ctx.translate(W * 0.26 * carSw, 0);   // with your swerve, this leaves it partly out of shot on the right
    const lit = st === 'go' || st === 'result' || st === 'slow' || (st === 'early' && this.missed);
    const grow = 1 + 0.9 * this.closer;
    const cw = W * 0.24 * grow, ch = cw * 0.62, carX = cx - cw / 2;
    const carY = H * 0.5 - ch / 2 + this.closer * H * 0.08 + Math.sin(now / 300) * 1.2 * this.speed;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, carY + ch + 4, cw * 0.55, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#16181a'; ctx.fillRect(carX + cw * 0.06, carY + ch * 0.85, cw * 0.16, ch * 0.2); ctx.fillRect(carX + cw * 0.78, carY + ch * 0.85, cw * 0.16, ch * 0.2);
    ctx.fillStyle = '#d9822b'; roundRect(ctx, carX, carY + ch * 0.32, cw, ch * 0.6, 12); ctx.fill();
    ctx.fillStyle = '#c4731f'; roundRect(ctx, carX + cw * 0.12, carY, cw * 0.76, ch * 0.42, 14); ctx.fill();
    ctx.fillStyle = '#1d2b36'; roundRect(ctx, carX + cw * 0.18, carY + ch * 0.06, cw * 0.64, ch * 0.28, 8); ctx.fill();
    ctx.fillStyle = '#f5d33b'; roundRect(ctx, cx - cw * 0.18, carY + ch * 0.62, cw * 0.36, ch * 0.13, 3); ctx.fill();
    ctx.fillStyle = '#15181a'; ctx.font = `800 ${Math.round(ch * 0.1)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ST0P 1T', cx, carY + ch * 0.69); ctx.textBaseline = 'alphabetic';
    for (const sx of [carX + cw * 0.04, carX + cw * 0.8]) {
      if (lit) {
        const gg = ctx.createRadialGradient(sx + cw * 0.08, carY + ch * 0.48, 0, sx + cw * 0.08, carY + ch * 0.48, cw * 0.3);
        gg.addColorStop(0, 'rgba(255,40,30,.9)'); gg.addColorStop(1, 'rgba(255,40,30,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sx + cw * 0.08, carY + ch * 0.48, cw * 0.3, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = lit ? '#ff2a1e' : '#7a1a14'; roundRect(ctx, sx, carY + ch * 0.4, cw * 0.16, ch * 0.16, 4); ctx.fill();
    }
    ctx.fillStyle = lit ? '#ff2a1e' : '#7a1a14'; ctx.fillRect(cx - cw * 0.1, carY + ch * 0.015, cw * 0.2, ch * 0.03);
    ctx.restore();   // the car ahead
    ctx.restore();   // the outside view
    // things on the windscreen
    for (const e of this.active(now)) if (e.kind === 'bee') this.bee(ctx, W, H, now, e);
    // your own car: windscreen frame and dashboard
    ctx.fillStyle = '#15181a';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.08, 0); ctx.lineTo(0, H * 0.75); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 0.92, 0); ctx.lineTo(W, H * 0.75); ctx.fill();
    ctx.fillRect(0, 0, W, H * 0.03);
    ctx.fillStyle = '#22272c'; ctx.beginPath(); ctx.moveTo(0, H * 0.84); ctx.quadraticCurveTo(W / 2, H * 0.76, W, H * 0.84); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    const wR = Math.min(W * 0.15, H * 0.36), wx = W * 0.72, wy = H * 0.98;
    this.speedo(ctx, wx, wy - wR * 0.36, wR * 0.36);   // the dial sits low behind the wheel, partly hidden by it
    this.wheel(ctx, wx, wy, wR, youSw);
    // phone and sat-nav pop-ups
    for (const e of this.active(now)) {
      if (e.kind === 'phone') this.phone(ctx, W, H, now, e);
    }
    if (mt >= 0) this.honks(ctx, W, H, mt);
    // once the swerve is over, make it clear that nobody was hurt
    if (mt >= 1.1) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (mt - 1.1) / 0.3);
      pill(ctx, W / 2, H * 0.26, 'Phew! You both swerved out of the way, so nobody was hurt. That was close!', '#58c08a', '#05200f', 'center', 16);
      ctx.restore();
    }
    // messages
    if (this.state === 'idle') pill(ctx, W / 2, H * 0.14, 'Press Drive. When the car in front brakes, hit the BRAKE pedal as fast as you can!', 'rgba(18,20,22,.85)', '#eef0ef', 'center', 15);
    if (this.state === 'wait') pill(ctx, W / 2, H * 0.14, this.speed < 1 ? 'Pulling away…' : 'Watch the car in front… foot over the brake!', 'rgba(18,20,22,.85)', '#eef0ef', 'center', 16);
    if (this.state === 'early') pill(ctx, W / 2, H * 0.14, this.missed ? `Too slow! Recorded as 3.000 seconds.${this.goNum >= 5 ? ' Press Next repeat to finish.' : ' Press Next repeat for repeat ' + (this.goNum + 1) + '.'}` : 'Too soon! The car in front hadn\u2019t braked. Press Next repeat to try again.', '#ffd166', '#2a1c00', 'center', 16);
    if (this.state === 'slow') pill(ctx, W / 2, H * 0.14, `${this.rt.toFixed(3)} s: too fast to be real, so that was a guess. Press Next repeat to try again.`, '#ffd166', '#2a1c00', 'center', 15);
    if (this.state === 'done') pill(ctx, W / 2, H * 0.14, this.distract ? 'All 5 repeats done! Compare your means in section 4B.' : 'All 5 repeats done! Now switch distractions on.', '#58c08a', '#05200f', 'center', 16);
    if ((this.state === 'wait' || this.state === 'go' || this.state === 'result') && this.goNum) {
      pill(ctx, 16, H * 0.06 + 6, `Repeat ${this.goNum} of 5${this.distract ? ' \u2022 distractions on' : ''}`, 'rgba(18,20,22,.85)', '#eef0ef', 'left', 13);
    }
    if (this.state === 'result') {
      ctx.fillStyle = 'rgba(18,20,22,.85)'; roundRect(ctx, W / 2 - 150, H * 0.06, 300, 92, 16); ctx.fill();
      ctx.fillStyle = '#a4a9ad'; ctx.font = `700 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Your reaction time', W / 2, H * 0.06 + 24);
      ctx.fillStyle = '#eef0ef'; ctx.font = `800 40px ${HEAD}`; ctx.fillText(this.rt.toFixed(3) + ' s', W / 2, H * 0.06 + 66);
      ctx.fillStyle = '#a4a9ad'; ctx.font = `700 12px ${FONT}`; ctx.fillText(this.goNum >= 5 ? 'That was repeat 5. Press Next repeat to finish.' : 'Press Next repeat for repeat ' + (this.goNum + 1), W / 2, H * 0.06 + 84);
    }
  }
  // A simple speedometer behind the steering wheel: 0-70 mph, cruising at 30 mph
  speedo(ctx, x, y, r) {
    // instrument binnacle
    ctx.fillStyle = '#181c20'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * 1.45, r * 1.2, 0, Math.PI, 0); ctx.lineTo(x + r * 1.45, y + r * 1.3); ctx.lineTo(x - r * 1.45, y + r * 1.3); ctx.fill();
    const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5, ang = v => a0 + sweep * v / 70;
    ctx.fillStyle = '#0f1214'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a5058'; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineCap = 'round';
    for (let v = 0; v <= 70; v += 10) {
      const a = ang(v), c = Math.cos(a), sn = Math.sin(a);
      ctx.strokeStyle = '#d9dee2'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + c * r * 0.72, y + sn * r * 0.72); ctx.lineTo(x + c * r * 0.88, y + sn * r * 0.88); ctx.stroke();
    }
    ctx.fillStyle = '#a4a9ad'; ctx.font = `700 ${Math.round(r * 0.24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('mph', x, y + r * 0.72);
    const mph = 30 * this.speed, a = ang(mph);
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); ctx.stroke();
    ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(x, y, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef0ef'; ctx.font = `800 ${Math.round(r * 0.34)}px ${HEAD}`;
    ctx.fillText(Math.round(mph), x, y + r * 0.42);
    ctx.textBaseline = 'alphabetic';
  }
  // Your steering wheel, on the right (a UK car). It turns left when you swerve.
  wheel(ctx, wx, wy, R, swerve) {
    ctx.save();
    ctx.translate(wx, wy); ctx.rotate(-0.9 * swerve);
    const rim = R * 0.13;
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = rim + 6; ctx.beginPath(); ctx.arc(0, 4, R, 0, Math.PI * 2); ctx.stroke();   // shadow
    // spokes: left, right and down, to the hub
    ctx.strokeStyle = '#3a4148'; ctx.lineWidth = R * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-R * 0.95, R * 0.05); ctx.lineTo(-R * 0.2, R * 0.08); ctx.moveTo(R * 0.95, R * 0.05); ctx.lineTo(R * 0.2, R * 0.08);
    ctx.moveTo(0, R * 0.25); ctx.lineTo(0, R * 0.95); ctx.stroke();
    // hub
    ctx.fillStyle = '#3a4148'; ctx.beginPath(); ctx.ellipse(0, R * 0.08, R * 0.34, R * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4b535c'; ctx.beginPath(); ctx.ellipse(0, R * 0.04, R * 0.26, R * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a939b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, R * 0.04, R * 0.09, R * 0.065, 0, 0, Math.PI * 2); ctx.stroke();
    // rim: dark leather with a lighter top edge and stitching
    ctx.strokeStyle = '#0b0c0e'; ctx.lineWidth = rim; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#5a636c'; ctx.lineWidth = rim * 0.3; ctx.beginPath(); ctx.arc(0, 0, R + rim * 0.3, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,205,210,.35)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(0, 0, R - rim * 0.15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.setLineDash([]);
    // thumb grips at ten-to-two
    ctx.strokeStyle = '#0a0b0d'; ctx.lineWidth = rim * 1.25;
    for (const a of [Math.PI * 1.17, Math.PI * 1.83]) { ctx.beginPath(); ctx.arc(0, 0, R, a - 0.12, a + 0.12); ctx.stroke(); }
    ctx.restore();
  }
  // a few HONK!!s pop up around the screen after a miss
  honks(ctx, W, H, mt) {
    const r = i => { const x = Math.sin((this.honkSeed + i) * 127.1) * 43758.5; return x - Math.floor(x); };
    for (let i = 0; i < 5; i++) {
      const t0 = i * 0.25, age = mt - t0;
      if (age < 0 || age > 0.75) continue;
      const pop = age < 0.12 ? age / 0.12 * 1.25 : 1.25 - Math.min(0.25, (age - 0.12) * 2);
      const x = W * (0.15 + r(i) * 0.7), y = H * (0.22 + r(i + 9) * 0.45), size = Math.round(Math.max(28, W * 0.045) * pop);
      ctx.save(); ctx.translate(x, y); ctx.rotate((r(i + 3) - 0.5) * 0.5);
      ctx.globalAlpha = age > 0.55 ? 1 - (age - 0.55) / 0.2 : 1;
      ctx.font = `900 ${size}px ${HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(5, size * 0.16); ctx.strokeStyle = '#2a1c00'; ctx.strokeText('HONK!!', 0, 0);
      ctx.fillStyle = i % 2 ? '#ffd166' : '#ff8a3d'; ctx.fillText('HONK!!', 0, 0);
      ctx.restore();
    }
  }
  active(now) { return this.state === 'idle' || this.state === 'done' ? [] : this.events.filter(e => now >= e.at && now <= e.at + e.dur); }
  // walks in from the left to the edge of the road and waves. We're driving towards it, so as soon as it arrives it
  // grows slowly at first and then rushes past us out of view, like anything at the side of the road.
  gorilla(ctx, W, H, hz, now, e) {
    const f = (now - e.at) / e.dur;
    const inF = Math.min(1, f / 0.6), walking = f < 0.6, waving = !walking;
    const appF = Math.max(0, (f - 0.6) / 0.4);                // the rush starts as soon as it arrives, and lasts 1.4 s
    const k0 = 0.3;                                           // where it stops to wave, a little way down the road
    const k = k0 / (1 - 0.56 * appF);                          // perspective: the distance shrinks steadily, so it grows faster and faster, and is just out of view at the end
    const y = hz + (H - hz) * k, s = (W / 760) * (0.02 + 0.73 * k) / (0.02 + 0.73 * 0.4);
    const roadside = W / 2 - W * (0.02 + 0.73 * k) - 26 * s;  // just off the left-hand edge of the road (fixed to the ground)
    const x = walking ? -0.12 * W + (roadside + 0.12 * W) * (1 - (1 - inF) ** 2) : roadside;
    const step = walking ? Math.sin(now / 120) : 0;
    const sway = walking ? Math.sin(now / 120) * 0.06 : 0, bob = walking ? Math.abs(Math.sin(now / 120)) * 3 : 0;
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(s, s); ctx.rotate(sway);
    const fur = '#2b2b2e', skin = '#5e5a56';
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, bob / s + 2, 34, 6, 0, 0, TAU); ctx.fill();   // shadow
    ctx.fillStyle = fur;
    ctx.fillRect(-20, -26 - step * 4, 15, 28 + step * 4); ctx.fillRect(5, -26 + step * 4, 15, 28 - step * 4);   // legs
    ctx.beginPath(); ctx.moveTo(-34, -78); ctx.quadraticCurveTo(0, -96, 34, -78); ctx.lineTo(24, -22); ctx.quadraticCurveTo(0, -12, -24, -22); ctx.closePath(); ctx.fill();   // big shoulders, body
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, -54, 15, 20, 0, 0, TAU); ctx.fill();   // chest
    ctx.strokeStyle = fur; ctx.lineCap = 'round'; ctx.lineWidth = 15;
    // left arm: long, knuckles near the ground
    ctx.beginPath(); ctx.moveTo(-30, -74); ctx.quadraticCurveTo(-44, -44, -38, -6 + step * 4); ctx.stroke();
    // right arm: swings while walking, waves once stopped
    const wave = Math.sin(now / 110);
    ctx.beginPath(); ctx.moveTo(30, -74);
    if (!waving) ctx.quadraticCurveTo(44, -44, 38, -6 - step * 4);
    else ctx.quadraticCurveTo(52, -88, 44 + wave * 8, -118);
    ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(!waving ? 38 : 44 + wave * 8, !waving ? -6 - step * 4 : -122, 7, 0, TAU); ctx.fill();   // hand
    // head
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, -100, 17, 18, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -114, 11, 8, 0, 0, TAU); ctx.fill();   // crest
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, -95, 12, 11, 0, 0, TAU); ctx.fill();   // face
    ctx.fillStyle = '#1c1c1e'; ctx.fillRect(-11, -105, 22, 4);   // brow
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, -99, 2.6, 0, TAU); ctx.arc(5, -99, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-5, -99, 1.4, 0, TAU); ctx.arc(5, -99, 1.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-2.5, -93, 1.3, 0, TAU); ctx.arc(2.5, -93, 1.3, 0, TAU); ctx.fill();   // nostrils
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -90, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();   // smile
    ctx.restore();
  }
  // a flashing roadside sign in the distance: it grows a little as we drive towards it
  billboard(ctx, W, H, hz, now, e) {
    const f = Math.min(1, Math.max(0, (now - e.at) / e.dur));
    const g = 1 + 0.3 * f * f;                       // up to 1.3x, a bit faster towards the end
    const x = W * 0.8, base = hz + 20, on = Math.floor(now / 180) % 2;
    ctx.save(); ctx.translate(x, base); ctx.scale(g, g); ctx.translate(-x, -base);
    const y = hz - 30;
    ctx.fillStyle = '#5b6168'; ctx.fillRect(x - 3, y, 6, 50);
    ctx.fillStyle = on ? '#ff3fa4' : '#ffe14a'; roundRect(ctx, x - 70, y - 50, 140, 56, 6); ctx.fill();
    ctx.fillStyle = on ? '#fff' : '#d62b1f'; ctx.font = `900 20px ${HEAD}`; ctx.textAlign = 'center'; ctx.fillText('MEGA SALE!!', x, y - 16);
    ctx.restore();
  }
  bee(ctx, W, H, now, e) {
    const f = (now - e.at) / e.dur, x = W * (0.1 + 0.8 * f), y = H * (0.3 + 0.15 * Math.sin(f * 18 + e.seed * 6));
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; const fl = Math.sin(now / 20) * 4;
    ctx.beginPath(); ctx.ellipse(-4, -10 - fl, 8, 5, -0.5, 0, TAU); ctx.ellipse(6, -10 + fl, 8, 5, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(-6, -9, 4, 18); ctx.fillRect(3, -9, 4, 18);
    ctx.fillStyle = '#eef0ef'; ctx.font = `800 13px ${HEAD}`; ctx.textAlign = 'left'; ctx.fillText('bzzz', 18, -10);
    ctx.restore();
  }
  phone(ctx, W, H, now, e) {
    const t = (now - e.at) / 1000, slide = Math.min(1, t * 4), shake = t < 1 ? Math.sin(now / 25) * 3 : 0;
    const w = Math.min(320, W * 0.4), x = W - (w + 20) * slide + shake, y = H * 0.24;
    ctx.fillStyle = 'rgba(250,250,250,.97)'; roundRect(ctx, x, y, w, 56, 14); ctx.fill();
    ctx.fillStyle = '#58c08a'; roundRect(ctx, x + 10, y + 10, 36, 36, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 18px ${HEAD}`; ctx.textAlign = 'center'; ctx.fillText('✉', x + 28, y + 34);
    ctx.fillStyle = '#15181a'; ctx.textAlign = 'left'; ctx.font = `800 12px ${FONT}`; ctx.fillText('MESSAGES • now', x + 56, y + 22);
    ctx.font = `700 13.5px ${FONT}`; ctx.fillText(e.msg, x + 56, y + 41, w - 64);
  }
  // the sat-nav is an HTML overlay on top of the brake pedal (see ReactionTab), flashing while active
  satnavOn(now) { return this.active(now).some(e => e.kind === 'satnav') && Math.floor(now / 350) % 2 === 0; }
}
