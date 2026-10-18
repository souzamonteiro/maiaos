#!/usr/bin/env node
"use strict";

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const shellRoot = path.resolve(__dirname, "..");
const grammarPath = path.join(shellRoot, "maia-shell.ebnf");
const scenarios = JSON.parse(
  fs.readFileSync(path.join(__dirname, "shell-grammar-scenarios.json"), "utf8"),
);

function resolveMaiaccRoot() {
  const root = process.env.MAIACC_ROOT;
  if (!root) {
    throw new Error(
      "Set MAIACC_ROOT to the MaiaCC checkout (the directory containing parser-generator/).",
    );
  }
  return path.resolve(root);
}

function generateParser() {
  const generatorRoot = path.join(resolveMaiaccRoot(), "parser-generator");
  const rexPath = path.join(generatorRoot, "REx.js");
  const parserGeneratorPath = path.join(generatorRoot, "parser-generator.js");
  const collectorPath = path.join(generatorRoot, "parse-tree-collector.js");
  for (const filePath of [rexPath, parserGeneratorPath, collectorPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required MaiaCC parser tool not found: ${filePath}`);
    }
  }

  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "maia-shell-grammar-"));
  const xmlPath = path.join(outputRoot, "shell-grammar.xml");
  const parserPath = path.join(outputRoot, "shell-parser.js");
  try {
    const xml = execFileSync(process.execPath, [rexPath, grammarPath], {
      cwd: generatorRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    fs.writeFileSync(xmlPath, xml);
    execFileSync(process.execPath, [parserGeneratorPath, xmlPath, parserPath], {
      cwd: generatorRoot,
      stdio: "pipe",
      maxBuffer: 16 * 1024 * 1024,
    });

    const collectorApi = require(collectorPath);
    return {
      Parser: require(parserPath),
      ParseTreeCollector: collectorApi.ParseTreeCollector,
      printTree: collectorApi.printTree,
      outputRoot,
    };
  } catch (error) {
    fs.rmSync(outputRoot, { recursive: true, force: true });
    throw error;
  }
}

function visitTree(node, callback) {
  if (!node) return;
  callback(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visitTree(child, callback);
  }
}

function treeLeaves(root) {
  const leaves = [];
  visitTree(root, (node) => {
    if (node.kind === "terminal") {
      leaves.push({ type: node.token, value: node.value });
    }
  });
  return leaves;
}

function treeRuleCounts(root) {
  const counts = new Map();
  visitTree(root, (node) => {
    if (node.kind === "nonterminal") {
      counts.set(node.name, (counts.get(node.name) ?? 0) + 1);
    }
  });
  return counts;
}

function parseAndCompare(Parser, ParseTreeCollector, source, label) {
  const collector = new ParseTreeCollector();
  const parser = new Parser(source, collector);
  collector.parse(parser, label);
  assert.ok(collector.root, `${label}: parser did not produce a tree`);

  const expectedLeaves = parser.lexer.tokens.map(({ type, value }) => ({
    type,
    value,
  }));
  assert.deepEqual(
    treeLeaves(collector.root),
    expectedLeaves,
    `${label}: parse-tree leaves differ from lexer tokens`,
  );

  for (const token of parser.lexer.tokens) {
    if (token.type === "EOF") continue;
    assert.equal(
      source.slice(token.start, token.end),
      token.value,
      `${label}: token ${token.type} does not map back to its source text`,
    );
  }

  return { collector, parser, rules: treeRuleCounts(collector.root) };
}

function describeRules(ruleCounts) {
  return [...ruleCounts.keys()].join(", ");
}

function getScenarioSource(scenario) {
  if (typeof scenario.source === "string") return scenario.source;
  if (typeof scenario.file === "string") {
    return fs.readFileSync(path.resolve(__dirname, scenario.file), "utf8");
  }
  throw new TypeError(`${scenario.name}: expected source or file`);
}

function runValidFixtures(Parser, ParseTreeCollector, printTrees, printTree) {
  for (const scenario of scenarios.valid) {
    const source = getScenarioSource(scenario);
    const { collector, parser, rules } = parseAndCompare(
      Parser,
      ParseTreeCollector,
      source,
      scenario.name,
    );
    for (const name of scenario.rules) {
      assert.ok(rules.has(name), `${scenario.name}: expected rule ${name}`);
    }
    const leaves = treeLeaves(collector.root);
    for (const type of scenario.tokens ?? []) {
      assert.ok(
        leaves.some((leaf) => leaf.type === type),
        `${scenario.name}: expected terminal token ${type}`,
      );
    }
    console.log(
      `PASS ${scenario.name}: ${parser.lexer.tokens.length} tokens; rules: ${describeRules(rules)}`,
    );
    if (printTrees) printTree(collector.root);
  }
}

function runInvalidFixtures(Parser, ParseTreeCollector) {
  for (const scenario of scenarios.invalid) {
    const collector = new ParseTreeCollector();
    const parser = new Parser(getScenarioSource(scenario), collector);
    assert.throws(
      () => collector.parse(parser, scenario.name),
      undefined,
      `${scenario.name}: malformed shell input was accepted`,
    );
    console.log(`PASS rejects ${scenario.name}`);
  }
}

function hasTerminal(node, type, value) {
  let found = false;
  visitTree(node, (current) => {
    if (
      current.kind === "terminal" &&
      current.token === type &&
      current.value === value
    ) {
      found = true;
    }
  });
  return found;
}

function runKnownPosixGaps(Parser, ParseTreeCollector, strictPosix) {
  let unresolved = 0;
  for (const scenario of scenarios.posixGaps) {
    const collector = new ParseTreeCollector();
    const parser = new Parser(getScenarioSource(scenario), collector);
    let resolved = false;
    try {
      collector.parse(parser, scenario.name);
      if (scenario.name === "reserved word used as an argument") {
        resolved = hasTerminal(collector.root, "TOKEN_if", "if");
      } else if (scenario.name === "IO_NUMBER must be adjacent to redirection") {
        let redirectionHasNumber = false;
        visitTree(collector.root, (node) => {
          if (node.kind === "nonterminal" && node.name === "Redirection") {
            redirectionHasNumber ||= hasTerminal(node, "IO_NUMBER", "2");
          }
        });
        resolved = !redirectionHasNumber;
      }
    } catch {
      resolved = false;
    }

    if (resolved) {
      console.log(`RESOLVED POSIX gap ${scenario.name}`);
    } else {
      unresolved += 1;
      console.log(`KNOWN POSIX GAP ${scenario.name}: ${scenario.gap}`);
    }
  }

  if (strictPosix && unresolved > 0) {
    throw new Error(`${unresolved} known POSIX lexical gap(s) remain`);
  }
}

function runOneInput(Parser, ParseTreeCollector, printTree, source, label) {
  const { collector, parser, rules } = parseAndCompare(
    Parser,
    ParseTreeCollector,
    source,
    label,
  );
  console.log(
    `Parsed ${label}: ${parser.lexer.tokens.length} tokens; rules: ${describeRules(rules)}`,
  );
  printTree(collector.root);
}

function main() {
  const args = process.argv.slice(2);
  const printTrees = args.includes("--print-trees");
  const strictPosix = args.includes("--strict-posix");
  const fileIndex = args.indexOf("--file");
  const inputIndex = args.indexOf("--input");
  const parserTools = generateParser();

  try {
    if (fileIndex !== -1) {
      const filePath = args[fileIndex + 1];
      if (!filePath) throw new Error("--file requires a shell script path");
      const source = fs.readFileSync(path.resolve(filePath), "utf8");
      runOneInput(
        parserTools.Parser,
        parserTools.ParseTreeCollector,
        parserTools.printTree,
        source,
        path.basename(filePath),
      );
      return;
    }
    if (inputIndex !== -1) {
      const source = args[inputIndex + 1];
      if (source == null) throw new Error("--input requires a shell command");
      runOneInput(
        parserTools.Parser,
        parserTools.ParseTreeCollector,
        parserTools.printTree,
        source,
        "command input",
      );
      return;
    }

    runValidFixtures(
      parserTools.Parser,
      parserTools.ParseTreeCollector,
      printTrees,
      parserTools.printTree,
    );
    runInvalidFixtures(parserTools.Parser, parserTools.ParseTreeCollector);
    runKnownPosixGaps(
      parserTools.Parser,
      parserTools.ParseTreeCollector,
      strictPosix,
    );
  } finally {
    fs.rmSync(parserTools.outputRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}