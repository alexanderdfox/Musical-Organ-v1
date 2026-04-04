# Sacred Heart Pipe Organ — MIDI to your DAW

How to use the organ in the browser as a **MIDI source** for **macOS** or **Windows**, so notes played in the page can trigger instruments in Logic, Ableton, FL Studio, Reaper, etc.

---

## Which pages support this?

**Web MIDI output** (the **Connect MIDI** button) is available on:

- **`v4.html`**
- **`v5.html`**
- **`v6.html`**
- **`v7.html`** (adds a **MIDI output device** menu after you connect)

Open one of these from the same folder as the rest of the project (or start from **`index.html`** and choose that version). For **v7**, keep **`v7-app.js`** next to **`v7.html`**.

**Note:** **`v1.html`**, **`v2.html`**, and **`v3.html`** can **import `.mid` files** (with **`midi-parser.js`** next to the HTML) but do **not** expose the Connect MIDI / Web MIDI output feature.

**Browser:** Google **Chrome** or Microsoft **Edge** (Web MIDI is not available in Firefox; Safari support is limited).

---

## Prerequisites

- This repo on disk (at minimum the HTML file you use plus **`midi-parser.js`** if you rely on MIDI **file** import).
- Chrome or Edge.
- A DAW (Logic Pro, GarageBand, Ableton Live, FL Studio, Reaper, etc.).
- A **virtual MIDI cable** between the browser and the DAW (setup below).

---

## macOS setup

### 1. Enable IAC Driver (built-in virtual MIDI)

1. Open **Spotlight** (`Cmd + Space`) → **Audio MIDI Setup**.
2. Menu **Window** → **Show MIDI Studio**.
3. Double-click **IAC Driver**.
4. Enable **Device is online** → **Apply**.

You should see a port such as **IAC Driver Bus 1**.

### 2. Open the organ

1. Open **`v4.html`**, **`v5.html`**, or **`v6.html`** in Chrome (or open **`index.html`** and follow the link).
2. Click **Connect MIDI**. The page should show that MIDI is connected. The app uses the **first MIDI output** the browser lists; if the DAW hears nothing, temporarily disable other MIDI outputs or change device order so **IAC Driver Bus 1** is that first output.

### 3. Arm the DAW

In **Logic / GarageBand / Ableton / Reaper**:

- Open **MIDI** preferences.
- Enable **IAC Driver Bus 1** as **MIDI input** on an instrument track.
- Play the on-screen organ; the DAW should receive **Note On/Off** and velocity.

---

## Windows setup

### 1. Virtual MIDI cable

1. Install **loopMIDI** (Tobias Erichsen):  
   [https://www.tobias-erichsen.de/software/loopmidi.html](https://www.tobias-erichsen.de/software/loopmidi.html)
2. Run loopMIDI and add a port (e.g. `Organ MIDI`).

### 2. Open the organ

1. Open **`v4.html`**, **`v5.html`**, or **`v6.html`** in Chrome or Edge.
2. Click **Connect MIDI** and confirm the status message. Same as on macOS: the **first** listed MIDI output is used—put your **loopMIDI** port first if another device steals the slot.

### 3. DAW input

In **Ableton, FL Studio, Reaper**, etc.:

- Enable your loopMIDI port as **MIDI input** on an instrument track.
- Play the browser organ; the track should respond.

---

## Importing MIDI files (playback in the browser)

On **v1–v7**, **Import MIDI File** uses **`midi-parser.js`**. Keep that file in the **same directory** as the HTML file you open. **v7** also loads **`v7-app.js`** from the same folder. Playback follows file tempo and note lengths; chords overlap in time when the file contains them. **v7** can filter by MIDI channel, loop a time range, show **lyrics** from meta events, and highlight keys during playback.

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| **Connect MIDI** does nothing | Use Chrome or Edge; avoid Firefox for Web MIDI. |
| No sound in the DAW | Confirm the virtual port is enabled as **input** on the instrument track; restart the DAW after creating a new port. |
| **Import MIDI** fails or is silent | Ensure **`midi-parser.js`** is beside the HTML file; try another `.mid` file. |
| Laggy notes | Close heavy tabs; use a wired connection if using extra MIDI gear. |
| macOS: no IAC | Re-open Audio MIDI Setup and set IAC **online** again. |

**Tip:** Keep the organ tab **active** while testing; some browsers throttle background tabs.

---

## Need more detail?

Mention your OS and DAW (e.g. “macOS + Logic” or “Windows + FL Studio”) when asking for help so routing steps can be narrowed down.

Enjoy — *Cor Jesu*.
