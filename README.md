# TactiMath

Type an equation, hear its graph. Runs fully in the browser.

## Run
    npm install
    npm run dev        # open the address it prints
    npm test           # 17 unit tests
    npm run build      # output in dist/, drag that folder to Netlify

## Layout
- src/lib/latex.js   LaTeX -> math.js expression
- src/lib/curve.js   sampling, roots, peaks, trend
- src/lib/audio.js   Web Audio: pitch = height, stereo pan = position, landmark sounds
- src/lib/speech.js  spoken description (English, Urdu, Hindi)
- src/App.jsx, src/Graph.jsx   interface and keyboard controls
- research/evidence.md   verified statistics and prior art (read before pitching)
