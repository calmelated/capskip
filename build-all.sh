#!/usr/bin/env bash
# build-all.sh — regenerate the item bank end to end.
#
# Order matters: the Bopomofo table must cover every character the item bank can
# emit, and the template vocabulary is discovered by sampling the generators.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 1/5 build item bank"
node build-itembank.mjs

echo "==> 2/5 sample template vocabulary"
node sample-template-vocab.mjs

echo "==> 3/5 generate Bopomofo table"
python gen-zhuyin-table.py

echo "==> 4/5 rebuild (now with a complete table)"
node build-itembank.mjs
node sample-template-vocab.mjs
python gen-zhuyin-table.py
node build-itembank.mjs

echo "==> 5/5 emit item-bank.js"
node emit-itembank.mjs

echo "done."