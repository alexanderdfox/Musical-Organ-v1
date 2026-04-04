/**
 * Light sanity check for midi-parser.js (no test framework).
 * Run: node test/midi-parser.mjs
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'midi-parser.js'), 'utf8');
vm.runInThisContext(code, { filename: 'midi-parser.js' });

const minimal = Buffer.from([
	0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 1, 0x80,
	0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 0x14,
	0x00, 0xff, 0x05, 0x04, 0x4b, 0x79, 0x72, 0x69,
	0x00, 0x90, 0x3c, 0x40,
	0x60, 0x80, 0x3c, 0x00,
	0x00, 0xff, 0x2f, 0x00
]);

const r = parseMidiImport(minimal.buffer.slice(minimal.byteOffset, minimal.byteOffset + minimal.byteLength));
if (r.notes.length !== 1) throw new Error('expected 1 note, got ' + r.notes.length);
if (r.notes[0].midiNote !== 60) throw new Error('midiNote should be 60');
if (!r.notes[0].channel) throw new Error('channel missing');
if (r.lyrics.length < 1 || !String(r.lyrics[0].text).includes('Kyri')) {
	throw new Error('lyric meta not parsed: ' + JSON.stringify(r.lyrics));
}

const arr = parseMidiFile(minimal.buffer.slice(minimal.byteOffset, minimal.byteOffset + minimal.byteLength));
if (!Array.isArray(arr) || arr.length !== 1) throw new Error('parseMidiFile backward compat failed');

console.log('midi-parser tests: ok');
