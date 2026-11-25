import { spawn, spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: npm run cf:with-env -- <command> [arguments]');
  process.exit(1);
}
let token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const passEntry = process.env.CLOUDFLARE_API_TOKEN_PASS_ENTRY;
if (token?.startsWith('$(')) {
  console.error('Command substitution is not evaluated in .env files. Set CLOUDFLARE_API_TOKEN_PASS_ENTRY instead.');
  process.exit(1);
}
if (!token && passEntry) {
  const result = spawnSync('pass', ['show', passEntry], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000,
  });
  if (result.error || result.status !== 0) {
    console.error('Could not read the configured pass entry. Unlock GPG or check password-store access.');
    process.exit(1);
  }
  token = result.stdout.split(/\r?\n/, 1)[0].trim();
}
if (!token) {
  console.error('Set CLOUDFLARE_API_TOKEN or CLOUDFLARE_API_TOKEN_PASS_ENTRY in the shell or ignored infra/cloudflare/.env.local.');
  process.exit(1);
}
const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_API_TOKEN: token }, shell: false });
child.on('error', () => {
  console.error('Could not start the requested command. Check that its tool is installed.');
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
