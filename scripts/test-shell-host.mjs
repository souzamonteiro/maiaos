import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { instantiateNativeWasmFile } from "../runtime/native-wasm-node.js";
import {
  createMaiaHostImports,
  MAIA_EVENT_KEY,
  MAIA_KEY_ENTER,
  MAIA_KEY_LEFT,
  MAIA_KEY_RIGHT,
  MAIA_KEY_TEXT,
  MAIA_KEY_UP,
  MAIA_KEY_DOWN,
} from "../runtime/maia-host-imports.js";
import { assertManifestCapabilities } from "../runtime/maia-capabilities.js";
import { MemoryVfsAdapter } from "../runtime/maia-vfs.js";
import { createLvglGraphicsCallbacks } from "../platform/desktop-web/lvgl-bridge.js";

const useLvgl = process.argv.includes("--lvgl");
const trace = process.argv.includes("--trace");
let lvgl = null;
let realGraphics = null;
let flushCount = 0;
let windowHandle = -1;
if (useLvgl) {
  const { default: createLvgl } = await import("../platform/desktop-web/generated/maiaos-lvgl.js");
  lvgl = await createLvgl({
    noInitialRun: true,
    onLvglFlush: (_x, _y, width, height, pixels) => {
      assert.equal(pixels.length, width * height * 2);
      ++flushCount;
    },
  });
  lvgl._main();
  if (trace) console.log("TRACE LVGL display initialized");
  realGraphics = createLvglGraphicsCallbacks(lvgl);
}

const wasmPath = new URL("../apps/shell/shell.wasm", import.meta.url);
const manifestPath = new URL("../apps/shell/manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const labels = new Map();
let nextLabel = 1;
let exitCode = null;
const vfs = new MemoryVfsAdapter({ appId: manifest.id });
const host = createMaiaHostImports({
  vfs,
  graphics: {
    windowCreate: (title) => (windowHandle = realGraphics ? realGraphics.windowCreate(title) : 1),
    labelCreate: (_parent, text) => {
      const handle = realGraphics ? realGraphics.labelCreate(_parent, text) : nextLabel++;
      labels.set(handle, text);
      return handle;
    },
    labelSetText: (handle, text) => {
      labels.set(handle, text);
      if (trace) console.log("TRACE label", handle, JSON.stringify(text.slice(-100)), text.length);
      return realGraphics ? realGraphics.labelSetText(handle, text) : 0;
    },
    buttonCreate: () => -1,
    objectDestroy: () => 0,
  },
  onProcessExit: (code) => {
    exitCode = code;
    if (realGraphics && windowHandle >= 0) realGraphics.objectDestroy(windowHandle);
  },
});
const guest = await instantiateNativeWasmFile(wasmPath, host.imports);
assertManifestCapabilities(guest.module, manifest, [
  "memory.alloc",
  "memory.free",
  "gfx.window",
  "gfx.label",
  "gfx.label.set_text",
  "events.poll",
  "tty.input",
  "vfs.open",
  "vfs.read",
  "vfs.close",
  "process.exit",
]);
host.attachInstance(guest.instance);
assert.equal(guest.exports.maia_app_start instanceof Function, true);
assert.equal(guest.exports.maiaos_step instanceof Function, true);
guest.exports.maia_app_start();
if (trace) console.log("TRACE shell started");
if (lvgl) {
  for (let tick = 0; tick < 8; ++tick) lvgl._maiaos_lvgl_tick();
  assert.ok(flushCount > 0, "Actual LVGL must rasterize the shell window");
}

const [outputHandle, inputHandle] = [...labels.keys()];
function pressKey(key, data0 = 0) {
  assert.equal(host.enqueueEvent({
    type: MAIA_EVENT_KEY,
    objectHandle: 0,
    data0,
    data1: key,
  }), 0);
  guest.exports.maiaos_step();
  // Match the platform scheduler: advance LVGL while delivering guest events.
  if (lvgl) lvgl._maiaos_lvgl_tick();
}
function typeText(text) {
  for (const character of text) pressKey(MAIA_KEY_TEXT, character.charCodeAt(0));
}
function submitText(text) {
  typeText(text);
  pressKey(MAIA_KEY_ENTER);
}

assert.match(labels.get(outputHandle), /MaiaOS Shell MVP.*maia> /s);
assert.equal(labels.get(inputHandle), "|");
submitText("help");
typeText("echo helo");
pressKey(MAIA_KEY_LEFT);
pressKey(MAIA_KEY_TEXT, "l".charCodeAt(0));
pressKey(MAIA_KEY_RIGHT);
pressKey(MAIA_KEY_ENTER);
submitText("pwd");
pressKey(MAIA_KEY_UP);
assert.equal(labels.get(inputHandle), "pwd|");
pressKey(MAIA_KEY_DOWN);
assert.equal(labels.get(inputHandle), "|");
submitText("cat /system/welcome.txt");
const longEcho = `${"A".repeat(70)} ${"B".repeat(70)}`;
submitText(`echo ${longEcho}`);
const priorOutput = labels.get(outputHandle);
assert.match(priorOutput, /Commands: help, echo, pwd, cat \/system\/welcome\.txt, clear, exit/);
assert.match(priorOutput, /echo hello\nhello/);
assert.match(priorOutput, /pwd\n\/\n/);
assert.match(priorOutput, /C\+\+ kernel read this text through maia\.vfs/);
assert.ok(priorOutput.includes(`echo ${longEcho}\n${longEcho}\nmaia> `), priorOutput);
// These commands enter as keyboard bytes and are lexed/parsed inside the guest.
// Exact output checks prevent the echoed input from masquerading as execution.
const initialPages = guest.exports.memory.buffer.byteLength / 65536;
assert.ok(initialPages <= manifest.limits.memoryPages);
const stackBefore = guest.exports.__stack_ptr.value;
const commandCases = [
  ['echo "two words"', "two words\n"],
  ["echo pre'fix'\"tail\"", "prefixtail\n"],
  ["echo one\\ two", "one two\n"],
  ['echo "if"', "if\n"],
  ["echo key=value 2", "key=value 2\n"],
  ["echo hello # comment", "hello\n"],
  ["# comment only", ""],
  ["", ""],
  ['echo "open', "syntax error\n"],
  ["echo tail\\", "syntax error\n"],
  ["echo |", "syntax error\n"],
  ["echo hidden | pwd", "unsupported syntax: simple commands only\n"],
  ["echo hidden > output.txt", "unsupported syntax: simple commands only\n"],
  ["name=value echo hidden", "unsupported syntax: simple commands only\n"],
  ["if true; then echo hidden; fi", "unsupported syntax: simple commands only\n"],
  ["(".repeat(14) + "echo x" + ")".repeat(14), "unsupported syntax: simple commands only\n"],
  ["(".repeat(29) + "echo x", "syntax error\n"],
  ["if ".repeat(29) + "echo x", "syntax error\n"],
  ["(".repeat(31), "syntax error\n"],
  ["echo " + "x ".repeat(32), "shell input limit exceeded\n"],
  ["echo " + "x ".repeat(12), "shell input limit exceeded\n"],
  ["echo " + "x".repeat(96), "shell input limit exceeded\n"],
];
for (const [source, expected] of commandCases) {
  submitText("clear");
  submitText(source);
  assert.equal(labels.get(outputHandle), `maia> ${source}\n${expected}maia> `, source);
  assert.equal(guest.exports.__stack_ptr.value, stackBefore, source);
}
submitText("clear");
typeText("x".repeat(260));
assert.equal(labels.get(inputHandle), "x".repeat(255) + "|");
pressKey(MAIA_KEY_ENTER);
assert.match(labels.get(outputHandle), /shell input limit exceeded\nmaia> $/);
for (let iteration = 0; iteration < 1000; ++iteration) submitText('echo "reuse"');
assert.equal(guest.exports.__stack_ptr.value, stackBefore, "Repeated parsing restores frames");
assert.equal(guest.exports.memory.buffer.byteLength / 65536, initialPages,
  "Repeated generated lexing reuses guest allocations");
submitText("clear");
assert.equal(labels.get(outputHandle), "maia> ");
submitText("exit");

const output = labels.get(outputHandle);
assert.equal(output, "maia> exit\n");
assert.equal(exitCode, 0);
console.log(`Shell guest passed${lvgl ? ` with actual LVGL (${flushCount} flushes)` : " with host callbacks"}: generated lexer/parser, commands, quoting, invalid/unsupported input, bounds, 1000 repeated parses, stable stack/memory (${initialPages} pages).`);
