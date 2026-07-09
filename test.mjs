/**
 * EmojiTraduci — Test suite
 * Verifica i criteri di accettazione e funzionalità core
 */

import { translate, lookup, emojiDB } from './src/emoji-db.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}", got "${actual}"`);
  }
}

console.log('\n📋 EmojiTraduci Test Suite\n');

/* ── Criterio 1: 'cane gatto sole' produce emoji cane gatto sole ─── */

test('"cane" → 🐕', () => {
  const r = lookup('cane');
  assert(r && r.length > 0, 'lookup deve restituire un array');
  assertEq(r[0], '🐕', 'cane deve tradursi in 🐕');
});

test('"gatto" → 🐱', () => {
  const r = lookup('gatto');
  assert(r && r.length > 0, 'lookup deve restituire un array');
  assertEq(r[0], '🐱', 'gatto deve tradursi in 🐱');
});

test('"sole" → ☀️', () => {
  const r = lookup('sole');
  assert(r && r.length > 0, 'lookup deve restituire un array');
  assertEq(r[0], '☀️', 'sole deve tradursi in ☀️');
});

test('"cane gatto sole" produce token con emoji corretti', () => {
  const tokens = translate('cane gatto sole');
  const wordTokens = tokens.filter(t => t.type === 'word');

  assertEq(wordTokens.length, 3, 'Devono esserci 3 token parola');

  assertEq(wordTokens[0].resolvedEmoji, '🐕', 'Primo token: cane → 🐕');
  assertEq(wordTokens[1].resolvedEmoji, '🐱', 'Secondo token: gatto → 🐱');
  assertEq(wordTokens[2].resolvedEmoji, '☀️', 'Terzo token: sole → ☀️');
});

/* ── Criterio 2: le emoji hanno alternative multiple ─── */

test('"cane" ha almeno 2 alternative', () => {
  const r = lookup('cane');
  assert(r.length >= 2, `cane ha ${r.length} alternative, attese >= 2`);
});

test('"gatto" ha almeno 2 alternative', () => {
  const r = lookup('gatto');
  assert(r.length >= 2, `gatto ha ${r.length} alternative, attese >= 2`);
});

test('"felice" ha almeno 2 alternative', () => {
  const r = lookup('felice');
  assert(r.length >= 2, `felice ha ${r.length} alternative, attese >= 2`);
});

/* ── Criterio 2b: le alternative sono emoji valide ─── */

test('le alternative per "cane" sono emoji valide', () => {
  const r = lookup('cane');
  const emojiRegex = /\p{Emoji}/u;
  r.forEach((e, i) => {
    assert(emojiRegex.test(e), `Alternativa ${i} "${e}" non è un emoji valido`);
  });
});

/* ── Varianti morfologiche ─── */

test('plurale "cani" trova "cane"', () => {
  const r = lookup('cani');
  assert(r !== null, '"cani" deve trovare un match via varianti');
});

test('plurale "gatti" trova "gatto"', () => {
  const r = lookup('gatti');
  assert(r !== null, '"gatti" deve trovare un match via varianti');
});

test('plurale "fiori" trova "fiore"', () => {
  const r = lookup('fiori');
  assert(r !== null, '"fiori" deve trovare un match via varianti');
});

test('participio "mangiato" trova "mangiare"', () => {
  const r = lookup('mangiato');
  assert(r !== null, '"mangiato" deve trovare "mangiare"');
});

/* ── Edge cases ─── */

test('parola sconosciuta restituisce null', () => {
  const r = lookup('xyzabc123');
  assertEq(r, null, 'Parola inesistente deve restituire null');
});

test('stringa vuota restituisce array vuoto', () => {
  const tokens = translate('');
  assertEq(tokens.length, 0, 'Stringa vuota → 0 token');
});

test('solo spazi restituisce array vuoto', () => {
  const tokens = translate('   ');
  assertEq(tokens.length, 0, 'Solo spazi → 0 token');
});

test('punteggiatura preservata', () => {
  const tokens = translate('cane!');
  const punctTokens = tokens.filter(t => t.type === 'punctuation');
  assert(punctTokens.length > 0, 'La punteggiatura deve essere preservata');
});

test('case insensitive: "CANE" trova emoji', () => {
  const r = lookup('CANE');
  assert(r !== null, '"CANE" deve trovare emoji (case insensitive)');
});

test('case insensitive: "GaTtO" trova emoji', () => {
  const r = lookup('GaTtO');
  assert(r !== null, '"GaTtO" deve trovare emoji (case insensitive)');
});

/* ── Copertura database ─── */

test('database ha almeno 300 parole', () => {
  const count = Object.keys(emojiDB).length;
  assert(count >= 300, `Il database ha ${count} parole, attese >= 300`);
});

/* ── Riepilogo ──────────────────────────────────── */

console.log(`\n📊 Risultati: ${passed} passati, ${failed} falliti su ${passed + failed} test\n`);

if (failed > 0) {
  process.exit(1);
}
