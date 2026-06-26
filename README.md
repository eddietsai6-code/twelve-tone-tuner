# Twelve Tone Tuner

A dependency-free browser tuner for 12-tone equal temperament. It listens through the Web Audio API, detects pitch with a local autocorrelation helper, and shows the result on a vintage VU-style meter.

## Features

- 12-tone equal temperament note detection
- Frequency readout in Hz
- Closest note, octave, target Hz, and cents offset
- Vintage analog VU meter interface
- Green tuned state when the pitch is within plus or minus 5 cents
- Adjustable A4 reference from 400 Hz to 480 Hz
- No runtime dependencies, backend, CDN, or account required

## Quick Start

Serve the project from localhost so the browser can use microphone access:

```powershell
npm run serve
```

Then open:

```text
http://127.0.0.1:4188/
```

Click `Start` and allow microphone access in the browser.

## Tests

```powershell
npm test
```

The test suite covers:

- A4 and C4 12-TET conversion
- signed cents offsets
- tuned threshold behavior
- VU needle angle mapping
- generated sine-wave pitch detection
- quiet-input rejection

## Project Structure

```text
twelve-tone-tuner/
  index.html
  assets/
    app.js
    styles.css
    tuner-core.js
  tests/
    core.test.mjs
```

## Notes

Microphone input requires a secure browser context. `http://127.0.0.1` and `http://localhost` are treated as secure for local development by modern browsers.

This project was built after reviewing existing open-source browser tuner projects. It does not bundle or depend on their source packages; the implementation is local and MIT licensed.

## License

MIT
