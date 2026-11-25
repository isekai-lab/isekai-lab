import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const host = process.env.HOST || '127.0.0.1';

function readPort(value) {
  if (value === undefined || value === '') return 4173;
  if (!/^\d+$/.test(value)) return undefined;
  const port = Number(value);
  return Number.isSafeInteger(port) && port <= 65535 ? port : undefined;
}

const port = readPort(process.env.PORT);
if (port === undefined) {
  console.error('PORT は 0 から 65535 までの整数で指定してください。');
  process.exitCode = 1;
} else {
  const server = createServer(async (req, res) => {
    let target;
    try { const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)); }
    catch { res.writeHead(400); res.end('Bad request'); return; }
    if (!target.startsWith(root) || path.extname(target) !== '.html') { res.writeHead(404); res.end('Not found'); return; }
    try { const data = await readFile(target); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(data); }
    catch { res.writeHead(404); res.end('Not found'); }
  });

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`ポート ${port} はすでに使われています。別のポートで起動するには PORT=4174 npm run dev を実行してください。`);
    } else if (error.code === 'EPERM' || error.code === 'EACCES') {
      console.error(`ポート ${port} を待ち受ける権限がありません。実行環境の待受権限を確認し、ローカルのターミナルなど待受可能な環境で実行してください。`);
    } else {
      console.error(`開発サーバーを起動できませんでした: ${error.code || error.message}`);
    }
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`Preview: http://${host}:${actualPort} (Ctrl+C to stop)`);
  });
}
