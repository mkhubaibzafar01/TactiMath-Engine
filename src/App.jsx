import { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import Graph from './Graph.jsx';
import { compileCurve } from './lib/latex.js';
import { sampleCurve, findFeatures } from './lib/curve.js';
import { Sonifier, yToFreq, xToPan } from './lib/audio.js';
import { describeCurve, speak, stopSpeaking, fmt, LANGS } from './lib/speech.js';

const PRESETS = [
  { name: 'Damped wave', latex: 'y = \\sin(x) \\cdot e^{-0.2x}', xmin: '0', xmax: '20' },
  { name: 'Parabola', latex: 'y = x^2 - 4', xmin: '-5', xmax: '5' },
  { name: 'Asymptote', latex: 'y = \\frac{1}{x}', xmin: '-5', xmax: '5' },
  { name: 'Two waves', latex: 'y = \\sin(x) + \\frac{\\sin(3x)}{3}', xmin: '-10', xmax: '10' },
];

function buildModel(latex, xminS, xmaxS) {
  try {
    const lo = parseFloat(xminS);
    const hi = parseFloat(xmaxS);
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && hi > lo)) throw new Error('"From" must be smaller than "To".');
    const { fn } = compileCurve(latex);
    const curve = sampleCurve(fn, lo, hi);
    if (curve.empty) throw new Error('This equation has no real values on that range.');
    return { ok: true, curve, features: findFeatures(fn, curve) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function KeyRow({ keys, children }) {
  return (
    <li className="flex items-baseline gap-3 py-1.5">
      <span className="flex min-w-[8.5rem] shrink-0 flex-wrap gap-1.5">{keys}</span>
      <span>{children}</span>
    </li>
  );
}

export default function App() {
  const [latex, setLatex] = useState(PRESETS[0].latex);
  const [xmin, setXmin] = useState(PRESETS[0].xmin);
  const [xmax, setXmax] = useState(PRESETS[0].xmax);
  const [lang, setLang] = useState('en');
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState('Press Tab to reach the graph, then use the arrow keys.');
  const [speech, setSpeech] = useState('');
  const [vibrate, setVibrate] = useState(true);

  const model = useMemo(() => buildModel(latex, xmin, xmax), [latex, xmin, xmax]);
  const lastGood = useRef(null);
  if (model.ok) lastGood.current = model;
  const shown = model.ok ? model : lastGood.current;

  const sonRef = useRef(null);
  const son = () => (sonRef.current ||= new Sonifier());
  const cursorRef = useRef(0);
  const stageRef = useRef(null);

  // New curve: stop sound and go back to the start.
  useEffect(() => {
    if (!model.ok) return;
    sonRef.current?.stopAll();
    setPlaying(false);
    setCursor(0);
    cursorRef.current = 0;
  }, [model]);

  const preview = useMemo(() => {
    try {
      return katex.renderToString(latex, { throwOnError: false, displayMode: true });
    } catch {
      return '';
    }
  }, [latex]);

  const description = useMemo(() => (shown ? describeCurve(shown, lang) : ''), [shown, lang]);

  const buzz = (pattern) => {
    if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  };

  const setPos = (i) => {
    cursorRef.current = i;
    setCursor(i);
  };

  const moveTo = (raw) => {
    if (!shown) return;
    const { curve, features } = shown;
    const n = curve.xs.length;
    const i = Math.max(0, Math.min(n - 1, raw));
    const prev = cursorRef.current;
    son().stopSweep();
    setPlaying(false);
    setPos(i);
    const x = curve.xs[i];
    const y = curve.ys[i];
    const pan = xToPan(x, curve.xmin, curve.xmax);
    if (y === null) {
      son().blip({ freq: 70, pan, dur: 0.25, type: 'sawtooth', gain: 0.15 });
      setNote(`x ${fmt(x)}: no value here`);
      return;
    }
    const off = y < curve.yview[0] || y > curve.yview[1];
    son().blip({
      freq: yToFreq(y, curve.yview[0], curve.yview[1]),
      pan,
      dur: 0.22,
      type: off ? 'sawtooth' : 'sine',
      gain: off ? 0.15 : 0.35,
    });
    const hits = [];
    if (i !== prev) {
      const xlo = curve.xs[Math.min(prev, i)];
      const xhi = curve.xs[Math.max(prev, i)];
      if (features.roots.some((r) => r > xlo && r <= xhi)) hits.push('root');
      if (features.extrema.some((e) => e.x > xlo && e.x <= xhi)) hits.push('peak');
    }
    if (hits.includes('root')) son().earcon('root', pan, 0.12);
    if (hits.includes('peak')) son().earcon('peak', pan, hits.includes('root') ? 0.25 : 0.12);
    if (hits.length) buzz(hits.includes('root') ? [30] : [15, 40, 15]);
    const tag = hits.map((h) => (h === 'root' ? 'crossed zero' : 'peak or valley')).join(', ');
    setNote(`x ${fmt(x)}, y ${fmt(y)}${off ? ' (off the sound scale)' : ''}${tag ? `, ${tag}` : ''}`);
  };

  const jump = (kind, dir) => {
    if (!shown) return;
    const { curve, features } = shown;
    const n = curve.xs.length;
    const cx = curve.xs[cursorRef.current];
    const list =
      kind === 'root'
        ? features.roots.map((x) => ({ x, y: 0, kind: 'root' }))
        : features.extrema.map((e) => ({ x: e.x, y: e.y, kind: e.kind }));
    const eps = ((curve.xmax - curve.xmin) / (n - 1)) * 0.5;
    const target = dir > 0 ? list.find((f) => f.x > cx + eps) : [...list].reverse().find((f) => f.x < cx - eps);
    son().stopSweep();
    setPlaying(false);
    if (!target) {
      son().blip({ freq: 70, dur: 0.2, type: 'sawtooth', gain: 0.12 });
      setNote(kind === 'root' ? 'No more roots in that direction.' : 'No more peaks or valleys in that direction.');
      return;
    }
    setPos(Math.round(((target.x - curve.xmin) / (curve.xmax - curve.xmin)) * (n - 1)));
    const pan = xToPan(target.x, curve.xmin, curve.xmax);
    son().blip({ freq: yToFreq(target.y, curve.yview[0], curve.yview[1]), pan, dur: 0.25 });
    son().earcon(kind === 'root' ? 'root' : 'peak', pan, 0.1);
    buzz(kind === 'root' ? [30] : [15, 40, 15]);
    const what = target.kind === 'root' ? 'Root' : target.kind === 'max' ? 'Peak' : 'Valley';
    setNote(target.kind === 'root' ? `Root at x ${fmt(target.x)}` : `${what}: y ${fmt(target.y)} at x ${fmt(target.x)}`);
  };

  const togglePlay = () => {
    if (!shown) return;
    if (playing) {
      son().stopSweep();
      setPlaying(false);
      setNote('Stopped.');
      return;
    }
    stopSpeaking();
    setPlaying(true);
    setNote('Playing the whole curve, left to right.');
    son().playSweep(shown.curve, shown.features, 6, {
      onProgress: (i) => setPos(i),
      onEnd: () => {
        setPlaying(false);
        setNote('End of the curve.');
      },
    });
  };

  const describe = () => {
    if (!shown) return;
    son().stopSweep();
    setPlaying(false);
    const status = speak(description, LANGS[lang].code);
    setSpeech(
      status === 'unsupported'
        ? 'This browser cannot speak. The description is shown as text and can be read by a screen reader or Braille display.'
        : status === 'novoice'
          ? `No ${LANGS[lang].label} voice found on this device, so the default voice is used. The text below is always available.`
          : '',
    );
    setNote('Reading the description.');
  };

  const referenceTone = () => {
    if (!shown) return;
    const { curve } = shown;
    if (curve.yview[0] > 0 || curve.yview[1] < 0) {
      setNote('Zero is outside the visible height range.');
      return;
    }
    son().blip({ freq: yToFreq(0, curve.yview[0], curve.yview[1]), pan: 0, dur: 0.5, gain: 0.3 });
    setNote('This is the pitch of y = 0. Higher means above zero.');
  };

  const onKeyDown = (e) => {
    if (!shown || e.ctrlKey || e.metaKey || e.altKey) return;
    const c = cursorRef.current;
    const n = shown.curve.xs.length;
    let handled = true;
    switch (e.key) {
      case 'ArrowRight': moveTo(c + (e.shiftKey ? 10 : 1)); break;
      case 'ArrowLeft': moveTo(c - (e.shiftKey ? 10 : 1)); break;
      case 'ArrowUp': moveTo(c + 5); break;
      case 'ArrowDown': moveTo(c - 5); break;
      case 'PageUp': moveTo(c + 25); break;
      case 'PageDown': moveTo(c - 25); break;
      case 'Home': moveTo(0); break;
      case 'End': moveTo(n - 1); break;
      case 'r': jump('root', 1); break;
      case 'R': jump('root', -1); break;
      case 'e': jump('extremum', 1); break;
      case 'E': jump('extremum', -1); break;
      case 's': case 'S': describe(); break;
      case 'z': case 'Z': referenceTone(); break;
      case ' ': togglePlay(); break;
      case 'Escape':
        son().stopAll();
        stopSpeaking();
        setPlaying(false);
        setNote('Stopped.');
        break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  };

  const onScrub = (i) => {
    if (i === null || !shown) {
      return;
    }
    const { curve } = shown;
    if (playing) {
      son().stopSweep();
      setPlaying(false);
    }
    setPos(i);
    const y = curve.ys[i];
    if (y === null) return;
    const off = y < curve.yview[0] || y > curve.yview[1];
    son().holdTone(yToFreq(y, curve.yview[0], curve.yview[1]), xToPan(curve.xs[i], curve.xmin, curve.xmax), off);
    setNote(`x ${fmt(curve.xs[i])}, y ${fmt(y)}`);
  };

  const usePreset = (p) => {
    setLatex(p.latex);
    setXmin(p.xmin);
    setXmax(p.xmax);
  };

  const cx = shown ? shown.curve.xs[cursor] : 0;
  const cy = shown ? shown.curve.ys[cursor] : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <h1 className="text-4xl font-bold tracking-tight">TactiMath</h1>
        <p className="text-lg text-mute">Type an equation. Hear its shape.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Controls */}
        <section aria-label="Equation" className="rounded-3xl bg-white p-5 shadow-[0_1px_0_var(--color-line)] ring-1 ring-line">
          <label htmlFor="latex" className="block text-lg font-bold">Equation (LaTeX)</label>
          <input
            id="latex"
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-describedby="latex-help latex-error"
            className="mt-2 w-full rounded-xl border-2 border-ink bg-white px-3 py-2.5 font-mono text-lg"
          />
          <p id="latex-help" className="mt-1 text-base text-mute">Example: y = \sin(x) \cdot e^{'{-0.2x}'}</p>

          <div id="latex-error" role="alert" className="min-h-[1.5rem]">
            {!model.ok && <p className="mt-2 rounded-xl bg-[#ffe3e8] px-3 py-2 font-bold text-[#8a1030]">{model.error}</p>}
          </div>

          {preview && (
            <div className="mt-2 rounded-xl bg-page px-3 py-1" aria-hidden="true" dangerouslySetInnerHTML={{ __html: preview }} />
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="xmin" className="block font-bold">From x</label>
              <input id="xmin" inputMode="decimal" value={xmin} onChange={(e) => setXmin(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-2 font-mono" />
            </div>
            <div>
              <label htmlFor="xmax" className="block font-bold">To x</label>
              <input id="xmax" inputMode="decimal" value={xmax} onChange={(e) => setXmax(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-2 font-mono" />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="font-bold">Examples</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => usePreset(p)} className="rounded-full border-2 border-ink bg-white px-4 py-1.5 font-bold hover:bg-page">
                  {p.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-3">
            <button
              onClick={togglePlay}
              disabled={!shown}
              className="rounded-2xl bg-action px-5 py-3.5 text-lg font-bold text-white disabled:opacity-40"
            >
              {playing ? 'Stop' : 'Play the whole curve'}
            </button>
            <button
              onClick={() => stageRef.current?.focus()}
              disabled={!shown}
              className="rounded-2xl border-2 border-ink bg-white px-5 py-3 text-lg font-bold disabled:opacity-40"
            >
              Explore with the keyboard
            </button>
          </div>

          <div className="mt-5">
            <label htmlFor="lang" className="block font-bold">Description language</label>
            <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-2.5">
              {Object.entries(LANGS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button onClick={describe} disabled={!shown} className="mt-3 w-full rounded-2xl border-2 border-ink bg-white px-5 py-3 text-lg font-bold disabled:opacity-40">
              Read the description aloud
            </button>
          </div>

          <label className="mt-4 flex items-center gap-3">
            <input type="checkbox" checked={vibrate} onChange={(e) => setVibrate(e.target.checked)} className="h-5 w-5" />
            <span>Vibrate at roots and peaks (phones)</span>
          </label>
        </section>

        {/* Stage */}
        <section aria-label="Graph" className="min-w-0">
          <div
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Interactive graph. Use the left and right arrow keys to move along the curve. Press S to hear a description."
            aria-roledescription="sound graph"
            onKeyDown={onKeyDown}
            className="stage-focus rounded-[22px] bg-stage p-3 sm:p-4"
          >
            {shown ? (
              <Graph curve={shown.curve} features={shown.features} cursor={cursor} onScrub={onScrub} dim={!model.ok} />
            ) : (
              <p className="p-10 text-center text-lg text-[#b9c0e6]">Type an equation to see and hear it.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-1 font-mono text-lg text-white">
              <span>x = {fmt(cx)}</span>
              <span>y = {cy === null || cy === undefined ? 'no value' : fmt(cy)}</span>
            </div>
          </div>

          <div aria-live="polite" role="status" className="mt-3 min-h-[2rem] rounded-xl bg-white px-4 py-2 text-lg font-bold ring-1 ring-line">
            {note}
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
              <h2 className="text-xl font-bold">How to listen</h2>
              <ul className="mt-2 text-base">
                <li className="py-1"><b>Higher on the graph</b> sounds higher in pitch.</li>
                <li className="py-1"><b>Left to right</b> moves from the left ear to the right ear. Use headphones.</li>
                <li className="py-1"><b>Low tick</b>: the curve crosses zero.</li>
                <li className="py-1"><b>High bell</b>: a peak or a valley.</li>
                <li className="py-1"><b>Buzzy tone</b>: the value is beyond the sound scale.</li>
                <li className="py-1"><b>Silence</b>: the equation has no value there.</li>
              </ul>
            </div>
            <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
              <h2 className="text-xl font-bold">Keyboard</h2>
              <ul className="mt-2 text-base">
                <KeyRow keys={<><kbd>←</kbd><kbd>→</kbd></>}>Step along the curve. Hold <kbd>Shift</kbd> for bigger steps.</KeyRow>
                <KeyRow keys={<><kbd>Home</kbd><kbd>End</kbd></>}>Jump to the start or end.</KeyRow>
                <KeyRow keys={<kbd>R</kbd>}>Next root. <kbd>Shift</kbd>+<kbd>R</kbd> goes back.</KeyRow>
                <KeyRow keys={<kbd>E</kbd>}>Next peak or valley. <kbd>Shift</kbd>+<kbd>E</kbd> goes back.</KeyRow>
                <KeyRow keys={<kbd>Space</kbd>}>Play or stop the whole curve.</KeyRow>
                <KeyRow keys={<kbd>S</kbd>}>Read the description aloud.</KeyRow>
                <KeyRow keys={<kbd>Z</kbd>}>Hear the pitch of zero.</KeyRow>
                <KeyRow keys={<kbd>Esc</kbd>}>Stop all sound.</KeyRow>
              </ul>
              <p className="mt-2 text-base text-mute">With a mouse or finger, drag across the graph to hear it.</p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-white p-5 ring-1 ring-line">
            <h2 className="text-xl font-bold">Description</h2>
            <p className="mt-2" lang={lang} dir={lang === 'ur' ? 'rtl' : 'ltr'}>{description || 'Type an equation to get a description.'}</p>
            {speech && <p className="mt-2 text-base text-mute">{speech}</p>}
          </div>
        </section>
      </div>

      <footer className="mt-10 max-w-3xl text-base text-mute">
        TactiMath runs entirely in your browser. Nothing you type is sent anywhere. It supports equations of the form y = f(x). This is a prototype and has not yet been tested with blind students.
      </footer>
    </div>
  );
}
