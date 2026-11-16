# TactiMath: verified evidence and prior art

Checked on 16 Nov 2026. Do not put anything in the pitch that is not on this page.

## Claim in the original brief that is NOT supported

"WHO and UNESCO report that over 90% of visually impaired children in low-income settings lack accessible STEM materials."

I could not find this statistic. Do not quote it. Jurors who know the field may challenge it.

## Statistics that ARE sourced (use these instead)

| Fact | Source |
|---|---|
| Only 1% of learning materials are available in accessible formats for blind and partially sighted readers | World Blind Union study, cited in the World Economic Forum article "93 million children with disabilities risk missing education" (2019) |
| 32.5 million children with disabilities in low- and middle-income countries are out of school | Education Commission, 2016, same article |
| Only 5-15% of children who need assistive devices have access to them | WHO, same article |

Link: https://www.weforum.org/stories/2019/09/93-million-children-with-disabilities-risk-missing-education/

Note: none of these is STEM-specific. In the pitch say "accessible learning materials", not "accessible STEM materials", unless you find a STEM-specific source.

## Prior art (judges may know these)

1. **Audiofunctions** (University of Turin, Laboratorio "S. Polin", public since 2019). Web-based. Maps x to stereo pan and f(x) to pitch. Keyboard arrows move a point along the curve. Almost the same core mechanism as TactiMath. A 2025 paper reports one interview with a blind maths graduate, not classroom data.
   https://univda.iris.cineca.it/retrieve/35644857-2010-447d-9093-22ca71dcaf82/Manolino%20et%20al.%20%282025%29.%20Audiofunctions%20Miriam.%20CERME%2014.pdf
2. **MathTrax** (NASA). Graph sonification for blind and low-vision students.
   https://www.w3.org/dpub/IG/wiki/MathSonifyA11y

So "nobody has done audio graphs" is false. Do not say it.

## What TactiMath adds (honest differentiators to test and pitch)

- Type **LaTeX** directly, with a rendered preview for sighted teachers.
- **Landmarks by sound**: separate cues for roots (low tick) and peaks/valleys (high bell), and keys to jump between them (R, E).
- **Spoken description** of the curve's shape in English, Urdu and Hindi.
- **Runs in the browser, nothing uploaded**: works offline after the first load and costs nothing to host.
- Handles asymptotes and undefined regions explicitly (silence, buzzy tone) instead of misleading the listener.

## Changes from the original brief

- **Python/SymPy removed.** A Python backend contradicts "runs entirely in the browser". Parsing is done in JavaScript (math.js).
- **"Mouse haptic feedback" removed.** Browsers cannot make a mouse vibrate. The app uses the Vibration API, which works on many Android phones only, and does not work on iPhone Safari.
- **3D / multi-variable equations are out of scope** for now. Say so openly.

## What still needs real evidence (Problem & insight = 20 marks)

- Talk to one blind or low-vision student, teacher or a school for the blind. Even 10 minutes and one quote is worth more than any statistic.
- Ask whether they already use Audiofunctions, MathTrax, or a screen reader's math mode, and what is missing.
