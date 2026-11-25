import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serve = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));

function runServe(env: Record<string, string>) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [serve], { env: { ...process.env, ...env } });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

test('serve: reports an occupied port without an unhandled error', async () => {
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  const address = blocker.address();
  assert.ok(typeof address === 'object' && address);
  try {
    const result = await runServe({ HOST: '127.0.0.1', PORT: String(address.port) });
    assert.equal(result.code, 1);
    assert.match(result.output, new RegExp(`ポート ${address.port} はすでに使われています`));
    assert.match(result.output, /PORT=4174 npm run dev/);
    assert.doesNotMatch(result.output, /Unhandled 'error' event/);
  } finally {
    await new Promise<void>((resolve, reject) => blocker.close((error) => error ? reject(error) : resolve()));
  }
});

test('serve: rejects an invalid PORT before listening', async () => {
  const result = await runServe({ PORT: 'invalid' });
  assert.equal(result.code, 1);
  assert.match(result.output, /PORT は 0 から 65535 までの整数/);
});
