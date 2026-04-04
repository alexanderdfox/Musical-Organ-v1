#!/usr/bin/env node
/**
 * Builds dist/v7.inline.html: v7.html with midi-parser.js and v7-app.js inlined.
 * Run from repo root: node scripts/build-v7-inline.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const parserPath = path.join(root, 'midi-parser.js');
const appPath = path.join(root, 'v7-app.js');
const v7Path = path.join(root, 'v7.html');
const outDir = path.join(root, 'dist');
const outPath = path.join(outDir, 'v7.inline.html');

const parser = fs.readFileSync(parserPath, 'utf8');
const app = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(v7Path, 'utf8');

const tagParser = '<script src="midi-parser.js"></script>';
const tagApp = '<script src="v7-app.js"></script>';
if (!html.includes(tagParser) || !html.includes(tagApp)) {
	console.error('v7.html must contain:', tagParser, 'and', tagApp);
	process.exit(1);
}
html = html.replace(tagParser, `<script>\n${parser}\n</script>`);
html = html.replace(tagApp, `<script>\n${app}\n</script>`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote', outPath);
