import { readFile } from "node:fs/promises";
import { instantiateNativeWasm } from "./native-wasm.js";

export async function instantiateNativeWasmFile(filePath, imports = {}) {
  const bytes = await readFile(filePath);
  return instantiateNativeWasm(
    new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    imports,
    "node",
  );
}
