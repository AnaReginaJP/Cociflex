// Development database in Docker. Works the same on Windows, Linux and macOS.
//   npm run db:dev          create/start MariaDB, create tables, apply migrations, write .env
//   npm run db:dev -- stop  stop the container
//   npm run db:dev -- reset delete the container and all its data
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTAINER = 'cociflex-db';
const PORT = 3307; // 3306 is often taken by XAMPP or MySQL on Windows
const ROOT_PASSWORD = 'root';
const DB = { name: 'cociflex', user: 'cociflex_app', password: 'cociflex_dev' };
// TCP on purpose: the image first runs a temporary init server without networking,
// so only the final server answers over TCP.
const MARIADB = ['mariadb', '-h127.0.0.1', '--protocol=TCP', '-uroot', `-p${ROOT_PASSWORD}`];

const fail = (message) => {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
};

function docker(args, { quiet = false } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.error) {
    fail('No encuentro Docker. Instala Docker Desktop y asegúrate de que esté abierto.');
  }
  if (result.status !== 0 && !quiet) {
    fail(`docker ${args[0]} falló:\n${result.stderr || result.stdout}`);
  }
  return result;
}

// Feed a .sql file to mariadb through stdin (binary-safe, no shell redirection needed).
function runSqlFile(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      ['exec', '-i', CONTAINER, ...MARIADB, DB.name],
      { stdio: ['pipe', 'inherit', 'pipe'] }
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${path.basename(file)}: ${stderr.trim()}`))
    );
    child.stdin.end(readFileSync(file));
  });
}

async function waitUntilReady() {
  for (let i = 0; i < 60; i++) {
    const r = docker(['exec', CONTAINER, ...MARIADB, '-e', 'SELECT 1'], {
      quiet: true,
    });
    if (r.status === 0) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail('MariaDB no arrancó en 60 segundos. Revisa: docker logs cociflex-db');
}

function writeEnvIfMissing() {
  const envPath = path.join(ROOT, '.env');
  if (existsSync(envPath)) {
    const current = readFileSync(envPath, 'utf8');
    if (!current.includes(`SQL_PORT=${PORT}`)) {
      console.log(`\n    Ya tienes un .env: revisa que diga SQL_HOST="127.0.0.1" y SQL_PORT=${PORT}.`);
    }
    return;
  }
  writeFileSync(
    envPath,
    [
      '# Solo para tu computadora: NO se sube al repositorio.',
      '# IA local para recetas (borra esta línea si no tienes Ollama: se usará una receta de respaldo)',
      'LLM_BASE_URL="http://localhost:11434/v1"',
      'LLM_MODEL="qwen2.5:7b"',
      '',
      'SQL_HOST="127.0.0.1"',
      `SQL_PORT=${PORT}`,
      `SQL_USER="${DB.user}"`,
      `SQL_PASSWORD="${DB.password}"`,
      `SQL_DB_NAME="${DB.name}"`,
      '',
      'PORT=3000',
      'NODE_ENV="development"',
      '',
    ].join('\n')
  );
  console.log('    Archivo .env creado con los datos de la base de desarrollo.');
}

async function main() {
  const command = process.argv[2] || 'start';
  docker(['version', '--format', '{{.Server.Version}}']);
  const exists = docker(['container', 'inspect', CONTAINER], { quiet: true }).status === 0;

  if (command === 'stop') {
    if (exists) docker(['stop', CONTAINER]);
    console.log('Base de desarrollo detenida.');
    return;
  }
  if (command === 'reset') {
    if (exists) docker(['rm', '-f', CONTAINER]);
    console.log('Base de desarrollo borrada. Ejecuta "npm run db:dev" para crearla de nuevo.');
    return;
  }
  if (command !== 'start') fail(`Comando desconocido: ${command} (usa start, stop o reset)`);

  if (!exists) {
    console.log(`==> Creando MariaDB de desarrollo (contenedor ${CONTAINER}, puerto ${PORT})`);
    docker([
      'run', '-d', '--name', CONTAINER,
      '-p', `127.0.0.1:${PORT}:3306`,
      '-e', `MARIADB_ROOT_PASSWORD=${ROOT_PASSWORD}`,
      '-e', `MARIADB_DATABASE=${DB.name}`,
      '-e', `MARIADB_USER=${DB.user}`,
      '-e', `MARIADB_PASSWORD=${DB.password}`,
      'mariadb:10.11',
    ]);
  } else {
    console.log('==> Arrancando MariaDB de desarrollo');
    docker(['start', CONTAINER]);
  }
  await waitUntilReady();

  const hasTables = docker([
    'exec', CONTAINER, ...MARIADB, '-N', '-e',
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB.name}' AND table_name='users'`,
  ]).stdout.trim();

  if (hasTables === '0') {
    console.log('==> Creando las tablas');
    await runSqlFile(path.join(ROOT, 'database', 'schema.sql'));
  }

  // Migrations are idempotent: apply all of them every time to keep the dev DB up to date.
  const migrations = readdirSync(path.join(ROOT, 'database'))
    .filter((f) => /^migrate_.*\.sql$/.test(f))
    .sort();
  for (const file of migrations) {
    await runSqlFile(path.join(ROOT, 'database', file));
  }
  console.log(`==> Migraciones aplicadas: ${migrations.join(', ') || 'ninguna'}`);

  writeEnvIfMissing();
  console.log('\nListo. Ahora ejecuta: npm run dev   y abre http://localhost:3000');
}

main().catch((error) => fail(error.message));
