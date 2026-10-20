import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shell = path.join(root, "apps/shell");
const cc = path.join(root, "maiacpp/maiacc");
const regex = path.join(root, "maiacpp/maiaregex");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "maia-shell-raw-parity-"));
const scenarios = JSON.parse(fs.readFileSync(path.join(shell, "tests/shell-grammar-scenarios.json")));
const hex = (value) => Buffer.from(value).toString("hex") || "-";
function flatten(node, depth = 0, output = []) {
  const terminal = node.kind === "terminal";
  output.push([depth, terminal ? "T" : "N", terminal ? node.token : node.name,
    terminal ? hex(node.value) : "-"].join("\t"));
  for (const child of node.children || []) flatten(child, depth + 1, output);
  return output;
}
try {
  for (const [language, name] of [["javascript", "parser.cjs"], ["cpp98", "maia-shell-parser.hpp"]]) {
    execFileSync("bash", [path.join(cc, "bin/tREx.sh"), "--ebnf", "--language", language,
      "--to-xml", path.join(temporary, "shell.xml"), path.join(shell, "maia-shell.ebnf"), path.join(temporary, name)],
    { stdio: "pipe" });
  }
  const Parser = require(path.join(temporary, "parser.cjs"));
  const { ParseTreeCollector } = require(path.join(cc, "parser-generator/parse-tree-collector.js"));
  const binary = path.join(temporary, "raw-parser");
  execFileSync(process.env.CXX || "clang++", ["-x", "c++", "-std=c++98", "-pedantic-errors", "-O1",
    "-I", temporary, "-I", regex, path.join(shell, "tests/generated-lexer-driver.cpp"),
    path.join(regex, "maia_regex.c"), "-o", binary], { stdio: "inherit" });
  const cases = [...scenarios.valid.map((s) => ({ ...s, accepted: true })),
    ...scenarios.invalid.map((s) => ({ ...s, accepted: false })),
    ...["commands.sh", "control-flow.sh", "missing-fi.invalid.sh"].map((file) => ({
      name: file, file: `fixtures/${file}`, accepted: !file.includes(".invalid."),
    })),
    { name: "Unicode quoted token offsets", source: 'echo "café 😄"\n', accepted: true },
    { name: "unterminated double quote", source: 'echo "open', accepted: false },
    { name: "unterminated single quote", source: "echo 'open", accepted: false },
    { name: "dangling escape", source: "echo tail\\", accepted: false },
    { name: "deepest token-bounded subshell", source: "(".repeat(14) + "echo x" + ")".repeat(14), accepted: true },
    { name: "token-bounded missing subshell closers", source: "(".repeat(29) + "echo x", accepted: false },
    { name: "token-bounded missing if bodies", source: "if ".repeat(29) + "echo x", accepted: false },
    { name: "token-bounded open subshells", source: "(".repeat(31), accepted: false },
  ];
  for (const item of cases) {
    const source = item.source ?? fs.readFileSync(path.join(shell, "tests", item.file), "utf8");
    const collector = new ParseTreeCollector();
    let parser;
    let accepted = false;
    try { parser = new Parser(source, collector); collector.parse(parser, item.name); accepted = true; } catch {}
    assert.equal(accepted, item.accepted, `${item.name}: JS grammar expectation`);
    const actual = execFileSync(binary, { input: source, encoding: "utf8", timeout: 10000 }).trimEnd().split("\n");
    if (!parser) assert.deepEqual(actual, ["LEXERROR"], item.name);
    else {
      const expected = [`TOKENS\t${parser.lexer.tokens.length}`,
        ...parser.lexer.tokens.map((t) => [t.type, t.start, t.end, hex(t.value)].join("\t")),
        accepted ? "ACCEPT" : "REJECT", ...(accepted ? flatten(collector.root) : [])];
      assert.deepEqual(actual, expected, `${item.name}: raw C++ lexer tokens/offsets/tree differ from JS`);
    }
    console.log(`PASS generated JS/C++ raw lexer/parser: ${item.name}`);
  }
  console.log(`PASS ${cases.length} raw-input shell lexer/parser cases; no host tokenization`);
  // Measure actual generated-rule calls, independently of collector tree depth.
  // A rule entered again at the same position while still active is a cycle.
  let active = new Set(), depth = 0, peak = 0, calls = 0, cycle = false;
  for (const name of Object.getOwnPropertyNames(Parser.prototype).filter((name) => name.startsWith("parse"))) {
    const original = Parser.prototype[name];
    Parser.prototype[name] = function (...args) {
      const key = `${name}@${this.position}`;
      if (active.has(key)) cycle = true;
      active.add(key); ++depth; ++calls; peak = Math.max(peak, depth);
      try { return original.apply(this, args); }
      finally { --depth; active.delete(key); }
    };
  }
  let flatDepth;
  for (const n of [8, 32, 128]) {
    for (const [kind, source, expected] of [
      ["words", "echo " + "x ".repeat(n), true],
      ["list", "echo x;".repeat(n), true],
      ["pipeline", Array(n).fill("echo x").join("|"), true],
      ["nested", "(".repeat(n) + "echo x" + ")".repeat(n), true],
      ["incomplete", "(".repeat(n) + "echo x", false],
    ]) {
      active = new Set(); depth = peak = calls = 0; cycle = false;
      let accepted = false;
      try { new Parser(source).parse(); accepted = true; } catch {}
      assert.equal(accepted, expected, `${kind}/${n}: acceptance`);
      assert.equal(cycle, false, `${kind}/${n}: recursion without token progress`);
      assert.equal(depth, 0, `${kind}/${n}: rule frames unwind`);
      assert.ok(calls < 50 * n, `${kind}/${n}: excessive rule attempts (${calls})`);
      if (["words", "list", "pipeline"].includes(kind)) {
        flatDepth ??= peak;
        assert.equal(peak, flatDepth, `${kind}/${n}: flat input must use loops`);
      } else assert.ok(peak <= 7 * n + 12, `${kind}/${n}: nesting depth`);
      console.log(`PASS recursion profile ${kind}/${n}: peak=${peak}, calls=${calls}, cycles=0`);
    }
  }
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
