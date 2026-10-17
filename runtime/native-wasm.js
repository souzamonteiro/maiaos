export const NATIVE_WASM_BACKEND_ID = "native-wasm-reference";

function normalizeBytes(source) {
  if (source instanceof Uint8Array) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }
  throw new TypeError("WASM input must be a Uint8Array or ArrayBuffer");
}

export async function instantiateNativeWasm(
  source,
  imports = {},
  host = "unknown",
) {
  const wasm = globalThis.WebAssembly;
  if (!wasm) {
    throw new Error("This host does not provide the WebAssembly API");
  }

  let module;
  let instance;
  if (source instanceof wasm.Module) {
    module = source;
    instance = await wasm.instantiate(module, imports);
  } else {
    const bytes = normalizeBytes(source);
    ({ module, instance } = await wasm.instantiate(bytes, imports));
  }

  return Object.freeze({
    backendId: NATIVE_WASM_BACKEND_ID,
    host,
    isReferenceBackend: true,
    module,
    instance,
    exports: instance.exports,
  });
}
