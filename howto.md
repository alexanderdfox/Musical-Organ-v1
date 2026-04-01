# Sacred Heart Pipe Organ - MIDI Setup Guide

How to use the Sacred Heart Pipe Organ web app as a **MIDI device** on **macOS** and **Windows**.

---

## Prerequisites

- The organ HTML file (`sacred-heart-organ.html`)
- Google Chrome (recommended) or Microsoft Edge
- Your DAW (Logic Pro, GarageBand, Ableton Live, FL Studio, Reaper, etc.)

---

## macOS Setup

### Step 1: Enable IAC Driver (macOS built-in virtual MIDI)

1. Open **Spotlight** (`Cmd + Space`) and search for **Audio MIDI Setup**
2. Open **Audio MIDI Setup**
3. Go to menu bar → **Window** → **Show MIDI Studio**
4. Double-click on **IAC Driver**
5. Check the box **"Device is online"**
6. Click **Apply**

You should now have a port called **"IAC Driver Bus 1"**

### Step 2: Open the Organ

1. Open the `sacred-heart-organ.html` file in **Google Chrome**
2. Click the button **🎹 Connect MIDI**
3. It should show "✅ MIDI Connected"

### Step 3: Connect to Your DAW

In **Logic Pro / GarageBand / Ableton / Reaper**:
- Go to Preferences → MIDI Settings
- Enable **IAC Driver Bus 1** as a MIDI Input
- Create a Software Instrument track
- Play the organ in Chrome → sound should come from your DAW

---

## Windows Setup

### Step 1: Install Virtual MIDI Cable

1. Download and install **LoopMIDI** (free and reliable):
   - https://www.tobias-erichsen.de/software/loopmidi.html
2. Run LoopMIDI
3. Click **"+"** to create a new port
4. Name it something like `Organ MIDI Out`

### Step 2: Open the Organ

1. Open the `sacred-heart-organ.html` file in **Google Chrome** or **Microsoft Edge**
2. Click **🎹 Connect MIDI**
3. It should show "✅ MIDI Connected"

### Step 3: Connect to Your DAW

In **Ableton Live, FL Studio, Reaper, Cakewalk**, etc.:

- Go to MIDI / Preferences settings
- Enable the virtual port you created (`Organ MIDI Out` or similar) as **MIDI Input**
- Load any virtual instrument
- Play the organ in the browser → it should trigger your DAW

---

## Troubleshooting

| Problem                        | Solution |
|-------------------------------|----------|
| "Connect MIDI" does nothing   | Use Chrome/Edge, not Firefox or Safari |
| No sound in DAW               | Make sure the correct MIDI Input port is enabled |
| Notes are delayed             | Close other tabs, restart browser |
| Can't see virtual port        | Restart your DAW after creating the virtual port |
| macOS - No IAC Driver         | Re-open Audio MIDI Setup and enable it |

### Pro Tips

- Keep the Chrome tab with the organ **visible** (don't minimize)
- You can play using mouse, touch, computer keyboard, or external MIDI keyboard
- The organ sends **MIDI Note On/Off** with velocity

---

## Need Help?

Reply with your operating system and DAW (e.g., "macOS + Logic Pro" or "Windows + FL Studio") and I’ll give you more specific instructions.

Enjoy making music with the Sacred Heart Pipe Organ! ❤️🎹
