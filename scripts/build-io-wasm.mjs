import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-io-build-'));
try {
  const { Cpp98Compiler } = require(path.join(root, 'maiacpp/compiler/cpp-compiler.js'));
  const { compileSource } = require(path.join(root, 'maiacpp/maiac/compiler/c-compiler.js'));
  const source = path.join(root, 'apps/io/io.cpp');
  const code = new Cpp98Compiler(source, { astStrict: true, legacyFunctionHints: false }).compile();
  assert.doesNotMatch(code, /stub-fallback|deterministic-fold/);
  const emitted = path.join(temp, 'io.c'); fs.writeFileSync(emitted, code);
  if (process.argv.includes('--check-c89')) execFileSync(process.env.CC || 'clang', ['--target=wasm32-unknown-unknown', '-std=c89', '-pedantic-errors', '-ffreestanding', '-Werror=implicit-function-declaration', '-fsyntax-only', emitted], { stdio: 'inherit' });
  const compiled = compileSource(code, { sourcePath: emitted, resolveSystemIncludes: true, validate: true });
  assert.ok(compiled.wasm, compiled.validationError?.message);
  const bytes = Buffer.from(compiled.wasm);
  const module = new WebAssembly.Module(bytes);
  assert.ok(WebAssembly.Module.imports(module).every(i => i.module.startsWith('maia.')), 'I/O must use only MaiaOS imports');
  const output = path.join(root, 'apps/io/io.wasm'); fs.writeFileSync(output + '.tmp', bytes); fs.renameSync(output + '.tmp', output);
  console.log(`MaiaOS I/O: C++98 -> C89 -> WASM (${bytes.length} bytes)`);
} finally {
  if (process.env.MAIA_IO_KEEP_BUILD === '1') console.log(`Preserved I/O build: ${temp}`);
  else fs.rmSync(temp, { recursive: true, force: true });
}
