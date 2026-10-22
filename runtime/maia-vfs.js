import { normalizeGuestPath } from "../components/maia-vfs/api.js";

import {MaiaVfsStore, VFS_LIMITS} from "./maia-vfs-store.js";

export const VFS_FLAGS = Object.freeze({
  READ: 1,
  WRITE: 2,
  CREATE: 4,
  TRUNCATE: 8,
  APPEND: 16,
});

const STATUS = Object.freeze({
  INVALID_ARGUMENT: -1,
  NOT_FOUND: -2,
  PERMISSION_DENIED: -3,
  OUT_OF_MEMORY: -4,
  UNSUPPORTED: -5,
  INVALID_HANDLE: -7,
  NOT_DIRECTORY: -9,
});

const VALID_MOUNTS = new Set(["system", "apps", "home", "tmp", "shared"]);
const APP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const LEGACY_HOME_OWNER_ID = "org.maiaos.kernel";

function toBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  return new TextEncoder().encode(String(value));
}

function mountFor(path) {
  const mount = path.split("/")[1];
  return VALID_MOUNTS.has(mount) ? mount : null;
}

function isPersistentPath(path) {
  const mount = mountFor(path);
  return mount === "home" || mount === "shared";
}

function openVfsDatabase(indexedDB, databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("files")) {
        database.createObjectStore("files", { keyPath: "path" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("VFS database open failed"));
    request.onblocked = () => reject(new Error("VFS database upgrade is blocked"));
  });
}

export class MemoryVfsAdapter {
  constructor({ files = {}, maxOpenFiles = 16, appId = "default", store = new MaiaVfsStore() } = {}) {
    if (typeof appId !== "string" || !APP_ID_PATTERN.test(appId)) {
      throw new TypeError("Invalid VFS appId");
    }
    if (!Number.isInteger(maxOpenFiles) || maxOpenFiles < 0 || maxOpenFiles > 16) throw new TypeError("Invalid open-file limit");
    if (!(store instanceof MaiaVfsStore)) throw new TypeError("Invalid VFS store");
    this.store = store;
    this.files = store.files;
    if (!this.files.has("/system/welcome.txt")) this.files.set("/system/welcome.txt", toBytes("C++ kernel read this text through maia.vfs.\n"));
    for (const [path, contents] of Object.entries(files)) this.files.set(normalizeGuestPath(path), toBytes(contents));
    this.appId = appId;
    this.homeRoot = `/home/${appId}`;
    this.maxOpenFiles = maxOpenFiles;
    this.handles = new Map();
    this.nextHandle = 1;
  }

  open(rawPath, flags) {
    if (!Number.isInteger(flags) || flags <= 0 || flags > 31) {
      return STATUS.INVALID_ARGUMENT;
    }
    const canRead = (flags & VFS_FLAGS.READ) !== 0;
    const canWrite = (flags & VFS_FLAGS.WRITE) !== 0;
    if (!canRead && !canWrite) return STATUS.INVALID_ARGUMENT;
    if ((flags & VFS_FLAGS.APPEND) && (!canWrite || (flags & VFS_FLAGS.TRUNCATE))) return STATUS.INVALID_ARGUMENT;

    let path;
    try {
      const encoded = new TextEncoder().encode(rawPath);
      if (encoded.length > 1023 || new TextDecoder("utf-8", {fatal:true, ignoreBOM:true}).decode(encoded) !== rawPath) return STATUS.INVALID_ARGUMENT;
      path = normalizeGuestPath(rawPath);
    } catch {
      return STATUS.INVALID_ARGUMENT;
    }
    const mount = mountFor(path);
    if (path === "/") return canWrite ? STATUS.INVALID_ARGUMENT : STATUS.NOT_FOUND;
    if (!mount) return STATUS.NOT_FOUND;
    if (mount === "home" && path !== "/home" && path !== this.homeRoot && !path.startsWith(`${this.homeRoot}/`)) {
      return STATUS.PERMISSION_DENIED;
    }
    if (canWrite && (mount === "system" || mount === "apps")) {
      return STATUS.PERMISSION_DENIED;
    }
    let parent = "";
    const parts = path.split("/").filter(Boolean);
    for (const part of parts.slice(0, -1)) {
      parent += "/" + part;
      if (this.files.has(parent)) return STATUS.NOT_DIRECTORY;
    }
    if (parts.length === 1 || path === this.homeRoot || [...this.files.keys()].some(name => name.startsWith(path + "/"))) return canWrite ? STATUS.INVALID_ARGUMENT : STATUS.NOT_FOUND;
    if (this.handles.size >= this.maxOpenFiles) return STATUS.OUT_OF_MEMORY;

    let bytes = this.files.get(path);
    if (!bytes) {
      if ((flags & VFS_FLAGS.CREATE) === 0 || !canWrite)
        return STATUS.NOT_FOUND;
      bytes = new Uint8Array(0);
    }
    if ((flags & VFS_FLAGS.TRUNCATE) !== 0 && !canWrite) {
      return STATUS.PERMISSION_DENIED;
    }
    if ((flags & VFS_FLAGS.TRUNCATE) !== 0) bytes = new Uint8Array(0);
    if (canWrite && (!this.files.has(path) || (flags & VFS_FLAGS.TRUNCATE)) && !this.store.canSet(path, bytes.length)) return STATUS.OUT_OF_MEMORY;

    const handle = this.nextHandle++;
    this.files.set(path, bytes);
    this.handles.set(handle, {
      kind: "file",
      path,
      flags,
      position: 0,
    });
    return handle;
  }

  read(handle, count) {
    const file = this.handles.get(handle);
    if (!file) return STATUS.INVALID_HANDLE;
    if (file.kind === "directory") return STATUS.INVALID_ARGUMENT;
    if ((file.flags & VFS_FLAGS.READ) === 0) return STATUS.PERMISSION_DENIED;
    if (!Number.isInteger(count) || count < 0) return STATUS.INVALID_ARGUMENT;

    const bytes = this.files.get(file.path);
    const end = Math.min(file.position + count, bytes.byteLength);
    const chunk = bytes.slice(file.position, end);
    file.position += chunk.length;
    return chunk;
  }

  write(handle, input) {
    const file = this.handles.get(handle);
    if (!file) return STATUS.INVALID_HANDLE;
    if (file.kind === "directory") return STATUS.INVALID_ARGUMENT;
    if ((file.flags & VFS_FLAGS.WRITE) === 0) return STATUS.PERMISSION_DENIED;
    if (!(input instanceof Uint8Array) || input.length > VFS_LIMITS.writeBytes) return STATUS.INVALID_ARGUMENT;
    if (!input.length) return 0;
    const current = this.files.get(file.path);
    const position = (file.flags & VFS_FLAGS.APPEND) ? current.length : file.position;
    const end = position + input.length;
    const length = Math.max(current.length, end);
    if (!Number.isSafeInteger(end) || length > VFS_LIMITS.fileBytes || !this.store.canSet(file.path, length)) return STATUS.OUT_OF_MEMORY;
    let updated;
    try { updated = new Uint8Array(length); updated.set(current); updated.set(input, position); }
    catch { return STATUS.OUT_OF_MEMORY; }
    this.files.set(file.path, updated);
    file.position = end;
    return input.length;
  }

  // Read-only directory snapshots derived from the caller's visible namespace.
  opendir(rawPath) {
    let path;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    if (typeof rawPath !== "string" || rawPath.length === 0) return STATUS.INVALID_ARGUMENT;
    const rawBytes = encoder.encode(rawPath);
    if (rawBytes.length > 1023 || decoder.decode(rawBytes) !== rawPath) return STATUS.INVALID_ARGUMENT;
    try { path = normalizeGuestPath(rawPath); } catch { return STATUS.INVALID_ARGUMENT; }
    if (path !== "/" && !mountFor(path)) return STATUS.NOT_FOUND;
    if (mountFor(path) === "home" && path !== "/home"
        && path !== this.homeRoot && !path.startsWith(`${this.homeRoot}/`)) return STATUS.PERMISSION_DENIED;
    const virtual = ["/", ...[...VALID_MOUNTS].map(mount => `/${mount}`), this.homeRoot];
    const visible = file => !!mountFor(file) && (mountFor(file) !== "home" || file === this.homeRoot || file.startsWith(`${this.homeRoot}/`));
    let prefix = "";
    for (const part of path.split("/").filter(Boolean)) {
      prefix += "/" + part;
      if (this.files.has(prefix)) return STATUS.NOT_DIRECTORY;
    }
    const directoryPrefix = path === "/" ? "/" : path + "/";
    const children = new Map();
    let exists = virtual.includes(path);
    let snapshotBytes = 0;
    const add = (fullPath, directory) => {
      if (!fullPath.startsWith(directoryPrefix) || fullPath === path) return 0;
      const suffix = fullPath.slice(directoryPrefix.length);
      if (!suffix) return 0;
      exists = true;
      const slash = suffix.indexOf("/");
      const name = slash < 0 ? suffix : suffix.slice(0, slash);
      const type = directory || slash >= 0 ? 2 : 1;
      const prior = children.get(name);
      if (prior) return prior.type === type ? 0 : STATUS.NOT_DIRECTORY;
      const bytes = encoder.encode(name);
      if (!name || name.includes("\0") || decoder.decode(bytes) !== name) return STATUS.INVALID_ARGUMENT;
      if (bytes.length > 255) return STATUS.OUT_OF_MEMORY;
      snapshotBytes += 16 + bytes.length;
      if (children.size >= 1024 || snapshotBytes > 65536) return STATUS.OUT_OF_MEMORY;
      children.set(name, { type, bytes });
      return 0;
    };
    for (const dir of virtual) { const status = add(dir, true); if (status < 0) return status; }
    for (const file of this.files.keys()) {
      if (!visible(file)) continue;
      const status = add(file, false); if (status < 0) return status;
    }
    if (!exists) return STATUS.NOT_FOUND;
    if (this.handles.size >= this.maxOpenFiles) return STATUS.OUT_OF_MEMORY;
    const entries = [...children.values()].sort((a, b) => {
      for (let i = 0; i < Math.min(a.bytes.length, b.bytes.length); ++i) {
        if (a.bytes[i] !== b.bytes[i]) return a.bytes[i] - b.bytes[i];
      }
      return a.bytes.length - b.bytes.length;
    }).map(({type, bytes}) => {
      const packet = new Uint8Array(16 + bytes.length);
      const header = new DataView(packet.buffer);
      header.setUint32(0, 1, true); header.setUint32(4, type, true);
      header.setUint32(8, bytes.length, true); header.setUint32(12, 0, true);
      packet.set(bytes, 16); return packet;
    });
    const handle = this.nextHandle++;
    this.handles.set(handle, { kind: "directory", entries, position: 0 });
    return handle;
  }

  readdir(handle, capacity) {
    const directory = this.handles.get(handle);
    if (!directory) return STATUS.INVALID_HANDLE;
    if (directory.kind !== "directory") return STATUS.INVALID_ARGUMENT;
    if (!Number.isInteger(capacity) || capacity < 16 || capacity > 4096) return STATUS.INVALID_ARGUMENT;
    if (directory.position === directory.entries.length) return new Uint8Array(0);
    const packet = directory.entries[directory.position];
    if (packet.length > capacity) return STATUS.OUT_OF_MEMORY;
    ++directory.position;
    return packet.slice();
  }

  closeAll() {
    this.handles.clear();
  }

  close(handle) {
    return this.handles.delete(handle) ? 0 : STATUS.INVALID_HANDLE;
  }

  get openHandleCount() {
    return this.handles.size;
  }
}

export class IndexedDbVfsAdapter extends MemoryVfsAdapter {
  static async create({
    databaseName = "maiaos-vfs",
    indexedDB = globalThis.indexedDB,
    onPersistenceError = () => {},
    appId = "default",
    maxOpenFiles = 16,
    store = new MaiaVfsStore(),
  } = {}) {
    if (!indexedDB) throw new Error("IndexedDB is unavailable");
    if (!(store instanceof MaiaVfsStore)) throw new TypeError("Invalid VFS store");
    if (!store.initializing) store.initializing = openVfsDatabase(indexedDB, databaseName);
    const database = await store.initializing;
    const adapter = new IndexedDbVfsAdapter(database, onPersistenceError, appId, maxOpenFiles, store);
    await adapter.hydrate();
    return adapter;
  }

  constructor(database, onPersistenceError, appId, maxOpenFiles = 16, store = new MaiaVfsStore()) {
    super({ appId, maxOpenFiles, store });
    if (store.database && store.database !== database) throw new TypeError("VFS store already has a database");
    store.database = database;
    store.errorListeners.add(onPersistenceError);
  }
  get database() { return this.store.database; }
  get pendingPersistence() { return this.store.pendingPersistence; }
  get persistenceError() { return this.store.persistenceError; }
  hydrate() {
    if (!this.store.hydrating) this.store.hydrating = this.hydrateRecords();
    return this.store.hydrating;
  }

  async hydrateRecords() {
    const transaction = this.database.transaction("files", "readonly");
    const request = transaction.objectStore("files").getAll();
    const records = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("VFS database read failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("VFS database read aborted"));
    });

    const legacyFiles = [];
    for (const record of records) {
      try {
        const path = normalizeGuestPath(record.path);
        if (path !== record.path || !isPersistentPath(path)) continue;
        if (!(record.bytes instanceof Uint8Array)) continue;
        if (mountFor(path) === "home") {
          const segments = path.split("/").filter(Boolean);
          if (segments.length === 2) {
            const migratedPath = `/home/${LEGACY_HOME_OWNER_ID}/${segments[1]}`;
            // Prefer an explicit modern record irrespective of database order.
            const explicit = records.some(item => item.path === migratedPath && item.bytes instanceof Uint8Array);
            if (!explicit && !this.files.has(migratedPath)) this.files.set(migratedPath, new Uint8Array(record.bytes));
            legacyFiles.push({path, migratedPath, bytes:this.files.get(migratedPath)?.slice(), explicit});
            continue;
          }
        }
        this.files.set(path, new Uint8Array(record.bytes));
      } catch {
        continue;
      }
    }
    for (const legacyFile of legacyFiles) {
      this.movePersisted(
        legacyFile.path,
        legacyFile.migratedPath,
        legacyFile.bytes,
        legacyFile.explicit,
      );
    }
    if (legacyFiles.length > 0) await this.flush();
  }

  open(rawPath, flags) {
    let existed = false;
    try { existed = this.files.has(normalizeGuestPath(rawPath)); } catch { /* super.open reports invalid paths. */ }
    const handle = super.open(rawPath, flags);
    if (handle > 0 && (flags & VFS_FLAGS.WRITE) !== 0 && (!existed || (flags & VFS_FLAGS.TRUNCATE))) {
      this.persist(this.handles.get(handle).path);
    }
    return handle;
  }

  write(handle, input) {
    const result = super.write(handle, input);
    const file = this.handles.get(handle);
    if (result > 0 && file) this.persist(file.path);
    return result;
  }

  async flush() { await this.store.flush(); }

  persist(path) {
    if (!isPersistentPath(path)) return;
    if (!this.files.has(path) || this.store.queuedPaths.has(path)) return;
    // Coalesce pending changes per record; do not retain one full snapshot per
    // tiny guest write. The serialized transaction copies the latest bytes.
    this.store.queuedPaths.add(path);
    this.store.enqueue(
      () =>
        new Promise((resolve, reject) => {
          this.store.queuedPaths.delete(path);
          const bytes = this.files.get(path).slice();
          const transaction = this.database.transaction("files", "readwrite");
          transaction.objectStore("files").put({ path, bytes });
          transaction.oncomplete = resolve;
          transaction.onerror = () =>
            reject(transaction.error ?? new Error("VFS database write failed"));
          transaction.onabort = () =>
            reject(transaction.error ?? new Error("VFS database write aborted"));
        }),
    );
  }

  movePersisted(oldPath, newPath, bytes, explicit = false) {
    this.store.enqueue(
      () =>
        new Promise((resolve, reject) => {
          const transaction = this.database.transaction("files", "readwrite");
          const store = transaction.objectStore("files");
          if (!explicit) store.put({ path: newPath, bytes });
          store.delete(oldPath);
          transaction.oncomplete = resolve;
          transaction.onerror = () =>
            reject(transaction.error ?? new Error("VFS database migration failed"));
          transaction.onabort = () =>
            reject(transaction.error ?? new Error("VFS database migration aborted"));
        }),
    );
  }
}
