import {
  createMaiaHostImports,
  MAIA_EVENT_GFX_CLICKED,
  MAIA_EVENT_KEY,
  MAIA_KEY_BACKSPACE,
  MAIA_KEY_DELETE,
  MAIA_KEY_DOWN,
  MAIA_KEY_END,
  MAIA_KEY_ENTER,
  MAIA_KEY_HOME,
  MAIA_KEY_LEFT,
  MAIA_KEY_RIGHT,
  MAIA_KEY_TEXT,
  MAIA_KEY_UP,
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
import { KernelProcessController } from "/runtime/maia-kernel-processes.js";
import { KernelPipelineTransport } from "/runtime/maia-pipeline-transport.js";
import { MaiaStreamBroker } from "/runtime/maia-streams.js";

import { MaiaVfsStore } from "/runtime/maia-vfs-store.js";

const sharedVfsStore = new MaiaVfsStore();
const screen = document.getElementById("screen");
const status = document.getElementById("status");
const BROWSER_HOST_GRANTS = [
  "memory.alloc",
  "memory.free",
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
  "vfs.opendir",
  "vfs.readdir",
  "tty.input",
  "process.exit",
  "process.pipeline",
  "process.args",
  "time.monotonic",
  "stream.read",
  "stream.write",
  "stream.close",
];
const runningProcesses = new Set();
const streamBroker = new MaiaStreamBroker();
const buttonOwners = new Map();
let lvglModule = null;
let graphicsCallbacks = null;
let kernelProcess = null;
let kernelController = null;
let pipelineTransport = null;
let catPackage = null;

function setSimulatorState(state, text) {
  document.body.dataset.state = state;
  document.getElementById("runtime-state").textContent = text;
  document.getElementById("run-app").disabled = state !== "ready";
}

function reportError(error) {
  setSimulatorState("error", "Session error");
  document.getElementById("developer-tools").open = true;
  status.textContent = `Startup error: ${error.message}`;
  console.error(error);
}

function configureFullscreen() {
  const button = document.getElementById("fullscreen-button");
  const device = document.getElementById("device");
  button.disabled = !document.fullscreenEnabled;
  if (button.disabled) button.title = "Full screen is not available in this browser";
  button.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === device) await document.exitFullscreen();
      else await device.requestFullscreen();
      screen.focus();
    } catch (error) {
      document.getElementById("app-status").textContent = `Full screen unavailable: ${error.message}`;
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const active = document.fullscreenElement === device;
    button.textContent = active ? "Exit full screen" : "Full screen";
    button.setAttribute("aria-pressed", String(active));
  });
}

function keyboardTargetProcess() {
  for (const process of runningProcesses) {
    if (process.running && process.acceptsKeyboardInput) return process;
  }
  return null;
}

function routeKeyboardEvent(event) {
  const process = keyboardTargetProcess();
  if (!process || document.activeElement !== screen) return false;

  let keyKind;
  let data0 = 0;
  if (event.key === "Enter") keyKind = MAIA_KEY_ENTER;
  else if (event.key === "Backspace") keyKind = MAIA_KEY_BACKSPACE;
  else if (event.key === "Delete") keyKind = MAIA_KEY_DELETE;
  else if (event.key === "ArrowLeft") keyKind = MAIA_KEY_LEFT;
  else if (event.key === "ArrowRight") keyKind = MAIA_KEY_RIGHT;
  else if (event.key === "ArrowUp") keyKind = MAIA_KEY_UP;
  else if (event.key === "ArrowDown") keyKind = MAIA_KEY_DOWN;
  else if (event.key === "Home" || (event.ctrlKey && event.key.toLowerCase() === "a")) {
    keyKind = MAIA_KEY_HOME;
  } else if (event.key === "End" || (event.ctrlKey && event.key.toLowerCase() === "e")) {
    keyKind = MAIA_KEY_END;
  } else if (
    event.key.length === 1
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && event.key.codePointAt(0) >= 32
    && event.key.codePointAt(0) <= 126
  ) {
    keyKind = MAIA_KEY_TEXT;
    data0 = event.key.codePointAt(0);
  } else {
    return false;
  }

  event.preventDefault();
  const result = process.host.enqueueEvent({
    type: MAIA_EVENT_KEY,
    objectHandle: 0,
    data0,
    data1: keyKind,
  });
  if (result !== 0) {
    document.getElementById("app-status").textContent = "Shell keyboard event queue is full.";
  }
  return true;
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

function stopProcess(process, exitCode, trapped = false) {
  if (!process || process.stopped) return;
  process.stopped = true;
  process.running = false;
  runningProcesses.delete(process);
  process.host?.closeStreams();
  process.host?.closeFiles();
  process.controller?.exit(process.pid, exitCode, trapped);
  if (process.role === "kernel") {
    // A dead kernel cannot schedule or authorize surviving platform instances.
    for (const child of [...runningProcesses]) stopProcess(child, exitCode, true);
    kernelController = null; pipelineTransport = null;
  }
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
      .catch((error) => console.error("[maia vfs] flush failed", error));
  }
  process.runtime = null;
  process.host = null;
  if (process.role === "app") {
    document.getElementById("app-status").textContent =
      `${process.name} exited (${exitCode}).`;
  }
}

function reportVfsPersistenceError(error) {
  status.textContent = `VFS persistence failed: ${error.message}`;
  console.error("[maia vfs] persistence failed", error);
}

async function createAppVfs(appId, requestedLimit = 16) {
  if (!Number.isInteger(requestedLimit) || requestedLimit < 0) throw new TypeError("Invalid open-file limit");
  const maxOpenFiles = Math.min(requestedLimit, 16);
  try {
    return await IndexedDbVfsAdapter.create({
      appId,
      store: sharedVfsStore,
      maxOpenFiles,
      onPersistenceError: reportVfsPersistenceError,
    });
  } catch (error) {
    status.textContent = "Persistent storage unavailable; using temporary VFS.";
    console.error("[maia vfs] using temporary storage", error);
    return new MemoryVfsAdapter({ appId, maxOpenFiles, store: sharedVfsStore });
  }
}

async function startProcess({ manifest, bytes, role, entryName, stepName, pid = null, effectiveAppId = manifest.id, processArgs = null, deferEntry = false }) {
  const ownerKernel = kernelController;
  if (role !== "kernel" && !ownerKernel) throw new Error("Start the kernel before applications");
  const module = await WebAssembly.compile(bytes);
  assertManifestCapabilities(module, manifest, BROWSER_HOST_GRANTS);

  if (pid === null) {
    pid = role === "kernel" ? 1 : ownerKernel.reserve(manifest, role === "service" ? 1 : 2);
    if (pid <= 0) throw new Error(`Kernel rejected process reservation (${pid})`);
  }
  const process = {
    pid,
    appId: manifest.id,
    effectiveAppId, manifest, controller: ownerKernel,
    started: !deferEntry, entryExport: entryName,
    name: manifest.name ?? manifest.id,
    role,
    acceptsKeyboardInput: manifest.capabilities.includes("tty.input"),
    running: false,
    stopped: false,
    windowHandle: -1,
    runtime: null,
    host: null,
    vfs: await createAppVfs(effectiveAppId, manifest.limits?.openFiles),
    stepExport: stepName || null,
  };
  const processPipeline = pipelineTransport;
  process.host = createMaiaHostImports({
    graphics: processGraphics(process),
    vfs: process.vfs,
    streams: streamBroker,
    processId: process.pid,
    processArgs,
    pipeline: manifest.capabilities.includes("process.pipeline") ? {
      start: packet => processPipeline.start(process.pid, packet, process),
      wait: (group, capacity) => processPipeline.wait(process.pid, group, capacity),
      cancel: group => processPipeline.cancel(process.pid, group),
    } : null,
    log: (level, message) => {
      status.textContent = message;
      (level >= 2 ? console.error : console.log)(
        `[maia ${process.appId}]`,
        message,
      );
    },
    onProcessExit: (exitCode) => stopProcess(process, exitCode),
  });

  try {
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

    if (role !== "kernel" && ownerKernel !== kernelController) throw new Error("Kernel restarted during process startup");
    process.runtime = runtime;
    if (role === "kernel") {
      kernelController = new KernelProcessController(runtime.instance);
      process.controller = kernelController;
      if (kernelController.reserve(manifest, 0) !== 1) throw new Error("Kernel boot reservation failed");
      pipelineTransport = new KernelPipelineTransport({controller: kernelController, streams: streamBroker,
        spawn: spawnKernelWorker, stop: stopKernelProcess});
    }
    process.running = true;
    runningProcesses.add(process);
    if (!deferEntry) {
      entry();
      if (process.running && process.controller.ready(process.pid) !== 0) throw new Error("Kernel rejected boot readiness");
    }
    return process;
  } catch (error) {
    stopProcess(process, 1);
    throw error;
  }
}

async function startApplication({ manifest, bytes, entryName, stepName }) {
  if (manifest.id !== "org.maiaplatform.shell") {
    return startProcess({ manifest, bytes, entryName, stepName, role: "app" });
  }
  const response = await fetch("/apps/io/manifest.json");
  if (!response.ok) throw new Error(`I/O manifest request failed: HTTP ${response.status}`);
  const ioManifest = await response.json();
  const ioRoot = new URL("/apps/io/", window.location.href);
  const ioUrl = new URL(ioManifest.entry, ioRoot);
  if (ioManifest.id !== "org.maiaplatform.io" || ioUrl.origin !== ioRoot.origin
      || !ioUrl.pathname.startsWith(ioRoot.pathname)) throw new Error("Invalid I/O service package");
  const ioResponse = await fetch(ioUrl);
  if (!ioResponse.ok) throw new Error(`I/O guest request failed: HTTP ${ioResponse.status}`);
  const ioBytes = await ioResponse.arrayBuffer();
  if (!kernelController || !pipelineTransport) throw new Error("Start the kernel before the shell");
  const ioPid = kernelController.reserve(ioManifest, 1);
  if (ioPid <= 0) throw new Error(`Kernel rejected I/O reservation (${ioPid})`);
  const shellPid = kernelController.reserve(manifest, 2, ioPid);
  if (shellPid <= 0) {kernelController.ready(ioPid, -1);await pipelineTransport.pump();throw new Error(`Kernel rejected shell reservation (${shellPid})`);}
  await pipelineTransport.pump();
  let ioProcess = null;
  try {
    ioProcess = await startProcess({ manifest: ioManifest, bytes: ioBytes, role: "service", pid: ioPid,
      entryName: ioManifest.entryExport, stepName: ioManifest.stepExport });
    if (!ioProcess.running) throw new Error("I/O guest exited during startup");
    return await startProcess({ manifest, bytes, entryName, stepName, role: "app", pid: shellPid });
  } catch (error) {
    if (ioProcess) stopProcess(ioProcess, 1);
    kernelController?.ready(shellPid, -1);
    await pipelineTransport?.pump();
    streamBroker.closeProcess(ioPid); streamBroker.closeProcess(shellPid);
    throw error;
  }
}

async function stopKernelProcess(pid, status) {
  const process = [...runningProcesses].find(item => item.pid === pid);
  if (process) stopProcess(process, status);
  else {streamBroker.closeProcess(pid);kernelController?.exit(pid, status);}
}

async function spawnKernelWorker(action, owner) {
  if (action.arg0 !== 1 || owner.controller !== kernelController) throw new Error("Invalid kernel worker package/boot");
  if (!catPackage) catPackage = (async () => {
    const root = new URL("/apps/cat/", window.location.href);
    const response = await fetch(new URL("manifest.json",root));
    if (!response.ok) throw new Error("Cat worker manifest unavailable");
    const manifest = await response.json(), url = new URL(manifest.entry,root);
    if (manifest.id !== "org.maiaplatform.cat" || url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error("Invalid cat worker package");
    const binary = await fetch(url); if (!binary.ok) throw new Error("Cat worker binary unavailable");
    return {manifest,bytes:await binary.arrayBuffer()};
  })().catch(error => {catPackage=null;throw error;});
  const pkg = await catPackage;
  // Package index 1 has the fixed read-only resource profile reserved by kernel.
  const workerProfile = new Set(["vfs.open","vfs.read","vfs.close","stream.read","stream.write","stream.close","process.args","process.exit"]);
  if (pkg.manifest.capabilities.some(cap => !workerProfile.has(cap))) throw new Error("Worker package exceeds the kernel-reserved profile");
  if (pkg.manifest.capabilities.some(cap => cap !== "process.args" && !owner.manifest.capabilities.includes(cap))) throw new Error("Worker capability delegation denied");
  const manifest = {...pkg.manifest, limits:{...pkg.manifest.limits,
    memoryPages:Math.min(pkg.manifest.limits.memoryPages,owner.manifest.limits.memoryPages,action.arg1),
    openFiles:Math.min(pkg.manifest.limits.openFiles,owner.manifest.limits.openFiles,4)}};
  return startProcess({manifest,bytes:pkg.bytes,role:"worker",pid:action.pid,
    effectiveAppId:owner.effectiveAppId,processArgs:action.payload,deferEntry:true,
    entryName:manifest.entryExport,stepName:manifest.stepExport});
}

function stepKernelProcesses() {
  if (kernelProcess?.running && kernelProcess.stepExport) {
    try {kernelProcess.runtime.exports[kernelProcess.stepExport]();}
    catch(error){stopProcess(kernelProcess,1,true);console.error("Kernel trapped",error);return;}
  }
  if (!kernelController) return;
  for (let budget=0;budget<16;++budget) {
    const pid=kernelController.next();if(!pid)break;
    const process=[...runningProcesses].find(item=>item.pid===pid);
    if(!process || !process.running || !process.stepExport)continue;
    try {
      if(!process.started){process.started=true;process.runtime.exports[process.entryExport]();}
      if(process.running)process.runtime.exports[process.stepExport]();
    } catch(error){stopProcess(process,1,true);console.error(`[maia ${process.appId}] scheduler trapped`,error);}
  }
  void pipelineTransport?.pump().catch(error=>console.error("Kernel action transport failed",error));
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
  const process = await startApplication({
    manifest,
    bytes: await moduleResponse.arrayBuffer(),
    entryName: manifest.entryExport,
    stepName: manifest.stepExport,
  });
  document.getElementById("app-status").textContent =
    `${process.name} running as PID ${process.pid}.`;
  if (process.acceptsKeyboardInput || manifest.id === "org.maiaplatform.shell") screen.focus();
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
  configureFullscreen();
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
    stepKernelProcesses();
    window.requestAnimationFrame(tickLvgl);
  };
  window.requestAnimationFrame(tickLvgl);

  graphicsCallbacks = createLvglGraphicsCallbacks(lvglModule);

  document.getElementById("load-guest").addEventListener("click", () => {
    setSimulatorState("starting", "Starting…");
    const input = document.getElementById("guest-file");
    const manifestInput = document.getElementById("guest-manifest");
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
    const loadManifest =
      manifestInput.files && manifestInput.files[0]
        ? manifestInput.files[0].text().then((text) => JSON.parse(text))
        : Promise.resolve(kernelManifest);
    Promise.all([loadSelected, loadManifest])
      .then(async ([bytes, manifest]) => {
        const role = manifest.id === kernelManifest.id ? "kernel" : "app";
        for (const process of [...runningProcesses]) stopProcess(process, -1);
        graphicsCallbacks.reset();
        buttonOwners.clear();
        const options = {
          manifest,
          bytes: new Uint8Array(bytes),
          role,
          entryName: entry,
          stepName: step,
        };
        if (role === "app") {
          const response = await fetch("/platform/desktop-web/generated/kernel.wasm");
          if (!response.ok) throw new Error("Kernel binary unavailable");
          kernelProcess = await startProcess({manifest:kernelManifest,bytes:await response.arrayBuffer(),role:"kernel",entryName:kernelManifest.entryExport,stepName:kernelManifest.stepExport});
        }
        const process = role === "app" ? await startApplication(options) : await startProcess(options);
        if (role === "kernel") kernelProcess = process;
        if (role === "app") {
          document.getElementById("app-status").textContent =
            `${process.name} running as PID ${process.pid}.`;
        } else {
          document.getElementById("app-status").textContent =
            "Kernel ready. Choose an application to begin.";
        }
        status.textContent = `${process.name} running in ${process.runtime.backendId}; LVGL-WASM callbacks active.`;
        setSimulatorState("ready", "Ready");
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
    screen.focus();
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
    if (document.activeElement !== screen) return;
    if (routeKeyboardEvent(event)) return;
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      lvglModule._maiaos_lvgl_key(event.key === "Enter" ? 1 : 2, 1);
    }
  });
  window.addEventListener("keyup", (event) => {
    if (document.activeElement !== screen || keyboardTargetProcess()) return;
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      lvglModule._maiaos_lvgl_key(event.key === "Enter" ? 1 : 2, 0);
    }
  });
  screen.focus();
  document.getElementById("load-guest").click();
}

boot().catch(reportError);
