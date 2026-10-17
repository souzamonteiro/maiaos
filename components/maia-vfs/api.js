// VFS namespace contract: real adapters must enforce sandbox and quotas.
export function normalizeGuestPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('absolute guest path required');
  const parts = [];
  for (const p of path.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') { if (!parts.length) throw new Error('path escapes root'); parts.pop(); }
    else if (p.includes('\0')) throw new Error('NUL in path');
    else parts.push(p);
  }
  return '/' + parts.join('/');
}
