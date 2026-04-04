/* global parseMidiFile, parseMidiImport */
'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: true });

let heartX = canvas.width / 2;
let heartY = 228;
let heartScale = 1;
let layoutScale = 1;
let flameIntensity = 0;
let pipes = [];
let manuals = [];
let flatKeys = [];
let keyBindings = {};
let audioContext;
let isPlayingSong = false;
let songTimeoutIds = [];
let midiChannel = 1;
let manualStops = [];
let midiOutChannels = [];
let swellGain = 1;
let midiOutput = null;
let midiAccess = null;
let midiInputOn = false;
let pendingImport = null;
let recording = false;
let recordStart = 0;
let recordNotes = [];
let metronomeTimer = null;
const midiSynthVoices = new Map();
let customParams = { osc1: 'sawtooth', osc2: 'sine', filter: 2600, detune: 0 };

const OSC_TYPES = ['sawtooth', 'square', 'triangle', 'sine'];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const LAYOUT_PRESETS = {
	single: [{ name: 'Great', from: 'C3', to: 'B4', y: 518 }],
	dual: [
		{ name: 'Swell', from: 'C4', to: 'B5', y: 400 },
		{ name: 'Great', from: 'C3', to: 'B4', y: 528 }
	],
	triple: [
		{ name: 'Swell', from: 'C5', to: 'C6', y: 322 },
		{ name: 'Great', from: 'C3', to: 'B4', y: 458 },
		{ name: 'Pedal', from: 'C2', to: 'E3', y: 588 }
	]
};

const KEY_POOLS = [
	['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", '\\', 'z', 'x', 'c', 'v'],
	['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '1', '2', '3', '4'],
	['5', '6', '7', '8', '9', '0', '-', '=', 'n', 'm', ',', '.', '/', '`', 'b', 'v']
];

const DEFAULT_CUSTOM_JSON = `[
  { "name": "Swell", "from": "C4", "to": "B5", "y": 400 },
  { "name": "Great", "from": "C3", "to": "B4", "y": 528 }
]`;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function isBlackMidi(m) {
	const pc = m % 12;
	return [1, 3, 6, 8, 10].includes(pc);
}

function midiToFreq(m) {
	return 440 * Math.pow(2, (m - 69) / 12);
}

function midiToLabel(m) {
	const oct = Math.floor(m / 12) - 1;
	return NOTE_NAMES[(m % 12 + 12) % 12] + oct;
}

function parseNoteToMidi(s) {
	const str = String(s).trim();
	const m = str.match(/^([A-Ga-g])([#b]?)(\d+)$/);
	if (!m) return null;
	let pc = LETTER_PC[m[1].toUpperCase()];
	if (m[2] === '#') pc++;
	if (m[2] === 'b') pc--;
	const oct = parseInt(m[3], 10);
	return (oct + 1) * 12 + pc;
}

function buildManual(spec, centerX, opt) {
	opt = opt || {};
	const sc = opt.scale != null ? opt.scale : 1;
	const pedalWide = !!opt.pedalWide;
	const midiLo = parseNoteToMidi(spec.from);
	const midiHi = parseNoteToMidi(spec.to);
	if (midiLo == null || midiHi == null || midiLo > midiHi) return [];

	let whiteSpacing = 38 * sc;
	let whiteW = 36 * sc;
	let blackW = 26 * sc;
	let whiteH = 88 * sc;
	let blackH = 56 * sc;
	if (pedalWide) {
		whiteSpacing *= 1.18;
		whiteW *= 1.12;
		whiteH *= 0.72;
		blackH *= 0.72;
	}
	const baseY = spec.y * sc;

	const midis = [];
	for (let m = midiLo; m <= midiHi; m++) midis.push(m);
	const whiteMidis = midis.filter(m => !isBlackMidi(m));
	if (!whiteMidis.length) return [];

	const totalW = (whiteMidis.length - 1) * whiteSpacing;
	const leftWhiteX = centerX - totalW / 2;
	const midiToWhiteX = new Map();
	whiteMidis.forEach((m, i) => {
		midiToWhiteX.set(m, leftWhiteX + i * whiteSpacing);
	});

	const mi = spec.manualIndex != null ? spec.manualIndex : 0;
	const keys = [];
	for (const m of whiteMidis) {
		const x = midiToWhiteX.get(m);
		keys.push({
			x,
			y: baseY,
			width: whiteW,
			height: whiteH,
			pressed: false,
			playbackGlow: 0,
			freq: midiToFreq(m),
			label: midiToLabel(m),
			isBlack: false,
			offset: 0,
			midi: m,
			manualIndex: mi,
			manualName: spec.name
		});
	}

	for (const m of midis) {
		if (!isBlackMidi(m)) continue;
		let pw = m - 1;
		while (pw >= midiLo && isBlackMidi(pw)) pw--;
		let nw = m + 1;
		while (nw <= midiHi && isBlackMidi(nw)) nw++;
		const xPrev = midiToWhiteX.get(pw);
		const xNext = midiToWhiteX.get(nw);
		if (xPrev === undefined || xNext === undefined) continue;
		const x = (xPrev + xNext) / 2;
		keys.push({
			x,
			y: baseY - 16 * sc,
			width: blackW,
			height: blackH,
			pressed: false,
			playbackGlow: 0,
			freq: midiToFreq(m),
			label: '',
			isBlack: true,
			offset: 0,
			midi: m,
			manualIndex: mi,
			manualName: spec.name
		});
	}
	return keys;
}

function assignKeyBindings() {
	keyBindings = {};
	manuals.forEach((man, mi) => {
		const pool = KEY_POOLS[mi % KEY_POOLS.length] || KEY_POOLS[0];
		const ordered = [...man.keys].sort((a, b) => a.midi - b.midi);
		ordered.forEach((k, i) => {
			if (i < pool.length) keyBindings[pool[i]] = k;
		});
	});
	const parts = [];
	manuals.forEach((man, mi) => {
		const pool = KEY_POOLS[mi % KEY_POOLS.length];
		const ordered = [...man.keys].sort((a, b) => a.midi - b.midi);
		const chars = ordered.slice(0, pool.length).map((k, i) => pool[i]).join(' ');
		if (chars) parts.push('<strong>' + man.name + '</strong>: ' + chars);
	});
	document.getElementById('keybind-hint').innerHTML =
		parts.join('<br>') + '<br>MIDI v7 • themes • per-manual voice &amp; output channel';
}

function voiceSelectOptions() {
	const opts = [
		['diapason', 'Diapason'],
		['flute', 'Flute'],
		['reed', 'Reed'],
		['string', 'String'],
		['full', 'Full Chorus'],
		['piano', 'Piano'],
		['custom', 'Custom preset']
	];
	return opts.map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('');
}

function refreshManualVoiceUI() {
	const wrap = document.getElementById('manual-voice-rows');
	const defStop = document.getElementById('organ-stop').value;
	while (manualStops.length < manuals.length) {
		manualStops.push(defStop);
		midiOutChannels.push(manualStops.length);
	}
	manualStops.length = manuals.length;
	midiOutChannels.length = manuals.length;
	for (let i = 0; i < manuals.length; i++) {
		if (!midiOutChannels[i]) midiOutChannels[i] = i + 1;
	}
	wrap.innerHTML = '';
	manuals.forEach((man, i) => {
		const row = document.createElement('div');
		row.style.marginBottom = '8px';
		const chOpts = [];
		for (let c = 1; c <= 16; c++) chOpts.push('<option value="' + c + '">' + c + '</option>');
		row.innerHTML =
			'<label>' +
			man.name +
			' stop <select data-mv="' +
			i +
			'" class="manual-stop-sel">' +
			voiceSelectOptions() +
			'</select></label> ' +
			'<label>MIDI out ch <select data-mch="' +
			i +
			'" class="manual-ch-sel">' +
			chOpts.join('') +
			'</select></label>';
		wrap.appendChild(row);
		const ss = row.querySelector('.manual-stop-sel');
		ss.value = manualStops[i] || defStop;
		ss.onchange = () => {
			manualStops[i] = ss.value;
		};
		const cs = row.querySelector('.manual-ch-sel');
		cs.value = String(midiOutChannels[i] || i + 1);
		cs.onchange = () => {
			midiOutChannels[i] = parseInt(cs.value, 10);
		};
	});
}

function rebuildFromLayout(layoutKey, customJson) {
	let specs;
	if (layoutKey === 'custom') {
		try {
			specs = JSON.parse(customJson);
			if (!Array.isArray(specs) || !specs.length) throw new Error('Need a non-empty array');
		} catch (err) {
			alert('Invalid JSON: ' + err.message);
			return;
		}
	} else {
		specs = LAYOUT_PRESETS[layoutKey];
	}
	const pedalMode = document.getElementById('pedal-mode').checked;
	manuals = [];
	flatKeys = [];
	specs.forEach((s, mi) => {
		const pedalWide = pedalMode && mi === specs.length - 1;
		const keys = buildManual(
			{ name: s.name || 'Manual', from: s.from, to: s.to, y: s.y, manualIndex: mi },
			heartX,
			{ scale: layoutScale, pedalWide: pedalWide }
		);
		manuals.push({ name: s.name || 'Manual', keys: keys });
		keys.forEach(k => flatKeys.push(k));
	});
	refreshManualVoiceUI();
	assignKeyBindings();
}

function initAudio() {
	if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
	if (audioContext.state === 'suspended') audioContext.resume();
}

function stopMidiSynthVoice(deviceCh, noteNum) {
	if (!audioContext) return;
	const mk = (deviceCh << 8) | (noteNum & 0x7f);
	const v = midiSynthVoices.get(mk);
	if (!v) return;
	const now = audioContext.currentTime;
	try {
		v.gain.gain.cancelScheduledValues(now);
		const cur = Math.max(0.0001, Math.min(1, v.gain.gain.value));
		v.gain.gain.setValueAtTime(cur, now);
		v.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
	} catch (e) {
		/* ignore */
	}
	try {
		v.osc1.stop(now + 0.12);
		v.osc2.stop(now + 0.12);
	} catch (e) {
		/* ignore */
	}
	midiSynthVoices.delete(mk);
}

function configureOscForStop(stop, osc1, osc2, filter) {
	filter.frequency.value = stop === 'piano' ? 2800 : 2600;
	if (stop === 'piano') {
		osc1.type = 'triangle';
		osc2.type = 'sine';
	} else if (stop === 'custom') {
		osc1.type = customParams.osc1;
		osc2.type = customParams.osc2;
		osc1.detune.value = customParams.detune;
		osc2.detune.value = -customParams.detune;
		filter.frequency.value = customParams.filter;
	} else {
		osc1.type = 'sawtooth';
		osc2.type = 'sine';
	}
	if (stop === 'piano') osc2.frequency.value = 0;
}

function playNote(freq, duration, velocity, opts) {
	opts = opts || {};
	initAudio();
	const mi = opts.manualIndex != null ? opts.manualIndex : 0;
	let stop = opts.stopOverride || manualStops[mi] || document.getElementById('organ-stop').value;
	if (stop === 'piano' && opts.stopOverride == null) {
		/* keep */
	}
	let vel = velocity * (opts.gainMul != null ? opts.gainMul : 1);
	if (mi === 0) vel *= swellGain;
	vel = Math.min(1, Math.max(0.02, vel));

	const now = audioContext.currentTime;
	const osc1 = audioContext.createOscillator();
	const osc2 = audioContext.createOscillator();
	const gain = audioContext.createGain();
	const filter = audioContext.createBiquadFilter();
	filter.type = 'lowpass';
	configureOscForStop(stop, osc1, osc2, filter);
	if (stop === 'piano') {
		osc2.frequency.value = freq * 2.01;
	} else {
		osc2.frequency.value = freq * 2;
	}
	osc1.frequency.value = freq;

	gain.gain.setValueAtTime(0.001, now);
	gain.gain.linearRampToValueAtTime(vel, now + 0.04);
	gain.gain.linearRampToValueAtTime(vel * 0.52, now + (duration / 1000) * 0.68);
	gain.gain.linearRampToValueAtTime(0.001, now + duration / 1000 + 0.5);

	osc1.connect(filter);
	osc2.connect(filter);
	filter.connect(gain);
	gain.connect(audioContext.destination);
	if (opts.midiTrack) {
		const dch = opts.midiTrack.ch & 0x0f;
		const nn = opts.midiTrack.note & 0x7f;
		const mk = (dch << 8) | nn;
		stopMidiSynthVoice(dch, nn);
		midiSynthVoices.set(mk, { osc1: osc1, osc2: osc2, gain: gain });
		setTimeout(() => {
			midiSynthVoices.delete(mk);
		}, Math.ceil(duration + 700));
	}

	osc1.start(now);
	osc2.start(now);
	osc1.stop(now + duration / 1000 + 0.6);
	osc2.stop(now + duration / 1000 + 0.6);

	if (!reducedMotion()) flameIntensity = Math.min(3.5, flameIntensity + 0.9);

	if (midiOutput && opts.sendMidi !== false) {
		const note = Math.round(69 + 12 * Math.log2(freq / 440));
		const ch = (midiOutChannels[mi] != null ? midiOutChannels[mi] : midiChannel) - 1;
		const st = 0x90 | ch;
		midiOutput.send([st, note, Math.floor(vel * 127)]);
		setTimeout(() => {
			if (midiOutput) midiOutput.send([0x80 | ch, note, 0]);
		}, duration);
	}

	if (recording && opts.record !== false) {
		recordNotes.push({
			t: performance.now() - recordStart,
			midi: Math.round(69 + 12 * Math.log2(freq / 440)),
			dur: duration,
			vel: vel
		});
	}
}

function playMetroClick() {
	if (!audioContext) return;
	const t = audioContext.currentTime;
	const o = audioContext.createOscillator();
	const g = audioContext.createGain();
	o.type = 'sine';
	o.frequency.value = 1100;
	o.connect(g);
	g.connect(audioContext.destination);
	const v = 0.12;
	g.gain.setValueAtTime(v, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
	o.start(t);
	o.stop(t + 0.05);
}

const hymns = {
	corjesu: [
		{ freq: 261.63, duration: 600 },
		{ freq: 329.63, duration: 600 },
		{ freq: 392, duration: 1200 },
		{ freq: 440, duration: 600 },
		{ freq: 392, duration: 600 },
		{ freq: 329.63, duration: 1200 },
		{ freq: 261.63, duration: 800 },
		{ freq: 293.66, duration: 400 },
		{ freq: 329.63, duration: 800 },
		{ freq: 392, duration: 1600 }
	],
	avemaria: [
		{ freq: 523.25, duration: 800 },
		{ freq: 587.33, duration: 400 },
		{ freq: 659.25, duration: 800 },
		{ freq: 783.99, duration: 1200 },
		{ freq: 698.46, duration: 600 },
		{ freq: 659.25, duration: 600 },
		{ freq: 587.33, duration: 800 },
		{ freq: 523.25, duration: 1600 }
	],
	tantum: [
		{ freq: 392, duration: 600 },
		{ freq: 440, duration: 600 },
		{ freq: 493.88, duration: 600 },
		{ freq: 523.25, duration: 1200 },
		{ freq: 493.88, duration: 600 },
		{ freq: 440, duration: 600 },
		{ freq: 392, duration: 1200 }
	],
	panis: [
		{ freq: 349.23, duration: 800 },
		{ freq: 392, duration: 400 },
		{ freq: 440, duration: 800 },
		{ freq: 466.16, duration: 1200 },
		{ freq: 440, duration: 800 },
		{ freq: 392, duration: 800 },
		{ freq: 349.23, duration: 1600 }
	],
	amazing: [
		{ freq: 392, duration: 600 },
		{ freq: 523.25, duration: 900 },
		{ freq: 659.25, duration: 600 },
		{ freq: 523.25, duration: 600 },
		{ freq: 659.25, duration: 1200 },
		{ freq: 587.33, duration: 600 },
		{ freq: 523.25, duration: 900 }
	]
};

function highlightKeyByMidi(noteNum, duration) {
	flatKeys.forEach(k => {
		if (k.midi === noteNum) k.playbackGlow = 1;
	});
	if (duration > 30) {
		setTimeout(() => {
			flatKeys.forEach(k => {
				if (k.midi === noteNum) k.playbackGlow = 0;
			});
		}, duration);
	}
}

function playSong(notes, songOpts) {
	songOpts = songOpts || {};
	if (isPlayingSong || !notes.length) return;
	initAudio();
	isPlayingSong = true;
	document.getElementById('lyric-display').textContent = '';
	const useAbs = typeof notes[0].startTime === 'number';
	const defStop = document.getElementById('organ-stop').value;

	if (songOpts.lyrics && songOpts.lyrics.length) {
		songOpts.lyrics.forEach(line => {
			const id = setTimeout(() => {
				document.getElementById('lyric-display').textContent = line.text;
			}, line.startTime);
			songTimeoutIds.push(id);
		});
	}

	if (useAbs) {
		let maxEnd = 0;
		notes.forEach(n => {
			const v = n.velocity != null ? n.velocity : 0.72;
			const id = setTimeout(() => {
				if (document.getElementById('metro-click-import').checked) playMetroClick();
				playNote(n.freq, n.duration || 800, v, {
					stopOverride: defStop,
					manualIndex: 0,
					gainMul: 1,
					record: false
				});
				if (songOpts.highlight && n.midiNote != null) highlightKeyByMidi(n.midiNote, Math.min(n.duration || 500, 1200));
			}, n.startTime);
			songTimeoutIds.push(id);
			maxEnd = Math.max(maxEnd, n.startTime + (n.duration || 800));
		});
		songTimeoutIds.push(
			setTimeout(() => {
				isPlayingSong = false;
				document.getElementById('lyric-display').textContent = '';
			}, maxEnd + 800)
		);
	} else {
		let time = 0;
		notes.forEach(n => {
			const id = setTimeout(() => {
				playNote(n.freq, n.duration || 800, 0.72, { stopOverride: defStop, manualIndex: 0, record: false });
				if (songOpts.highlight && n.midi != null) highlightKeyByMidi(n.midi, n.duration || 500);
			}, time);
			songTimeoutIds.push(id);
			time += (n.duration || 800) * 0.92;
		});
		songTimeoutIds.push(
			setTimeout(() => {
				isPlayingSong = false;
			}, time + 800)
		);
	}
}

function stopSong() {
	songTimeoutIds.forEach(clearTimeout);
	songTimeoutIds = [];
	isPlayingSong = false;
	document.getElementById('lyric-display').textContent = '';
}

function initPipes() {
	pipes = [];
	const startX = heartX - 280 * layoutScale;
	for (let i = 0; i < 13; i++) {
		const x = startX + i * 45 * layoutScale;
		const height = (170 + Math.abs(i - 6) * -28 + Math.random() * 35) * layoutScale;
		pipes.push({ x: x, height: height, glow: 0 });
	}
}

function drawSacredHeart() {
	ctx.save();
	ctx.translate(heartX, heartY);
	ctx.scale(heartScale, heartScale);
	ctx.fillStyle = '#8b0000';
	ctx.strokeStyle = typeof getComputedStyle !== 'undefined' ? getComputedStyle(document.body).color : '#ffd700';
	ctx.lineWidth = 18 * layoutScale;
	ctx.beginPath();
	ctx.moveTo(0, 80);
	ctx.bezierCurveTo(-110, -40, -140, 60, 0, 160);
	ctx.bezierCurveTo(140, 60, 110, -40, 0, 80);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#ff4444';
	ctx.beginPath();
	ctx.moveTo(0, 95);
	ctx.bezierCurveTo(-85, 10, -105, 75, 0, 135);
	ctx.bezierCurveTo(105, 75, 85, 10, 0, 95);
	ctx.fill();
	ctx.restore();
}

function drawPipes() {
	pipes.forEach(p => {
		const g = Math.max(0, p.glow);
		ctx.fillStyle = '#c0c0c0';
		ctx.fillRect(p.x - 14 * layoutScale, heartY - p.height - 42 * layoutScale, 28 * layoutScale, p.height);
		ctx.fillStyle = '#b8860b';
		ctx.fillRect(p.x - 18 * layoutScale, heartY - p.height - 58 * layoutScale, 36 * layoutScale, 24 * layoutScale);
		ctx.fillStyle = 'rgba(255,255,200,' + (0.5 + g) + ')';
		ctx.fillRect(p.x - 11 * layoutScale, heartY - p.height - 48 * layoutScale, 9 * layoutScale, p.height);
		p.glow *= 0.89;
	});
}

function drawKeys() {
	manuals.forEach(man => {
		const minY = Math.min(...man.keys.map(k => k.y - (k.isBlack ? 16 * layoutScale : 0) - k.height / 2));
		ctx.save();
		ctx.fillStyle = 'rgba(255,215,0,0.75)';
		ctx.font = 'bold ' + Math.max(10, 14 * layoutScale) + 'px Cinzel';
		ctx.textAlign = 'left';
		ctx.fillText(man.name, 24 * layoutScale, minY - 10 * layoutScale);
		ctx.restore();
	});
	flatKeys.forEach(k => {
		if (!k.isBlack) {
			ctx.save();
			ctx.translate(k.x, k.y);
			const g = k.playbackGlow || 0;
			ctx.fillStyle = k.pressed ? '#ddd' : g > 0.2 ? 'rgba(255,240,200,' + (0.5 + g * 0.5) + ')' : '#eee';
			ctx.fillRect(-k.width / 2, -k.height / 2, k.width, k.height);
			ctx.strokeStyle = typeof getComputedStyle !== 'undefined' ? getComputedStyle(document.body).color : '#ffd700';
			ctx.lineWidth = 4 * layoutScale;
			ctx.strokeRect(-k.width / 2 + 4 * layoutScale, -k.height / 2 + 4 * layoutScale, k.width - 8 * layoutScale, k.height - 8 * layoutScale);
			ctx.fillStyle = '#4a0000';
			ctx.font = 'bold ' + Math.max(9, 12 * layoutScale) + 'px Cinzel';
			ctx.textAlign = 'center';
			ctx.fillText(k.label, 0, 28 * layoutScale);
			ctx.restore();
			if (g > 0) k.playbackGlow *= 0.88;
		}
	});
	flatKeys.forEach(k => {
		if (k.isBlack) {
			ctx.save();
			ctx.translate(k.x + k.offset, k.y - 14 * layoutScale);
			const g = k.playbackGlow || 0;
			ctx.fillStyle = k.pressed ? '#222' : g > 0.2 ? '#333' : '#111';
			ctx.fillRect(-k.width / 2, -k.height / 2, k.width, k.height);
			ctx.strokeStyle = typeof getComputedStyle !== 'undefined' ? getComputedStyle(document.body).color : '#ffd700';
			ctx.lineWidth = 3 * layoutScale;
			ctx.strokeRect(-k.width / 2 + 3 * layoutScale, -k.height / 2 + 3 * layoutScale, k.width - 6 * layoutScale, k.height - 6 * layoutScale);
			ctx.restore();
			if (g > 0) k.playbackGlow *= 0.88;
		}
	});
}

function drawFrame() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	const grad = ctx.createRadialGradient(heartX, heartY + 80 * layoutScale, 120 * layoutScale, heartX, heartY + 320 * layoutScale, 520 * layoutScale);
	grad.addColorStop(0, 'rgba(255,90,90,0.14)');
	grad.addColorStop(1, 'transparent');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	drawPipes();
	drawSacredHeart();
	drawKeys();
	if (reducedMotion()) heartScale = 1;
	else heartScale = 1 + Math.sin(Date.now() / 920) * 0.013;
	flameIntensity = Math.max(0, flameIntensity * 0.87);
}

function animate() {
	drawFrame();
	requestAnimationFrame(animate);
}

function hitTestKey(pos) {
	for (let i = flatKeys.length - 1; i >= 0; i--) {
		const key = flatKeys[i];
		const kx = key.x + (key.isBlack ? key.offset : 0);
		const ky = key.y + (key.isBlack ? -14 * layoutScale : 0);
		if (Math.abs(pos.x - kx) < key.width / 2 + 12 * layoutScale && Math.abs(pos.y - ky) < key.height / 2 + 12 * layoutScale) {
			return key;
		}
	}
	return null;
}

function pointerVelocity(e) {
	if (e.touches && e.touches[0]) {
		const f = e.touches[0].force;
		if (f != null && f > 0) return Math.max(0.25, Math.min(1, f));
	}
	if (typeof e.pressure === 'number' && e.pressure > 0) return Math.max(0.28, Math.min(1, e.pressure));
	return 0.82;
}

function handleStart(e) {
	e.preventDefault();
	initAudio();
	const rect = canvas.getBoundingClientRect();
	const scaleX = canvas.width / rect.width;
	const scaleY = canvas.height / rect.height;
	const clientX = e.touches ? e.touches[0].clientX : e.clientX;
	const clientY = e.touches ? e.touches[0].clientY : e.clientY;
	const pos = {
		x: (clientX - rect.left) * scaleX,
		y: (clientY - rect.top) * scaleY
	};
	const key = hitTestKey(pos);
	if (key) {
		key.pressed = true;
		const v = pointerVelocity(e);
		playNote(key.freq, 1350, v, { manualIndex: key.manualIndex });
		if (!reducedMotion()) flameIntensity = 1.7;
	}
}

function handleEnd() {
	flatKeys.forEach(k => {
		k.pressed = false;
	});
}

function handleKeyDown(e) {
	if (e.repeat) return;
	const k = keyBindings[e.key.toLowerCase()];
	if (e.key === '\\') {
		const bk = keyBindings['\\'];
		if (bk) {
			bk.pressed = true;
			playNote(bk.freq, 950, 0.8, { manualIndex: bk.manualIndex });
			if (!reducedMotion()) flameIntensity = 1.6;
		}
		return;
	}
	if (k) {
		k.pressed = true;
		playNote(k.freq, 950, 0.8, { manualIndex: k.manualIndex });
		if (!reducedMotion()) flameIntensity = 1.6;
	}
}

function handleKeyUp(e) {
	let k = keyBindings[e.key.toLowerCase()];
	if (e.key === '\\') k = keyBindings['\\'];
	if (k) k.pressed = false;
}

function populateMidiOutputs() {
	const sel = document.getElementById('midi-output-select');
	sel.innerHTML = '';
	if (!midiAccess) {
		sel.disabled = true;
		sel.innerHTML = '<option value="">Connect first…</option>';
		return;
	}
	const outs = Array.from(midiAccess.outputs.values());
	if (!outs.length) {
		sel.disabled = true;
		sel.innerHTML = '<option value="">No outputs</option>';
		return;
	}
	sel.disabled = false;
	outs.forEach((port, i) => {
		const o = document.createElement('option');
		o.value = port.id;
		o.textContent = port.name || 'Output ' + (i + 1);
		sel.appendChild(o);
	});
	sel.onchange = () => {
		midiOutput = midiAccess.outputs.get(sel.value) || null;
	};
	midiOutput = outs[0];
	sel.value = outs[0].id;
}

async function connectMIDI() {
	if (!navigator.requestMIDIAccess) {
		alert('Web MIDI not supported. Use Chrome or Edge.');
		return;
	}
	try {
		midiAccess = await navigator.requestMIDIAccess({ sysex: false });
		document.getElementById('midi-status').textContent = 'MIDI: connected — pick output below';
		populateMidiOutputs();
		if (midiInputOn) attachMidiInputs();
	} catch (err) {
		alert('MIDI connection failed');
	}
}

function attachMidiInputs() {
	if (!midiAccess) return;
	midiAccess.inputs.forEach(inp => {
		inp.onmidimessage = onMidiInMessage;
	});
	document.getElementById('midi-in-status').textContent =
		'MIDI in: ' + midiAccess.inputs.size + ' input(s) — routed to manuals (see target below)';
}

function detachMidiInputs() {
	if (!midiAccess) return;
	midiAccess.inputs.forEach(inp => {
		inp.onmidimessage = null;
	});
	document.getElementById('midi-in-status').textContent = '';
}

let midiInTargetManual = 0;
let midiInChannelFilter = -1;

function onMidiInMessage(ev) {
	const [st, n, vel] = ev.data;
	const ch = st & 0x0f;
	if (midiInChannelFilter >= 0 && ch !== midiInChannelFilter) return;
	const hi = st & 0xf0;
	if (hi === 0x90 && vel > 0) {
		const freq = midiToFreq(n);
		const mi = Math.min(midiInTargetManual, manuals.length - 1);
		if (mi < 0) return;
		playNote(freq, 8000, Math.max(0.2, vel / 127), {
			manualIndex: mi,
			sendMidi: false,
			record: true,
			midiTrack: { ch: ch, note: n }
		});
		flatKeys.forEach(k => {
			if (k.midi === n && k.manualIndex === mi) k.pressed = true;
		});
	} else if (hi === 0x80 || (hi === 0x90 && vel === 0)) {
		stopMidiSynthVoice(ch, n);
		flatKeys.forEach(k => {
			if (k.midi === n) k.pressed = false;
		});
	}
}

function updateLayoutScale() {
	const cw = document.querySelector('.container').clientWidth - 24;
	layoutScale = Math.min(1, Math.max(0.45, cw / 920));
	canvas.width = Math.floor(920 * layoutScale);
	canvas.height = Math.floor(720 * layoutScale);
	heartX = canvas.width / 2;
	heartY = Math.floor(228 * layoutScale);
	applyLayoutFromSelect();
	initPipes();
}

function parseMelodyLine(parts) {
	const noteStr = parts[0];
	const m = noteStr.match(/^([A-Ga-g])([#b]?)(\d+)/);
	if (!m) return null;
	let pc = LETTER_PC[m[1].toUpperCase()];
	if (m[2] === '#') pc++;
	if (m[2] === 'b') pc--;
	const oct = parseInt(m[3], 10);
	const midi = (oct + 1) * 12 + pc;
	const freq = midiToFreq(midi);
	return { freq: freq, duration: parseFloat(parts[1]) || 800, midi: midi };
}

function updateLayoutUI() {
	const sel = document.getElementById('keyboard-layout').value;
	document.getElementById('layout-custom-wrap').style.display = sel === 'custom' ? 'block' : 'none';
}

function applyLayoutFromSelect() {
	const sel = document.getElementById('keyboard-layout').value;
	const json = document.getElementById('keyboard-json').value || DEFAULT_CUSTOM_JSON;
	rebuildFromLayout(sel, json);
}

function writeVLQ(n) {
	const arr = [];
	arr.unshift(n & 0x7f);
	while ((n >>= 7)) {
		arr.unshift((n & 0x7f) | 0x80);
	}
	return arr;
}

function buildMidiFileFromNotes(noteList) {
	const tpq = 480;
	const usPerQ = 500000;
	const msPerTick = usPerQ / 1000 / tpq;
	const trk = [0x00, 0xff, 0x51, 0x03, (usPerQ >> 16) & 0xff, (usPerQ >> 8) & 0xff, usPerQ & 0xff];
	let lastTick = 0;
	noteList.forEach(ev => {
		const tick = Math.max(0, Math.round(ev.t / msPerTick));
		const deltaOn = tick - lastTick;
		writeVLQ(deltaOn).forEach(b => trk.push(b));
		trk.push(0x90, ev.midi & 0x7f, Math.min(127, Math.floor((ev.vel || 0.7) * 127)));
		const durTick = Math.max(1, Math.round(ev.dur / msPerTick));
		writeVLQ(durTick).forEach(b => trk.push(b));
		trk.push(0x80, ev.midi & 0x7f, 0x00);
		lastTick = tick + durTick;
	});
	trk.push(0x00, 0xff, 0x2f, 0x00);
	const trkLen = trk.length;
	const header = [
		0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (tpq >> 8) & 0xff, tpq & 0xff,
		0x4d, 0x54, 0x72, 0x6b,
		(trkLen >> 24) & 0xff,
		(trkLen >> 16) & 0xff,
		(trkLen >> 8) & 0xff,
		trkLen & 0xff
	];
	return new Uint8Array(header.concat(trk));
}

function downloadBlob(buf, name) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([buf], { type: 'audio/midi' }));
	a.download = name;
	a.click();
	URL.revokeObjectURL(a.href);
}

function startMetronome() {
	stopMetronome();
	const bpm = parseInt(document.getElementById('metro-bpm').value, 10) || 72;
	const ms = 60000 / bpm;
	metronomeTimer = setInterval(() => {
		if (document.getElementById('metro-on').checked) playMetroClick();
	}, ms);
}

function stopMetronome() {
	if (metronomeTimer) {
		clearInterval(metronomeTimer);
		metronomeTimer = null;
	}
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('touchstart', handleStart, { passive: false });
window.addEventListener('mouseup', handleEnd);
window.addEventListener('touchend', handleEnd);
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

document.getElementById('theme-select').onchange = e => {
	document.body.setAttribute('data-theme', e.target.value);
};

document.getElementById('midi-connect').onclick = connectMIDI;
document.getElementById('midi-in-toggle').onclick = () => {
	midiInputOn = !midiInputOn;
	if (midiInputOn) {
		if (!midiAccess) connectMIDI();
		else attachMidiInputs();
		document.getElementById('midi-in-toggle').textContent = '🎹 MIDI in (on)';
	} else {
		detachMidiInputs();
		document.getElementById('midi-in-toggle').textContent = '🎹 MIDI in';
	}
};

document.getElementById('organ-stop').onchange = e => {
	document.getElementById('custom-presets').style.display = e.target.value === 'custom' ? 'block' : 'none';
	refreshManualVoiceUI();
};
document.getElementById('midi-channel').onchange = e => {
	midiChannel = parseInt(e.target.value, 10);
};

document.getElementById('swell-gain').oninput = e => {
	const v = parseInt(e.target.value, 10) / 100;
	swellGain = v;
	document.getElementById('swell-val').textContent = String(Math.round(v * 100));
};

document.getElementById('pedal-mode').onchange = () => applyLayoutFromSelect();
document.getElementById('metro-on').onchange = () => {
	if (document.getElementById('metro-on').checked) startMetronome();
	else stopMetronome();
};
document.getElementById('metro-bpm').onchange = () => {
	if (document.getElementById('metro-on').checked) startMetronome();
};

document.getElementById('keyboard-layout').onchange = () => {
	updateLayoutUI();
	applyLayoutFromSelect();
};
document.getElementById('apply-keyboard-json').onclick = () => {
	document.getElementById('keyboard-layout').value = 'custom';
	updateLayoutUI();
	rebuildFromLayout('custom', document.getElementById('keyboard-json').value);
};

document.getElementById('osc1').oninput = e => {
	customParams.osc1 = OSC_TYPES[parseInt(e.target.value, 10)];
	document.getElementById('osc1-val').textContent = customParams.osc1;
};
document.getElementById('osc2').oninput = e => {
	customParams.osc2 = OSC_TYPES[parseInt(e.target.value, 10)];
	document.getElementById('osc2-val').textContent = customParams.osc2;
};
document.getElementById('filter').oninput = e => {
	customParams.filter = parseInt(e.target.value, 10);
	document.getElementById('filter-val').textContent = customParams.filter;
};
document.getElementById('detune').oninput = e => {
	customParams.detune = parseInt(e.target.value, 10);
	document.getElementById('detune-val').textContent = customParams.detune;
};

document.getElementById('chord').onclick = () => {
	initAudio();
	[261.63, 329.63, 392, 523.25].forEach(f => playNote(f, 2200, 0.55, { manualIndex: 0 }));
	if (!reducedMotion()) flameIntensity = 2.5;
};
document.getElementById('corjesu').onclick = () => {
	stopSong();
	playSong(hymns.corjesu);
};
document.getElementById('avemaria').onclick = () => {
	stopSong();
	playSong(hymns.avemaria);
};
document.getElementById('tantum').onclick = () => {
	stopSong();
	playSong(hymns.tantum);
};
document.getElementById('panis').onclick = () => {
	stopSong();
	playSong(hymns.panis);
};
document.getElementById('amazing').onclick = () => {
	stopSong();
	playSong(hymns.amazing);
};
document.getElementById('stop').onclick = () => {
	stopSong();
	stopMetronome();
	document.getElementById('metro-on').checked = false;
};
document.getElementById('reset').onclick = () => {
	stopSong();
	flameIntensity = 0;
	flatKeys.forEach(k => {
		k.pressed = false;
		k.playbackGlow = 0;
	});
	pipes.forEach(p => {
		p.glow = 0;
	});
};

document.getElementById('play-custom').onclick = () => {
	stopSong();
	const lines = document.getElementById('custom-input').value.trim().split('\n');
	const melody = [];
	lines.forEach(line => {
		const parts = line.trim().split(/\s+/);
		if (parts[0]) {
			const n = parseMelodyLine(parts);
			if (n) melody.push(n);
		}
	});
	if (melody.length) playSong(melody, { highlight: true });
};

document.getElementById('midi-upload').onchange = async e => {
	const file = e.target.files[0];
	if (!file) return;
	try {
		const buf = await file.arrayBuffer();
		if (typeof parseMidiImport !== 'function') {
			alert('MIDI parser not loaded.');
			return;
		}
		const data = parseMidiImport(buf);
		if (!data.notes.length) {
			alert('No notes found in MIDI file.');
			e.target.value = '';
			return;
		}
		pendingImport = data;
		const grid = document.getElementById('channel-checkboxes');
		grid.innerHTML = '';
		let chans = data.channelsPresent.length
			? data.channelsPresent
			: [...new Set(data.notes.map(n => n.channel))].sort((a, b) => a - b);
		if (!chans.length) chans = [1];
		chans.forEach(ch => {
			const id = 'ch-' + ch;
			const lab = document.createElement('label');
			lab.innerHTML = '<input type="checkbox" class="ch-filter" value="' + ch + '" checked> Ch ' + ch;
			grid.appendChild(lab);
		});
		document.getElementById('midi-import-options').style.display = 'block';
	} catch (err) {
		alert('Could not read MIDI file.');
	}
	e.target.value = '';
};

document.getElementById('midi-import-cancel').onclick = () => {
	pendingImport = null;
	document.getElementById('midi-import-options').style.display = 'none';
};

document.getElementById('midi-import-play').onclick = () => {
	if (!pendingImport) return;
	const lyricLines = pendingImport.lyrics || [];
	const allowed = new Set();
	document.querySelectorAll('.ch-filter:checked').forEach(cb => allowed.add(parseInt(cb.value, 10)));
	let notes = pendingImport.notes.filter(n => allowed.has(n.channel));
	const ls = parseInt(document.getElementById('loop-start-ms').value, 10) || 0;
	const le = parseInt(document.getElementById('loop-end-ms').value, 10) || 0;
	if (le > ls) {
		notes = notes
			.filter(n => n.startTime >= ls && n.startTime < le)
			.map(n => Object.assign({}, n, { startTime: n.startTime - ls }));
	}
	document.getElementById('midi-import-options').style.display = 'none';
	pendingImport = null;
	if (!notes.length) {
		alert('No notes after filter.');
		return;
	}
	stopSong();
	let lyricsForPlay = lyricLines;
	if (le > ls) {
		lyricsForPlay = lyricLines
			.filter(l => l.startTime >= ls && l.startTime < le)
			.map(l => Object.assign({}, l, { startTime: l.startTime - ls }));
	}
	playSong(notes, { highlight: true, lyrics: lyricsForPlay });
};

document.getElementById('record-toggle').onclick = () => {
	recording = !recording;
	const btn = document.getElementById('record-toggle');
	if (recording) {
		recordNotes = [];
		recordStart = performance.now();
		btn.textContent = '■ Stop recording';
		btn.setAttribute('aria-pressed', 'true');
	} else {
		btn.textContent = '● Record';
		btn.setAttribute('aria-pressed', 'false');
	}
};

document.getElementById('export-record-midi').onclick = () => {
	if (!recordNotes.length) {
		alert('Record something first (use Stop recording, then export).');
		return;
	}
	const sorted = recordNotes.slice().sort((a, b) => a.t - b.t);
	downloadBlob(buildMidiFileFromNotes(sorted), 'organ-recording.mid');
};

document.getElementById('export-text-midi').onclick = () => {
	const lines = document.getElementById('custom-input').value.trim().split('\n');
	const evs = [];
	let t = 0;
	lines.forEach(line => {
		const parts = line.trim().split(/\s+/);
		if (!parts[0]) return;
		const n = parseMelodyLine(parts);
		if (!n) return;
		evs.push({ t: t, midi: n.midi, dur: n.duration, vel: 0.75 });
		t += n.duration * 0.92;
	});
	if (!evs.length) {
		alert('No valid lines in custom melody.');
		return;
	}
	downloadBlob(buildMidiFileFromNotes(evs), 'melody.mid');
};

const midiInExtra = document.createElement('div');
midiInExtra.className = 'v7-panel';
midiInExtra.innerHTML =
	'<h3>MIDI keyboard routing</h3>' +
	'<label>Target manual <select id="midi-in-manual"><option value="0">First manual</option></select></label> ' +
	'<label>Channel <select id="midi-in-ch-filter">' +
	'<option value="-1">Omni</option>' +
	Array.from({ length: 16 }, (_, i) => '<option value="' + i + '">' + (i + 1) + '</option>').join('') +
	'</select></label>';
document.getElementById('manual-voices-panel').after(midiInExtra);

function syncMidiInManualSelect() {
	const sel = document.getElementById('midi-in-manual');
	sel.innerHTML = '';
	manuals.forEach((m, i) => {
		const o = document.createElement('option');
		o.value = String(i);
		o.textContent = m.name;
		sel.appendChild(o);
	});
	sel.onchange = () => {
		midiInTargetManual = parseInt(sel.value, 10);
	};
}
document.getElementById('midi-in-ch-filter').onchange = e => {
	midiInChannelFilter = parseInt(e.target.value, 10);
};

const _origRebuild = rebuildFromLayout;
rebuildFromLayout = function (a, b) {
	_origRebuild(a, b);
	syncMidiInManualSelect();
};

document.getElementById('keyboard-json').value = DEFAULT_CUSTOM_JSON;
updateLayoutUI();
updateLayoutScale();
syncMidiInManualSelect();
animate();

if (typeof ResizeObserver !== 'undefined') {
	new ResizeObserver(() => updateLayoutScale()).observe(document.querySelector('.container'));
} else {
	window.addEventListener('resize', updateLayoutScale);
}
