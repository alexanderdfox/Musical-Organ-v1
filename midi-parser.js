/**
 * Standard MIDI File (SMF) → note list for the organ players.
 * Each note: { freq, duration, startTime, velocity }
 * - startTime / duration in milliseconds (from tempo map + ticks)
 * - velocity 0–1 for Web Audio gain
 */
(function (global) {
	'use strict';

	function readVLQ(dv, offset) {
		let v = 0;
		let b;
		do {
			b = dv.getUint8(offset++);
			v = (v << 7) | (b & 0x7f);
		} while (b & 0x80);
		return { val: v, offset: offset };
	}

	function midiToFreq(note) {
		return 440 * Math.pow(2, (note - 69) / 12);
	}

	function eventSortOrder(e) {
		if (e.type === 'tempo') return 0;
		if (e.type === 'off') return 1;
		if (e.type === 'on') return 2;
		return 9;
	}

	global.parseMidiFile = function parseMidiFile(arrayBuffer) {
		const dv = new DataView(arrayBuffer);
		if (dv.byteLength < 22) return [];

		const magic =
			String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
		if (magic !== 'MThd') return [];

		const headerLen = dv.getUint32(4);
		if (headerLen < 6 || 8 + headerLen > dv.byteLength) return [];

		const ntrks = dv.getUint16(10);
		let division = dv.getUint16(12);
		let ticksPerQuarter = division & 0x8000 ? 480 : division;
		if (!ticksPerQuarter || ticksPerQuarter < 0) ticksPerQuarter = 480;

		let o = 8 + headerLen;
		const events = [];
		let maxTick = 0;

		for (let tr = 0; tr < ntrks; tr++) {
			if (o + 8 > dv.byteLength) break;
			const trk =
				String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
			if (trk !== 'MTrk') break;
			o += 4;
			const trkLen = dv.getUint32(o);
			o += 4;
			const trkEnd = o + trkLen;
			if (trkEnd > dv.byteLength) break;

			let absTick = 0;
			let running = null;

			while (o < trkEnd) {
				const d = readVLQ(dv, o);
				absTick += d.val;
				o = d.offset;

				const b0 = dv.getUint8(o);
				let status;
				if (b0 < 0x80) {
					if (running === null) {
						o++;
						continue;
					}
					status = running;
				} else {
					status = b0;
					o++;
					if (status !== 0xff && (status & 0xf0) !== 0xf0) running = status;
					else running = null;
				}

				const hi = status & 0xf0;

				if (status === 0xff) {
					running = null;
					const metaType = dv.getUint8(o++);
					const lenR = readVLQ(dv, o);
					o = lenR.offset;
					if (metaType === 0x51 && lenR.val >= 3) {
						const us =
							(dv.getUint8(o) << 16) | (dv.getUint8(o + 1) << 8) | dv.getUint8(o + 2);
						if (us > 0) events.push({ type: 'tempo', tick: absTick, us: us });
					}
					o += lenR.val;
					continue;
				}

				if (status === 0xf0 || status === 0xf7) {
					const lenR = readVLQ(dv, o);
					o = lenR.offset + lenR.val;
					running = null;
					continue;
				}

				if (hi === 0x80) {
					const note = dv.getUint8(o++);
					dv.getUint8(o++);
					events.push({ type: 'off', tick: absTick, ch: status & 0x0f, note: note });
					maxTick = Math.max(maxTick, absTick);
				} else if (hi === 0x90) {
					const note = dv.getUint8(o++);
					const vel = dv.getUint8(o++);
					const ch = status & 0x0f;
					if (vel === 0) {
						events.push({ type: 'off', tick: absTick, ch: ch, note: note });
					} else {
						events.push({ type: 'on', tick: absTick, ch: ch, note: note, vel: vel });
					}
					maxTick = Math.max(maxTick, absTick);
				} else if (hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
					o += 2;
				} else if (hi === 0xc0 || hi === 0xd0) {
					o += 1;
				} else {
					if (o < trkEnd) o++;
				}
			}
			o = trkEnd;
		}

		events.sort(function (a, b) {
			if (a.tick !== b.tick) return a.tick - b.tick;
			return eventSortOrder(a) - eventSortOrder(b);
		});

		const tempoPoints = [{ tick: 0, usPerQuarter: 500000 }];
		for (let i = 0; i < events.length; i++) {
			if (events[i].type === 'tempo') {
				tempoPoints.push({ tick: events[i].tick, usPerQuarter: events[i].us });
			}
		}
		tempoPoints.sort(function (a, b) {
			return a.tick - b.tick;
		});
		const merged = [];
		for (let i = 0; i < tempoPoints.length; i++) {
			const p = tempoPoints[i];
			if (merged.length && merged[merged.length - 1].tick === p.tick) {
				merged[merged.length - 1] = p;
			} else {
				merged.push(p);
			}
		}

		function tickToMs(tick) {
			let ms = 0;
			let prevTick = 0;
			let usPerQ = merged[0].usPerQuarter;
			for (let i = 1; i < merged.length; i++) {
				const segEnd = merged[i].tick;
				if (tick <= segEnd) {
					return ms + (tick - prevTick) * (usPerQ / 1000) / ticksPerQuarter;
				}
				ms += (segEnd - prevTick) * (usPerQ / 1000) / ticksPerQuarter;
				prevTick = segEnd;
				usPerQ = merged[i].usPerQuarter;
			}
			return ms + (tick - prevTick) * (usPerQ / 1000) / ticksPerQuarter;
		}

		const stacks = new Map();
		function stackKey(ch, note) {
			return (ch << 8) | note;
		}

		const notesOut = [];
		const maxNotes = 8000;

		for (let i = 0; i < events.length; i++) {
			const ev = events[i];
			if (ev.type === 'tempo') continue;
			if (ev.type === 'on') {
				if (ev.ch === 9) continue;
				const k = stackKey(ev.ch, ev.note);
				if (!stacks.has(k)) stacks.set(k, []);
				stacks.get(k).push({ tick: ev.tick, vel: ev.vel });
			} else if (ev.type === 'off') {
				if (ev.ch === 9) continue;
				const k = stackKey(ev.ch, ev.note);
				const st = stacks.get(k);
				if (!st || !st.length) continue;
				const start = st.shift();
				const startMs = tickToMs(start.tick);
				const endMs = tickToMs(ev.tick);
				let dur = Math.max(40, endMs - startMs);
				if (dur > 60000) dur = 60000;
				const vel = Math.min(1, Math.max(0.12, start.vel / 127));
				notesOut.push({
					freq: midiToFreq(ev.note),
					duration: dur,
					startTime: startMs,
					velocity: vel
				});
				if (notesOut.length >= maxNotes) break;
			}
		}

		if (notesOut.length < maxNotes) {
			const endTick = maxTick + ticksPerQuarter;
			stacks.forEach(function (st, mapKey) {
				while (st.length && notesOut.length < maxNotes) {
					const start = st.shift();
					const note = mapKey & 0xff;
					const startMs = tickToMs(start.tick);
					const endMs = tickToMs(endTick);
					let dur = Math.max(120, endMs - startMs);
					if (dur > 8000) dur = 8000;
					const vel = Math.min(1, Math.max(0.12, start.vel / 127));
					notesOut.push({
						freq: midiToFreq(note),
						duration: dur,
						startTime: startMs,
						velocity: vel
					});
				}
			});
		}

		notesOut.sort(function (a, b) {
			if (a.startTime !== b.startTime) return a.startTime - b.startTime;
			return a.freq - b.freq;
		});

		return notesOut;
	};
})(typeof window !== 'undefined' ? window : globalThis);
