import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cpp = path.join(root, "maiacpp");
const shell = path.join(root, "apps/shell");
const glob = path.join(root, "maiaglob");
assert.ok(fs.existsSync(path.join(glob, "maia_glob_compile.cpp")), "Initialize the published MaiaGlob submodule");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "maia-shell-build-"));
const keep = process.env.MAIA_SHELL_KEEP_BUILD === "1";
const { Cpp98Compiler } = require(path.join(cpp, "compiler/cpp-compiler.js"));
const { compileSource } = require(path.join(cpp, "maiac/compiler/c-compiler.js"));
try {
  const generated = path.join(shell, "generated");
  fs.mkdirSync(generated, { recursive: true });
  execFileSync("bash", [path.join(cpp, "maiacc/bin/tREx.sh"), "--ebnf",
    "--to-xml", path.join(temporary, "shell.xml"), "--language", "cpp98",
    path.join(shell, "maia-shell.ebnf"), path.join(generated, "maia-shell-parser.hpp")],
  { cwd: root, stdio: "inherit" });
  fs.copyFileSync(path.join(cpp, "maiaregex/maia_regex.h"), path.join(generated, "maia_regex.h"));
  // One C++ translation unit shares public POD helpers. Generated identifiers
  // are scoped by the owner's prefix include, then restored before shell input.
  const unity = path.join(temporary, "shell-unity.cpp");
  const prefix = fs.readFileSync(path.join(glob, "generated/glob-prefix.hpp"), "utf8");
  const rawGlob = fs.readFileSync(path.join(glob, "generated/glob-parser.hpp"), "utf8");
  const undefNames = [...new Set([...prefix.matchAll(/^#define\s+(\w+)/gm),
    ...rawGlob.matchAll(/^#define\s+(MAIACC_\w+)/gm)].map(match => match[1]))];
  fs.writeFileSync(unity, `#include "${path.join(glob, "maia_glob_compile.cpp")}"\n`
    + undefNames.map(name => `#undef ${name}\n`).join("")
    + `#include "${path.join(shell, "shell.cpp")}"\n`);
  const emitted = path.join(temporary, "shell.c");
  const code = new Cpp98Compiler(unity, {
    astStrict: true, legacyFunctionHints: false,
  }).compile();
  assert.doesNotMatch(code, /stub-fallback|deterministic-fold/, "Shell bodies must be implemented");
  fs.writeFileSync(emitted, code);
  if (process.argv.includes("--check-c89")) {
    execFileSync(process.env.CC || "clang", ["--target=wasm32-unknown-unknown", "-std=c89", "-pedantic-errors", "-ffreestanding",
      "-Werror=implicit-function-declaration", "-fsyntax-only", emitted], { stdio: "inherit" });
  }
  const linked = path.join(temporary, "shell-linked.c");
  fs.writeFileSync(linked, `#define MAIACPP_USE_C_ALLOCATOR
#include "${path.join(cpp, "maiac/src/stdlib.c")}"
#include "${path.join(cpp, "maiac/src/string.c")}"
#include "${path.join(cpp, "maiaregex/maia_regex.c")}"
#include "${path.join(glob, "maia_glob.c")}"
#include "${emitted}"
`);
  const compiled = compileSource(fs.readFileSync(linked, "utf8"), {
    sourcePath: linked, resolveSystemIncludes: true, validate: true,
  });
  assert.ok(compiled.wasm, compiled.validationError?.message || "Invalid shell WASM");
  const bytes = Buffer.from(compiled.wasm);
  const module = new WebAssembly.Module(bytes);
  for (const item of WebAssembly.Module.imports(module)) {
    assert.ok(item.module.startsWith("maia.") || (item.module === "env"
      && ["__builtin_wasm_memory_size", "__builtin_wasm_memory_grow", "__malloc", "__free"].includes(item.name)),
    `Unexpected shell host dependency: ${item.module}.${item.name}`);
  }
  const output = path.join(shell, "shell.wasm");
  fs.writeFileSync(output + ".tmp", bytes);
  fs.renameSync(output + ".tmp", output);
  console.log(`MaiaOS shell: generated C++98 lexer/parser + guest MaiaRegex/libc -> WASM (${bytes.length} bytes)`);
} finally {
  if (keep) console.log(`Preserved shell build: ${temporary}`);
  else fs.rmSync(temporary, { recursive: true, force: true });
}
