// Reference-host backing records only. Authorization and handles stay in adapters.
export const VFS_LIMITS = Object.freeze({writeBytes:4096,fileBytes:1048576,totalBytes:8388608,files:4096});
const writable = path => /^\/(home|shared|tmp)\//.test(path);
export class MaiaVfsStore {
  constructor() {
    this.files = new Map();
    this.pendingPersistence = Promise.resolve();
    this.persistenceError = null;
    this.database = null;
    this.initializing = null;
    this.hydrating = null;
    this.errorListeners = new Set();
    this.queuedPaths = new Set();
  }
  canSet(path, length) {
    if (!writable(path)) return false;
    const prior = this.files.get(path);
    // Truncation can recover a store hydrated beyond the current quotas.
    if (prior && length < prior.length) return true;
    if (length > VFS_LIMITS.fileBytes) return false;
    let count = prior ? 0 : 1, total = length;
    for (const [name, bytes] of this.files) {
      if (name === path || !writable(name)) continue;
      ++count; total += bytes.length;
    }
    return count <= VFS_LIMITS.files && total <= VFS_LIMITS.totalBytes;
  }
  enqueue(operation) {
    const pending = this.pendingPersistence.then(operation);
    this.pendingPersistence = pending.catch(error => {
      this.persistenceError = error;
      for (const listener of this.errorListeners) {
        try { listener(error); } catch { /* A UI reporter cannot break storage cleanup. */ }
      }
    });
  }
  async flush() {
    await this.pendingPersistence;
    if (this.persistenceError) throw this.persistenceError;
  }
}
