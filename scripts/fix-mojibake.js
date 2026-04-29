#!/usr/bin/env node
/**
 * Corrige mojibake UTF-8 duplo (ex: "é" -> "é") em todos os arquivos
 * de texto do projeto. Seguro: só converte sequências [ÃÂ][\x80-\xBF].
 */
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['node_modules', '.git', 'storage', 'docs', 'public/img', 'tools']);
const EXTS = /\.(ejs|html|htm|js|css|md|json|txt)$/i;
const RE = /[\u00C2\u00C3][\u0080-\u00FF]/g;

// Mapa de mojibake triplo/Windows-1252 que escapa do RE acima
const REPLACEMENTS = [
  ["Ã", "Ã"], ["Ç", "Ç"],
  ["Ã\u201C", "Ó"], ["Ã\u2019", "É"], ["Ã\u2018", "Á"],
  ["Ú", "Ú"], ["Ê", "Ê"],
  ["ÃÂ", "Ã"],
  ["â\u201E\u00A2", "™"],
  ["â\u20AC\u201C", "–"], ["â\u20AC\u201D", "—"],
  ["â\u20AC\u0153", "\u201C"], ["â\u20AC\u009D", "\u201D"],
  ["â\u20AC\u2122", "\u2019"], ["â\u20AC\u02DC", "\u2018"],
  ["â\u20AC\u00A2", "•"], ["â\u20AC\u00A6", "…"],
  ["ðŸ\u008F\u2020", "🏆"], ["🎰", "🎰"],
  ["ðŸ\u201D¥", "🔥"], ["ðŸ\u0090¥", "🔥"],
  ["🌟", "🌟"], ["ðŸ\u2019°", "💰"],
  ["ðŸŽ\u0081", "🎁"],
];

function fixSequences(s) {
  for (const [bad, good] of REPLACEMENTS) {
    if (s.indexOf(bad) !== -1) s = s.split(bad).join(good);
  }
  return s;
}

function fix(s) {
  s = fixSequences(s);
  return s.replace(RE, (m) => {
    try {
      const b = Buffer.from(m, 'latin1');
      const out = b.toString('utf8');
      // só aceita se gerou exatamente 1 char (UTF-8 válido de 2 bytes)
      if ([...out].length === 1) return out;
      return m;
    } catch { return m; }
  });
}

let scanned = 0, changed = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p);
    } else if (EXTS.test(e.name)) {
      scanned++;
      const buf = fs.readFileSync(p);
      const s = buf.toString('utf8');
      const f = fix(s);
      if (f !== s) {
        fs.writeFileSync(p, f, 'utf8');
        changed++;
        console.log('FIXED', path.relative(process.cwd(), p));
      }
    }
  }
}

const root = process.argv[2] || '.';
walk(root);
console.log(`\nScanned ${scanned} files, fixed ${changed}.`);
