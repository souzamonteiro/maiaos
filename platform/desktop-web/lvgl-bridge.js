function callWithUtf8(module, exportName, prefixArgs, value) {
  const bytes = new TextEncoder().encode(value);
  const pointer = module._malloc(bytes.length + 1);
  if (!pointer) throw new Error("LVGL WASM could not allocate a text buffer");
  try {
    module.stringToUTF8(value, pointer, bytes.length + 1);
    return module[exportName](...prefixArgs, pointer, bytes.length);
  } finally {
    module._free(pointer);
  }
}

export function createLvglGraphicsCallbacks(module) {
  return Object.freeze({
    reset: () => module._maiaos_lvgl_reset(),
    windowCreate: (title) =>
      callWithUtf8(module, "_maiaos_lvgl_window_create", [], title),
    labelCreate: (parent, value) =>
      callWithUtf8(module, "_maiaos_lvgl_label_create", [parent], value),
    labelSetText: (handle, value) =>
      callWithUtf8(module, "_maiaos_lvgl_label_set_text", [handle], value),
    buttonCreate: (parent, value) =>
      callWithUtf8(module, "_maiaos_lvgl_button_create", [parent], value),
    objectDestroy: (handle) => module._maiaos_lvgl_object_destroy(handle),
  });
}

export function presentLvglRgb565(canvas, x, y, width, height, bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength !== width * height * 2
  ) {
    throw new RangeError(
      "LVGL flush callback supplied an invalid RGB565 image buffer",
    );
  }
  const context = canvas.getContext("2d", { alpha: false });
  const image = context.createImageData(width, height);
  for (let src = 0, dst = 0; src < bytes.length; src += 2, dst += 4) {
    const packed = bytes[src] | (bytes[src + 1] << 8);
    const red = (packed >> 11) & 0x1f;
    const green = (packed >> 5) & 0x3f;
    const blue = packed & 0x1f;
    image.data[dst] = (red << 3) | (red >> 2);
    image.data[dst + 1] = (green << 2) | (green >> 4);
    image.data[dst + 2] = (blue << 3) | (blue >> 2);
    image.data[dst + 3] = 0xff;
  }
  context.putImageData(image, x, y);
}
