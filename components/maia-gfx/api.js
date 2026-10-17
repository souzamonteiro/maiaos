// Platform-neutral graphics API contract used by the desktop prototype.
// Production guest ABI is numeric handles + WASM memory offsets (see docs).
export class MaiaGfx {
  constructor(backend) { this.backend = backend; }
  createWindow(title, options = {}) { return this.backend.createWindow(title, options); }
  createLabel(parent, text) { return this.backend.createLabel(parent, text); }
  createButton(parent, text, onClick) { return this.backend.createButton(parent, text, onClick); }
  render() { this.backend.render(); }
}
