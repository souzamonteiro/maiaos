import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "../..");
const trex = path.join(repo, "maiacpp/maiacc/bin/tREx.sh");
const grammar = path.join(root, "maia-shell.ebnf");
const xml = path.join(root, "maia-shell.xml");
const cppEnabled = process.argv.includes("--cpp");
const printTrees = process.argv.includes("--print-trees");
function generate(language, target) {
  execFileSync("bash", [trex, "--ebnf", "--to-xml", xml,
    "--language", language, grammar, path.join(root, target)], { stdio: "pipe" });
}
function loadCommonJs(filename) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, filename), "utf8"),
    { module, exports: module.exports, structuredClone, console }, { filename });
  return module.exports;
}
function flatten(node, depth = 0, output = []) {
  const terminal = node.kind === "terminal";
  output.push([depth, terminal ? "T" : "N", terminal ? node.token : node.name,
    terminal ? Buffer.from(node.value).toString("hex") || "-" : "-"].join("\t"));
  for (const child of node.children || []) flatten(child, depth + 1, output);
  return output;
}
const scenarios = JSON.parse(fs.readFileSync(path.join(root, "tests/shell-grammar-scenarios.json")));
const cases = [
  ...scenarios.valid.map((item) => ({ ...item, accepted: true })),
  ...scenarios.invalid.map((item) => ({ ...item, accepted: false })),
];
for (const filename of ["commands.sh", "control-flow.sh", "missing-fi.invalid.sh"]) {
  cases.push({ name: filename, file: `fixtures/${filename}`, accepted: !filename.includes(".invalid.") });
}
generate("javascript", "maia-shell.js");
const Parser = loadCommonJs("maia-shell.js");
const { ParseTreeCollector } = loadCommonJs("parse-tree-collector.js");
const results = [];
for (const item of cases) {
  const source = item.source ?? fs.readFileSync(path.join(root, "tests", item.file), "utf8");
  const collector = new ParseTreeCollector();
  let parser;
  let accepted = false;
  try {
    parser = new Parser(source, collector);
    collector.parse(parser, item.name);
    accepted = true;
  } catch (error) {
    if (item.accepted) throw error;
  }
  assert.equal(accepted, item.accepted, item.name);
  assert.ok(parser, `${item.name}: lexical errors need a separate C++ lexer test`);
  let tree = [];
  if (accepted) {
    assert.ok(collector.root, item.name);
    tree = flatten(collector.root);
    const leaves = tree.filter((row) => row.split("\t")[1] === "T")
      .map((row) => row.split("\t").slice(2).join("\t"));
    assert.deepEqual(leaves, Array.from(parser.tokens, (token) =>
      `${token.type}\t${Buffer.from(token.value).toString("hex") || "-"}`), item.name);
    for (const token of parser.tokens) {
      if (token.type !== "EOF") assert.equal(source.slice(token.start, token.end), token.value, item.name);
    }
    for (const rule of item.rules || []) {
      assert.ok(tree.some((row) => row.split("\t")[2] === rule), `${item.name}: missing ${rule}`);
    }
    for (const token of item.tokens || []) {
      assert.ok(leaves.some((row) => row.startsWith(`${token}\t`)), `${item.name}: missing ${token}`);
    }
    if (printTrees) console.log(`${item.name}\n${collector.toJSON()}`);
  }
  results.push({ item, parser, tree });
  console.log(`PASS JS ${accepted ? "accepts" : "rejects"} ${item.name}`);
}
console.log(`JavaScript: ${results.length}/${cases.length} passed.`);
if (cppEnabled) {
  generate("cpp98", "maia-shell.cpp");
  const generated = fs.readFileSync(path.join(root, "maia-shell.cpp"), "utf8");
  const tokenIds = new Map(Array.from(generated.matchAll(/^#define MAIACC_TOKEN_(\w+) (\d+)$/gm),
    (match) => [match[1], Number(match[2])]));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "maia-shell-parity-"));
  try {
    const binary = path.join(temporary, "test-shell");
    const regex = path.join(repo, "maiacpp/maiaregex");
    execFileSync("clang++", ["-x", "c++", "-std=c++98", "-Wall", "-Wextra", "-pedantic",
      "-I", regex, path.join(root, "test.cpp"), path.join(regex, "maia_regex.c"), "-o", binary], { stdio: "pipe" });
    for (const { item, parser, tree } of results) {
      const tokens = Array.from(parser.tokens, (token) => {
        assert.ok(tokenIds.has(token.type), `No C++ token ID for ${token.type}`);
        return `${tokenIds.get(token.type)} ${token.start} ${token.end} ${Buffer.from(token.value).toString("hex") || "-"}`;
      });
      const output = execFileSync(binary, [], {
        input: `${tokens.length}\n${tokens.join("\n")}\n`, encoding: "utf8", timeout: 10000,
      }).trimEnd().split("\n");
      assert.equal(output[0], item.accepted ? "ACCEPT" : "REJECT", item.name);
      if (item.accepted) assert.deepEqual(output.slice(1), tree, `${item.name}: C++/JS tree mismatch`);
      console.log(`PASS C++ ${item.name}`);
    }
    console.log(`C++98: ${results.length}/${cases.length} passed; accepted trees match JavaScript.`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
