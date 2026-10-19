import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { instantiateNativeWasmFile } from "../runtime/native-wasm-node.js";
import { createMaiaHostImports } from "../runtime/maia-host-imports.js";
import { assertManifestCapabilities } from "../runtime/maia-capabilities.js";
import { MemoryVfsAdapter } from "../runtime/maia-vfs.js";

const wasmPath = new URL("../apps/shell/shell.wasm", import.meta.url);
const manifestPath = new URL("../apps/shell/manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const inputLines = ["help", "echo hello world", "pwd", "cat /system/welcome.txt", "exit"];
const output = [];
const errors = [];
const writes = [];
let exitCode = null;
const vfs = new MemoryVfsAdapter({ appId: manifest.id });
const host = createMaiaHostImports({
  vfs,
  graphics: {
    windowCreate: () => 1,
    labelCreate: () => 2,
    labelSetText: () => 0,
    buttonCreate: () => 3,
    objectDestroy: () => 0,
  },
  tty: {
    pollLine: () => inputLines.shift() ?? null,
    write: (stream, text) => {
      writes.push([stream, text]);
      (stream === 2 ? errors : output).push(text);
    },
  },
  onProcessExit: (code) => {
    exitCode = code;
  },
});
const guest = await instantiateNativeWasmFile(wasmPath, host.imports);
assertManifestCapabilities(guest.module, manifest, [
  "memory.alloc",
  "memory.free",
  "tty.input",
  "tty.output",
  "vfs.open",
  "vfs.read",
  "vfs.close",
  "process.exit",
]);
host.attachInstance(guest.instance);
assert.equal(guest.exports.maia_app_start instanceof Function, true);
assert.equal(guest.exports.maiaos_step instanceof Function, true);
guest.exports.maia_app_start();
for (let index = 0; index < 5; index += 1) {
  guest.exports.maiaos_step();
}

const stdout = output.join("");
const smokeState = JSON.stringify({ stdout, stderr: errors, writes, queuedLines: inputLines.length });
assert.match(stdout, /MaiaOS Shell MVP/, smokeState);
assert.match(stdout, /Commands: help, echo, pwd, cat \/system\/welcome\.txt, exit/, smokeState);
assert.match(stdout, /hello world/, JSON.stringify({ stdout, errors, writes, inputLines }));
assert.match(stdout, /\/\n/, JSON.stringify({ stdout, errors, writes, inputLines }));
assert.match(stdout, /C\+\+ kernel read this text through maia\.vfs/, JSON.stringify({ stdout, errors, writes, inputLines }));
assert.deepEqual(errors, [], JSON.stringify({ stdout, errors, writes, inputLines }));
assert.equal(exitCode, 0, JSON.stringify({ stdout, errors, writes, inputLines }));
console.log("Shell WASM host smoke passed: help, echo, pwd, cat, exit.");
