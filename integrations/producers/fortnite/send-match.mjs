#!/usr/bin/env node
/**
 * Companion local Fortnite: envía un match-end al webhook (misma firma que send-match).
 * Usalo desde overlays / scripts que detecten fin de partida, o para pruebas.
 *
 *   node integrations/producers/fortnite/send-match.mjs --kills 10 --placement 1
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = ['--platform', 'fortnite', ...process.argv.slice(2)];

const result = spawnSync(process.execPath, [path.join(root, 'send-match.mjs'), ...args], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
