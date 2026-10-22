# Shell read-only cat using the current VFS contract

Status: implemented and reference tested. 2026-10-21. Baseline main `10f1a34`.

The owner asked to continue the implementation after directory navigation was
published. This slice generalizes the existing cat command without new public
imports, capabilities, status codes or filesystem behavior. No compiler, grammar,
version/npm, dependency pointer or publication changes are included.

## Behavior and architecture

- `cat <file>` accepts exactly one nonempty path operand, including quoted paths.
  Resolve absolute/relative paths using the C++98 shell's current logical cwd
  normalizer, including dot/dotdot/root clamping and its 1023-byte path bound.
  Existing 255-byte input / 95-byte decoded-word limits remain.
- Missing/excess operands or an operand starting with `-` produce
  `usage: cat <file>` on stderr; stdin, options and multiple files are not added.
  A file whose basename starts with `-` remains accessible using `./-name`.
- Open only with existing VFS READ flag. VFS remains the sole file authorization
  authority, including private-home and mount policy. No directory snapshot probe
  or host filesystem fallback is used. Read-only directory targets/missing files
  retain the existing generic `cat: cannot open file` diagnostic because the
  current file-open API does not distinguish them. Permission failures produce
  `cat: permission denied`; quota failure `cat: open-file limit exceeded`;
  invalid/oversized path `cat: invalid path`. Failed reads retain
  `cat: read failed`. Errors go to stderr and do not change cwd.
- Copy file bytes to stdout unchanged, including NUL and arbitrary UTF-8 chunks,
  with no appended newline. The terminal independently decodes/render bytes
  according to its existing profile. Prompts remain shell-generated; an
  unterminated file's final line is immediately followed by the next prompt.
- Retain bounded 128-byte reads and the existing pending-output queue, yielding
  on stream backpressure. Close the file at EOF/read error/exit; host lifecycle
  cleanup releases it after a trap. EOF on stdin with a final unterminated cat
  drains output before process exit, without an extra prompt.
- Preserve generated lexer/parser and keep execution/path resolution in the guest.
  I/O remains real C++98 io.wasm with maia.gfx -> LVGL callbacks; kernel stays
  scheduled. JavaScript transports bounded streams and VFS file bytes only.

## Verification

Build through pinned MaiaCpp AST-strict -> C89 -> MaiaC/MaiaWASM, including strict
C89 syntax checking. Exercise actual shell WASM with absolute/relative/quoted/
Unicode paths, own/foreign home files, empty/missing/directory targets, malformed
arity and path bounds, exact binary bytes and unterminated text. Force a 31-byte
output ring and slow/closed peers, read failure after partial output, stdin EOF,
quota exhaustion, repeated reads and cleanup. Extend actual kernel/I/O/shell
LVGL tests with file output and large-file scheduling, and boot cleanup with a
real guest file-read import trap. Retain all directory/stream/app regressions.
Interactive browser and device/MaiaWASMVM checks are separate from Node reference
execution. Implementation authorization does not include a new commit/push.

## Results

`npm run build:shell -- --check-c89` PASS: 1193374-byte guest. `npm test`
PASS 38; `test:shell-files`, `test:shell-directories`, `test:io-streams`,
`test:shell-lvgl`, `test:shell-boot`, `test:lvgl-host` all PASS. The file suite
compares exact 128KiB of binary stdout through a 31-byte ring and 1000 repeated
reads. The actual LVGL session checks relative/absolute paths, empty and
unterminated content, own/foreign home access, quoted paths and large UTF-8 file
output while the kernel keeps stepping. Stable memories: shell 18 pages, I/O 2;
73612 kernel steps in the expanded session. Boot teardown also covers a real
cat read import trap with a live file; no handles/windows/endpoints survive.

Manifest, exact WASM import set, EBNF and generated parser/Regex headers are
unchanged from `10f1a34`. All seven principal compiler/dependency repositories are
clean. No new ABI, capabilities, compiler changes or version/npm publication.
Interactive browser/device/MaiaWASMVM checks remain unrun. This implementation
and its documentation remain local; no new commit or push was authorized.
