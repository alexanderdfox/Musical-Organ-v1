# Sacred Heart Pipe Organ

Interactive **Sacred Heart** pipe organ in the browser: canvas art, Web Audio organ tone, hymns, custom melodies, and MIDI file import. Some versions also send notes to external gear or a DAW over **Web MIDI**.

## Quick start

1. Clone or download this repository.
2. Open **`index.html`** in a modern browser, or open any version file directly.
3. For **Import MIDI File** to work, keep **`midi-parser.js`** in the **same folder** as the HTML file (required for `v1.html`–`v7.html`; **`v7.html`** also needs **`v7-app.js`** beside it).

Using a local static server (optional) avoids any `file://` quirks:

```bash
# example
npx --yes serve .
```

Then visit the URL shown and open `index.html`.

## Versions

| File | Summary |
|------|---------|
| **`index.html`** | Hub with links to all organ versions |
| **`v1.html`** | Original organ, two auto hymns, MIDI **file** import |
| **`v2.html`** | Six hymns, custom melody text, MIDI **file** import |
| **`v3.html`** | Like v2 + computer keyboard mapping |
| **`v4.html`** | Like v3 + **Web MIDI output** (Connect MIDI), Opera/Chrome/Edge |
| **`v5.html`** | Piano-style keys, **16 MIDI channels**, Web MIDI output |
| **`v6.html`** | **Multi-manual** keyboards (presets + JSON layouts), Web MIDI output |
| **`v7.html`** | v6 + themes, accessibility, per-manual voice/MIDI channels, swell, **MIDI in**, responsive layout, metronome, import filters & lyrics, export `.mid`, **`v7-app.js`** |

## Features

- **Touch and mouse** on on-screen keys (layout varies by version).
- **Computer keyboard** on v3–v7 (mappings shown in the UI where applicable).
- **Hymns / chord / custom text** melodies (scope varies by version).
- **MIDI file import** (`.mid` / `.midi`): standard MIDI file parsing in **`midi-parser.js`** (tempo map, note on/off pairing, timed playback; v7 also exposes **`parseMidiImport()`** for channel metadata and lyrics). Used by all `v1`–`v7` pages.
- **Web MIDI output** (to a virtual cable and then a DAW): **`v4.html`**–**`v7.html`** — see **`howto.md`**. v7 adds an **output device** dropdown.

## Project files

| Item | Role |
|------|------|
| `index.html` | Landing page / version picker |
| `v1.html` … `v7.html` | Organ apps |
| `midi-parser.js` | Shared SMF → note list; `parseMidiFile` + `parseMidiImport` |
| `v7-app.js` | Logic for **`v7.html`** only |
| `scripts/build-v7-inline.mjs` | Builds **`dist/v7.inline.html`** (single-file v7, no extra `.js`) |
| `test/midi-parser.mjs` | Quick sanity check: `node test/midi-parser.mjs` |
| `howto.md` | Routing browser MIDI into macOS / Windows DAWs |
| `LICENSE` | [Unlicense](https://unlicense.org/) (public domain) |

## Tech

- Vanilla HTML, CSS, JavaScript (optional **inline** build for v7 only).
- **Web Audio API** for synthesis.
- **Canvas** for the heart, pipes, and keys.
- **Web MIDI API** where supported (output v4–v7; MIDI input v7).

## Mobile

- Touch works on the key areas; first user gesture may be required to unlock audio on iOS.
- Layout is scrollable so controls stay reachable on small screens.
- **v7** scales the canvas with the page width and offers a **pedal-friendly** key shape for the lowest manual.

## Inspiration

A digital tribute to the **Immaculate Heart of Jesus** — *Cor Jesu, miserere nobis*.

## License

This project is released under the **Unlicense**; see **`LICENSE`**.

Contributions welcome: hymns, sound tweaks, or artwork — keep the spirit reverent and the stack simple.
