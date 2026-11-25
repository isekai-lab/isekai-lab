import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const runner = fileURLToPath(new URL('./run-with-env.mjs', import.meta.url));
function runWithPass(passBody, overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'tensei-pass-test-'));
  try {
    writeFileSync(join(directory, 'pass'), `#!/usr/bin/env node\n${passBody}\n`, { mode: 0o700 });
    return spawnSync(process.execPath, [runner, process.execPath, '-e',
      'if (process.env.CLOUDFLARE_API_TOKEN !== "test-only-token") process.exit(9); console.log("child received credential");'], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_API_TOKEN_PASS_ENTRY: 'fixture-entry', ...overrides },
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('pass reads only the first line and does not print the credential', () => {
  const result = runWithPass('process.stdout.write("test-only-token\\nprivate metadata\\n");');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /child received credential/);
  assert.doesNotMatch(result.stdout + result.stderr, /test-only-token|private metadata/);
});

test('pass failures do not expose captured output or start the child', () => {
  const result = runWithPass('process.stdout.write("captured-secret"); process.stderr.write("private diagnostic"); process.exit(2);');
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /captured-secret|private diagnostic|child received/);
  assert.match(result.stderr, /Could not read/);
});

test('explicit environment tokens take precedence; env-file commands are rejected', () => {
  const direct = runWithPass('process.exit(99);', { CLOUDFLARE_API_TOKEN: 'test-only-token' });
  assert.equal(direct.status, 0);
  assert.doesNotMatch(direct.stdout + direct.stderr, /test-only-token/);
  const literal = runWithPass('process.exit(99);', { CLOUDFLARE_API_TOKEN: '$(pass fixture-entry)' });
  assert.equal(literal.status, 1);
  assert.match(literal.stderr, /Command substitution is not evaluated/);
  assert.doesNotMatch(literal.stdout, /child received/);
});
