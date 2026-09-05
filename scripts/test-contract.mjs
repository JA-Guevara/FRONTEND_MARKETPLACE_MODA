import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const python = resolve(root, '..', 'backend_marketplace_moda', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const result = spawnSync(python, ['scripts/test_cycle_one.py'], {cwd:root,stdio:'inherit'});
if (result.error) console.error('No se pudo iniciar el entorno Python del backend:', result.error.message);
process.exit(result.status ?? 1);
