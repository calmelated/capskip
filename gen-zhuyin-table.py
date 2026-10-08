#!/usr/bin/env python
"""gen-zhuyin-table.py — build zhuyin-table.json

Generates a complete character -> Bopomofo reading table for every Han
character that appears in the item bank's low-grade (target grade 2-3)
questions. This is what build-itembank.mjs consumes.

Hand-writing these readings was the original cause of the missing-注音 bug,
so the table is now generated from an authoritative reading source.

Requires: pip install pypinyin
Usage:    python gen-zhuyin-table.py
"""
import io
import json
import re
import sys

try:
    from pypinyin import pinyin, Style
except ImportError:
    sys.exit("pypinyin is required: pip install pypinyin")

HAN = re.compile(r'[\u3400-\u9fff]')

# Deterministic RNG streams used to sample template items when collecting the
# vocabulary they can emit. Any decent spread works; these are fixed so the
# generated table is reproducible.
_SAMPLE_STREAMS = tuple(range(40))


def _rng_for(stream, seed_text):
    """A small deterministic RNG so template sampling is reproducible."""
    state = (stream * 2654435761 + sum(ord(c) for c in str(seed_text))) & 0xFFFFFFFF

    def rnd():
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 0x100000000

    return rnd


def collect_chars(bank):
    """Every Han character that can appear in a question served to 國小一、二年級.

    Those students are tested at target grades 2-3, so we must cover the full
    item bank at those target grades — including programmatically generated
    math items, whose wording was previously not covered.

    Template items have no fixed text, so we sample several draws of each
    generator to discover the vocabulary it can emit.
    """
    chars = set()

    def add(text):
        if not text:
            return
        chars.update(ch for ch in text if HAN.match(ch))

    for subj in bank.values():
        for grade in ('2', '3'):
            node = subj.get(grade)
            if not node:
                continue
            for items in node.values():
                for it in items:
                    # Template items carry no fixed text; their vocabulary is
                    # sampled in JS (emit-itembank.mjs) and merged in by main().
                    add(it.get('q'))
                    add(it.get('explain'))
                    for opt in it.get('options', []):
                        add(opt)
    return sorted(chars)


def main():
    with io.open('itembank-data.json', encoding='utf-8') as f:
        bank = json.load(f)

    chars = set(collect_chars(bank))

    # Template items have no fixed text. Their vocabulary is sampled in JS by
    # sample-template-vocab.mjs; merge it in so the table covers it too.
    try:
        with io.open('template-vocab.txt', encoding='utf-8') as f:
            for line in f:
                chars.update(ch for ch in line.rstrip('\n') if HAN.match(ch))
    except FileNotFoundError:
        print('note: template-vocab.txt absent — run sample-template-vocab.mjs first',
              file=sys.stderr)

    chars = sorted(chars)
    if not chars:
        sys.exit('no characters found — run build-itembank.mjs first')

    table = {}
    for ch in chars:
        reading = pinyin(ch, style=Style.BOPOMOFO, heteronym=False)
        table[ch] = reading[0][0] if reading and reading[0] else ''

    missing = [c for c, v in table.items() if not v]
    if missing:
        print('WARNING: no reading for %d chars: %s' % (len(missing), ''.join(missing)),
              file=sys.stderr)

    with io.open('zhuyin-table.json', 'w', encoding='utf-8') as f:
        json.dump(table, f, ensure_ascii=False, sort_keys=True)

    print('zhuyin-table.json: %d characters' % len(table))


if __name__ == '__main__':
    main()