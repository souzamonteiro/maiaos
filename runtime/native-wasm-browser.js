import { instantiateNativeWasm } from "./native-wasm.js";

export { instantiateNativeWasm } from "./native-wasm.js";

export async function instantiateNativeWasmUrl(
  url,
  imports = {},
  options = {},
) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("The browser host does not provide fetch()");
  }

  const response = await fetchImpl(url, { signal: options.signal });
  if (!response.ok) {
    throw new Error(
      `WASM request failed (${response.status} ${response.statusText}): ${url}`,
    );
  }

  return instantiateNativeWasm(
    await response.arrayBuffer(),
    imports,
    "browser",
  );
}
