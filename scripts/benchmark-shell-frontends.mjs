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
const cpp = path.join(root, 'maiacpp'), shell = path.join(root, 'apps/shell');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-shell-performance-'));
console.log(`Performance artifacts: ${temp}`);
const measuredRegex = `
static unsigned int regex_calls = 0;
static double regex_bytes = 0.0;
void* measured_calloc(size_t count, size_t size) {
  ++regex_calls; regex_bytes += (double)count * (double)size;
  return calloc(count, size);
}
unsigned int measured_calls() { return regex_calls; }
double measured_bytes() { return regex_bytes; }
void measured_reset() { regex_calls = 0; regex_bytes = 0; }
#define calloc measured_calloc
#include "${cpp}/maiaregex/maia_regex.c"
#undef calloc
`;
for (const [language, name] of [['javascript', 'parser.cjs'], ['cpp98', 'maia-shell-parser.hpp']]) execFileSync('bash', [path.join(cpp, 'maiacc/bin/tREx.sh'), '--ebnf', '--language', language, '--to-xml', path.join(temp, 'shell.xml'), path.join(shell, 'maia-shell.ebnf'), path.join(temp, name)], { stdio: 'pipe' });
fs.copyFileSync(path.join(cpp, 'maiaregex/maia_regex.h'), path.join(temp, 'maia_regex.h'));
const driver = path.join(temp, 'driver.cpp');
fs.writeFileSync(driver, fs.readFileSync(path.join(shell, 'tests/generated-wasm-driver.cpp'), 'utf8').replace('../maia-shell-parse-tree-collector.hpp', path.join(shell, 'maia-shell-parse-tree-collector.hpp')));
const nativeSource = path.join(temp, 'native.cpp');
fs.writeFileSync(nativeSource, `#include <iostream>
#include <ctime>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include "${driver}"
${measuredRegex}
int main(int argc, char** argv) {
  if (argc != 2) return 1;
  unsigned int length = (unsigned int)std::strlen(argv[1]);
  if (length >= 4096) return 2;
  std::memcpy(probe_input(), argv[1], length);
  if (probe_run(length) != 4) return 3;
  measured_reset(); probe_lex(length);
  std::cout << "{\\"calls\\":" << measured_calls() << ",\\"bytes\\":" << measured_bytes() << ",\\"us\\":[";
  for (unsigned int mode = 0; mode < 4; ++mode) {
    probe_bench(mode, 3, length);
    std::clock_t start = std::clock(); probe_bench(mode, 4, length);
    double pilot = (double)(std::clock() - start) / CLOCKS_PER_SEC;
    unsigned int count = (unsigned int)(0.01 * 4 / (pilot > 0 ? pilot : 0.000001));
    if (count < 1) count = 1; if (count > 50000) count = 50000;
    double samples[5];
    for (unsigned int s = 0; s < 5; ++s) {
      start = std::clock(); unsigned int sum = probe_bench(mode, count, length);
      samples[s] = (double)(std::clock() - start) * 1000000 / CLOCKS_PER_SEC / count;
      if (sum != 4 * count) return 4;
    }
    std::sort(samples, samples + 5);
    if (mode) std::cout << ','; std::cout << samples[2];
  }
  std::cout << "]}\\n";
}
`);
const binary = path.join(temp, 'native');
const measuredBinary = path.join(temp, 'native-counted');
const nativeFlags = ['-std=c++98', '-pedantic-errors', '-O2', '-I', temp, '-I', path.join(cpp, 'maiaregex')];
execFileSync(process.env.CXX || 'clang++', [...nativeFlags, nativeSource, '-o', measuredBinary], { stdio: 'inherit' });
// Keep allocation instrumentation out of all timed implementations.
fs.writeFileSync(nativeSource, fs.readFileSync(nativeSource, 'utf8').replace(measuredRegex,
  `unsigned int measured_calls() { return 0; }\ndouble measured_bytes() { return 0.0; }\nvoid measured_reset() {}\n#include "${cpp}/maiaregex/maia_regex.c"\n`));
execFileSync(process.env.CXX || 'clang++', [...nativeFlags, nativeSource, '-o', binary], { stdio: 'inherit' });
const { Cpp98Compiler } = require(path.join(cpp, 'compiler/cpp-compiler.js'));
const { compileSource } = require(path.join(cpp, 'maiac/compiler/c-compiler.js'));
const emitted = path.join(temp, 'driver.c');
fs.writeFileSync(emitted, new Cpp98Compiler(driver, { astStrict: true, legacyFunctionHints: false }).compile());
const linked = path.join(temp, 'linked.c');
fs.writeFileSync(linked, `#define MAIACPP_USE_C_ALLOCATOR\n#include "${cpp}/maiac/src/stdlib.c"\n#include "${cpp}/maiac/src/string.c"\n#include "${cpp}/maiaregex/maia_regex.c"\n#include "${emitted}"\n`);
const compiled = compileSource(fs.readFileSync(linked, 'utf8'), { sourcePath: linked, resolveSystemIncludes: true, validate: true });
assert.ok(compiled.wasm, compiled.validationError?.message);
fs.writeFileSync(path.join(temp, 'driver.wasm'), Buffer.from(compiled.wasm));
const unexpected = () => { throw new Error('Unexpected graphics in parser benchmark'); };
const host = createMaiaHostImports({ graphics: Object.fromEntries(['windowCreate', 'labelCreate', 'labelSetText', 'buttonCreate', 'objectDestroy'].map(n => [n, unexpected])), vfs: new MemoryVfsAdapter({ appId: 'org.maiaos.shell-performance' }) });
const module = new WebAssembly.Module(Buffer.from(compiled.wasm));
assert.ok(WebAssembly.Module.imports(module).every(i => i.module === 'env'));
const instance = new WebAssembly.Instance(module, host.imports); host.attachInstance(instance);
const e = instance.exports;
const Parser = require(path.join(temp, 'parser.cjs')), Lexer = new Parser('').lexer.constructor;
const { ParseTreeCollector } = require(path.join(cpp, 'maiacc/parser-generator/parse-tree-collector.js'));
const modes = ['lexer', 'parser', 'parser+collector', 'full+collector'];
function measure(run) {
  run(3); let start = performance.now(); run(4); const pilot = performance.now() - start;
  const count = Math.max(1, Math.min(50000, Math.ceil(10 * 4 / Math.max(pilot, 0.001))));
  const samples = [];
  for (let sample = 0; sample < 5; ++sample) { start = performance.now(); assert.equal(run(count), 4 * count); samples.push((performance.now() - start) * 1000 / count); }
  return samples.sort((a, b) => a - b)[2];
}
const inputs = [ ['simple', 'echo hello'], ...[16, 64, 256, 1024].map(n => [`word-${n}`, 'echo ' + 'x'.repeat(n)]), ...[4, 16, 64, 128].map(n => [`list-${n}`, 'echo x;'.repeat(n)]), ...[4, 16, 64, 128].map(n => [`nested-${n}`, '('.repeat(n) + 'echo x' + ')'.repeat(n)]) ];
const report = { units: 'median microseconds/operation, 5 samples, warmed, build/startup/transport excluded', platform: `${os.platform()} ${os.arch()}`, node: process.version, modes, results: [] };
for (const [name, source] of inputs) {
  const native = JSON.parse(execFileSync(binary, [source], { encoding: 'utf8', timeout: 120000 }));
  const counted = JSON.parse(execFileSync(measuredBinary, [source], { encoding: 'utf8', timeout: 120000 }));
  const input = Buffer.from(source); new Uint8Array(e.memory.buffer).set(input, e.probe_input());
  assert.equal(e.probe_run(input.length), 4); const stack = e.__stack_ptr.value;
  const allocation = { calls: counted.calls, bytes: counted.bytes, measuredIn: 'separate native instrumented build; cumulative, not live memory' };
  const wasmUs = modes.map((_, mode) => measure(count => e.probe_bench(mode, count, input.length)));
  assert.equal(e.__stack_ptr.value, stack);
  const tokens = new Lexer(source).tokenize();
  const parser = new Parser(source);
  const jsUs = modes.map((_, mode) => measure(count => {
    for (let i = 0; i < count; ++i) {
      if (mode === 0) { new Lexer(source).tokenize(); continue; }
      if (mode === 3) { new Parser(source, new ParseTreeCollector()).parse(); continue; }
      parser.tokens = tokens; parser.position = 0; parser.errors = []; parser.failureMemo = new Set();
      parser.eventHandler = mode === 2 ? new ParseTreeCollector() : null; parser.parse();
    }
    return 4 * count;
  }));
  const result = { name, bytes: input.length, tokens: tokens.length, regexMemo: allocation, jsUs, nativeUs: native.us, wasmUs };
  report.results.push(result); fs.writeFileSync(path.join(temp, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(result));
}
report.allocation = [];
for (const bytes of [4096, 65536, 1048576]) for (const operation of ['malloc', 'calloc']) {
  const us = measure(count => {
    for (let i = 0; i < count; ++i) {
      const pointer = operation === 'malloc' ? e.malloc(bytes) : e.calloc(bytes, 1);
      assert.ok(pointer, 'Guest allocator benchmark failed');
      e.free(pointer);
    }
    return 4 * count;
  });
  const row = { bytes, operation, us };
  report.allocation.push(row); console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(temp, 'report.json'), JSON.stringify(report, null, 2));
console.log(`PASS phased measurements and checksums; report ${temp}/report.json`);
