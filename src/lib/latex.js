import { compile } from 'mathjs';

// LaTeX name -> mathjs name
const FN = {
  arcsin: 'asin', arccos: 'acos', arctan: 'atan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  ln: 'log', log: 'log10', exp: 'exp',
};
const FN_NAMES = Object.keys(FN).sort((a, b) => b.length - a.length);
const INVERSE = { sin: 'asin', cos: 'acos', tan: 'atan' };

function matchClose(s, i, open, close) {
  let d = 0;
  for (let k = i; k < s.length; k++) {
    if (s[k] === open) d++;
    else if (s[k] === close) {
      d--;
      if (d === 0) return k;
    }
  }
  return -1;
}

function replaceFrac(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const m = /^\\(?:d|t)?frac(?![a-zA-Z])/.exec(s.slice(i));
    if (m) {
      let j = i + m[0].length;
      while (s[j] === ' ') j++;
      if (s[j] === '{') {
        const e1 = matchClose(s, j, '{', '}');
        if (e1 > 0) {
          let k = e1 + 1;
          while (s[k] === ' ') k++;
          if (s[k] === '{') {
            const e2 = matchClose(s, k, '{', '}');
            if (e2 > 0) {
              out += ` ((${convert(s.slice(j + 1, e1))})/(${convert(s.slice(k + 1, e2))})) `;
              i = e2 + 1;
              continue;
            }
          }
        }
      }
      throw new Error('Could not read a fraction. Write it as \\frac{top}{bottom}.');
    }
    out += s[i];
    i++;
  }
  return out;
}

function replaceSqrt(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const m = /^\\sqrt(?![a-zA-Z])/.exec(s.slice(i));
    if (m) {
      let j = i + m[0].length;
      let root = null;
      if (s[j] === '[') {
        const e = s.indexOf(']', j);
        if (e < 0) throw new Error('Could not read a root. Write it as \\sqrt[n]{...}.');
        root = s.slice(j + 1, e);
        j = e + 1;
      }
      while (s[j] === ' ') j++;
      if (s[j] === '{') {
        const e = matchClose(s, j, '{', '}');
        if (e > 0) {
          const a = convert(s.slice(j + 1, e));
          out += root ? ` nthRoot(${a}, ${convert(root)}) ` : ` sqrt(${a}) `;
          i = e + 1;
          continue;
        }
      }
      throw new Error('Could not read a square root. Write it as \\sqrt{...}.');
    }
    out += s[i];
    i++;
  }
  return out;
}

function readArg(s, j) {
  while (s[j] === ' ') j++;
  if (s[j] === '(') {
    const e = matchClose(s, j, '(', ')');
    if (e < 0) throw new Error('Unbalanced parentheses.');
    return { arg: s.slice(j + 1, e), end: e + 1 };
  }
  if (s[j] === '{') {
    const e = matchClose(s, j, '{', '}');
    if (e < 0) throw new Error('Unbalanced braces.');
    return { arg: s.slice(j + 1, e), end: e + 1 };
  }
  const m = /^-?[a-zA-Z0-9.]+/.exec(s.slice(j));
  if (m) return { arg: m[0], end: j + m[0].length };
  throw new Error('A function such as \\sin needs something to act on, for example \\sin(x).');
}

function replaceFunctions(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\') {
      const name = FN_NAMES.find((n) => s.startsWith(n, i + 1) && !/[a-zA-Z]/.test(s[i + 1 + n.length] || ''));
      if (name) {
        let j = i + 1 + name.length;
        let pow = null;
        while (s[j] === ' ') j++;
        if (s[j] === '^') {
          j++;
          if (s[j] === '{') {
            const e = matchClose(s, j, '{', '}');
            if (e < 0) throw new Error('Unbalanced braces.');
            pow = s.slice(j + 1, e).trim();
            j = e + 1;
          } else {
            pow = s[j];
            j++;
          }
        }
        const { arg, end } = readArg(s, j);
        const inner = replaceFunctions(arg);
        if (pow === '-1' && INVERSE[name]) {
          out += ` ${INVERSE[name]}(${inner}) `;
        } else {
          const call = `${FN[name]}(${inner})`;
          out += pow ? ` ((${call})^(${convert(pow)})) ` : ` ${call} `;
        }
        i = end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

function convert(input) {
  let s = input
    .replace(/\$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\(lvert|rvert|vert)(?![a-zA-Z])/g, '|')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\(cdot|times)(?![a-zA-Z])/g, '*')
    .replace(/\\div(?![a-zA-Z])/g, '/')
    .replace(/\\pi(?![a-zA-Z])/g, ' pi ');

  s = replaceFrac(s);
  s = replaceSqrt(s);
  s = replaceFunctions(s);

  const bars = (s.match(/\|/g) || []).length;
  if (bars % 2) throw new Error('The | | absolute-value bars are not balanced.');
  let open = true;
  s = s.replace(/\|/g, () => {
    const r = open ? ' abs(' : ') ';
    open = !open;
    return r;
  });

  const bad = /\\([a-zA-Z]+)/.exec(s);
  if (bad) throw new Error(`The command \\${bad[1]} is not supported yet.`);

  s = s.replace(/\{/g, '(').replace(/\}/g, ')');
  // implicit multiplication before "(": 2(x+1), x(x+1), (a)(b)
  s = s.replace(/(?<![a-zA-Z0-9_.])([0-9.]+)\s*\(/g, '$1*(');
  s = s.replace(/(?<![a-zA-Z_])x\s*\(/g, 'x*(');
  s = s.replace(/\)\s*\(/g, ')*(');
  return s.trim();
}

/** Turn "y = \sin(x) \cdot e^{-0.2x}" into a mathjs expression string. */
export function latexToExpr(latex) {
  let s = String(latex || '').trim();
  if (!s) throw new Error('Type an equation to begin.');
  if (s.includes('=')) {
    const parts = s.split('=');
    if (parts.length === 2 && /^\s*(y|f\s*\(\s*x\s*\))\s*$/.test(parts[0])) s = parts[1];
    else throw new Error('Only equations of the form y = f(x) are supported for now.');
  }
  return convert(s);
}

/** Returns { expr, fn } where fn(x) is a real number or NaN. */
export function compileCurve(latex) {
  const expr = latexToExpr(latex);
  let code;
  try {
    code = compile(expr);
  } catch {
    throw new Error('Could not read that expression. Check the brackets and operators.');
  }
  try {
    code.evaluate({ x: 1 });
  } catch (e) {
    const m = /Undefined symbol (\w+)/.exec(e.message);
    if (m) throw new Error(`Unknown symbol "${m[1]}". Use x as the variable.`);
  }
  const fn = (x) => {
    try {
      const v = code.evaluate({ x });
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };
  return { expr, fn };
}
