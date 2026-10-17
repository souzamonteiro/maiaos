import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { instantiateNativeWasmFile } from "../runtime/native-wasm-node.js";
import {
  createMaiaHostImports,
  MAIA_EVENT_GFX_CLICKED,
} from "../runtime/maia-host-imports.js";
import { assertManifestCapabilities } from "../runtime/maia-capabilities.js";
import { MemoryVfsAdapter } from "../runtime/maia-vfs.js";
import { createLvglGraphicsCallbacks } from "../platform/desktop-web/lvgl-bridge.js";

const modulePath = new URL(
  "../platform/desktop-web/generated/kernel.wasm",
  import.meta.url,
);
const manifestPath = new URL("../apps/kernel/kernel.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const calls = [];
let nextHandle = 40;
const buttonHandles = new Map();
let statusLabelHandle = 0;
const nodeVfs = new MemoryVfsAdapter({ appId: manifest.id });
const host = createMaiaHostImports({
  vfs: nodeVfs,
  graphics: {
    windowCreate(title) {
      calls.push(["window", title]);
      return nextHandle++;
    },
    labelCreate(parent, text) {
      calls.push(["label", parent, text]);
      const handle = nextHandle++;
      if (text.startsWith("Reading /system/welcome.txt"))
        statusLabelHandle = handle;
      return handle;
    },
    labelSetText(handle, text) {
      calls.push(["label-set-text", handle, text]);
      return 0;
    },
    buttonCreate(parent, text) {
      calls.push(["button", parent, text]);
      const handle = nextHandle++;
      buttonHandles.set(text, handle);
      return handle;
    },
    objectDestroy(handle) {
      calls.push(["destroy", handle]);
      return 0;
    },
  },
  log: (level, message) => calls.push(["log", level, message]),
});

const guest = await instantiateNativeWasmFile(modulePath, host.imports);
assert.equal(guest.backendId, "native-wasm-reference");
assert.equal(guest.host, "node");
assert.deepEqual(
  WebAssembly.Module.imports(guest.module)
    .map(({ module, name }) => `${module}.${name}`)
    .sort(),
  [
    "maia.gfx.button_create",
    "maia.gfx.label_create",
    "maia.gfx.label_set_text",
    "maia.gfx.window_create",
    "maia.events.poll",
    "maia.log.write",
    "maia.vfs.close",
    "maia.vfs.open",
    "maia.vfs.read",
    "maia.vfs.write",
  ].sort(),
);
assert.doesNotThrow(() =>
  assertManifestCapabilities(guest.module, manifest, manifest.capabilities),
);
assert.throws(
  () =>
    assertManifestCapabilities(
      guest.module,
      {
        ...manifest,
        capabilities: manifest.capabilities.filter(
          (capability) => capability !== "vfs.write",
        ),
      },
      manifest.capabilities,
    ),
  /Manifest does not request required capabilities.*maia\.vfs\.write/,
);
assert.throws(
  () =>
    assertManifestCapabilities(
      guest.module,
      manifest,
      manifest.capabilities.filter((capability) => capability !== "vfs.write"),
    ),
  /Host policy denies required capabilities.*maia\.vfs\.write/,
);
const guestExports = WebAssembly.Module.exports(guest.module).map(
  ({ name }) => name,
);
assert.ok(guestExports.includes("memory"));
assert.ok(guestExports.includes(manifest.entryExport));
assert.ok(guestExports.includes(manifest.stepExport));
host.attachInstance(guest.instance);
guest.exports[manifest.entryExport]();
assert.deepEqual(
  calls.slice(0, 6).map(([kind]) => kind),
  ["window", "label", "label", "button", "button", "button"],
);
assert.equal(calls[0][1], "MaiaOS C++ kernel guest");
assert.ok(
  calls.some(
    ([, , text]) => text === "C++ kernel read this text through maia.vfs.\n",
  ),
);

guest.exports[manifest.stepExport]();
assert.equal(host.imports["maia.events"].poll(0, 24), host.status.WOULD_BLOCK);
assert.equal(
  host.enqueueEvent({
    type: MAIA_EVENT_GFX_CLICKED,
    objectHandle: buttonHandles.get("Write a note to /home"),
  }),
  0,
);
guest.exports[manifest.stepExport]();
assert.deepEqual(calls.at(-2), [
  "label-set-text",
  statusLabelHandle,
  "Note saved to /home/org.maiaos.kernel/maia-note.txt.",
]);
assert.deepEqual(calls.at(-1), [
  "log",
  1,
  "Kernel consumed a button event from the host queue.",
]);
assert.equal(
  new TextDecoder().decode(
    nodeVfs.files.get(`/home/${manifest.id}/maia-note.txt`),
  ),
  "Saved by the C++98 kernel through maia.vfs.write.\n",
);
assert.equal(
  host.enqueueEvent({
    type: MAIA_EVENT_GFX_CLICKED,
    objectHandle: buttonHandles.get("Read the saved note"),
  }),
  0,
);
guest.exports[manifest.stepExport]();
assert.deepEqual(calls.at(-2), [
  "label-set-text",
  statusLabelHandle,
  "Saved by the C++98 kernel through maia.vfs.write.\n",
]);
console.log("Node native WebAssembly kernel event-poll test passed.");

const lvglPath = new URL(
  "../platform/desktop-web/generated/maiaos-lvgl.js",
  import.meta.url,
);
const { default: createLvgl } = await import(lvglPath.href);
const flushFrames = [];
let lvglHost = null;
const eventHosts = new Map();
const lvgl = await createLvgl({
  noInitialRun: true,
  onLvglFlush: (x, y, width, height, pixels) =>
    flushFrames.push({ x, y, width, height, pixels }),
  onMaiaEvent: (handle) => {
    const eventHost = eventHosts.get(handle) ?? lvglHost;
    if (!eventHost)
      throw new Error(
        "LVGL event arrived before guest host binding was initialized",
      );
    eventHost.enqueueEvent({
      type: MAIA_EVENT_GFX_CLICKED,
      objectHandle: handle,
    });
  },
  printErr: (message) => console.error("[lvgl-wasm]", message),
});
lvgl._main();

const lvglGraphics = createLvglGraphicsCallbacks(lvgl);
lvglHost = createMaiaHostImports({
  graphics: lvglGraphics,
  vfs: new MemoryVfsAdapter({ appId: manifest.id }),
  log: (level, message) => calls.push(["log", level, message]),
});
const lvglGuest = await instantiateNativeWasmFile(modulePath, lvglHost.imports);
lvglHost.attachInstance(lvglGuest.instance);
lvglGuest.exports[manifest.entryExport]();
for (let tick = 0; tick < 8; tick += 1) lvgl._maiaos_lvgl_tick();
assert.ok(
  flushFrames.length > 0,
  "LVGL must emit rasterized display areas through flush callback",
);
assert.ok(
  flushFrames.some(
    ({ width, height, pixels }) => pixels.length === width * height * 2,
  ),
);
lvgl._maiaos_lvgl_key(1, 1);
await new Promise((resolve) => setTimeout(resolve, 40));
for (let tick = 0; tick < 4; tick += 1) lvgl._maiaos_lvgl_tick();
lvgl._maiaos_lvgl_key(1, 0);
await new Promise((resolve) => setTimeout(resolve, 40));
for (let tick = 0; tick < 4; tick += 1) lvgl._maiaos_lvgl_tick();
assert.ok(
  lvglHost.queuedEventCount > 0,
  "LVGL input must be queued by the platform callback",
);
lvglGuest.exports[manifest.stepExport]();
assert.ok(
  calls.some(
    ([kind, , message]) =>
      kind === "log" &&
      message === "Kernel consumed a button event from the host queue.",
  ),
  "The C++ kernel step must consume the LVGL event packet",
);

const calculatorManifest = JSON.parse(
  await readFile(
    new URL("../apps/examples/calculator/manifest.json", import.meta.url),
    "utf8",
  ),
);
const calculatorCalls = [];
const calculatorButtons = new Map();
let calculatorHost = null;
let calculatorExitCode = null;
let calculatorWindow = -1;
const calculatorGraphics = {
  windowCreate(title) {
    calculatorWindow = lvglGraphics.windowCreate(title);
    calculatorCalls.push(["window", title]);
    return calculatorWindow;
  },
  labelCreate(parent, text) {
    calculatorCalls.push(["label", parent, text]);
    return lvglGraphics.labelCreate(parent, text);
  },
  labelSetText(handle, text) {
    calculatorCalls.push(["label-set-text", handle, text]);
    return lvglGraphics.labelSetText(handle, text);
  },
  buttonCreate(parent, text) {
    const handle = lvglGraphics.buttonCreate(parent, text);
    calculatorButtons.set(text, handle);
    eventHosts.set(handle, calculatorHost);
    return handle;
  },
  objectDestroy(handle) {
    return lvglGraphics.objectDestroy(handle);
  },
};
calculatorHost = createMaiaHostImports({
  graphics: calculatorGraphics,
  vfs: new MemoryVfsAdapter({ appId: calculatorManifest.id }),
  onProcessExit: (exitCode) => {
    calculatorExitCode = exitCode;
    lvglGraphics.objectDestroy(calculatorWindow);
  },
});
const calculatorPath = new URL(
  "../apps/examples/calculator/app.wasm",
  import.meta.url,
);
const calculator = await instantiateNativeWasmFile(
  calculatorPath,
  calculatorHost.imports,
);
assert.doesNotThrow(() =>
  assertManifestCapabilities(
    calculator.module,
    calculatorManifest,
    calculatorManifest.capabilities,
  ),
);
calculatorHost.attachInstance(calculator.instance);
calculator.exports[calculatorManifest.entryExport]();
assert.deepEqual(calculatorCalls[0], ["window", "Maia Calculator"]);
assert.ok(calculator.exports.memory.buffer.byteLength <= calculatorManifest.limits.memoryPages * 65536);
assert.equal(
  calculatorHost.enqueueEvent({
    type: MAIA_EVENT_GFX_CLICKED,
    objectHandle: calculatorButtons.get("Add 7 + 5"),
  }),
  0,
);
calculator.exports[calculatorManifest.stepExport]();
assert.ok(
  calculatorCalls.some(([, , text]) => text === "7 + 5 = 12"),
  "The Calculator guest must update its LVGL label after an app-owned event",
);
assert.equal(
  calculatorHost.enqueueEvent({
    type: MAIA_EVENT_GFX_CLICKED,
    objectHandle: calculatorButtons.get("Close calculator"),
  }),
  0,
);
calculator.exports[calculatorManifest.stepExport]();
assert.equal(calculatorExitCode, 0);

const clockManifest = JSON.parse(
  await readFile(
    new URL("../apps/examples/clock/manifest.json", import.meta.url),
    "utf8",
  ),
);
const clockCalls = [];
const clockButtons = new Map();
let clockHost = null;
let clockExitCode = null;
let clockWindow = -1;
const clockGraphics = {
  windowCreate(title) {
    clockWindow = lvglGraphics.windowCreate(title);
    clockCalls.push(["window", title]);
    return clockWindow;
  },
  labelCreate(parent, text) {
    clockCalls.push(["label", parent, text]);
    return lvglGraphics.labelCreate(parent, text);
  },
  labelSetText(handle, text) {
    clockCalls.push(["label-set-text", handle, text]);
    return lvglGraphics.labelSetText(handle, text);
  },
  buttonCreate(parent, text) {
    const handle = lvglGraphics.buttonCreate(parent, text);
    clockButtons.set(text, handle);
    eventHosts.set(handle, clockHost);
    return handle;
  },
  objectDestroy(handle) {
    return lvglGraphics.objectDestroy(handle);
  },
};
clockHost = createMaiaHostImports({
  graphics: clockGraphics,
  vfs: new MemoryVfsAdapter({ appId: clockManifest.id }),
  monotonicMs: () => 12345,
  onProcessExit: (exitCode) => {
    clockExitCode = exitCode;
    lvglGraphics.objectDestroy(clockWindow);
  },
});
const clock = await instantiateNativeWasmFile(
  new URL("../apps/examples/clock/app.wasm", import.meta.url),
  clockHost.imports,
);
assert.doesNotThrow(() =>
  assertManifestCapabilities(
    clock.module,
    clockManifest,
    clockManifest.capabilities,
  ),
);
clockHost.attachInstance(clock.instance);
clock.exports[clockManifest.entryExport]();
clock.exports[clockManifest.stepExport]();
assert.ok(
  clockCalls.some(([, , text]) => text === "Browser uptime: 000000012 seconds"),
  "The Clock guest must use the monotonic host callback during scheduled steps",
);
assert.equal(
  clockHost.enqueueEvent({
    type: MAIA_EVENT_GFX_CLICKED,
    objectHandle: clockButtons.get("Close clock"),
  }),
  0,
);
clock.exports[clockManifest.stepExport]();
assert.equal(clockExitCode, 0);
console.log("Node LVGL-WASM kernel, Calculator, and Clock process test passed.");
