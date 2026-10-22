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

import { MaiaStreamBroker, bindShellStreams } from "../runtime/maia-streams.js";

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
const vfs = new MemoryVfsAdapter({ appId: manifest.id, maxOpenFiles: manifest.limits.openFiles, files: {
  "/shared/folder with space/child/note.txt": "fixture\n",
  "/shared/cat-batch/a.txt": "A\n", "/shared/cat-batch/b.txt": "B\n",
  "/shared/empty.txt": "", "/shared/no-newline.txt": "tail",
  "/home/org.maiaplatform.shell/note.txt": "own home\n",
  "/home/another/private.txt": "MUST NOT LEAK",
  "/shared/large.txt": "Maia streaming UTF-8: olá 🌎\n".repeat(1500),
  "/shared/names/é": "unicode", "/shared/names/\x1b[2J": "control",
  "/shared/names/a\nb": "newline", "/shared/names/back\\slash": "backslash",
} });
for (let index = 0; index < 1024; ++index) vfs.files.set(`/shared/large/item${String(index).padStart(4, "0")}`, new Uint8Array(0));
const broker = new MaiaStreamBroker();
bindShellStreams(broker, 2, 3);
let ioExitCode = null;
const ioManifest = JSON.parse(await readFile(new URL("../apps/io/manifest.json", import.meta.url), "utf8"));
const ioHost = createMaiaHostImports({
  streams: broker, processId: 2,
  vfs: new MemoryVfsAdapter({appId: ioManifest.id, maxOpenFiles: 0}),
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
    ioExitCode = code;
    if (realGraphics && windowHandle >= 0) realGraphics.objectDestroy(windowHandle);
  },
});
const io = await instantiateNativeWasmFile(new URL("../apps/io/io.wasm", import.meta.url), ioHost.imports);
assertManifestCapabilities(io.module, ioManifest, ioManifest.capabilities);
assert.ok(WebAssembly.Module.imports(io.module).every(({module}) => module !== "maia.vfs"));
ioHost.attachInstance(io.instance);
const host = createMaiaHostImports({ vfs, pipeline:{start(){throw new Error("Unexpected pipeline in builtin-only regression");},wait(){throw new Error("Unexpected pipeline wait");}}, graphics: Object.fromEntries(["windowCreate", "labelCreate", "labelSetText", "buttonCreate", "objectDestroy"].map(name => [name, () => { throw new Error("Shell must not call graphics"); }])), streams: broker, processId: 3,
  onProcessExit: (code) => { exitCode = code; } });
const guest = await instantiateNativeWasmFile(wasmPath, host.imports);
assertManifestCapabilities(guest.module, manifest, manifest.capabilities);
assert.ok(WebAssembly.Module.imports(guest.module).every(({module}) => !["maia.gfx", "maia.events"].includes(module)));
assert.throws(() => assertManifestCapabilities(guest.module, manifest,
  manifest.capabilities.filter((capability) => capability !== "stream.write")), /Host policy denies/);
assert.throws(() => assertManifestCapabilities(guest.module,
  {...manifest, capabilities: manifest.capabilities.filter((capability) => capability !== "stream.read")},
  manifest.capabilities), /Manifest does not request/);
host.attachInstance(guest.instance);
// The real kernel stays scheduled while terminal I/O and parsing run in separate memories.
const kernelManifest = JSON.parse(await readFile(new URL("../apps/kernel/kernel.json", import.meta.url), "utf8"));
let kernelHandle = 1000;
const kernelHost = createMaiaHostImports({
  vfs: new MemoryVfsAdapter({appId: kernelManifest.id}),
  graphics: realGraphics ?? {windowCreate: () => kernelHandle++, labelCreate: () => kernelHandle++,
    labelSetText: () => 0, buttonCreate: () => kernelHandle++, objectDestroy: () => 0},
});
const kernel = await instantiateNativeWasmFile(new URL("../platform/desktop-web/generated/kernel.wasm", import.meta.url), kernelHost.imports);
assertManifestCapabilities(kernel.module, kernelManifest, kernelManifest.capabilities);
kernelHost.attachInstance(kernel.instance);
kernel.exports[kernelManifest.entryExport]();
let kernelSteps = 0;
const kernelStack = kernel.exports.__stack_ptr.value;
function pump(count = 3) {
  for (let tick = 0; tick < count; ++tick) {
    kernel.exports[kernelManifest.stepExport](); ++kernelSteps;
    if (ioExitCode === null) io.exports.maiaos_step();
    if (exitCode === null) guest.exports.maiaos_step();
    if (lvgl) lvgl._maiaos_lvgl_tick();
  }
}
io.exports.maia_io_start();
guest.exports.maia_app_start();
pump(8);
const ioPages = io.exports.memory.buffer.byteLength / 65536;
const ioStack = io.exports.__stack_ptr.value;
assert.ok(ioPages <= ioManifest.limits.memoryPages);
assert.notEqual(io.exports.memory, guest.exports.memory);
assert.notEqual(kernel.exports.memory, guest.exports.memory);
if (lvgl) assert.ok(flushCount > 0, "Actual LVGL must rasterize the session");

const [outputHandle, inputHandle] = [...labels.keys()];
function pressKey(key, data0 = 0) {
  assert.equal(ioHost.enqueueEvent({
    type: MAIA_EVENT_KEY,
    objectHandle: 0,
    data0,
    data1: key,
  }), 0);
  pump();
}
function typeText(text) {
  for (const character of text) pressKey(MAIA_KEY_TEXT, character.charCodeAt(0));
}
function submitText(text) {
  typeText(text);
  pressKey(MAIA_KEY_ENTER);
  pump(24);
}

assert.equal(labels.get(inputHandle), "maia> |", "Prompt and caret share one LVGL label");
assert.equal(labels.get(outputHandle), "MaiaOS Shell MVP. Type help to begin.\n");
submitText("help");
typeText("echo helo");
pressKey(MAIA_KEY_LEFT);
pressKey(MAIA_KEY_TEXT, "l".charCodeAt(0));
assert.equal(labels.get(inputHandle), "maia> echo hell|o");
pressKey(MAIA_KEY_RIGHT);
pressKey(MAIA_KEY_ENTER);
submitText("pwd");
pressKey(MAIA_KEY_UP);
assert.equal(labels.get(inputHandle), "maia> pwd|");
pressKey(MAIA_KEY_DOWN);
assert.equal(labels.get(inputHandle), "maia> |");
submitText("cat /system/welcome.txt");
const longEcho = `${"A".repeat(70)} ${"B".repeat(70)}`;
submitText(`echo ${longEcho}`);
const priorOutput = labels.get(outputHandle);
assert.match(priorOutput, /Commands: help, echo, pwd, ls \[path \.\.\.\], cd \[path\], cat <file> \[file \.\.\.\], clear, exit/);
assert.match(priorOutput, /echo hello\nhello/);
assert.match(priorOutput, /pwd\n\/\n/);
assert.match(priorOutput, /C\+\+ kernel read this text through maia\.vfs/);
assert.ok(priorOutput.includes(`echo ${longEcho}\n${longEcho}\n`), priorOutput);
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
  ["echo hidden | pwd", "shell: unsupported pipeline command\n"],
  ["echo hidden < input.txt", "unsupported syntax: simple commands only\n"],
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
  assert.equal(labels.get(outputHandle), `maia> ${source}\n${expected}`, source);
  assert.equal(labels.get(inputHandle), "maia> |", source);
  assert.equal(guest.exports.__stack_ptr.value, stackBefore, source);
}
const directoryCases = [
  ["ls", "apps/\nhome/\nshared/\nsystem/\ntmp/\n"],
  ["ls /system", "welcome.txt\n"],
  ["echo /system/*.txt", "/system/welcome.txt\n"],
  ["ls /system/*.txt", "/system/welcome.txt\n"],
  ["ls /system/welcome.txt /system", "/system/welcome.txt\n/system:\nwelcome.txt\n"],
  ["cd /system", ""], ["pwd", "/system\n"], ["ls .", "welcome.txt\n"],
  ["cd /system/welcome.txt", "cd: not a directory\n"], ["pwd", "/system\n"],
  ["cd missing", "cd: no such directory\n"], ["pwd", "/system\n"],
  ["cd /home/another", "cd: permission denied\n"], ["pwd", "/system\n"],
  ["cd ..", ""], ["cd ..", ""], ["pwd", "/\n"],
  ["cd //shared/./", ""], ['cd "folder with space"', ""],
  ["pwd", "/shared/folder with space\n"], ["ls", "child/\n"],
  ["cd child/../../names", ""], ["pwd", "/shared/names\n"],
  ["ls", "\\x1B[2J\na\\x0Ab\nback\\\\slash\né\n"],
  ["cd", ""], ["pwd", "/home/org.maiaplatform.shell\n"], ["ls", "note.txt\n"],
  ["ls /home", "org.maiaplatform.shell/\n"],
  ["ls -l", "usage: ls [path ...]\n"], ["cd -", "usage: cd [path]\n"],
  ["ls a b", "ls: no such directory\nls: no such directory\n"], ["cd a b", "usage: cd [path]\n"],
  ['cd ""', "cd: invalid path or directory entry\n"],
  ["cd /", ""],
];
for (const [source, expected] of directoryCases) {
  submitText("clear"); submitText(source);
  assert.equal(labels.get(outputHandle), `maia> ${source}\n${expected}`, source);
  assert.equal(labels.get(inputHandle), "maia> |", source);
  assert.equal(vfs.openHandleCount, 0, source);
  assert.equal(guest.exports.__stack_ptr.value, stackBefore, source);
}
const fileCases = [
  ["cd /system", ""], ["cat welcome.txt", "C++ kernel read this text through maia.vfs.\n"],
  ['cat "/shared/folder with space/child/note.txt"', "fixture\n"],
  ["cd /shared/folder\\ with\\ space/child", ""], ["cat ./note.txt", "fixture\n"],
  ["cat absent", "cat: cannot open file\n"], ["cat /shared/empty.txt", ""],
  ["cat /home/another/private.txt", "cat: permission denied\n"],
  ["cd", ""], ["cat note.txt", "own home\n"],
  ["cat", "usage: cat <file> [file ...]\n"], ["cat -n", "usage: cat <file> [file ...]\n"],
  ["cat one two", "cat: cannot open file\ncat: cannot open file\n"],
  ["cat /shared/cat-batch/b.txt /shared/cat-batch/a.txt", "B\nA\n"],
  ["cat /shared/cat-batch/*.txt", "A\nB\n"],
  ["cat missing /shared/cat-batch/a.txt", "cat: cannot open file\nA\n"], ['cat ""', "cat: invalid path\n"],
  ["cd /", ""],
];
for (const [source, expected] of fileCases) {
  submitText("clear"); submitText(source);
  assert.equal(labels.get(outputHandle), `maia> ${source}\n${expected}`, source);
  assert.equal(labels.get(inputHandle), "maia> |", source);
  assert.equal(vfs.openHandleCount, 0, source);
  assert.equal(guest.exports.__stack_ptr.value, stackBefore, source);
}
const redirectionCases = [
  ["echo first > /tmp/lvgl-output", ""],
  ["echo second >> /tmp/lvgl-output", ""],
  ["cat /tmp/lvgl-output", "first\nsecond\n"],
  ["cat /shared/cat-batch/*.txt > /tmp/lvgl-output", ""],
  ["cat /tmp/lvgl-output", "A\nB\n"],
  ["echo denied > /system/denied", "shell: redirection: permission denied\n"],
];
for (const [source, expected] of redirectionCases) {
  submitText("clear"); submitText(source);
  assert.equal(labels.get(outputHandle), `maia> ${source}\n${expected}`, source);
  assert.equal(labels.get(inputHandle), "maia> |", source);
  assert.equal(vfs.openHandleCount, 0, source);
  assert.equal(guest.exports.__stack_ptr.value, stackBefore, source);
}
submitText("clear"); submitText("cat /shared/no-newline.txt");
assert.equal(labels.get(outputHandle), "maia> cat /shared/no-newline.txt\n");
assert.equal(labels.get(inputHandle), "tailmaia> |", "cat must not add a newline to the file");
submitText("clear");
const stepsBeforeFile = kernelSteps;
submitText("cat /shared/large.txt"); pump(512);
assert.match(labels.get(outputHandle), /Maia streaming UTF-8: olá 🌎\n$/);
assert.equal(labels.get(inputHandle), "maia> |");
assert.equal(vfs.openHandleCount, 0); assert.ok(kernelSteps >= stepsBeforeFile + 512);
assert.equal(guest.exports.__stack_ptr.value, stackBefore);
submitText("clear");
const stepsBeforeListing = kernelSteps;
submitText("ls /shared/large"); pump(256);
assert.match(labels.get(outputHandle), /item1023\n$/);
assert.equal(labels.get(inputHandle), "maia> |");
assert.equal(vfs.openHandleCount, 0);
assert.ok(kernelSteps >= stepsBeforeListing + 256, "Kernel stays scheduled during large directory output");
assert.equal(guest.exports.__stack_ptr.value, stackBefore);
submitText("clear");
typeText("x".repeat(260));
assert.equal(labels.get(inputHandle), "maia> " + "x".repeat(255) + "|");
pressKey(MAIA_KEY_ENTER);
assert.match(labels.get(outputHandle), /shell input limit exceeded\n$/);
assert.equal(labels.get(inputHandle), "maia> |");
for (let iteration = 0; iteration < 1000; ++iteration) submitText('echo "reuse"');
assert.equal(guest.exports.__stack_ptr.value, stackBefore, "Repeated parsing restores frames");
assert.equal(guest.exports.memory.buffer.byteLength / 65536, initialPages,
  "Repeated generated lexing reuses guest allocations");
submitText("clear");
assert.equal(labels.get(outputHandle), "");
assert.equal(labels.get(inputHandle), "maia> |");
submitText("exit");

const output = labels.get(outputHandle);
assert.equal(output, "maia> exit\n");
assert.equal(exitCode, 0);
assert.equal(ioExitCode, 0);
assert.deepEqual(broker.stats, {pipes: 0, endpoints: 0, capacityBytes: 0, bufferedBytes: 0});
assert.equal(vfs.handles.size, 0);
assert.equal(io.exports.__stack_ptr.value, ioStack);
assert.equal(io.exports.memory.buffer.byteLength / 65536, ioPages);
assert.equal(kernel.exports.__stack_ptr.value, kernelStack);
assert.ok(kernelSteps > 1000);
const stepsAtExit = kernelSteps; pump(5); assert.equal(kernelSteps, stepsAtExit + 5);
console.log(`Kernel/I/O/shell session passed${lvgl ? ` with actual LVGL (${flushCount} flushes)` : " with host callbacks"}: generated lexer/parser, commands, quoting, invalid/unsupported input, bounds, ls/cd/cwd/escaped names, 1024-entry ls, relative/absolute/UTF-8 cat, 1000 repeated parses, stable stack/memory (shell ${initialPages}, I/O ${ioPages} pages), ${kernelSteps} kernel steps, drained/closed streams.`);
