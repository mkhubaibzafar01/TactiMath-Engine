export const LANGS = {
  en: { label: 'English', code: 'en-US' },
  ur: { label: 'اردو (Urdu)', code: 'ur-PK' },
  hi: { label: 'हिन्दी (Hindi)', code: 'hi-IN' },
};

export const fmt = (v) => (Math.abs(v) < 1e-9 ? '0' : String(Number(v.toPrecision(3))));

const T = {
  en: {
    head: (a, b) => `Graph of your equation from x ${a} to ${b}.`,
    start: (y, t) => `It starts at ${y}${t ? ` and ${t}` : ''}.`,
    up: 'rises',
    down: 'falls',
    sep: ', then ',
    none: 'It never crosses zero.',
    cross: (n, l, m) => `It crosses zero ${n} ${n === 1 ? 'time' : 'times'}, at x about ${l}${m > 0 ? `, and ${m} more` : ''}.`,
    hi: (y, x) => `Highest point: ${y} at x ${x}.`,
    lo: (y, x) => `Lowest point: ${y} at x ${x}.`,
    big: 'Values grow very large in places, so the sound scale covers only the typical range.',
    gap: 'The equation has no value in some places. These sound like silence.',
  },
  ur: {
    head: (a, b) => `آپ کی مساوات کا گراف، x ${a} سے ${b} تک۔`,
    start: (y, t) => `یہ ${y} سے شروع ہوتا ہے${t ? ` اور ${t}` : ''}۔`,
    up: 'اوپر جاتا ہے',
    down: 'نیچے آتا ہے',
    sep: '، پھر ',
    none: 'یہ کبھی صفر کو نہیں کاٹتا۔',
    cross: (n, l, m) => `یہ صفر کو ${n} بار کاٹتا ہے، تقریباً x ${l} پر${m > 0 ? `، اور ${m} مزید` : ''}۔`,
    hi: (y, x) => `سب سے اونچا نقطہ: ${y}، x ${x} پر۔`,
    lo: (y, x) => `سب سے نیچا نقطہ: ${y}، x ${x} پر۔`,
    big: 'کچھ جگہ قدریں بہت بڑی ہو جاتی ہیں، اس لیے آواز کا پیمانہ عام حد تک محدود ہے۔',
    gap: 'کچھ جگہ مساوات کی کوئی قدر نہیں۔ وہاں خاموشی سنائی دیتی ہے۔',
  },
  hi: {
    head: (a, b) => `आपकी समीकरण का ग्राफ, x ${a} से ${b} तक।`,
    start: (y, t) => `यह ${y} से शुरू होता है${t ? ` और ${t}` : ''}।`,
    up: 'ऊपर जाता है',
    down: 'नीचे आता है',
    sep: ', फिर ',
    none: 'यह कभी शून्य को नहीं काटता।',
    cross: (n, l, m) => `यह शून्य को ${n} बार काटता है, लगभग x ${l} पर${m > 0 ? `, और ${m} और` : ''}।`,
    hi: (y, x) => `सबसे ऊँचा बिंदु: ${y}, x ${x} पर।`,
    lo: (y, x) => `सबसे नीचा बिंदु: ${y}, x ${x} पर।`,
    big: 'कुछ जगह मान बहुत बड़े हो जाते हैं, इसलिए आवाज़ का पैमाना सामान्य सीमा तक ही है।',
    gap: 'कुछ जगह समीकरण का कोई मान नहीं है। वहाँ चुप्पी सुनाई देती है।',
  },
};

/** Structural description of a curve in plain words. */
export function describeCurve({ curve, features }, lang = 'en') {
  const t = T[lang] || T.en;
  const f = features;
  const parts = [t.head(fmt(curve.xmin), fmt(curve.xmax))];
  const words = f.trend.slice(0, 6).map((d) => (d === 'up' ? t.up : t.down));
  if (f.start !== null) parts.push(t.start(fmt(f.start), words.join(t.sep)));
  if (f.roots.length === 0) parts.push(t.none);
  else {
    const shown = f.roots.slice(0, 5).map(fmt).join(', ');
    parts.push(t.cross(f.roots.length, shown, f.roots.length - 5));
  }
  if (f.max) parts.push(t.hi(fmt(f.max.y), fmt(f.max.x)));
  if (f.min) parts.push(t.lo(fmt(f.min.y), fmt(f.min.x)));
  if (curve.clipped) parts.push(t.big);
  if (f.gaps) parts.push(t.gap);
  return parts.join(' ');
}

/** Returns 'ok', 'novoice' (spoken with the default voice) or 'unsupported'. */
export function speak(text, code) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return 'unsupported';
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = code;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(code.slice(0, 2).toLowerCase()));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
  return voice ? 'ok' : 'novoice';
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
