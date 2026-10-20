# Generated shell frontend integration — 2026-10-20

## Result

The shell guest now tokenizes raw input with `maiaCCLexerStateInit` /
`maiaCCLexerTokenize` and parses it with `maiaCCParserStateInit` / `maiaCC_parse`.
Both come from MaiaCC-generated C++98 source, compiled through the local MaiaCpp
AST-strict -> C89 -> MaiaC/MaiaWASM pipeline. Runtime parsing/matching stays in
WASM. The default MaiaCC JS tool generates the frontend at build time.

The handwritten tokenizer, keyword/operator classifier and handwritten contextual
NAME matcher were removed. Contextual matching uses the generated lexical rule.
The collector keeps tree events/nodes only; quote removal and bounded command
validation operate on the generated tree after successful parsing.

The six MVP commands remain `help`, `echo`, `pwd`, `cat /system/welcome.txt`,
`clear`, `exit`. Their existing LVGL, event, VFS and process syscalls are retained.
Valid compound syntax is parsed but rejected as unsupported by the executor.
No host parser, replacement GUI, new MaiaOS syscall or upstream compiler patch
was introduced.

## Implementation

- `apps/shell/shell.cpp`: generated lexer/parser entry points, per-call collector,
  compiler-owned static buffers, separate syntax/capacity/unsupported results.
  Removed literal linear-memory addresses, including the former 8192 base.
  The input-display buffer now has 263 bytes for the six-byte prompt, 255 editable
  bytes, caret and NUL. Prompt/input/caret use the same LVGL label.
- `apps/shell/maia-shell-parse-tree-collector.hpp`: checkpoint restore handles
  rollback; abort is a no-op after the generated rule's own restore. Resource
  exhaustion stays sticky. No duplicated lexical NAME rules.
- `scripts/build-shell-wasm.mjs` and `.sh`: regenerate the runtime header from
  EBNF, use local published submodules, link actual MaiaRegex/libc, validate and
  atomically write the WASM. `--check-c89` adds an optional Clang wasm32 strict
  syntax check; normal builds need Node and the Maia toolchain only.
- `runtime/maia-host-imports.js`, `maia-capabilities.js`: implement the existing
  MaiaC memory-size/grow ABI and forward malloc/free bridges to the linked guest
  allocator. They use the existing memory capability names. Matching/parsing
  never moves to the host.
- Raw-input native/JS comparison driver and guest/LVGL tests; new package scripts.
  The older pre-tokenized runner remains and now links its Regex dependency.
- Shell README, root status table and architecture artifact status updated.

The EBNF itself is byte-identical to the incoming version. No generated parser
was edited manually. Runtime generated headers are regenerated build outputs;
legacy root-level generated comparison files were preserved.

## Verification — all passed

| Command | Result |
|---|---|
| `npm run build:shell -- --check-c89` | C++98 AST strict -> emitted strict C89 (wasm32 syntax) -> own MaiaC/MaiaWASM; valid executable guest. |
| `npm test` | 20 tests, including C memory primitive semantics and allocator forwarding. |
| `npm run test:shell-grammar` | 32 valid and 9 invalid scenarios; two existing POSIX gaps reported explicitly. |
| `npm run test:shell-parser` | 52 raw-input JS/native C++ cases plus 15 recursion profiles; token kinds/values/offsets and complete accepted trees equal. Includes lexical errors, Unicode, bounded nesting and collector exhaustion. |
| `npm run test:shell-equivalence` | 5,356 deterministic raw UTF-8 inputs compared across JS, native C++98 and C++98 -> C89 -> WASM. Zero differences in tokens/offsets, lexical errors/partial tokens, acceptance and complete accepted trees; stack restored after every WASM call. |
| `npm run test:shell-host` | Six commands, editing/history, quoting/comments, exact output, syntax/unsupported/capacity errors, 255-byte boundary, 1,000 repeated parses; stable stack and memory. |
| `npm run test:shell-lvgl` |Same guest checks with actual LVGL-WASM; 1,253 valid RGB565 flushes; 1,000 parses; stack stable and 18 memory pages unchanged. |
| `npm run test:lvgl-host` |Existing kernel, Calculator and Clock event/VFS/real-LVGL regression passes. |

Original integration guest: 1,182,597 bytes; SHA-256:
`0519cc85a3da21fd8f57b110a150bcc2ec3a7c9be8a785d197788842997d84a0`.
Repeated builds produce identical WASM, including the optional C89 checker.
Guest memory is 18 pages (1,179,648 bytes), below its existing 32-page manifest.
This measurement covers the bounded guest, not the complete device/VM budget.

### Inline prompt follow-up

The live `maia> ` prompt now shares the input LVGL label with the editable text
and caret, instead of ending the separate history label. Submitted prompts and
commands move into history on Enter. The display buffer accommodates the six
prompt bytes in addition to the unchanged 255-byte input, caret and NUL.

`npm run build:shell -- --check-c89`, `npm run test:shell-host` and
`npm run test:shell-lvgl` PASS after this change, including prompt/caret adjacency,
editing/history, 255-byte input, all existing command/error cases, 1000 repeated
parses, restored stack and stable 18 pages. Actual LVGL produced 1269 flushes.
Current guest: 1,182,705 bytes; SHA-256
`8aff50c34d878b3f7dbf6deaad480d6fb71b0290051fdfbfb630014fc4b70e67`.
Refresh the simulator and relaunch the shell to load the updated module.

## LVGL scheduling observation

An initial synthetic stress test did not advance LVGL's timer/render loop after
input events. Its pending GUI work exhausted the standard 64 KiB pool. The test
now follows the platform scheduler and keeps all 1,000 commands/assertions.
Both original 64 KiB and experimental 256 KiB modules passed with correct ticks;
the experiment was reverted. Production `lv_conf.h` and `lvgl/main.c` are
byte-identical to the incoming files. No budget expansion or renderer change
remains. Initial failures and diagnostic logs are retained under `/tmp`.

The integrated browser backend returned no available browser. Interactive browser
verification was NOT RUN. Real LVGL rendering and its RGB565 flushes were tested
under Node, without DOM/canvas widget substitutes.

## Scope and remaining limitations

This is the existing structural, non-POSIX grammar profile. Reserved words are
still global, IO_NUMBER adjacency is unfinished, and some missing compound
separators are accepted (for example `if true then echo yes; fi` and
`for x in a do echo hi; done`). Those compounds do not execute in the bounded
MVP. Heredocs, expansions, pipelines/redirection execution, jobs and multiline
editing are not implemented by this integration. Quote evaluation retains the
existing limited MVP semantics.

Limits: 255 editable ASCII bytes, 32 lexer tokens including EOF, 12 words,
95 decoded bytes per word, 1,024 tree nodes, 4,096-byte terminal buffer.

## Git and preservation

Principal owner: maiaos; branch `main`, HEAD `306c1ee`. This new
integration is local/uncommitted; no commits, pushes, npm publication, version
changes, history rewrites or submodule pin changes were performed for it.
Existing pre-task edits were backed up at:
`/tmp/maiaos-shell-integration-before-inr07w6i`.
Fifteen existing files were intentionally changed for integration; the other 82
baseline files remain byte-identical. Existing UI, catalog, manifests, shell JS
wrapper and other unrelated work were preserved. Dependencies remain clean and
aligned to recorded published gitlinks. Staging is empty. Any later publication should review the existing local MVP
prerequisites together with this integration, rather than committing a partial
app slice without its host/UI support.

Reproduction logs/evidence:
`/tmp/maiaos-shell-delivery-build.log`,
`/tmp/maiaos-shell-final-unit.log`,
`/tmp/maiaos-shell-final-grammar.log`,
`/tmp/maiaos-shell-final-parser.log`,
`/tmp/maiaos-shell-final-host.log`,
`/tmp/maiaos-shell-final-original-lvgl.log`,
`/tmp/maiaos-shell-final-original-other-apps.log`,
`/tmp/maiaos-shell-integration-final-evidence.json`.
