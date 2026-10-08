// sample-template-vocab.mjs — discover the vocabulary that parameterised
// template items can emit, so the Bopomofo table can cover it.
//
// Emits template-vocab.txt: one candidate string per line (stem, every option
// and the explanation, sampled across many RNG streams).
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
const mathTpl = require_('./math-templates.js');

// Rebuild the template list exactly as build-itembank.mjs does.
const templates = [];
const push = (sub, g, t, it) => { templates.push({ sub, g, t, it }); };
let uid = 0;
const nid = (s, g, t) => `${s}-${g}-${t}-${(++uid).toString(36)}`;
mathTpl.buildMath(push, nid);

const STREAMS = 60;
const lines = [];
const seen = new Set();
for (const { g, it } of templates) {
    if (g > 3) continue; // only target grades 2-3 reach 國小一、二年級
    for (let s = 0; s < STREAMS; s++) {
        const rnd = makeRng(s * 7919 + it.id.length * 31);
        let got;
        try { got = it.gen(rnd); } catch { continue; }
        if (!got) continue;
        for (const text of [got.q, got.explain, ...(got.options || [])]) {
            if (text && !seen.has(text)) { seen.add(text); lines.push(text); }
        }
    }
}

function makeRng(seed) {
    let x = seed >>> 0 || 1;
    return () => {
        x ^= x << 13; x >>>= 0;
        x ^= x >> 17;
        x ^= x << 5; x >>>= 0;
        return x / 0x100000000;
    };
}

writeFileSync('template-vocab.txt', lines.join('\n'), 'utf8');
console.log('template-vocab.txt:', lines.length, 'strings');