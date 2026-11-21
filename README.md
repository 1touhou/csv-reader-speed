# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/1touhou/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/1touhou/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0: it returns exactly csv-reader's answer `{columns, rows, errors}` for every input `{text, header}` — same broken-row policy (BOM strip, stray CRs, unterminated quotes, quote junk, short/long rows) — while reading the text with indexOf-driven scans instead of one character at a time.

## How it is faster

- A record whose line holds no quote and no stray CR is split in one go (`String.split`), which covers most records of a drawn file.
- Other records are read field by field: each unquoted field is found with one regex scan for the next comma or LF plus a bounded stray-CR check on its slice; each quoted field is found with `indexOf('"')` jumps, doubled quotes folded in as segments are collected, and CRLF/lone CR inside quotes folded to LF.
- No per-field result objects: the field end and kept-character count travel in closure variables.

On the kit's practice set (6 cases, ~10.5 MB of CSV) it parses in ~180 ms against csv-reader 1.0.0's ~500 ms on this machine (interleaved rounds, same process), and the whole entry runs end to end in ~1.0 s against the baseline's ~2.1 s. Exact match verified on all 6 practice cases and 64 hand-built edge cases (BOM, stray CR, unterminated quotes, quote junk, CRLF in quotes, short/long rows, empty lines, header true/false).

## Run it

```sh
node main.ts
```

It reads every case from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`) and writes `/output/answers.json`: one answer per case, in the cases' order. Dependency-free, JavaScript/TypeScript only, deterministic — two runs write identical bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=3bes5xfn&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
