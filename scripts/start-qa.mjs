import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const python = resolve(root, '../backend_marketplace_moda/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) throw new Error('Falta el entorno virtual del backend. Revisá README.md.');
for (const port of [8011, 4201]) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`El puerto ${port} está ocupado.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolvePort));
  });
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exitCode = code;
}
function run(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 1));
  return child;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
run(python, ['scripts/qa_backend.py']);
console.log('FashionStore QA: http://127.0.0.1:4201 — base temporal, sin correos externos.');
run(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'serve', '--configuration', 'qa', '--host', '127.0.0.1', '--port', '4201', '--proxy-config', 'proxy.qa.conf.json']);
