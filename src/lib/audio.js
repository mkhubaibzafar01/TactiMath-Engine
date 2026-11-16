const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const F0 = 220; // lowest pitch (A3)
export const OCTAVES = 3; // up to 1760 Hz (A6)

/** Height -> pitch. Exponential, so equal steps in y sound like equal musical intervals. */
export function yToFreq(y, ymin, ymax) {
  const t = clamp((y - ymin) / (ymax - ymin || 1), 0, 1);
  return F0 * Math.pow(2, t * OCTAVES);
}

/** Left-to-right position -> stereo pan (-1 left, +1 right). */
export function xToPan(x, xmin, xmax) {
  return clamp(-1 + (2 * (x - xmin)) / (xmax - xmin || 1), -1, 1);
}

export class Sonifier {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.hold = null;
    this.holdTimer = null;
    this.sweep = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio is not supported in this browser.');
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  panner(pan) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      return p;
    }
    return this.ctx.createGain(); // no panning available: pass through
  }

  /** One short note. `when` is seconds from now. Returns the oscillator. */
  blip({ freq, pan = 0, dur = 0.2, type = 'sine', gain = 0.35, when = 0 }) {
    const ctx = this.ensure();
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const p = this.panner(pan);
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(p);
    p.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
    return o;
  }

  /** Landmarks: a low "tick" for a root, a high "bell" for a peak or valley. */
  earcon(kind, pan = 0, when = 0) {
    if (kind === 'root') return this.blip({ freq: 90, pan, dur: 0.09, type: 'square', gain: 0.3, when });
    return this.blip({ freq: 2093, pan, dur: 0.18, type: 'sine', gain: 0.28, when });
  }

  /** Continuous tone that follows the pointer. Fades out shortly after the last update. */
  holdTone(freq, pan, offscale = false) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    if (!this.hold) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const p = this.panner(pan);
      o.connect(g);
      g.connect(p);
      p.connect(this.master);
      g.gain.value = 0.0001;
      o.frequency.value = freq;
      o.start();
      this.hold = { o, g, p };
    }
    const { o, g, p } = this.hold;
    o.type = offscale ? 'sawtooth' : 'sine';
    o.frequency.setTargetAtTime(freq, t, 0.015);
    if (p.pan) p.pan.setTargetAtTime(pan, t, 0.015);
    g.gain.setTargetAtTime(offscale ? 0.12 : 0.3, t, 0.01);
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => this.releaseHold(), 180);
  }

  releaseHold() {
    if (!this.hold) return;
    const { o, g } = this.hold;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.03);
    o.stop(t + 0.2);
    this.hold = null;
  }

  /** Play the whole curve left to right in `seconds`. Gaps (undefined values) are silent. */
  playSweep(curve, features, seconds, { onProgress, onEnd } = {}) {
    this.stopSweep();
    const ctx = this.ensure();
    const t0 = ctx.currentTime + 0.05;
    const { xs, ys, yview, xmin, xmax } = curve;
    const n = xs.length;
    const dt = seconds / (n - 1);

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const p = this.panner(xToPan(xs[0], xmin, xmax));
    o.type = 'sine';
    o.connect(g);
    g.connect(p);
    p.connect(this.master);
    g.gain.setValueAtTime(0.0001, t0);

    let live = false;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * dt;
      const y = ys[i];
      if (y === null) {
        if (live) {
          g.gain.setValueAtTime(0.0001, t);
          live = false;
        }
        continue;
      }
      const f = yToFreq(y, yview[0], yview[1]);
      if (!live) {
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.3, t + 0.02);
        live = true;
      } else {
        o.frequency.linearRampToValueAtTime(f, t);
      }
      if (p.pan) p.pan.linearRampToValueAtTime(xToPan(xs[i], xmin, xmax), t);
    }
    const tEnd = t0 + seconds;
    g.gain.setValueAtTime(0.3, tEnd);
    g.gain.linearRampToValueAtTime(0.0001, tEnd + 0.04);
    o.start(t0);
    o.stop(tEnd + 0.1);

    const state = { o, g, stopped: false, raf: 0, earcons: [] };
    const when = (x) => t0 + ((x - xmin) / (xmax - xmin)) * seconds - ctx.currentTime;
    for (const r of features.roots) state.earcons.push(this.earcon('root', xToPan(r, xmin, xmax), Math.max(0, when(r))));
    for (const e of features.extrema) state.earcons.push(this.earcon('peak', xToPan(e.x, xmin, xmax), Math.max(0, when(e.x))));
    this.sweep = state;

    const tick = () => {
      if (state.stopped) return;
      const el = ctx.currentTime - t0;
      onProgress?.(clamp(Math.round(el / dt), 0, n - 1));
      if (el >= seconds + 0.05) {
        state.stopped = true;
        this.sweep = null;
        onEnd?.();
        return;
      }
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }

  stopSweep() {
    const s = this.sweep;
    if (!s) return;
    s.stopped = true;
    cancelAnimationFrame(s.raf);
    const now = this.ctx.currentTime;
    try {
      s.g.gain.cancelScheduledValues(0);
      s.g.gain.setValueAtTime(0.0001, now);
      s.o.stop(now + 0.02);
      s.earcons.forEach((e) => e.stop(0));
    } catch {
      /* already stopped */
    }
    this.sweep = null;
  }

  stopAll() {
    this.stopSweep();
    this.releaseHold();
  }
}
