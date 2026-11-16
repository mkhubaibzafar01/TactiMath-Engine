/** Sample fn over [xmin, xmax]. Invalid values become null. */
export function sampleCurve(fn, xmin, xmax, n = 401) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    const x = xmin + ((xmax - xmin) * i) / (n - 1);
    xs.push(x);
    const y = fn(x);
    ys.push(Number.isFinite(y) ? y : null);
  }
  const finite = ys.filter((v) => v !== null).sort((a, b) => a - b);
  if (!finite.length) return { xs, ys, yview: [-1, 1], clipped: false, empty: true, xmin, xmax, n };

  const min = finite[0];
  const max = finite[finite.length - 1];
  const q = (p) => finite[Math.min(finite.length - 1, Math.max(0, Math.round(p * (finite.length - 1))))];
  const lo = q(0.02);
  const hi = q(0.98);
  let a = min;
  let b = max;
  let clipped = false;
  // Asymptotes: keep the typical range so the audio scale stays usable.
  if (hi > lo && max - min > 4 * (hi - lo)) {
    const pad = 0.1 * (hi - lo);
    a = lo - pad;
    b = hi + pad;
    clipped = true;
  }
  if (b - a < 1e-12) {
    a -= 1;
    b += 1;
  } else if (!clipped) {
    const pad = 0.06 * (b - a);
    a -= pad;
    b += pad;
  }
  return { xs, ys, yview: [a, b], clipped, empty: false, xmin, xmax, n };
}

/** Roots, peaks/valleys, extremes and a simple "rises, falls" trend. */
export function findFeatures(fn, curve) {
  const { xs, ys, yview } = curve;
  const n = xs.length;
  const range = yview[1] - yview[0];
  const dx = xs[1] - xs[0];

  const roots = [];
  const addRoot = (x) => {
    if (!roots.some((r) => Math.abs(r - x) < dx * 0.75)) roots.push(x);
  };
  for (let i = 0; i < n; i++) {
    const y = ys[i];
    if (y === null) continue;
    if (y === 0) {
      addRoot(xs[i]);
      continue;
    }
    const y2 = i < n - 1 ? ys[i + 1] : null;
    if (y2 !== null && y2 !== 0 && y * y2 < 0 && Math.abs(y - y2) < 0.5 * range) {
      let lo = xs[i];
      let hi = xs[i + 1];
      let flo = y;
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        const fm = fn(mid);
        if (!Number.isFinite(fm)) break;
        if (fm === 0) {
          lo = hi = mid;
          break;
        }
        if (fm * flo < 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      const r = (lo + hi) / 2;
      const fr = fn(r);
      // reject jumps across asymptotes: the value at the "root" must really be near zero
      if (Number.isFinite(fr) && Math.abs(fr) <= 0.02 * range + 1e-9) addRoot(r);
    }
  }
  roots.sort((a, b) => a - b);

  const extrema = [];
  const eps = 1e-9 * range;
  for (let i = 1; i < n - 1; i++) {
    const a = ys[i - 1];
    const b = ys[i];
    const c = ys[i + 1];
    if (a === null || b === null || c === null) continue;
    const isMax = b > a + eps && b > c + eps;
    const isMin = b < a - eps && b < c - eps;
    if (!isMax && !isMin) continue;
    const sign = isMax ? 1 : -1;
    let lo = xs[i - 1];
    let hi = xs[i + 1];
    for (let k = 0; k < 60; k++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      const f1 = fn(m1) * sign;
      const f2 = fn(m2) * sign;
      if (!Number.isFinite(f1) || !Number.isFinite(f2)) break;
      if (f1 < f2) lo = m1;
      else hi = m2;
    }
    const x = (lo + hi) / 2;
    const y = fn(x);
    extrema.push({ x, y: Number.isFinite(y) ? y : b, kind: isMax ? 'max' : 'min' });
  }

  let maxPt = null;
  let minPt = null;
  let firstY = null;
  let gaps = false;
  for (let i = 0; i < n; i++) {
    const y = ys[i];
    if (y === null) {
      gaps = true;
      continue;
    }
    if (firstY === null) firstY = y;
    if (!maxPt || y > maxPt.y) maxPt = { x: xs[i], y };
    if (!minPt || y < minPt.y) minPt = { x: xs[i], y };
  }

  let dir0 = null;
  for (let i = 0; i < n - 1; i++) {
    if (ys[i] !== null && ys[i + 1] !== null && ys[i + 1] !== ys[i]) {
      dir0 = ys[i + 1] > ys[i] ? 'up' : 'down';
      break;
    }
  }
  const trend = [];
  if (dir0) trend.push(dir0);
  for (const e of extrema) {
    const d = e.kind === 'max' ? 'down' : 'up';
    if (trend[trend.length - 1] !== d) trend.push(d);
  }

  return { roots, extrema, max: maxPt, min: minPt, start: firstY, trend, gaps };
}
