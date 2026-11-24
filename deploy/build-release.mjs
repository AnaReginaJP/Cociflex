// Builds the server release package. Runs on Windows, Linux and macOS:  npm run release
// Output: cociflex-release.tar.gz (dist/ + server.mjs + runtime package.json + SQL schema and migrations)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'release');
const TARBALL = path.join(ROOT, 'cociflex-release.tar.gz');
// Only what server.mjs needs at runtime on the server.
const RUNTIME_DEPS = ['express', 'dotenv', 'drizzle-orm', 'mysql2'];

const fail = (message) => {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
};

function run(command, args, options = {}) {
  // npm is npm.cmd on Windows, which needs a shell to run.
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) fail(`No se pudo ejecutar "${command}": ${result.error.message}`);
  if (result.status !== 0) fail(`"${command} ${args.join(' ')}" terminó con error.`);
}

if (!existsSync(path.join(ROOT, 'node_modules'))) {
  fail('Faltan las dependencias. Ejecuta primero: npm install');
}

console.log('==> Limpiando');
rmSync(OUT, { recursive: true, force: true });
rmSync(TARBALL, { force: true });
mkdirSync(path.join(OUT, 'database'), { recursive: true });

console.log('==> Compilando la interfaz (Vite)');
run('npm', ['run', 'build']);
cpSync(path.join(ROOT, 'dist'), path.join(OUT, 'dist'), { recursive: true });

console.log('==> Empaquetando el servidor en un solo archivo');
await build({
  entryPoints: [path.join(ROOT, 'server.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  outfile: path.join(OUT, 'server.mjs'),
  logLevel: 'warning',
});

console.log('==> Copiando esquema y migraciones de la base');
for (const file of readdirSync(path.join(ROOT, 'database'))) {
  if (file === 'schema.sql' || /^migrate_.*\.sql$/.test(file)) {
    cpSync(path.join(ROOT, 'database', file), path.join(OUT, 'database', file));
  }
}

console.log('==> Generando package.json solo con dependencias de producción');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const dependencies = Object.fromEntries(RUNTIME_DEPS.map((name) => [name, pkg.dependencies[name]]));
writeFileSync(
  path.join(OUT, 'package.json'),
  JSON.stringify({ name: pkg.name, version: pkg.version, private: true, type: 'module', dependencies }, null, 2) + '\n'
);

console.log('==> Comprimiendo');
// tar is built into Windows 10/11, Linux and macOS.
run('tar', ['-czf', path.relative(OUT, TARBALL), '.'], { cwd: OUT, shell: false });

const mb = (statSync(TARBALL).size / 1024 / 1024).toFixed(1);
console.log(`==> Listo: cociflex-release.tar.gz (${mb} MB)`);
