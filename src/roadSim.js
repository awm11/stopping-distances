// Tab 1: a car on a road, seen side-on. Ducks step out ahead; the driver reacts (thinking distance, blue)
// and then brakes (braking distance, red). Distances are in metres along the road.
import { CAR_LEN } from './physics.js';

export const COL = { think: '#2f86d6', brake: '#e5412f', thinkInk: '#04172a', brakeInk: '#2a0500', car: '#14a39a' };
const FONT = '"Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif';
const HEAD = '"Bricolage Grotesque","Atkinson Hyperlegible",system-ui,sans-serif';
const TAU = Math.PI * 2;
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const LOOK = {
  dry: { sky: ['#7fc4ea', '#d4ecf7'], hill: ['#7fae6a', '#5f9150'], grass: '#6aa84f', verge: '#5a9443', road: '#474b4f', edge: '#f2f2ee' },
  wet: { sky: ['#7d8a95', '#b9c3ca'], hill: ['#5c7a5a', '#4b6849'], grass: '#4f7f43', verge: '#456f3a', road: '#2c3034', edge: '#d9dcdc' },
  icy: { sky: ['#b8c8d6', '#e6eef4'], hill: ['#e9f0f5', '#d5e2ea'], grass: '#eef3f6', verge: '#e2eaef', road: '#c9dde8', edge: '#ffffff' },
};

export class RoadSim {
  // States: parked -> armed (pulling away, then driving at a steady speed) -> think -> brake -> stopped
  constructor() {
    this.x = 0; this.v = 0; this.clock = 0; this.state = 'parked';
    this.cam = { left: -8, right: 37 };
    this.parts = []; this.flash = 0; this.rate = 1; this.last = null;
    this.run = null; this.ducks = null; this.result = null; this.t = 0;
  }
  // Drive (or Drive again): pull away, reach the set speed, then the ducks appear after a random 1-3 s
  drive() {
    if (this.state === 'stopped' && this.run) this.last = this.run;
    this.state = 'armed'; this.run = null; this.ducks = null; this.result = null; this.t = 0;
    this.wait = null; this.cancelledAt = null;
  }
  // a change of settings after a run clears it away (the markers and the bar under the road), ready to drive again
  clearRun() {
    if (this.state !== 'stopped') return;
    if (this.run) this.last = this.run;
    this.state = 'parked'; this.run = null; this.ducks = null; this.result = null; this.t = 0;
  }
  // a change of settings in the middle of a run cancels it, says so, and sends the ducks out again later
  cancel() { this.drive(); this.cancelledAt = this.clock; }
  // Skip: while pulling away, jump to cruising speed and bring on the ducks now; during a run, jump to the end.
  skip(p, hazard) {
    if (this.state === 'armed') { this.v = p.v; this.wait = null; this.start(p, hazard); return; }
    if (this.state !== 'think' && this.state !== 'brake') return;
    const r = this.run, P = r.p, T = P.tr + P.tBrake;
    // fill in the rest of the graph from where we are to the stop
    for (let i = 1; i <= 40; i++) {
      const t = this.t + (T - this.t) * i / 40;
      const tb = Math.max(0, t - P.tr);
      const v = t <= P.tr ? P.v : Math.max(0, P.v - P.a * tb);
      const sx = t <= P.tr ? P.v * t : P.v * P.tr + P.v * tb - 0.5 * P.a * tb * tb;
      r.samples.push({ t, v, s: sx });
    }
    r.brakeX = r.seenX + P.v * P.tr; r.stopX = r.brakeX + P.brake;
    this.t = T; this.v = 0; this.x = r.stopX; this.state = 'stopped'; this.stoppedAt = this.clock;
    if (this.ducks && !this.ducks.fly) this.ducks.fly = this.clock;
    const gap = r.hazardX - r.stopX;
    this.result = { ok: gap >= 0, gap };
  }
  // p: the numbers from compute(); hazard: how far ahead the ducks appear (m)
  start(p, hazard) {
    this.v = p.v; this.state = 'think'; this.t = 0;
    this.run = { p, seenX: this.x, hazardX: this.x + hazard, brakeX: null, stopX: null, samples: [{ t: 0, v: p.v, s: 0 }],
      T: p.tr + p.tBrake, S: p.stop, vmax: p.v, hazard };
    this.ducks = { born: this.clock, fly: null };
    this.stoppedAt = null;
  }
  update(dt, p, slow, hazard) {
    this.clock += dt;
    const k = slow ? 0.35 : 1;
    this.flash = Math.max(0, this.flash - dt * 1.6);
    if (this.state === 'parked' || this.state === 'stopped') { this.rate = k; }
    else if (this.state === 'armed') {
      this.rate = k;
      const d = dt * k, acc = 4;                 // pull away gently (m/s^2)
      if (this.v < p.v) this.v = Math.min(p.v, this.v + acc * d); else this.v = Math.max(p.v, this.v - acc * d);
      this.x += this.v * d;
      if (Math.abs(this.v - p.v) < 1e-6) {
        if (this.wait == null) this.wait = 1 + Math.random() * 2;   // a random 1-3 s wait once at speed
        this.wait -= d;
        if (this.wait <= 0) this.start(p, hazard);
      } else this.wait = null;
    } else {
      const r = this.run;
      this.rate = k;   // always real time (long stops can be skipped)
      let left = dt * this.rate;
      while (left > 1e-9 && this.state !== 'stopped') {
        if (this.state === 'think') {
          const d = Math.min(left, r.p.tr - this.t);
          this.x += this.v * d; this.t += d; left -= d;
          if (this.t >= r.p.tr - 1e-9) {
            this.state = 'brake'; r.brakeX = r.seenX + r.p.v * r.p.tr; this.x = r.brakeX; this.flash = 1;
            r.samples.push({ t: this.t, v: this.v, s: this.x - r.seenX });
          }
        } else {
          const a = r.p.a, d = Math.min(left, this.v / a);
          this.x += this.v * d - 0.5 * a * d * d; this.v -= a * d; this.t += d; left -= d;
          if (this.v <= 1e-6) {
            this.v = 0; this.state = 'stopped'; r.stopX = r.brakeX + r.p.brake; this.x = r.stopX; this.stoppedAt = this.clock;
            const gap = r.hazardX - r.stopX;
            this.result = { ok: gap >= 0, gap };
          }
        }
      }
      r.samples.push({ t: this.t, v: this.v, s: this.x - r.seenX });
      // on ice the back of the car fishtails while braking, and the rear wheels leave a wavy track
      if (this.look === 'icy' && this.state === 'brake') {
        this.wig = 0.035 * Math.min(1, this.v / 8) * Math.sin(this.clock * Math.PI * 2 * 0.6);   // a slow sway, about once every 1.7 s
        if (!r.track) r.track = [];
        const rx = this.x - 0.78 * CAR_LEN, lastT = r.track[r.track.length - 1];
        if (!lastT || rx - lastT.x > 0.15) r.track.push({ x: rx, w: this.wig });
      } else this.wig = 0;
      // the ducks take off when the car is 7 m away, so there's time to watch them fly
      if (this.ducks && !this.ducks.fly && this.x >= r.hazardX - 7) this.ducks.fly = this.clock;
    }
    this.spawn(dt);
    for (const q of this.parts) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g || 0) * dt; }
    this.parts = this.parts.filter(q => q.age < q.life);
  }
  spawn(dt) {
    const look = this.look || 'dry';
    const rearX = this.x - CAR_LEN * 0.78;
    if (this.state === 'brake' && this.v > 0.5) {
      if (look === 'dry' && Math.random() < dt * 30) this.parts.push({ kind: 'smoke', x: rearX, y: 0, vx: this.v * 0.3, vy: -14, age: 0, life: 1.1, s: 6 + Math.random() * 6 });
      if (look === 'icy' && Math.random() < dt * 40) this.parts.push({ kind: 'spark', x: rearX + Math.random() * 2, y: 0, vx: 0, vy: -10 - Math.random() * 20, age: 0, life: 0.6 });
    }
    if (look === 'wet' && this.v > 3 && Math.random() < dt * 50)
      this.parts.push({ kind: 'spray', x: rearX - 0.4, y: -2, vx: -2 - Math.random() * 3 + this.v * 0.6, vy: -40 - Math.random() * 40, g: 160, age: 0, life: 0.5 });
  }
  snap() {
    const r = this.run;
    return { state: this.state, t: this.t, v: this.v, s: r ? this.x - r.seenX : 0, run: r, last: this.last, result: this.result, rate: this.rate };
  }

  // ===== Drawing =====
  // s: the live settings (for the look and the driver cam); W, H in CSS pixels
  draw(ctx, W, H, s, dt) {
    const look = s.road; this.look = look;
    const L = LOOK[look];
    const base = clamp(W / 38, 10, 44);       // pixels per metre when following the car
    const carPx = CAR_LEN * base;
    this.updateCam(W, base, dt);
    const ppm = W / (this.cam.right - this.cam.left), left = this.cam.left;
    const sx = wx => (wx - left) * ppm;
    const hz = H * 0.4, roadTop = H * 0.56, roadBot = H * 0.78, roadH = roadBot - roadTop;
    const yG = roadTop + roadH * 0.8;          // where the tyres touch the road
    const r = this.run;

    // sky
    let g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, L.sky[0]); g.addColorStop(1, L.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 2);
    if (look === 'dry') {
      ctx.fillStyle = 'rgba(255,236,150,.35)'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, 26, 0, TAU); ctx.fill();
    }
    this.drawClouds(ctx, W, H, look, left * base);
    // hills (parallax)
    const off = left * base;
    for (let layer = 0; layer < 2; layer++) {
      const f = layer ? 0.14 : 0.06, amp = layer ? 34 : 48, y0 = hz - (layer ? 6 : 22);
      ctx.fillStyle = L.hill[layer]; ctx.beginPath(); ctx.moveTo(0, hz + 2);
      for (let x = 0; x <= W + 10; x += 10) {
        const u = (x + off * f) / (layer ? 140 : 260);
        ctx.lineTo(x, y0 - amp * (0.5 + 0.3 * Math.sin(u) + 0.2 * Math.sin(u * 2.3 + layer)));
      }
      ctx.lineTo(W, hz + 2); ctx.closePath(); ctx.fill();
    }
    // Everything on the road is drawn at the normal (close-up) scale and then shrunk as a whole about the
    // near edge of the road, like a camera pulling back. Nothing is stretched one way only.
    const z = ppm / base, WB = W / z;          // zoom (1 = close up) and the visible width before shrinking
    const sxB = wx => (wx - left) * base;
    ctx.fillStyle = L.grass; ctx.fillRect(0, hz, W, roadBot - hz);
    ctx.save();
    ctx.translate(0, roadBot); ctx.scale(z, z); ctx.translate(0, -roadBot);
    this.drawRoadside(ctx, sxB, base, left, WB, roadTop, look);
    if (look === 'icy') {
      const marks = r ? [r.seenX, r.brakeX, r.stopX].filter(v => v != null).map(sxB) : [];
      this.drawIceSign(ctx, sxB, base, left, WB, roadTop, marks, 80 / z);
    }

    // road
    if (look === 'icy') {
      g = ctx.createLinearGradient(0, roadTop, 0, roadBot); g.addColorStop(0, '#dcebf2'); g.addColorStop(1, '#b4cfdd');
      ctx.fillStyle = g;
    } else if (look === 'wet') {
      g = ctx.createLinearGradient(0, roadTop, 0, roadBot); g.addColorStop(0, '#3a3f44'); g.addColorStop(0.5, '#262a2e'); g.addColorStop(1, '#32373c');
      ctx.fillStyle = g;
    } else ctx.fillStyle = L.road;
    ctx.fillRect(0, roadTop, WB, roadH);
    this.drawSurface(ctx, sxB, base, left, WB, roadTop, roadBot, look);
    // lines
    ctx.fillStyle = L.edge; ctx.globalAlpha = look === 'icy' ? 0.7 : 0.9;
    ctx.fillRect(0, roadTop + 4, WB, 3); ctx.fillRect(0, roadBot - 7, WB, 3);
    const yc = roadTop + roadH * 0.42;
    for (let n = Math.floor(left / 9) - 1; n * 9 < this.cam.right + 9; n++) ctx.fillRect(sxB(n * 9), yc, 3 * base, 3);
    ctx.globalAlpha = 1;
    if (look === 'icy') { // snow banks along both edges
      ctx.fillStyle = '#ffffff';
      for (let x = -((left * base) % 30) - 30; x < WB + 30; x += 30) {
        ctx.beginPath(); ctx.ellipse(x, roadTop + 1, 22, 6, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 15, roadBot + 1, 22, 5, 0, 0, TAU); ctx.fill();
      }
    }

    // thinking and braking shading on the road, and skid marks
    if (r) {
      const xEnd = this.x;
      const tA = sxB(r.seenX), tB = sxB(r.brakeX ?? xEnd), bB = sxB(r.stopX ?? xEnd);
      ctx.fillStyle = 'rgba(47,134,214,.22)'; ctx.fillRect(tA, roadTop + roadH * 0.5, tB - tA, roadH * 0.5 - 7);
      if (r.brakeX != null) {
        ctx.fillStyle = 'rgba(229,65,47,.22)'; ctx.fillRect(tB, roadTop + roadH * 0.5, bB - tB, roadH * 0.5 - 7);
        // skid marks under both wheels
        ctx.strokeStyle = look === 'icy' ? 'rgba(255,255,255,.95)' : look === 'wet' ? 'rgba(10,10,12,.45)' : 'rgba(18,18,18,.7)';
        ctx.lineWidth = look === 'icy' ? 2 : 4; ctx.lineCap = 'round';
        for (const wOff of [0.2, 0.78]) {
          const a0 = sxB(r.brakeX - wOff * CAR_LEN), a1 = sxB(xEnd - wOff * CAR_LEN);
          if (a1 <= a0 + 1) continue;
          ctx.beginPath(); ctx.moveTo(a0, yG + 1);
          // the rear wheels swing from side to side on ice (shown as up and down the road), so their track wiggles
          if (wOff === 0.78 && r.track) for (const q of r.track) if (q.x <= xEnd - wOff * CAR_LEN) ctx.lineTo(sxB(q.x), yG + 1 + 0.58 * carPx * q.w);
          ctx.lineTo(a1, yG + 1 + (wOff === 0.78 ? 0.58 * carPx * (this.wig || 0) : 0)); ctx.stroke();
        }
      }
    }

    // ducks
    if (this.ducks && r) this.drawDucks(ctx, sxB(r.hazardX), roadTop, roadH, base);

    // the car (and its reflection on a wet road)
    const pitch = this.state === 'brake' ? 0.035 : 0;
    const wheel = this.x / 0.3;
    const braking = this.state === 'brake' || (this.state === 'stopped' && this.clock - this.stoppedAt < 1.2);
    if (look === 'wet') {
      ctx.save(); ctx.beginPath(); ctx.rect(0, yG, WB, roadBot - yG - 4); ctx.clip();
      ctx.translate(0, 2 * yG); ctx.scale(1, -1); ctx.globalAlpha = 0.22;
      drawCar(ctx, sxB(this.x), yG, carPx, { wheel, braking, pitch, wig: this.wig || 0, col: COL.car });
      ctx.restore();
    }
    for (const q of this.parts) if (q.kind !== 'spray') this.drawPart(ctx, q, sxB, yG);
    drawCar(ctx, sxB(this.x), yG, carPx, { wheel, braking, pitch, wig: this.wig || 0, col: COL.car });
    for (const q of this.parts) if (q.kind === 'spray') this.drawPart(ctx, q, sxB, yG);
    ctx.restore();

    // markers: hazard seen, brakes on, stopped (labels stay full size so they can be read)
    const topZ = roadBot - roadH * z;
    if (r) {
      this.marker(ctx, sx(r.seenX), topZ, roadBot, 'Hazard seen', COL.think, '#fff', 0);
      if (r.brakeX != null) this.marker(ctx, sx(r.brakeX), topZ, roadBot, 'BRAKES ON!', COL.brake, '#fff', 1);
      if (r.stopX != null) this.marker(ctx, sx(r.stopX), topZ, roadBot, 'Stopped', '#f4f4f0', '#15181a', 2);
    }

    // near verge with the distance strip and ruler
    ctx.fillStyle = L.verge; ctx.fillRect(0, roadBot, W, H - roadBot);
    this.drawStrip(ctx, sx, ppm, W, H, roadBot);

    // weather on top of everything in the scene
    if (look === 'wet') this.drawRain(ctx, W, H);
    if (look === 'icy') this.drawSnow(ctx, W, H);

    // ducks out of view: an arrow at the edge
    if (r && this.ducks && !this.ducks.fly) {
      const hx = sx(r.hazardX);
      if (hx > W - 30) {
        const y = roadBot - roadH * z * 0.5;
        pill(ctx, W - 12, y, `Ducks ${Math.round(r.hazardX - this.x)} m ahead →`, '#ffd166', '#2a1c00', 'right');
      }
    }
    if (this.flash > 0) {
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(229,65,47,0)'); g.addColorStop(1, `rgba(229,65,47,${0.55 * this.flash})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    this.drawHUD(ctx, W, H, s);
    drawCam(ctx, W, H, s, this);
  }

  updateCam(W, base, dt) {
    const r = this.run, c = this.cam;
    let tl, tr;
    if (!r) { tl = this.x - 8; tr = tl + W / base; }
    else if (this.state !== 'stopped') {
      tl = this.x - 8;
      const want = Math.max(r.hazardX + 6, tl + W / base);
      tr = Math.min(want, tl + (W / base) * 4);   // never zoom out more than 4x while moving
    } else {
      const far = Math.max(r.stopX, r.hazardX) + 8, maxSpan = (W / base) * 30;   // zoom out far enough to show a 771 m icy stop
      tl = r.seenX - 8; tr = Math.max(far, tl + W / base);
      const span = tr - tl; tl -= span * 0.08; tr += span * 0.06;   // room for the labels at each end
      if (tr - tl > maxSpan) { tr = Math.max(r.stopX + 10, r.hazardX < r.stopX ? r.stopX + 10 : r.hazardX + 8); tl = tr - maxSpan; }
    }
    const k = Math.min(1, dt * (this.state === 'stopped' ? 2.5 : 4));
    if (this.state === 'stopped' || !isFinite(c.left)) c.left += (tl - c.left) * k; else c.left = tl;
    c.right += (tr - c.right) * k;
    if (c.right - c.left < 5) c.right = c.left + 5;
  }

  drawClouds(ctx, W, H, look, off) {
    const n = look === 'wet' ? 7 : 4;
    ctx.fillStyle = look === 'wet' ? 'rgba(90,100,110,.75)' : look === 'icy' ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.85)';
    for (let i = 0; i < n; i++) {
      const span = W + 300;
      const x = ((rnd(i) * span - off * 0.03 + this.clock * 6 * (0.5 + rnd(i + 9))) % span + span) % span - 150;
      const y = H * (0.05 + rnd(i + 3) * 0.2), s = 0.7 + rnd(i + 5) * 0.8;
      ctx.beginPath();
      ctx.ellipse(x, y, 50 * s, 16 * s, 0, 0, TAU); ctx.ellipse(x + 30 * s, y - 10 * s, 30 * s, 18 * s, 0, 0, TAU);
      ctx.ellipse(x - 26 * s, y - 6 * s, 26 * s, 14 * s, 0, 0, TAU); ctx.fill();
    }
  }
  drawRoadside(ctx, sx, ppm, left, W, y, look) {
    let step = 12; while (step * ppm < 46) step *= 2;
    for (let n = Math.floor(left / step) - 1; n * step < this.cam.right + step; n++) {
      const wx = n * step + rnd(n) * step * 0.4, x = sx(wx), kind = rnd(n + 77);
      if (kind < 0.25) { // lamp post
        ctx.strokeStyle = '#5b6168'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 70); ctx.lineTo(x + 14, y - 74); ctx.stroke();
        ctx.fillStyle = '#e8e2c8'; ctx.fillRect(x + 10, y - 76, 10, 4);
      } else { // tree
        const h = 40 + rnd(n + 3) * 30;
        ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x - 3, y - h * 0.45, 6, h * 0.45);
        ctx.fillStyle = look === 'icy' ? '#7d9a8a' : look === 'wet' ? '#2f5d34' : '#3f8a3f';
        ctx.beginPath(); ctx.ellipse(x, y - h * 0.65, h * 0.3, h * 0.38, 0, 0, TAU); ctx.fill();
        if (look === 'icy') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.86, h * 0.24, h * 0.14, 0, 0, TAU); ctx.fill(); }
      }
    }
  }
  drawIceSign(ctx, sx, ppm, left, W, y, marks = [], gap = 80) {
    let step = 60; while (step * ppm < 300) step *= 2;
    for (let n = Math.floor(left / step) - 1; n * step < this.cam.right + step; n++) {
      const x = sx(n * step + 20);
      if (marks.some(m => Math.abs(m - x) < gap)) continue;
      ctx.strokeStyle = '#5b6168'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 40); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d62b1f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, y - 74); ctx.lineTo(x + 20, y - 40); ctx.lineTo(x - 20, y - 40); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x - 8 * Math.cos(a), y - 50 - 8 * Math.sin(a)); ctx.lineTo(x + 8 * Math.cos(a), y - 50 + 8 * Math.sin(a)); ctx.stroke(); }
    }
  }
  drawSurface(ctx, sx, ppm, left, W, top, bot, look) {
    const h = bot - top;
    if (look === 'wet') { // puddles with a sheen
      for (let n = Math.floor(left / 14) - 1; n * 14 < this.cam.right + 14; n++) {
        if (rnd(n + 40) < 0.45) continue;
        const x = sx(n * 14 + rnd(n) * 8), y = top + h * (0.25 + rnd(n + 2) * 0.6), w = (1.5 + rnd(n + 1) * 2.5) * ppm;
        ctx.fillStyle = 'rgba(150,175,195,.35)'; ctx.beginPath(); ctx.ellipse(x, y, Math.max(6, w), Math.max(2, w * 0.12), 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(220,235,245,.35)'; ctx.lineWidth = 1;
        const ring = (this.clock * 1.5 + rnd(n + 8)) % 1;
        ctx.beginPath(); ctx.ellipse(x + w * 0.2, y, w * 0.3 * ring + 2, (w * 0.3 * ring + 2) * 0.3, 0, 0, TAU); ctx.stroke();
      }
    } else if (look === 'icy') { // shiny streaks
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      for (let n = Math.floor(left / 5) - 1; n * 5 < this.cam.right + 5; n++) {
        if (rnd(n + 13) < 0.4) continue;
        const x = sx(n * 5 + rnd(n) * 4), y = top + h * (0.15 + rnd(n + 6) * 0.7), w = 10 + rnd(n + 2) * 30;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y - 3); ctx.stroke();
      }
      const tw = (this.clock * 2) % 1; // twinkles
      ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(tw * TAU)})`;
      for (let i = 0; i < 6; i++) { const x = (rnd(i + Math.floor(this.clock)) * W), y = top + rnd(i + 30 + Math.floor(this.clock)) * h; star(ctx, x, y, 4); }
    } else { // a little texture on dry tarmac
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      for (let n = Math.floor(left / 3) - 1; n * 3 < this.cam.right + 3; n++) {
        if (rnd(n + 5) < 0.5) continue;
        ctx.fillRect(sx(n * 3 + rnd(n) * 3), top + h * rnd(n + 9), 3, 2);
      }
    }
  }
  drawStrip(ctx, sx, ppm, W, H, y0) {
    const r = this.run;
    const yb = y0 + 8, hb = 22, yr = yb + hb + 4;
    if (!r) {
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, yb, W, hb);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Thinking distance and braking distance will be measured here', W / 2, yb + hb / 2);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, yb, W, hb);
    const a = sx(r.seenX), b = sx(r.brakeX ?? this.x), c = sx(r.stopX ?? this.x);
    const seg = (x0, x1, col, ink, text) => {
      if (x1 <= x0) return;
      ctx.fillStyle = col; ctx.fillRect(x0, yb, x1 - x0, hb);
      ctx.font = `800 13px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      const v0 = Math.max(0, x0), v1 = Math.min(W, x1), w = ctx.measureText(text).width;
      if (w + 10 < v1 - v0) { ctx.fillStyle = '#fff'; ctx.fillText(text, (v0 + v1) / 2, yb + hb / 2 + 1); }
      else if (w * 0.45 + 10 < v1 - v0) { ctx.fillStyle = '#fff'; ctx.fillText(text.split(' ').pop() === 'm' ? text.replace(/^\w+ distance /, '') : text, (v0 + v1) / 2, yb + hb / 2 + 1); }
    };
    const thinkD = (r.brakeX ?? this.x) - r.seenX;
    seg(a, b, COL.think, '#fff', `Thinking distance ${thinkD.toFixed(1)} m`);
    if (r.brakeX != null) seg(b, c, COL.brake, '#fff', `Braking distance ${(this.x - r.brakeX).toFixed(1)} m`);
    // ruler: metres from where the hazard was seen
    let step = 1; for (const st of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) { step = st; if (st * ppm >= 58) break; }
    const icy = this.look === 'icy';   // dark numbers on the pale icy scene, white elsewhere
    ctx.strokeStyle = icy ? 'rgba(0,0,0,.7)' : 'rgba(255,255,255,.75)'; ctx.fillStyle = icy ? '#111' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 1;
    ctx.font = `700 11.5px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const m0 = Math.ceil((this.cam.left - r.seenX) / step) * step;
    for (let m = m0; r.seenX + m < this.cam.right; m += step) {
      const x = sx(r.seenX + m);
      ctx.beginPath(); ctx.moveTo(x, yr); ctx.lineTo(x, yr + 6); ctx.stroke();
      if (m >= 0) ctx.fillText(m + ' m', x, yr + 8);
    }
  }
  marker(ctx, x, top, bot, text, col, ink, i) {
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(x, top - 26 - i * 0); ctx.lineTo(x, bot + 30); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `800 13px ${FONT}`;
    const w = ctx.measureText(text).width + 16, y = top - 46 - (i % 2) * 26;
    ctx.fillStyle = col; roundRect(ctx, x - w / 2, y, w, 22, 6); ctx.fill();
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 11.5);
    ctx.restore();
  }
  drawDucks(ctx, hx, roadTop, roadH, base) {
    const d = this.ducks, age = this.clock - d.born, s = clamp(base / 18, 0.7, 1.8);
    const walk = clamp(age / 1.4, 0, 1);       // they waddle out into the car's lane, then freeze
    const yLead = roadTop + roadH * (0.05 + 0.72 * walk);
    const flyT = d.fly ? this.clock - d.fly : 0;
    // "!" when they first appear
    if (age < 1.6 && !d.fly) {
      ctx.fillStyle = '#ffd166'; ctx.font = `900 ${28 * s}px ${HEAD}`; ctx.textAlign = 'center';
      ctx.fillText('!', hx, yLead - 40 * s - Math.sin(age * 10) * 3);
    }
    for (let i = 0; i < 4; i++) {
      const baby = i > 0, sc = s * (baby ? 0.6 : 1);
      let x = hx + i * 9 * s, y = yLead - i * 13 * s;
      const bob = Math.sin(this.clock * 12 + i) * (walk < 1 ? 1.5 : 0.4);
      let flap = 0;
      if (d.fly) {
        x += flyT * (90 + i * 30) * s; y -= flyT * (150 + i * 25) * s - 40 * flyT * flyT;
        flap = Math.sin(this.clock * 30 + i * 2);
      }
      duck(ctx, x, y + bob, sc, baby, flap);
    }
    if (d.fly && flyT < 1.8) {
      ctx.save(); ctx.globalAlpha = clamp(1.8 - flyT, 0, 1);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a1c00'; ctx.lineWidth = 4; ctx.font = `900 ${24 * s}px ${HEAD}`; ctx.textAlign = 'center';
      ctx.strokeText('QUACK!', hx + 20 * s, yLead - 70 * s - flyT * 30); ctx.fillText('QUACK!', hx + 20 * s, yLead - 70 * s - flyT * 30);
      ctx.fillStyle = '#f6f1e3';
      for (let k = 0; k < 7; k++) { // feathers
        const fx = hx + Math.sin(k * 2.1) * 40 * flyT * s + k * 4, fy = yLead - 10 + flyT * 30 * (0.5 + rnd(k)) - 20 * Math.sin(k);
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(this.clock * 3 + k);
        ctx.beginPath(); ctx.ellipse(0, 0, 6 * s, 2.2 * s, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.restore();
    }
  }
  drawPart(ctx, q, sx, yG) {
    const x = sx(q.x), y = yG + q.y, f = q.age / q.life;
    if (q.kind === 'smoke') { ctx.fillStyle = `rgba(220,220,220,${0.45 * (1 - f)})`; ctx.beginPath(); ctx.arc(x, y - 4, q.s * (1 + f * 2.5), 0, TAU); ctx.fill(); }
    else if (q.kind === 'spark') { ctx.fillStyle = `rgba(255,255,255,${1 - f})`; star(ctx, x, y, 3.5); }
    else { ctx.fillStyle = `rgba(200,220,235,${0.6 * (1 - f)})`; ctx.fillRect(x, y, 2.5, 2.5); }
  }
  drawRain(ctx, W, H) {
    ctx.strokeStyle = 'rgba(210,225,240,.45)'; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i < 110; i++) {
      const sp = 700 + rnd(i) * 300, x = (rnd(i + 1) * (W + 200) + this.clock * 60) % (W + 200) - 100;
      const y = (rnd(i + 2) * H + this.clock * sp) % (H + 40) - 20;
      ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16);
    }
    ctx.stroke();
  }
  drawSnow(ctx, W, H) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 80; i++) {
      const sp = 30 + rnd(i) * 40, x = (rnd(i + 1) * W + Math.sin(this.clock + i) * 18 + W) % W;
      const y = (rnd(i + 2) * H + this.clock * sp) % (H + 10) - 5;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + rnd(i + 3) * 2, 0, TAU); ctx.fill();
    }
  }
  drawHUD(ctx, W, H, s) {
    const st = this.state, r = this.run;
    const u = s._unit;
    const x = 14, y = 14, w = Math.min(236, W * 0.44), narrow = w < 220;
    ctx.fillStyle = 'rgba(18,20,22,.78)'; roundRect(ctx, x, y, w, r ? 118 : 66, 12); ctx.fill();
    ctx.fillStyle = '#a4a9ad'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('SPEED', x + 12, y + 20);
    ctx.fillStyle = '#eef0ef'; ctx.font = `800 30px ${HEAD}`;
    const vTxt = (this.v / u.k).toFixed(u.dp);
    ctx.fillText(vTxt, x + 12, y + 52);
    const vw = ctx.measureText(vTxt).width;
    ctx.fillStyle = '#a4a9ad'; ctx.font = `700 14px ${FONT}`; ctx.fillText(u.label, x + 18 + vw, y + 52);
    const ph = st === 'parked' ? ['Parked', '#5f666c', '#fff'] : st === 'armed' ? ['Driving', '#5f666c', '#fff'] : st === 'think' ? ['THINKING', COL.think, '#fff'] : st === 'brake' ? ['BRAKING', COL.brake, '#fff'] : ['STOPPED', '#eef0ef', '#15181a'];
    ctx.font = `800 12px ${FONT}`;
    const pw = ctx.measureText(ph[0]).width + 16;
    ctx.fillStyle = ph[1]; roundRect(ctx, x + w - pw - 10, y + 10, pw, 20, 10); ctx.fill();
    ctx.fillStyle = ph[2]; ctx.textAlign = 'center'; ctx.fillText(ph[0], x + w - 10 - pw / 2, y + 24);
    if (r) {
      ctx.textAlign = 'left';
      const rows = [[narrow ? 'Time' : 'Time since hazard', this.t.toFixed(2) + ' s'], [narrow ? 'Distance' : 'Distance since hazard', (this.x - r.seenX).toFixed(1) + ' m']];
      rows.forEach(([a, b], i) => {
        const yy = y + 80 + i * 24;
        ctx.fillStyle = '#a4a9ad'; ctx.font = `700 12px ${FONT}`; ctx.fillText(a, x + 12, yy);
        ctx.fillStyle = '#eef0ef'; ctx.font = `800 15px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(b, x + w - 12, yy); ctx.textAlign = 'left';
      });
    }
    // banners
    if (st === 'parked') pill(ctx, W / 2, H - 20, 'Press Drive (or the space bar). Somewhere along the road, ducks will step out!', 'rgba(18,20,22,.82)', '#eef0ef', 'center', 14);
    if (st === 'armed') {
      if (this.cancelledAt != null && this.clock - this.cancelledAt < 3) pill(ctx, W / 2, H - 20, 'You changed a setting, so that run was cancelled. The ducks will appear again soon.', '#ffd166', '#2a1c00', 'center', 14);
      else pill(ctx, W / 2, H - 20, 'Watch the road\u2026', 'rgba(18,20,22,.82)', '#eef0ef', 'center', 14);
    }
    if (st === 'stopped' && this.result && this.clock - this.stoppedAt > 0.3) {
      const g = this.result;
      pill(ctx, W / 2, H - 20, g.ok ? `Stopped ${g.gap.toFixed(1)} m before the ducks!` : `Didn't stop in time: ${(-g.gap).toFixed(1)} m too far. The ducks had to fly for it!`,
        g.ok ? '#58c08a' : '#ffd166', g.ok ? '#05200f' : '#2a1c00', 'center', 16);
    }
  }
}

// ===== Shared drawing helpers =====
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function pill(ctx, x, y, text, bg, ink, align = 'center', size = 14) {
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + 24, h = size + 14;
  const x0 = align === 'right' ? x - w : align === 'left' ? x : x - w / 2;
  ctx.fillStyle = bg; roundRect(ctx, x0, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x0 + w / 2, y + 1);
  ctx.textBaseline = 'alphabetic';
}
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
}
function duck(ctx, x, y, s, baby, flap) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = baby ? '#ffd84a' : '#8a6a45';
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, TAU); ctx.fill();                 // body
  ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(17, -7); ctx.lineTo(12, 3); ctx.fill();  // tail
  ctx.fillStyle = baby ? '#ffd84a' : '#2f7d4b';
  ctx.beginPath(); ctx.arc(-10, -9, 6, 0, TAU); ctx.fill();                          // head
  ctx.fillStyle = '#ff9a1f'; ctx.beginPath(); ctx.moveTo(-15, -10); ctx.lineTo(-22, -8); ctx.lineTo(-15, -6); ctx.fill(); // beak
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-11.5, -10.5, 1.4, 0, TAU); ctx.fill();
  ctx.fillStyle = baby ? '#f0c030' : '#6d5235';                                     // wing
  ctx.beginPath();
  if (flap) { ctx.moveTo(-2, -3); ctx.lineTo(6, -3 - 16 * flap); ctx.lineTo(10, -2); }
  else ctx.ellipse(2, -1, 7, 4, 0.2, 0, TAU);
  ctx.fill();
  if (!flap) { ctx.strokeStyle = '#ff9a1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 7); ctx.lineTo(-2, 11); ctx.moveTo(3, 7); ctx.lineTo(3, 11); ctx.stroke(); }
  ctx.restore();
}

// A small hatchback, front bumper at (fx, yG), length L pixels
export function drawCar(ctx, fx, yG, L, { wheel = 0, braking = false, pitch = 0, wig = 0, col = COL.car }) {
  const r = L * 0.105;
  ctx.save(); ctx.translate(fx, yG);
  // fishtail: the back slides across the road (up or down the screen) while the car stays upright, so it still
  // looks like it's on the road rather than doing a wheelie; it's a shear about the front wheels
  if (wig) { ctx.translate(-L * 0.2, 0); ctx.transform(1, -wig, 0, 1, 0, 0); ctx.translate(L * 0.2, 0); }
  ctx.translate(-L * 0.78, -r); ctx.rotate(pitch); ctx.translate(L * 0.78, r);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(-L * 0.5, 0, L * 0.52, L * 0.035, 0, 0, TAU); ctx.fill();
  // back face: when the rear swings towards us we see a thin sliver of the back of the car, in shade.
  // It's the rear outline of the body again, shifted a little to the left, so the car reads as a solid shape.
  if (wig > 0) {
    const w = L * 0.085 * Math.min(1, wig / 0.035);
    const rear = dx => {
      ctx.beginPath();
      ctx.moveTo(-L * 0.9, -L * 0.1); ctx.lineTo(-L * 0.99 - dx, -L * 0.1); ctx.lineTo(-L - dx, -L * 0.3);
      ctx.quadraticCurveTo(-L * 0.98 - dx, -L * 0.42, -L * 0.86 - dx, -L * 0.43); ctx.lineTo(-L * 0.8, -L * 0.43); ctx.closePath();
    };
    ctx.fillStyle = col; rear(w); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.32)'; rear(w); ctx.fill();
    ctx.fillStyle = '#1d2b36'; ctx.fillRect(-L * 0.985 - w * 0.85, -L * 0.4, w * 0.7, L * 0.085);          // rear window
    // two brake lights, one at each side of the back
    ctx.fillStyle = braking ? '#ff2a1e' : '#8f1d16';
    ctx.fillRect(-L - w * 0.97, -L * 0.29, w * 0.3, L * 0.07); ctx.fillRect(-L - w * 0.3, -L * 0.29, w * 0.3, L * 0.07);
  }
  // body
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-L * 0.99, -L * 0.1); ctx.lineTo(-L, -L * 0.3);
  ctx.quadraticCurveTo(-L * 0.98, -L * 0.42, -L * 0.86, -L * 0.43);
  ctx.lineTo(-L * 0.5, -L * 0.43); ctx.quadraticCurveTo(-L * 0.42, -L * 0.42, -L * 0.3, -L * 0.29);
  ctx.lineTo(-L * 0.06, -L * 0.25); ctx.quadraticCurveTo(0, -L * 0.23, 0, -L * 0.15);
  ctx.lineTo(-L * 0.01, -L * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-L * 0.99, -L * 0.135, L * 0.98, L * 0.035);   // sill
  // windows
  ctx.fillStyle = '#1d2b36';
  ctx.beginPath(); ctx.moveTo(-L * 0.93, -L * 0.3); ctx.lineTo(-L * 0.86, -L * 0.4); ctx.lineTo(-L * 0.68, -L * 0.4); ctx.lineTo(-L * 0.68, -L * 0.3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-L * 0.65, -L * 0.3); ctx.lineTo(-L * 0.65, -L * 0.4); ctx.lineTo(-L * 0.5, -L * 0.4); ctx.quadraticCurveTo(-L * 0.45, -L * 0.39, -L * 0.36, -L * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-L * 0.62, -L * 0.395, L * 0.05, L * 0.09);
  // door line and handle
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-L * 0.665, -L * 0.29); ctx.lineTo(-L * 0.665, -L * 0.14); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-L * 0.6, -L * 0.25, L * 0.05, L * 0.015);
  // lights
  ctx.fillStyle = '#fff3c4'; ctx.fillRect(-L * 0.035, -L * 0.21, L * 0.03, L * 0.04);
  if (braking) {
    const g = ctx.createRadialGradient(-L, -L * 0.25, 0, -L, -L * 0.25, L * 0.35);
    g.addColorStop(0, 'rgba(255,40,30,.85)'); g.addColorStop(1, 'rgba(255,40,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-L, -L * 0.25, L * 0.35, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff2a1e';
  } else ctx.fillStyle = '#8f1d16';
  ctx.fillRect(-L * 1.0, -L * 0.29, L * 0.035, L * 0.07);
  ctx.fillRect(-L * 0.9, -L * 0.435, L * 0.08, L * 0.012);      // high brake light
  // wheels
  for (const wx of [-L * 0.2, -L * 0.78]) {
    ctx.fillStyle = '#16181a'; ctx.beginPath(); ctx.arc(wx, -r, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9aa3aa'; ctx.beginPath(); ctx.arc(wx, -r, r * 0.55, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4b5258'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const a = wheel + k * TAU / 3;
      ctx.beginPath(); ctx.moveTo(wx, -r); ctx.lineTo(wx + Math.cos(a) * r * 0.5, -r + Math.sin(a) * r * 0.5); ctx.stroke();
    }
  }
  ctx.restore();
}

// ===== Driver cam: what's going on inside the car =====
function drawCam(ctx, W, H, s, sim) {
  const w = clamp(W * 0.24, 118, 230), h = w * 0.72, x0 = W - w - 14, y0 = 14;
  const t = sim.clock, st = sim.state;
  const reacting = st === 'brake' || (st === 'stopped' && t - sim.stoppedAt < 1.5);
  ctx.save();
  roundRect(ctx, x0, y0, w, h, 12); ctx.fillStyle = '#20262b'; ctx.fill();
  ctx.clip();
  // rear window behind the driver
  const sky = LOOK[s.road].sky;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.6); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
  ctx.fillStyle = g; roundRect(ctx, x0 + w * 0.06, y0 + h * 0.08, w * 0.88, h * 0.5, 10); ctx.fill();
  if (s.road === 'wet') { ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(x0 + w * (0.1 + rnd(i) * 0.8), y0 + h * (0.1 + ((rnd(i + 3) + t * 0.2 * (1 + rnd(i))) % 1) * 0.45), 1.6, 0, TAU); ctx.fill(); } }
  if (s.road === 'icy') { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(x0 + w * 0.06, y0 + h * 0.5, w * 0.88, h * 0.08); }

  // toddler in the back seat — sitting quietly but asking questions
  if (s.distraction === 'toddler') {
    const tx = x0 + w * 0.78, ty = y0 + h * 0.42;
    // body (sitting)
    ctx.fillStyle = '#d64545'; ctx.beginPath(); ctx.ellipse(tx, ty + h * 0.1, h * 0.085, h * 0.08, 0, 0, TAU); ctx.fill();
    // head
    ctx.fillStyle = '#c99a6e'; ctx.beginPath(); ctx.arc(tx, ty, h * 0.09, 0, TAU); ctx.fill();
    // hair
    ctx.fillStyle = '#e8c547'; ctx.beginPath(); ctx.arc(tx, ty - h * 0.06, h * 0.065, Math.PI, TAU); ctx.fill();
    // eyes
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(tx - h * 0.04, ty - h * 0.01, h * 0.015, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(tx + h * 0.04, ty - h * 0.01, h * 0.015, 0, TAU); ctx.fill();
    // small arms resting
    ctx.strokeStyle = '#c99a6e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(tx - h * 0.07, ty + h * 0.04); ctx.lineTo(tx - h * 0.11, ty + h * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx + h * 0.07, ty + h * 0.04); ctx.lineTo(tx + h * 0.11, ty + h * 0.1); ctx.stroke();
    // speech bubble "are we nearly there yet?"
    const bub = (Math.floor(t * 1.5) % 2 === 0);
    if (bub) {
      const msg = 'are we nearly there yet?';
      ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'left';
      const tw2 = ctx.measureText(msg).width + 10;
      const bbx = tx - tw2 * 0.5, bby = ty - h * 0.32;
      ctx.fillStyle = '#fff'; roundRect(ctx, bbx, bby, tw2, 14, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(tx - 4, bby + 14); ctx.lineTo(tx + 4, bby + 14); ctx.lineTo(tx, bby + 20); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillText(msg, bbx + 5, bby + 10);
    }
  }
  // seat
  const hx = x0 + w * 0.42, bob = s.distraction === 'music' && !reacting ? Math.sin(t * 9) * 3 : 0;
  const hy = y0 + h * 0.5 + bob, R = h * 0.17;
  ctx.fillStyle = '#3a3f45'; roundRect(ctx, hx - R * 1.6, hy - R * 1.4, R * 3.2, h, R * 0.8); ctx.fill();
  // body
  ctx.fillStyle = '#7a5aa8'; ctx.beginPath(); ctx.ellipse(hx, hy + R * 2.4, R * 1.7, R * 1.3, 0, 0, TAU); ctx.fill();
  // head and hair
  ctx.fillStyle = '#c99a6e'; ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3b2a20'; ctx.beginPath(); ctx.arc(hx, hy - R * 0.15, R * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  // where they're looking
  let lx = 0, ly = 0;
  const d = s.distraction;
  if (!reacting) {
    if (d === 'phone' || d === 'burger') { lx = 0.5; ly = 0.6; }
    else if (d === 'dog') lx = 0.8;
    else if (d === 'toddler') { lx = 0.6; ly = -0.6; }
  }
  const sleepy = s.tired && !reacting;
  for (const ex of [-0.38, 0.38]) {
    const cx = hx + ex * R, cy = hy - R * 0.05;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx, cy, R * (reacting ? 0.24 : 0.2), R * (reacting ? 0.27 : 0.2), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx + lx * R * 0.08, cy + ly * R * 0.08, R * 0.1, 0, TAU); ctx.fill();
    if (sleepy) { ctx.fillStyle = '#b8875c'; ctx.beginPath(); ctx.ellipse(cx, cy - R * 0.06, R * 0.23, R * 0.17, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(cx - R * 0.23, cy - R * 0.07, R * 0.46, R * 0.07); }
  }
  // mouth
  ctx.strokeStyle = '#6b3a2a'; ctx.fillStyle = '#6b3a2a'; ctx.lineWidth = 2;
  if (reacting) { ctx.beginPath(); ctx.ellipse(hx, hy + R * 0.5, R * 0.14, R * 0.18, 0, 0, TAU); ctx.fill(); }
  else if (d === 'music' || (sleepy && Math.sin(t * 0.9) > 0.85)) { ctx.beginPath(); ctx.ellipse(hx, hy + R * 0.5, R * 0.18, R * 0.13 * (1 + Math.sin(t * 9) * 0.4), 0, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(hx, hy + R * 0.3, R * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  // steering wheel
  ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(hx - R * 0.2, y0 + h * 1.02, R * 1.6, R * 0.8, 0, Math.PI, TAU); ctx.stroke();

  if (!reacting) {
    if (sleepy) { ctx.fillStyle = '#eef0ef'; ctx.font = `800 ${11 + (t * 2 % 1) * 6}px ${HEAD}`; ctx.textAlign = 'left'; ctx.fillText('z', hx + R * 1.1, hy - R * (1 + (t * 2 % 1))); ctx.font = `800 14px ${HEAD}`; ctx.fillText('Z', hx + R * 1.5, hy - R * 1.6); }
    if (d === 'phone') {
      const px = hx + R * 0.95, py = hy + R * 1.0;
      ctx.fillStyle = '#c99a6e'; ctx.beginPath(); ctx.arc(px + 2, py + R * 0.55, R * 0.32, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; roundRect(ctx, px - R * 0.3, py - R * 0.5, R * 0.6, R * 1.0, 3); ctx.fill();
      ctx.fillStyle = '#9fd3ff'; ctx.fillRect(px - R * 0.24, py - R * 0.42, R * 0.48, R * 0.8);
      if ((t % 1.6) < 0.7) { ctx.fillStyle = '#fff'; roundRect(ctx, px - 6, py - R * 1.25, 46, 16, 8); ctx.fill(); ctx.fillStyle = '#15181a'; ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('ping!', px + 2, py - R * 1.25 + 11.5); }
    }
    if (d === 'dog') {
      const dx = x0 + w * 0.86, dy = hy + R * 0.1;
      const lick = (Math.sin(t * 8) + 1) / 2;
      // panting tongue: drawn first so its root is hidden under the snout
      ctx.fillStyle = '#ff7f9e';
      ctx.beginPath(); ctx.ellipse(dx - R * 0.8, dy + R * (0.45 + lick * 0.18), R * 0.14, R * (0.2 + lick * 0.18), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b07a43'; ctx.beginPath(); ctx.ellipse(dx, dy, R * 0.75, R * 0.65, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(dx - R * 0.6, dy + R * 0.15, R * 0.5, R * 0.35, 0, 0, TAU); ctx.fill();  // snout
      ctx.fillStyle = '#7a5029'; ctx.beginPath(); ctx.ellipse(dx + R * 0.45, dy - R * 0.2, R * 0.25, R * 0.55, -0.3, 0, TAU); ctx.fill(); // ear
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(dx - R * 1.0, dy + R * 0.05, R * 0.12, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(dx - R * 0.25, dy - R * 0.25, R * 0.09, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6b4520'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(dx - R * 1.05, dy + R * 0.38); ctx.quadraticCurveTo(dx - R * 0.8, dy + R * 0.48, dx - R * 0.55, dy + R * 0.38); ctx.stroke();   // mouth line
      if (lick > 0.8) { ctx.fillStyle = '#eef0ef'; ctx.font = `800 11px ${HEAD}`; ctx.textAlign = 'center'; ctx.fillText('slurp!', dx - R * 0.6, dy - R * 0.9); }
    }
    if (d === 'burger') {
      const bx = hx + R * 0.7, by = hy + R * 1.25;
      ctx.fillStyle = '#d99a3e'; ctx.beginPath(); ctx.ellipse(bx, by - 5, 13, 7, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#5ab04a'; ctx.fillRect(bx - 13, by - 5, 26, 3);
      ctx.fillStyle = '#6b3a1e'; ctx.fillRect(bx - 12, by - 2, 24, 4);
      ctx.fillStyle = '#d99a3e'; ctx.fillRect(bx - 12, by + 2, 24, 4);
      const fall = (t * 1.3) % 1; ctx.fillStyle = '#5ab04a'; ctx.fillRect(bx - 4 + fall * 6, by + 8 + fall * 26, 6, 3);
      ctx.fillStyle = '#e8c547'; ctx.fillRect(bx + 6 - fall * 4, by + 12 + fall * 22, 5, 4);
    }
    if (d === 'music') {
      ctx.fillStyle = '#ffd166'; ctx.font = `800 18px ${HEAD}`; ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) { const f = (t * 0.7 + i / 3) % 1; ctx.globalAlpha = 1 - f; ctx.fillText(i % 2 ? '♫' : '♪', x0 + w * (0.15 + i * 0.05) + Math.sin(f * 6) * 6, y0 + h * (0.75 - f * 0.55)); }
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#2a1c00'; ctx.lineWidth = 3; ctx.font = `900 24px ${HEAD}`; ctx.textAlign = 'center';
    ctx.strokeText('!', hx + R * 1.4, hy - R * 0.6); ctx.fillText('!', hx + R * 1.4, hy - R * 0.6);
  }
  // a badge for alcohol or drugs (an icon only)
  let bx = x0 + 8;
  const badge = (text, icon) => {
    ctx.font = `800 10.5px ${FONT}`;
    const bw = ctx.measureText(text).width + 30;
    ctx.fillStyle = 'rgba(255,209,102,.95)'; roundRect(ctx, bx, y0 + h - 24, bw, 18, 9); ctx.fill();
    icon(bx + 11, y0 + h - 15);
    ctx.fillStyle = '#2a1c00'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + 21, y0 + h - 14.5); ctx.textBaseline = 'alphabetic';
    bx += bw + 5;
  };
  const no = (x, y) => { ctx.strokeStyle = '#d62b1f'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.stroke(); };
  if (s.impaired) badge('Alcohol or drugs', (x, y) => {
    // wine glass
    ctx.strokeStyle = '#2a1c00'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 5); ctx.lineTo(x + 4, y - 5); ctx.bezierCurveTo(x + 4, y - 1, x + 1.5, y + 1, x, y + 2); ctx.bezierCurveTo(x - 1.5, y + 1, x - 4, y - 1, x - 4, y - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 5); ctx.moveTo(x - 3, y + 5); ctx.lineTo(x + 3, y + 5); ctx.stroke();
  });
  ctx.restore();
  ctx.fillStyle = 'rgba(18,20,22,.8)'; roundRect(ctx, x0 + 8, y0 + 8, 74, 18, 9); ctx.fill();
  ctx.fillStyle = '#ff5a4e'; ctx.beginPath(); ctx.arc(x0 + 18, y0 + 17, 3.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#eef0ef'; ctx.font = `800 10.5px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('DRIVER CAM', x0 + 25, y0 + 17.5); ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; roundRect(ctx, x0, y0, w, h, 12); ctx.stroke();
}
