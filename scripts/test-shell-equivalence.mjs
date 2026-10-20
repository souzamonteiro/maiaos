import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createMaiaHostImports } from '../runtime/maia-host-imports.js';
import { MemoryVfsAdapter } from '../runtime/maia-vfs.js';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shell = path.join(root, 'apps/shell'), cpp = path.join(root, 'maiacpp');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-shell-equivalence-'));
const keep = process.env.MAIA_SHELL_KEEP_BUILD === '1';
let passed = false;
const unexpectedGraphics = () => { throw new Error('Parser test must not call graphics'); };
const host = createMaiaHostImports({
  graphics: Object.fromEntries(['windowCreate', 'labelCreate', 'labelSetText', 'buttonCreate', 'objectDestroy'].map(name => [name, unexpectedGraphics])),
  vfs: new MemoryVfsAdapter({ appId: 'org.maiaos.shell-equivalence' }),
});
const hex = value => Buffer.from(value).toString('hex') || '-';
function flatten(node, depth = 0, output = []) {
  const terminal = node.kind === 'terminal';
  output.push([depth, terminal ? 'T' : 'N', terminal ? node.token : node.name,
    terminal ? hex(node.value) : '-'].join('\t'));
  for (const child of node.children || []) flatten(child, depth + 1, output);
  return output;
}
try {
  for (const [language, name] of [['javascript', 'parser.cjs'], ['cpp98', 'maia-shell-parser.hpp']]) {
    execFileSync('bash', [path.join(cpp, 'maiacc/bin/tREx.sh'), '--ebnf', '--language', language,
      '--to-xml', path.join(temporary, 'shell.xml'), path.join(shell, 'maia-shell.ebnf'), path.join(temporary, name)], { stdio: 'pipe' });
  }
  fs.copyFileSync(path.join(cpp, 'maiaregex/maia_regex.h'), path.join(temporary, 'maia_regex.h'));
  const Parser = require(path.join(temporary, 'parser.cjs'));
  const Lexer = new Parser('').lexer.constructor;
  const { ParseTreeCollector } = require(path.join(cpp, 'maiacc/parser-generator/parse-tree-collector.js'));
  const corpus = new Map();
  function add(source, name) { if (!corpus.has(source)) corpus.set(source, name); }
  const scenarios = JSON.parse(fs.readFileSync(path.join(shell, 'tests/shell-grammar-scenarios.json')));
  for (const item of [...scenarios.valid, ...scenarios.invalid]) add(item.source ?? fs.readFileSync(path.join(shell, 'tests', item.file), 'utf8'), item.name);
  for (const file of ['commands.sh', 'control-flow.sh', 'missing-fi.invalid.sh']) add(fs.readFileSync(path.join(shell, 'tests/fixtures', file), 'utf8'), file);
  for (let i = 0; i < 128; ++i) for (const source of [String.fromCharCode(i), `echo '${String.fromCharCode(i)}'`, `echo "${String.fromCharCode(i)}"`, `#${String.fromCharCode(i)}\necho x`]) add(source, `ASCII ${i}`);
  for (const char of ['é', '中', '😄', '\u0085', '\u00a0', '\u2028', '\u2029', '\ufffd', '\uffff', '\u{10ffff}']) {
    for (const source of [`echo '${char}' x`, `echo "${char}" x`, `#${char}\necho x`, `echo ${char}`]) add(source, 'Unicode boundary');
  }
  const fragments = ['a', 'if', 'then', 'fi', 'for', 'in', 'do', 'done', '1', '12', 'a=', 'a=x', ' ', '\t', '\n', '\r\n', ';', '&', '&&', '|', '||', '<', '>', '>>', '>&', '(', ')', '{', '}', '!', '#', "'", '"', '\\', '=', '$'];
  for (const a of fragments) for (const b of fragments) { add(a + b, 'fragment pair'); add('echo ' + a + b, 'argument pair'); }
  let seed = 0x4d414941;
  function random(n) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; }
  for (let i = 0; i < 1600; ++i) {
    let source = ''; for (let j = 0, count = 1 + random(14); j < count; ++j) source += fragments[random(fragments.length)];
    add(source, `seeded mutation ${i}`);
  }
  for (const n of [1, 2, 4, 8, 14, 29, 32, 64, 128]) {
    add('('.repeat(n) + 'echo x' + ')'.repeat(n), `nested ${n}`);
    add('('.repeat(n) + 'echo x', `incomplete nested ${n}`);
    add('echo x;'.repeat(n), `flat list ${n}`);
    add(Array(n).fill('echo x').join('|'), `pipeline ${n}`);
    add('if '.repeat(n) + 'echo x', `incomplete if ${n}`);
    add("echo '" + 'x'.repeat(n) + "'", `long word ${n}`);
  }
  for (const n of [255, 512, 1024]) for (const source of ['echo ' + 'x'.repeat(n), "echo '" + 'x'.repeat(n) + "'", "echo '" + 'x'.repeat(n)]) add(source, `word boundary ${n}`);
  for (let i = 0; i < 100; ++i) {
    const words = Array.from({ length: 1 + random(8) }, () => ['a', '12', 'x=y', "'if'", '"two words"', 'one\\ two'][random(6)]).join(' ');
    const command = 'echo ' + words;
    for (const source of [command, `(${command})`, `{ ${command}; }`, `if ${command}; then echo yes; else echo no; fi`, `for x in a b; do ${command}; done`, `${command} >out`, `${command} && pwd`, `${command} | cat`]) add(source, 'structured generated command');
  }
  const cases = [...corpus].map(([source, name]) => ({ source, name }));
  console.log(`Comparing ${cases.length} unique raw inputs (seed 0x4d414941)`);
  const jsResults = cases.map(({ source }) => {
    let parser, accepted = false, collector = new ParseTreeCollector();
    try { parser = new Parser(source, collector); collector.parse(parser); accepted = true; } catch {}
    if (!parser) {
      const lexer = new Lexer(source);
      assert.throws(() => lexer.tokenize(), 'Constructor failed without a lexical error');
      return [`LEXERROR\t${lexer.position}`, `TOKENS\t${lexer.tokens.length}`,
        ...lexer.tokens.map(t => [t.type, t.start, t.end, hex(t.value)].join('\t'))];
    }
    return [`TOKENS\t${parser.lexer.tokens.length}`, ...parser.lexer.tokens.map(t => [t.type, t.start, t.end, hex(t.value)].join('\t')), accepted ? 'ACCEPT' : 'REJECT', ...(accepted ? flatten(collector.root) : [])];
  });
  console.log('JS corpus evaluated; building native C++98 adapter');
  const native = path.join(temporary, 'native');
  execFileSync(process.env.CXX || 'clang++', ['-x', 'c++', '-std=c++98', '-pedantic-errors', '-O1', '-I', temporary, '-I', path.join(cpp, 'maiaregex'), path.join(shell, 'tests/generated-lexer-driver.cpp'), path.join(cpp, 'maiaregex/maia_regex.c'), '-o', native], { stdio: 'inherit' });
  const nativeResults = execFileSync(native, ['--batch'], { input: cases.map(c => Buffer.from(c.source).toString('hex')).join('\n') + '\n', encoding: 'utf8', timeout: 120000, maxBuffer: 128 * 1024 * 1024 }).split('END\n');
  assert.equal(nativeResults.pop(), ''); assert.equal(nativeResults.length, cases.length);
  const nativeMismatches = cases.filter((_, i) => JSON.stringify(jsResults[i]) !== JSON.stringify(nativeResults[i].trimEnd().split('\n'))).length;
  console.log(`Native comparison: ${nativeMismatches} divergences`);
  console.log('Building C++98 -> C89 -> WASM adapter using Maia Suite');
  // Preserve the production header include context without modifying generated sources.
  const driver = path.join(temporary, 'driver.cpp');
  fs.writeFileSync(driver, fs.readFileSync(path.join(shell, 'tests/generated-wasm-driver.cpp'), 'utf8').replace('../maia-shell-parse-tree-collector.hpp', path.join(shell, 'maia-shell-parse-tree-collector.hpp')));
  const { Cpp98Compiler } = require(path.join(cpp, 'compiler/cpp-compiler.js'));
  const { compileSource } = require(path.join(cpp, 'maiac/compiler/c-compiler.js'));
  const emitted = path.join(temporary, 'driver.c');
  const code = new Cpp98Compiler(driver, { astStrict: true, legacyFunctionHints: false }).compile();
  assert.doesNotMatch(code, /stub-fallback|deterministic-fold/);
  fs.writeFileSync(emitted, code);
  const linked = path.join(temporary, 'linked.c');
  fs.writeFileSync(linked, `#define MAIACPP_USE_C_ALLOCATOR\n#include "${cpp}/maiac/src/stdlib.c"\n#include "${cpp}/maiac/src/string.c"\n#include "${cpp}/maiaregex/maia_regex.c"\n#include "${emitted}"\n`);
  const compiled = compileSource(fs.readFileSync(linked, 'utf8'), { sourcePath: linked, resolveSystemIncludes: true, validate: true });
  assert.ok(compiled.wasm, compiled.validationError?.message);
  fs.writeFileSync(path.join(temporary, 'driver.wasm'), Buffer.from(compiled.wasm));
  const module = new WebAssembly.Module(Buffer.from(compiled.wasm));
  assert.ok(WebAssembly.Module.imports(module).every(i => i.module === 'env'), 'Test guest needs only libc memory primitives');
  const instance = new WebAssembly.Instance(module, host.imports); host.attachInstance(instance);
  const e = instance.exports;
  const cstring = ptr => { const memory = new Uint8Array(e.memory.buffer); let end = ptr; while (memory[end]) ++end; return Buffer.from(memory.subarray(ptr, end)).toString('utf8'); };
  const bytesHex = (ptr, length) => Buffer.from(e.memory.buffer, ptr, length).toString('hex') || '-';
  const failures = [];
  let acceptedCount = 0, rejectedCount = 0, lexErrors = 0;
  const initialStack = e.__stack_ptr.value;
  for (let index = 0; index < cases.length; ++index) {
    const { source, name } = cases[index], input = Buffer.from(source);
    assert.ok(input.length < 4096);
    new Uint8Array(e.memory.buffer).set(input, e.probe_input());
    const status = e.probe_run(input.length);
    assert.notEqual(status, 2, `Test adapter capacity exhausted: ${name}`);
    assert.equal(e.__stack_ptr.value, initialStack, `WASM stack not restored: ${name}`);
    let wasm;
    wasm = status === 1 ? [`LEXERROR\t${e.probe_error_position()}`] : [];
    wasm.push(`TOKENS\t${e.probe_token_count()}`);
      for (let i = 0; i < e.probe_token_count(); ++i) wasm.push([cstring(e.probe_token_name(i)), e.probe_token_start(i), e.probe_token_end(i), bytesHex(e.probe_token_value(i), e.probe_token_length(i))].join('\t'));
    if (status === 1) ++lexErrors;
    else {
      wasm.push(status === 4 ? 'ACCEPT' : 'REJECT');
      if (status === 4) {
        ++acceptedCount;
        for (let i = 0; i < e.probe_node_count(); ++i) {
          let depth = 0;
          for (let parent = e.probe_node_parent(i); parent >= 0; parent = e.probe_node_parent(parent)) { assert.ok(parent < i); ++depth; }
          const terminal = e.probe_node_kind(i) === 2;
          wasm.push([depth, terminal ? 'T' : 'N', cstring(e.probe_node_name(i)), terminal ? bytesHex(e.probe_node_value(i), e.probe_node_length(i)) : '-'].join('\t'));
        }
      } else ++rejectedCount;
    }
    const nativeLines = nativeResults[index].trimEnd().split('\n');
    if (JSON.stringify(jsResults[index]) !== JSON.stringify(nativeLines) || JSON.stringify(jsResults[index]) !== JSON.stringify(wasm)) failures.push({ index, name, source, js: jsResults[index], native: nativeLines, wasm });
    if (index % 1000 === 0) console.log(`Compared ${index}/${cases.length}`);
  }
  const report = { cases: cases.length, seed: '0x4d414941', acceptedCount, rejectedCount, lexErrors, failures, pages: e.memory.buffer.byteLength / 65536 };
  fs.writeFileSync(path.join(temporary, 'report.json'), JSON.stringify(report, null, 2));
  assert.equal(failures.length, 0, `${failures.length} divergences; first: ${JSON.stringify(failures[0])}; report ${temporary}/report.json`);
  passed = true;
  console.log(`PASS JS/native C++98/WASM: ${cases.length} raw inputs; ${acceptedCount} accepted, ${rejectedCount} syntax errors, ${lexErrors} lexical errors; exact tokens/UTF-16 offsets/complete trees; restored WASM stack.`);
} finally {
  if (keep || !passed) console.log(`Preserved equivalence artifacts: ${temporary}`);
  else fs.rmSync(temporary, { recursive: true, force: true });
}
