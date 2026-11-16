import { describe, it, expect } from 'vitest';
import { compileCurve } from '../src/lib/latex.js';
import { sampleCurve, findFeatures } from '../src/lib/curve.js';
import { yToFreq, xToPan } from '../src/lib/audio.js';
import { describeCurve } from '../src/lib/speech.js';

const ev = (latex, x) => compileCurve(latex).fn(x);

describe('LaTeX parsing', () => {
  it('demo equation', () => {
    expect(ev('y = \\sin(x) \\cdot e^{-0.2x}', 1)).toBeCloseTo(Math.sin(1) * Math.exp(-0.2), 10);
  });
  it('fractions, roots, powers', () => {
    expect(ev('\\frac{x^2-4}{2}', 3)).toBeCloseTo(2.5, 10);
    expect(ev('\\sqrt{x+1}', 3)).toBeCloseTo(2, 10);
    expect(ev('\\sqrt[3]{x}', 27)).toBeCloseTo(3, 10);
    expect(ev('x^{2}+3x', 2)).toBeCloseTo(10, 10);
  });
  it('trig powers and inverses', () => {
    expect(ev('\\sin^2(x)+\\cos^2(x)', 0.7)).toBeCloseTo(1, 10);
    expect(ev('\\sin^{-1}(x)', 0.5)).toBeCloseTo(Math.asin(0.5), 10);
  });
  it('implicit multiplication', () => {
    expect(ev('2x(x+1)', 2)).toBeCloseTo(12, 10);
    expect(ev('x \\sin(x)', 2)).toBeCloseTo(2 * Math.sin(2), 10);
    expect(ev('(x+1)(x-1)', 3)).toBeCloseTo(8, 10);
  });
  it('absolute value, ln, log, pi', () => {
    expect(ev('|x-3|', 1)).toBeCloseTo(2, 10);
    expect(ev('\\left|x\\right|', -4)).toBeCloseTo(4, 10);
    expect(ev('\\ln(x)', Math.E)).toBeCloseTo(1, 10);
    expect(ev('\\log(x)', 100)).toBeCloseTo(2, 10);
    expect(ev('\\sin(\\pi x)', 0.5)).toBeCloseTo(1, 10);
  });
  it('friendly errors', () => {
    expect(() => compileCurve('x^2 + y^2 = 1')).toThrow(/y = f\(x\)/);
    expect(() => compileCurve('y = x + z')).toThrow(/Unknown symbol "z"/);
    expect(() => compileCurve('y = \\foo(x)')).toThrow(/not supported/);
    expect(() => compileCurve('')).toThrow(/Type an equation/);
    expect(() => compileCurve('y = \\frac{1}')).toThrow();
  });
});

describe('sampling and features', () => {
  it('parabola: roots at +-2 and a valley at 0', () => {
    const { fn } = compileCurve('y = x^2 - 4');
    const c = sampleCurve(fn, -5, 5);
    const f = findFeatures(fn, c);
    expect(f.roots).toHaveLength(2);
    expect(f.roots[0]).toBeCloseTo(-2, 6);
    expect(f.roots[1]).toBeCloseTo(2, 6);
    expect(f.extrema).toHaveLength(1);
    expect(f.extrema[0].kind).toBe('min');
    expect(f.extrema[0].y).toBeCloseTo(-4, 6);
    expect(f.trend).toEqual(['down', 'up']);
  });
  it('damped wave: roots at multiples of pi', () => {
    const { fn } = compileCurve('y = \\sin(x) \\cdot e^{-0.2x}');
    const c = sampleCurve(fn, 0, 20);
    const f = findFeatures(fn, c);
    expect(f.roots.length).toBe(7);
    expect(f.roots[1]).toBeCloseTo(Math.PI, 5);
    expect(f.roots[2]).toBeCloseTo(2 * Math.PI, 5);
    expect(f.extrema.length).toBeGreaterThanOrEqual(6);
    expect(f.extrema[0].kind).toBe('max');
  });
  it('tan: asymptote jumps are not reported as roots', () => {
    const { fn } = compileCurve('\\tan(x)');
    const c = sampleCurve(fn, -2, 2);
    const f = findFeatures(fn, c);
    expect(c.clipped).toBe(true);
    expect(f.roots).toHaveLength(1);
    expect(f.roots[0]).toBeCloseTo(0, 6);
  });
  it('1/x: gap at 0, no roots, no extrema', () => {
    const { fn } = compileCurve('\\frac{1}{x}');
    const c = sampleCurve(fn, -5, 5);
    const f = findFeatures(fn, c);
    expect(f.gaps).toBe(true);
    expect(f.roots).toHaveLength(0);
    expect(f.extrema).toHaveLength(0);
  });
  it('constant function gets a usable range', () => {
    const { fn } = compileCurve('5');
    const c = sampleCurve(fn, 0, 1);
    expect(c.yview[1]).toBeGreaterThan(c.yview[0]);
  });
  it('sqrt on negative numbers leaves gaps instead of crashing', () => {
    const { fn } = compileCurve('\\sqrt{x}');
    const c = sampleCurve(fn, -4, 4);
    expect(c.ys[0]).toBeNull();
    expect(c.ys[c.ys.length - 1]).toBeCloseTo(2, 10);
  });
});

describe('audio mapping', () => {
  it('pitch rises with y and spans 3 octaves', () => {
    expect(yToFreq(0, 0, 10)).toBeCloseTo(220, 6);
    expect(yToFreq(10, 0, 10)).toBeCloseTo(1760, 6);
    expect(yToFreq(5, 0, 10)).toBeGreaterThan(yToFreq(2, 0, 10));
  });
  it('clamps off-scale values', () => {
    expect(yToFreq(99, 0, 10)).toBeCloseTo(1760, 6);
    expect(yToFreq(-99, 0, 10)).toBeCloseTo(220, 6);
  });
  it('pan goes from left to right', () => {
    expect(xToPan(0, 0, 20)).toBe(-1);
    expect(xToPan(10, 0, 20)).toBe(0);
    expect(xToPan(20, 0, 20)).toBe(1);
  });
});

describe('speech description', () => {
  const { fn } = compileCurve('y = x^2 - 4');
  const c = sampleCurve(fn, -5, 5);
  const model = { curve: c, features: findFeatures(fn, c) };
  it('English', () => {
    const t = describeCurve(model, 'en');
    expect(t).toMatch(/crosses zero 2 times/);
    expect(t).toMatch(/falls, then rises/);
    expect(t).toMatch(/Lowest point: -4 at x 0/);
  });
  it('Urdu and Hindi are produced', () => {
    expect(describeCurve(model, 'ur')).toMatch(/صفر/);
    expect(describeCurve(model, 'hi')).toMatch(/शून्य/);
  });
});
