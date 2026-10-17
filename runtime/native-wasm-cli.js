#!/usr/bin/env node
import { instantiateNativeWasmFile } from "./native-wasm-node.js";

const [filePath, exportName = "_start", ...rawArgs] = process.argv.slice(2);
if (!filePath) {
  console.error("Usage: node runtime/native-wasm-cli.js <module.wasm> [export] [args...]");
  process.exit(2);
}

const result = await instantiateNativeWasmFile(filePath);
const entry = result.exports[exportName];
if (typeof entry !== "function") {
  throw new TypeError(`WASM export '${exportName}' is not a function`);
}
const args = rawArgs.map((value) => Number(value));
const value = entry(...args);
console.log(JSON.stringify({ backendId: result.backendId, host: result.host, exportName, value: value ?? null }));
