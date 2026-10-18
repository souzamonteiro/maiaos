# MaiaOS Shell — implementation blueprint

**Status:** structural phase-one grammar validated with the MaiaCC JavaScript generator and collector against representative fixtures. It is not POSIX-conformant and is not a working shell. The reference for comparison is POSIX.1-2017, Shell Grammar, sections 2.10.1 and 2.10.2.

## Architecture

```mermaid
flowchart TD
 B[Platform boot coordinator] --> K[kernel.wasm]
 B --> I[io.wasm]
 B --> S[shell.wasm]
 B --> D[desktop.wasm - optional]
 K <--> H[Host ABI / import dispatcher]
 I <--> H
 S <--> H
 D <--> H
 H <--> J[io.js - browser adapters]
 H <--> V[vfs.js - IndexedDB/OPFS]
 J <--> T[Terminal DOM / xterm.js]
```

The browser is the real host. Separate WASM modules do not magically share memory or link symbols. Implement a **versioned C ABI** through JS import/export dispatch and copy buffers across separate linear memories. A single shared-memory design is a separate, advanced option requiring compatible toolchains and browser isolation.

The diagram is the target module decomposition. The current browser coordinator is `platform/desktop-web/main.js`; there is no separate `bootloader.js`, and only the kernel, Calculator and Clock guests currently have buildable WASM sources. `io.wasm`, `shell.wasm` and `desktop.wasm` remain planned artifacts. Every C++98 guest is intended to use MaiaCpp AST-strict -> C89 -> MaiaC -> WASM; the LVGL-WASM browser platform module is the only current Emscripten-built module.

## MaiaCC parser generation

The shell grammar source is `apps/shell/maia-shell.ebnf`. Parser generation is owned by the in-repository MaiaCC toolchain (`maiacpp/maiacc`); REx is an internal stage of MaiaCC's EBNF pipeline, not a separate compiler dependency for MaiaOS. The current test runner generates a temporary JavaScript parser and parse-tree collector to validate grammar fixtures. It does not produce `shell.wasm` or implement command execution.

1. Edit only `apps/shell/maia-shell.ebnf` for grammar changes; never hand-edit generated parsers.
2. Use the MaiaCC parser generator from the recursive submodule and regenerate the target parser from EBNF.
3. Run the shell grammar fixtures and validate lexer/parser token and source-offset agreement.
4. Keep the temporary JavaScript parser used by this test harness distinct from the future shell runtime parser/guest.
5. When shell execution is implemented, compile the C++98 guest through MaiaCpp AST-strict -> C89 -> MaiaC -> WASM; do not use Emscripten for `shell.wasm`.

**Important:** the grammar is only a structural subset. It covers basic simple commands, assignments, file redirections, pipelines, AND/OR lists, subshells, brace groups, `if`, `while`, `until`, and `for`. It does not yet cover `case`, function definitions, here-document bodies, or POSIX word expansion. Its quoted-word lexer is deliberately limited. It also treats reserved words globally and recognizes digit-only tokens as `IO_NUMBER` without checking that they are adjacent to `<` or `>`; POSIX 2.10 requires parser-context classification for reserved words, `NAME`, `ASSIGNMENT_WORD`, and `IO_NUMBER`. These cases require a stateful/context-aware scanner or parser integration, not a change to the grammar productions alone. No POSIX-conformance claim should be made until those rules are implemented and differentially tested.

The current grammar was generated to a temporary JavaScript parser with MaiaCC and exercised through `ParseTreeCollector`. Valid fixtures covered simple commands, assignments, redirections, pipelines, AND/OR lists, comments, quoting, compound groups and loops. Invalid fixtures covered repeated separators and adjacent pipeline operators. This verifies generation and the declared subset only; it does not replace the POSIX lexical-convention rules.

## Parser test runner

The runner regenerates the JS parser into the OS temporary directory, parses the scenario corpus, checks expected production rules, and compares every parse-tree terminal with the lexer's token stream and source offsets. Generated parser files are removed when the run ends.

Point `MAIACC_ROOT` at the in-repository MaiaCC submodule, then run the suite:

```sh
MAIACC_ROOT="$PWD/maiacpp/maiacc" npm run test:shell-grammar
```

Print every accepted fixture tree, or inspect a script/command directly:

```sh
MAIACC_ROOT="$PWD/maiacpp/maiacc" npm run test:shell-grammar -- --print-trees
MAIACC_ROOT="$PWD/maiacpp/maiacc" npm run test:shell-grammar -- --file apps/shell/tests/fixtures/demo.sh
MAIACC_ROOT="$PWD/maiacpp/maiacc" npm run test:shell-grammar -- --input 'echo hello | wc -l'
```

The default run reports known POSIX lexical gaps separately. Add `--strict-posix` to make those gaps fail the command while contextual tokenization remains unfinished.

## Parsing semantics

Use stages: browser input -> incremental lexer -> REx parser -> AST -> expansions -> executor -> kernel ABI. Lexer must preserve newlines, comments, quote contexts, heredoc delimiters/bodies, reserved words in command position, assignment words, and IO_NUMBER adjacency. Expansions: tilde, parameter, command, arithmetic, field splitting, pathname globbing, quote removal (correct order and contexts). Redirections are processed left to right. `cd`, `export`, `unset`, `set`, `exit`, `read`, `shift`, `trap` and `umask` must run in the current shell environment when appropriate.

## Terminal and asynchronous stdin

Use xterm.js or a minimal DOM terminal for display. Keyboard events produce UTF-8 bytes and control events (Enter, Backspace, Ctrl-C, Ctrl-D). `io.js` queues input per TTY; `io.wasm` manages canonical editing, echo, line discipline, and fd 0/1/2. **Do not synchronously block the browser main thread.** Prefer asyncify/JSPI where supported, or an explicit coroutine/state-machine API (`shell_start`, `shell_feed`, `shell_poll`, `shell_resume`) with `EAGAIN`/pending results. A dedicated Worker can run WASM and exchange messages with the UI; blocking waits are only appropriate in a Worker with supported shared-memory primitives. `read` builtin consumes the same fd 0 stream as external programs.

## Host ABI proposal

`maia_open(path, flags, mode) -> fd`; `maia_close(fd)`; `maia_read(fd, ptr, len) -> ssize_t/pending`; `maia_write(fd, ptr, len)`; `maia_seek(fd, off, whence)`; `maia_stat(path, out)`; `maia_readdir(fd, out)`; `maia_mkdir(path, mode)`; `maia_unlink(path)`; `maia_rename(old,new)`; `maia_chdir(path)`; `maia_getcwd(out,len)`; `maia_clock_gettime(...)`; `maia_spawn(...)`; `maia_wait(...)`; `maia_pipe(...)`; `maia_dup2(...)`; `maia_tty_ioctl(...)`.

Use integer handles, fixed-width types, errno conventions, UTF-8 paths, ABI version checks, and per-process descriptor tables. Pointers always refer to the *calling module's* memory and require marshaling by the host. Define pending/async semantics explicitly; a plain synchronous C ABI cannot transparently await browser storage operations.

## Virtual filesystem

Mount `/` (root), `/bin` (commands), `/home/guest`, `/tmp`, `/dev` (tty/null/zero), `/proc` (synthetic, optional). `vfs.js` maintains inodes, directories, metadata, symlinks (phase 2), file handles and mounts. Start with memory backend, add OPFS/IndexedDB persistence and transactional error handling. Never treat browser storage as a real host POSIX filesystem. `cwd` is per-process; `cd` does not change the browser URL.

## Command inventory

**Shell builtins, phase 1:** `:`, `.`, `alias`, `bg`, `break`, `cd`, `command`, `continue`, `echo`, `eval`, `exec`, `exit`, `export`, `false`, `fg`, `getopts`, `hash`, `jobs`, `kill`, `pwd`, `read`, `readonly`, `return`, `set`, `shift`, `test`, `[`, `times`, `trap`, `true`, `type`, `ulimit`, `umask`, `unalias`, `unset`, `wait`.

**Core utilities, phase 1:** `basename`, `cat`, `clear`, `cmp`, `cp`, `cut`, `date`, `dirname`, `env`, `expr`, `find`, `grep`, `head`, `id`, `ln`, `ls`, `mkdir`, `mktemp`, `mv`, `printf`, `rm`, `rmdir`, `sed`, `seq`, `sleep`, `sort`, `stat`, `tail`, `tee`, `touch`, `tr`, `uname`, `uniq`, `wc`, `which`, `xargs`, `yes`.

**Phase 2 (depending on kernel support):** `awk`, `chmod`, `chown`, `dd`, `df`, `du`, `file`, `gzip`, `gunzip`, `less`, `more`, `od`, `paste`, `ps`, `tar`, `time`, `timeout`, `top`, `tty`, `vi`.

**Not promised:** real OS processes, native fork/exec, signals, networking, users/groups, device permissions or complete BusyBox behavior. These need explicit emulation or capability mapping. A command name in the inventory is a target, not an implemented feature.

## Implementation roadmap

1. Boot: loader instantiates modules and checks ABI versions; terminal prints `MaiaOS>`.
2. TTY: editable input line, stdout/stderr, Ctrl-C/Ctrl-D, multiline continuation.
3. VFS: memory filesystem, fd table, `/home/guest`, basic read/write/list operations.
4. Parser: validate grammar and generated C++; AST for words, simple commands, pipelines, redirections.
5. Executor: `echo`, `pwd`, `cd`, `ls`, `cat`, `mkdir`, `touch`, `rm`, `exit`.
6. Jobs: pipe buffers with backpressure; cooperative tasks and `wait`; no false claims of POSIX fork.
7. Shell language: variables, quoting, expansion, if/for/while/functions, substitutions, heredocs.
8. Persistence and GUI: OPFS/IndexedDB and optional `desktop.wasm` terminal window.
9. POSIX conformance: build fixtures from the Open Group shell specification and differential-test against `dash`/BusyBox `ash` where semantics are comparable.

## Acceptance criteria

`echo hello`; `pwd`; `mkdir demo; cd demo; echo hi > a.txt; cat a.txt`; `echo abc | tr a-z A-Z`; `false || echo recovered`; `printf 'a\nb\n' | wc -l`; `read name` (type at terminal); multiline input; Ctrl-C; EOF; reload and recover persisted file. Verify exit codes, stderr, ordering, no UI freeze, no dropped bytes, no parser hang on malformed input, and ABI mismatch detection.

## References

- POSIX.1-2017 Shell Grammar, lexical conventions and grammar rules: https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_10
- POSIX shell grammar source for study: https://gist.github.com/Chubek/42ec6e7b65d17888eeaaaad50738bff9
- REx: https://github.com/GuntherRademacher/rex-parser-generator
- POSIX Shell Command Language: https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html
- BusyBox: https://busybox.net/
