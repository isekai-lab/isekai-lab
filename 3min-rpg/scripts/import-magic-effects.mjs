#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
if (args.length !== 3) throw new Error('Usage: node import-magic-effects.mjs para1.zip para2.zip mikodrak-fx.zip');
const child = spawn('python3', [fileURLToPath(new URL('./import-magic-effects.py', import.meta.url)), ...args], { stdio: 'inherit' });
child.on('error', error => { throw error; });
child.on('exit', code => process.exitCode = code ?? 1);
