const IMPORT_CAPABILITIES = Object.freeze({
  "maia.gfx.window_create": "gfx.window",
  "maia.gfx.label_create": "gfx.label",
  "maia.gfx.label_set_text": "gfx.label.set_text",
  "maia.gfx.button_create": "gfx.button",
  "maia.gfx.object_destroy": "gfx.object.destroy",
  "maia.events.poll": "events.poll",
  "maia.vfs.open": "vfs.open",
  "maia.vfs.read": "vfs.read",
  "maia.vfs.write": "vfs.write",
  "maia.vfs.close": "vfs.close",
  "maia.time.monotonic_ms": "time.monotonic",
  "maia.process.exit": "process.exit",
  "maia.log.write": "log.write",
});

export function assertManifestCapabilities(module, manifest, grantedCapabilities) {
  if (!manifest || !Array.isArray(manifest.capabilities)) {
    throw new TypeError("The app manifest must declare a capabilities array");
  }
  if (!Array.isArray(grantedCapabilities)) {
    throw new TypeError("The host policy must provide a capabilities array");
  }

  const requested = new Set(manifest.capabilities);
  const granted = new Set(grantedCapabilities);
  const missingRequests = [];
  const deniedByPolicy = [];
  for (const { module: namespace, name } of WebAssembly.Module.imports(module)) {
    const importName = `${namespace}.${name}`;
    const required = IMPORT_CAPABILITIES[importName];
    if (!required || !requested.has(required)) missingRequests.push(importName);
    else if (!granted.has(required)) deniedByPolicy.push(importName);
  }

  if (missingRequests.length > 0) {
    throw new Error(
      `Manifest does not request required capabilities for imports: ${missingRequests.join(", ")}`,
    );
  }
  if (deniedByPolicy.length > 0) {
    throw new Error(
      `Host policy denies required capabilities for imports: ${deniedByPolicy.join(", ")}`,
    );
  }
}