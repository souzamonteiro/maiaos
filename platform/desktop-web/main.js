import {
  createMaiaHostImports,
  MAIA_EVENT_GFX_CLICKED,
} from "/runtime/maia-host-imports.js";
import { assertManifestCapabilities } from "/runtime/maia-capabilities.js";
import { instantiateNativeWasm } from "/runtime/native-wasm-browser.js";
import {
  IndexedDbVfsAdapter,
  MemoryVfsAdapter,
} from "/runtime/maia-vfs.js";
import {
  createLvglGraphicsCallbacks,
  presentLvglRgb565,
} from "/platform/desktop-web/lvgl-bridge.js";

const screen = document.getElementById("screen");
const status = document.getElementById("status");
const BROWSER_HOST_GRANTS = [
  "gfx.window",
  "gfx.label",
  "gfx.label.set_text",
  "gfx.button",
  "events.poll",
  "log.write",
  "vfs.open",
  "vfs.read",
  "vfs.write",
  "vfs.close",
  "process.exit",
  "time.monotonic",
];
const runningProcesses = new Set();
const buttonOwners = new Map();
let lvglModule = null;
let graphicsCallbacks = null;
let kernelProcess = null;
let nextProcessId = 1;

function reportError(error) {
  status.textContent = `Startup error: ${error.message}`;
  console.error(error);
}

function processGraphics(process) {
  return {
    windowCreate(title) {
      const handle = graphicsCallbacks.windowCreate(title);
      if (handle > 0) process.windowHandle = handle;
      return handle;
    },
    labelCreate: (parent, text) => graphicsCallbacks.labelCreate(parent, text),
    labelSetText: (handle, text) =>
      graphicsCallbacks.labelSetText(handle, text),
    buttonCreate(parent, text) {
      const handle = graphicsCallbacks.buttonCreate(parent, text);
      if (handle > 0) buttonOwners.set(handle, process);
      return handle;
    },
    objectDestroy(handle) {
      const result = graphicsCallbacks.objectDestroy(handle);
      if (result === 0) buttonOwners.delete(handle);
      return result;
    },
  };
}

function routeLvglEvent(handle) {
  const process = buttonOwners.get(handle);
  const result = process?.host?.enqueueEvent({
    type: MAIA_EVENT_GFX_CLICKED,
    objectHandle: handle,
  });
  if (result !== 0) {
    status.textContent = `Could not enqueue LVGL event (${result ?? "no owner"})`;
  }
}

function stopProcess(process, exitCode) {
  if (!process?.running) return;
  process.running = false;
  runningProcesses.delete(process);
  for (const [handle, owner] of buttonOwners) {
    if (owner === process) buttonOwners.delete(handle);
  }
  if (process.windowHandle > 0) {
    graphicsCallbacks.objectDestroy(process.windowHandle);
    process.windowHandle = -1;
  }
  const vfs = process.vfs;
  if (typeof vfs?.flush === "function") {
    void vfs
      .flush()
      .catch((error) => console.error("[maia vfs] flush failed", error))
      .finally(() => vfs.database?.close());
  }
  process.runtime = null;
  process.host = null;
  if (process.role === "app") {
    document.getElementById("app-status").textContent =
      `${process.name} exited (${exitCode}).`;
  }
}

async function createAppVfs(appId) {
  try {
    return await IndexedDbVfsAdapter.create({
      appId,
      onPersistenceError: (error) => {
        status.textContent = `VFS persistence failed: ${error.message}`;
        console.error("[maia vfs] persistence failed", error);
      },
    });
  } catch (error) {
    status.textContent = "Persistent storage unavailable; using temporary VFS.";
    console.error("[maia vfs] using temporary storage", error);
    return new MemoryVfsAdapter({ appId });
  }
}

async function startProcess({ manifest, bytes, role, entryName, stepName }) {
  const module = await WebAssembly.compile(bytes);
  assertManifestCapabilities(module, manifest, BROWSER_HOST_GRANTS);

  const process = {
    pid: nextProcessId++,
    appId: manifest.id,
    name: manifest.name ?? manifest.id,
    role,
    running: false,
    windowHandle: -1,
    runtime: null,
    host: null,
    vfs: await createAppVfs(manifest.id),
    stepExport: stepName || null,
  };
  process.host = createMaiaHostImports({
    graphics: processGraphics(process),
    vfs: process.vfs,
    log: (level, message) => {
      status.textContent = message;
      (level >= 2 ? console.error : console.log)(
        `[maia ${process.appId}]`,
        message,
      );
    },
    onProcessExit: (exitCode) => stopProcess(process, exitCode),
  });

  const runtime = await instantiateNativeWasm(
    module,
    process.host.imports,
    "browser",
  );
  process.host.attachInstance(runtime.instance);

  const entry = runtime.exports[entryName];
  if (typeof entry !== "function") {
    throw new TypeError(
      `Guest module is missing the '${entryName}' function export`,
    );
  }
  if (process.stepExport && typeof runtime.exports[process.stepExport] !== "function") {
    throw new TypeError(
      `Guest module is missing the scheduler export '${process.stepExport}'`,
    );
  }

  const memoryLimit = manifest.limits?.memoryPages;
  const memoryPages = runtime.exports.memory?.buffer.byteLength / 65536;
  if (Number.isInteger(memoryLimit) && memoryPages > memoryLimit) {
    throw new RangeError(
      `Guest memory (${memoryPages} pages) exceeds manifest limit (${memoryLimit})`,
    );
  }

  process.runtime = runtime;
  process.running = true;
  runningProcesses.add(process);
  try {
    entry();
  } catch (error) {
    stopProcess(process, 1);
    throw error;
  }
  return process;
}

async function launchSelectedApp() {
  const manifestPath = document.getElementById("app-select").value;
  const manifestUrl = new URL(manifestPath, window.location.href);
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`App manifest request failed: HTTP ${manifestResponse.status}`);
  }
  const manifest = await manifestResponse.json();
  if ([...runningProcesses].some((process) => process.role === "app" && process.appId === manifest.id)) {
    throw new Error(`App '${manifest.id}' is already running`);
  }

  const packageRoot = new URL(".", manifestUrl);
  const moduleUrl = new URL(manifest.entry, packageRoot);
  if (
    moduleUrl.origin !== window.location.origin ||
    !moduleUrl.pathname.startsWith(packageRoot.pathname)
  ) {
    throw new Error("App module must remain inside its package directory");
  }
  const moduleResponse = await fetch(moduleUrl);
  if (!moduleResponse.ok) {
    throw new Error(`App module request failed: HTTP ${moduleResponse.status}`);
  }
  const process = await startProcess({
    manifest,
    bytes: await moduleResponse.arrayBuffer(),
    role: "app",
    entryName: manifest.entryExport,
    stepName: manifest.stepExport,
  });
  document.getElementById("app-status").textContent =
    `${process.name} running as PID ${process.pid}.`;
}

async function loadAppCatalog() {
  const catalogUrl = new URL("/apps/catalog.json", window.location.href);
  const response = await fetch(catalogUrl);
  if (!response.ok) {
    throw new Error(`App catalog request failed: HTTP ${response.status}`);
  }
  const catalog = await response.json();
  if (catalog.schema !== 1 || !Array.isArray(catalog.apps)) {
    throw new TypeError("Unsupported app catalog format");
  }

  const select = document.getElementById("app-select");
  select.replaceChildren();
  for (const app of catalog.apps) {
    if (typeof app.manifest !== "string") continue;
    const manifestUrl = new URL(app.manifest, catalogUrl);
    if (
      manifestUrl.origin !== window.location.origin ||
      !manifestUrl.pathname.startsWith("/apps/")
    ) {
      continue;
    }
    const option = document.createElement("option");
    option.value = manifestUrl.pathname;
    option.textContent = app.name ?? app.manifest;
    select.append(option);
  }
  if (select.options.length === 0) throw new Error("App catalog is empty");
}

function sendPointer(module, event, pressed) {
  const bounds = screen.getBoundingClientRect();
  const x = Math.floor(
    ((event.clientX - bounds.left) * screen.width) / bounds.width,
  );
  const y = Math.floor(
    ((event.clientY - bounds.top) * screen.height) / bounds.height,
  );
  module._maiaos_lvgl_pointer(x, y, pressed ? 1 : 0);
}

async function boot() {
  const manifestResponse = await fetch("/apps/kernel/kernel.json");
  if (!manifestResponse.ok) {
    throw new Error(
      `Kernel manifest request failed: HTTP ${manifestResponse.status}`,
    );
  }
  const kernelManifest = await manifestResponse.json();
  await loadAppCatalog();
  document.getElementById("entry-export").value = kernelManifest.entryExport;
  document.getElementById("step-export").value = kernelManifest.stepExport;

  const { default: createMaiaOsLvgl } =
    await import("/platform/desktop-web/generated/maiaos-lvgl.js");
  lvglModule = await createMaiaOsLvgl({
    onLvglFlush: (x, y, width, height, pixels) =>
      presentLvglRgb565(screen, x, y, width, height, pixels),
    onMaiaEvent: routeLvglEvent,
    printErr: (message) => console.error("[lvgl-wasm]", message),
  });

  const tickLvgl = () => {
    lvglModule._maiaos_lvgl_tick();
    for (const process of [...runningProcesses]) {
      if (!process.stepExport || !process.running) continue;
      try {
        process.runtime.exports[process.stepExport]();
      } catch (error) {
        stopProcess(process, 1);
        console.error(`[maia ${process.appId}] scheduler trapped`, error);
      }
    }
    window.requestAnimationFrame(tickLvgl);
  };
  window.requestAnimationFrame(tickLvgl);

  graphicsCallbacks = createLvglGraphicsCallbacks(lvglModule);

  document.getElementById("load-guest").addEventListener("click", () => {
    const input = document.getElementById("guest-file");
    const entry = document.getElementById("entry-export").value.trim();
    const step = document.getElementById("step-export").value.trim();
    const loadSelected =
      input.files && input.files[0]
        ? input.files[0].arrayBuffer()
        : fetch("/platform/desktop-web/generated/kernel.wasm").then(
            (response) => {
              if (!response.ok)
                throw new Error(
                  `Guest fixture request failed: HTTP ${response.status}`,
                );
              return response.arrayBuffer();
            },
          );
    loadSelected
      .then(async (bytes) => {
        for (const process of [...runningProcesses]) stopProcess(process, -1);
        graphicsCallbacks.reset();
        buttonOwners.clear();
        kernelProcess = await startProcess({
          manifest: kernelManifest,
          bytes: new Uint8Array(bytes),
          role: "kernel",
          entryName: entry,
          stepName: step,
        });
        status.textContent = `Kernel running in ${kernelProcess.runtime.backendId}; LVGL-WASM callbacks active.`;
      })
      .catch(reportError);
  });

  document.getElementById("run-app").addEventListener("click", () => {
    launchSelectedApp().catch((error) => {
      document.getElementById("app-status").textContent = error.message;
      console.error("[maia app launcher]", error);
    });
  });

  screen.addEventListener("pointerdown", (event) => {
    screen.setPointerCapture(event.pointerId);
    sendPointer(lvglModule, event, true);
  });
  screen.addEventListener("pointermove", (event) => {
    if (event.buttons) sendPointer(lvglModule, event, true);
  });
  screen.addEventListener("pointerup", (event) =>
    sendPointer(lvglModule, event, false),
  );
  window.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      lvglModule._maiaos_lvgl_key(event.key === "Enter" ? 1 : 2, 1);
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "Enter" || event.key === "Tab") {
      lvglModule._maiaos_lvgl_key(event.key === "Enter" ? 1 : 2, 0);
    }
  });
  screen.focus();
  document.getElementById("load-guest").click();
}

boot().catch(reportError);
