import { useMemo, useRef } from 'react';

const W = 800;
const H = 460;
const M = { l: 54, r: 18, t: 18, b: 40 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function ticks(min, max, count = 5) {
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}
const label = (v) => String(Number(v.toPrecision(3)));

export default function Graph({ curve, features, cursor, onScrub, dim }) {
  const { xs, ys, yview, xmin, xmax } = curve;
  const [a, b] = yview;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const sx = (x) => M.l + ((x - xmin) / (xmax - xmin)) * iw;
  const sy = (y) => M.t + (1 - (clamp(y, a, b) - a) / (b - a)) * ih;
  const svgRef = useRef(null);

  const paths = useMemo(() => {
    const segs = [];
    let cur = [];
    const flush = () => {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    };
    for (let i = 0; i < xs.length; i++) {
      const y = ys[i];
      if (y === null || y < a || y > b) {
        // undefined, or beyond the visible range (asymptote): end the line instead of drawing a flat edge
        flush();
        continue;
      }
      if (cur.length && Math.abs(y - ys[i - 1]) > 0.6 * (b - a)) flush();
      cur.push(`${sx(xs[i]).toFixed(1)},${sy(y).toFixed(1)}`);
    }
    flush();
    return segs.map((s) => 'M' + s.join('L'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve]);

  const toIdx = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = clamp((px - M.l) / iw, 0, 1);
    return Math.round(t * (xs.length - 1));
  };

  const cy = ys[cursor];
  const xt = ticks(xmin, xmax);
  const yt = ticks(a, b);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`block w-full select-none ${dim ? 'opacity-40' : ''}`}
      style={{ touchAction: 'none' }}
      role="img"
      aria-label="Graph of your equation"
      onPointerMove={(e) => onScrub(toIdx(e))}
      onPointerDown={(e) => onScrub(toIdx(e))}
      onPointerLeave={() => onScrub(null)}
    >
      {yt.map((v) => (
        <g key={`y${v}`}>
          <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="#ffffff" strokeOpacity="0.09" />
          <text x={M.l - 8} y={sy(v) + 4} textAnchor="end" fontSize="13" fill="#b9c0e6">{label(v)}</text>
        </g>
      ))}
      {xt.map((v) => (
        <g key={`x${v}`}>
          <line y1={M.t} y2={H - M.b} x1={sx(v)} x2={sx(v)} stroke="#ffffff" strokeOpacity="0.09" />
          <text x={sx(v)} y={H - M.b + 20} textAnchor="middle" fontSize="13" fill="#b9c0e6">{label(v)}</text>
        </g>
      ))}
      {a < 0 && b > 0 && <line x1={M.l} x2={W - M.r} y1={sy(0)} y2={sy(0)} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.5" />}
      {xmin < 0 && xmax > 0 && <line x1={sx(0)} x2={sx(0)} y1={M.t} y2={H - M.b} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.5" />}

      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--color-curve)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {features.roots.map((r) => (
        <circle key={`r${r}`} cx={sx(r)} cy={sy(0)} r="7" fill="var(--color-root)" stroke="#0d1230" strokeWidth="2" />
      ))}
      {features.extrema.map((e) => (
        <rect
          key={`e${e.x}`}
          x={sx(e.x) - 6}
          y={sy(e.y) - 6}
          width="12"
          height="12"
          transform={`rotate(45 ${sx(e.x)} ${sy(e.y)})`}
          fill="var(--color-peak)"
          stroke="#0d1230"
          strokeWidth="2"
        />
      ))}

      <line x1={sx(xs[cursor])} x2={sx(xs[cursor])} y1={M.t} y2={H - M.b} stroke="var(--color-cursor)" strokeWidth="2" strokeDasharray="5 5" />
      {cy !== null && cy !== undefined && (
        <circle cx={sx(xs[cursor])} cy={sy(cy)} r="9" fill="var(--color-cursor)" stroke="#0d1230" strokeWidth="3" />
      )}
    </svg>
  );
}
