import { normalizeGuestPath } from "../components/maia-vfs/api.js";

export const VFS_FLAGS = Object.freeze({
  READ: 1,
  WRITE: 2,
  CREATE: 4,
  TRUNCATE: 8,
});

const STATUS = Object.freeze({
  INVALID_ARGUMENT: -1,
  NOT_FOUND: -2,
  PERMISSION_DENIED: -3,
  OUT_OF_MEMORY: -4,
  UNSUPPORTED: -5,
  INVALID_HANDLE: -7,
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
  constructor({ files = {}, maxOpenFiles = 16, appId = "default" } = {}) {
    if (typeof appId !== "string" || !APP_ID_PATTERN.test(appId)) {
      throw new TypeError("Invalid VFS appId");
    }
    this.files = new Map(
      Object.entries({
        "/system/welcome.txt": "C++ kernel read this text through maia.vfs.\n",
        ...files,
      }).map(([path, contents]) => [
        normalizeGuestPath(path),
        toBytes(contents),
      ]),
    );
    this.appId = appId;
    this.homeRoot = `/home/${appId}`;
    this.maxOpenFiles = maxOpenFiles;
    this.handles = new Map();
    this.nextHandle = 1;
  }

  open(rawPath, flags) {
    if (!Number.isInteger(flags) || flags <= 0 || (flags & ~0x0f) !== 0) {
      return STATUS.INVALID_ARGUMENT;
    }
    const canRead = (flags & VFS_FLAGS.READ) !== 0;
    const canWrite = (flags & VFS_FLAGS.WRITE) !== 0;
    if (!canRead && !canWrite) return STATUS.INVALID_ARGUMENT;

    let path;
    try {
      path = normalizeGuestPath(rawPath);
    } catch {
      return STATUS.INVALID_ARGUMENT;
    }
    const mount = mountFor(path);
    if (!mount) return STATUS.NOT_FOUND;
    if (mount === "home" && !path.startsWith(`${this.homeRoot}/`)) {
      return STATUS.PERMISSION_DENIED;
    }
    if (canWrite && (mount === "system" || mount === "apps")) {
      return STATUS.PERMISSION_DENIED;
    }
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

    const handle = this.nextHandle++;
    this.files.set(path, bytes);
    this.handles.set(handle, {
      path,
      flags,
      position: 0,
    });
    return handle;
  }

  read(handle, count) {
    const file = this.handles.get(handle);
    if (!file) return STATUS.INVALID_HANDLE;
    if ((file.flags & VFS_FLAGS.READ) === 0) return STATUS.PERMISSION_DENIED;
    if (!Number.isInteger(count) || count < 0) return STATUS.INVALID_ARGUMENT;

    const bytes = this.files.get(file.path);
    const end = Math.min(file.position + count, bytes.byteLength);
    const chunk = bytes.slice(file.position, end);
    file.position = end;
    return chunk;
  }

  write(handle, input) {
    const file = this.handles.get(handle);
    if (!file) return STATUS.INVALID_HANDLE;
    if ((file.flags & VFS_FLAGS.WRITE) === 0) return STATUS.PERMISSION_DENIED;
    if (!(input instanceof Uint8Array)) return STATUS.INVALID_ARGUMENT;

    const current = this.files.get(file.path);
    const end = file.position + input.byteLength;
    const updated = new Uint8Array(Math.max(current.byteLength, end));
    updated.set(current);
    updated.set(input, file.position);
    this.files.set(file.path, updated);
    file.position = end;
    return input.byteLength;
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
  } = {}) {
    if (!indexedDB) throw new Error("IndexedDB is unavailable");
    const database = await openVfsDatabase(indexedDB, databaseName);
    const adapter = new IndexedDbVfsAdapter(database, onPersistenceError, appId);
    await adapter.hydrate();
    return adapter;
  }

  constructor(database, onPersistenceError, appId) {
    super({ appId });
    this.database = database;
    this.onPersistenceError = onPersistenceError;
    this.pendingPersistence = Promise.resolve();
    this.persistenceError = null;
  }

  async hydrate() {
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
        if (mountFor(path) === "home" && !path.startsWith(`${this.homeRoot}/`)) {
          const segments = path.split("/").filter(Boolean);
          if (
            this.appId !== LEGACY_HOME_OWNER_ID ||
            segments.length !== 2 ||
            segments[0] !== "home"
          ) {
            continue;
          }
          const migratedPath = `${this.homeRoot}/${segments[1]}`;
          if (!this.files.has(migratedPath)) {
            this.files.set(migratedPath, new Uint8Array(record.bytes));
          }
          legacyFiles.push({
            path,
            migratedPath,
            bytes: this.files.get(migratedPath).slice(),
          });
          continue;
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
      );
    }
    if (legacyFiles.length > 0) await this.flush();
  }

  open(rawPath, flags) {
    const handle = super.open(rawPath, flags);
    if (handle > 0 && (flags & VFS_FLAGS.WRITE) !== 0) {
      this.persist(this.handles.get(handle).path);
    }
    return handle;
  }

  write(handle, input) {
    const result = super.write(handle, input);
    const file = this.handles.get(handle);
    if (result >= 0 && file) this.persist(file.path);
    return result;
  }

  async flush() {
    await this.pendingPersistence;
    if (this.persistenceError) throw this.persistenceError;
  }

  persist(path) {
    if (!isPersistentPath(path)) return;
    const bytes = this.files.get(path)?.slice();
    if (!bytes) return;

    const write = this.pendingPersistence.then(
      () =>
        new Promise((resolve, reject) => {
          const transaction = this.database.transaction("files", "readwrite");
          transaction.objectStore("files").put({ path, bytes });
          transaction.oncomplete = resolve;
          transaction.onerror = () =>
            reject(transaction.error ?? new Error("VFS database write failed"));
          transaction.onabort = () =>
            reject(transaction.error ?? new Error("VFS database write aborted"));
        }),
    );
    this.pendingPersistence = write.catch((error) => {
      this.persistenceError = error;
      this.onPersistenceError(error);
    });
  }

  movePersisted(oldPath, newPath, bytes) {
    const migration = this.pendingPersistence.then(
      () =>
        new Promise((resolve, reject) => {
          const transaction = this.database.transaction("files", "readwrite");
          const store = transaction.objectStore("files");
          store.put({ path: newPath, bytes });
          store.delete(oldPath);
          transaction.oncomplete = resolve;
          transaction.onerror = () =>
            reject(transaction.error ?? new Error("VFS database migration failed"));
          transaction.onabort = () =>
            reject(transaction.error ?? new Error("VFS database migration aborted"));
        }),
    );
    this.pendingPersistence = migration.catch((error) => {
      this.persistenceError = error;
      this.onPersistenceError(error);
    });
  }
}
