import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/platform/desktop-web/index.html' : pathname));
    if (file !== root && !file.startsWith(root + sep)) throw new Error('path escape');
    const bytes = await readFile(file);
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(8080, '127.0.0.1', () => console.log('MaiaOS desktop demo: http://localhost:8080'));
