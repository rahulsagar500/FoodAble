#!/usr/bin/env node
/**
 * Sweeps web/src for mojibake characters and replaces with proper punctuation/icons.
 * Run from repo root: `node scripts/fix-mojibake.js`
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'web', 'src');

const REPLACEMENTS = [
  // Ellipses and statuses
  [/Loading�?�/g, 'Loading…'],
  [/Loading offers�?�/g, 'Loading offers…'],
  [/Signing in�?�/g, 'Signing in…'],
  [/Saving�?�/g, 'Saving…'],
  [/Creating�?�/g, 'Creating…'],
  [/Processing�?�/g, 'Processing…'],
  [/Reserving�?�/g, 'Reserving…'],

  // Dashes between pickup times
  [/\?"/g, '–'], // handle stray ?"
  [/�?"/g, '–'],  // mojibake variant

  // Bullets / separators
  [/ A� /g, ' • '],
  [/ �?� /g, ' • '],

  // Footer copyright (best-effort)
  [/\bAc\s/g, '© '],

  // Common phrase
  [/Brisbane�?Ts best/g, 'Brisbane’s best'],
  [/doesn�?Tt/g, 'doesn’t'],

  // Ad-hoc icon glyphs
  [/dY>'/g, '🛒'],
  [/dY"Z/g, '🔍'],
  [/�sT�,\?/g, '⚙️'],
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) yield p;
  }
}

let changed = 0;
for (const file of walk(SRC)) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const [pattern, repl] of REPLACEMENTS) {
    after = after.replace(pattern, repl);
  }
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`Fixed: ${path.relative(ROOT, file)}`);
    changed++;
  }
}

if (!changed) console.log('No mojibake issues found or already fixed.');
else console.log(`Done. Updated ${changed} file(s).`);

