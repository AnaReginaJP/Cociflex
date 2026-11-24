// Updates CociFlex on the server. Runs on Windows (PowerShell/CMD), Linux and macOS.
//   npm run servidor:actualizar    build from main, back up, upload and install
//   npm run servidor:anterior      reinstall the previous version (rollback)
//
// Optional settings (environment variables or arguments after "--"):
//   COCIFLEX_SSH_KEY / --key <file>      default: ~/.ssh/Inteligencia_Artificial.pem
//   COCIFLEX_SERVER  / --server <u@ip>   default: root@79.143.88.199
//   --permitir-rama                      allow deploying from a branch other than main
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const mode = args[0] === 'anterior' ? 'anterior' : 'actualizar';
const KEY =
  argValue('--key') ||
  process.env.COCIFLEX_SSH_KEY ||
  path.join(os.homedir(), '.ssh', 'Inteligencia_Artificial.pem');
const SERVER = argValue('--server') || process.env.COCIFLEX_SERVER || 'root@79.143.88.199';
const SSH_OPTS = ['-i', KEY, '-o', 'ServerAliveInterval=30', '-o', 'ConnectTimeout=20'];

const fail = (message) => {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
};
const step = (message) => console.log(`\n==> ${message}`);

function run(command, commandArgs, { capture = false, allowFail = false, shell = false } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell,
  });
  if (result.error) {
    fail(
      command === 'ssh' || command === 'scp'
        ? 'No encuentro ssh/scp. En Windows: Configuración > Aplicaciones > Características opcionales > "Cliente OpenSSH".'
        : `No se pudo ejecutar "${command}": ${result.error.message}`
    );
  }
  if (result.status !== 0 && !allowFail) {
    if (capture) console.error(result.stderr || result.stdout);
    fail(`"${command}" terminó con error (código ${result.status}).`);
  }
  return result;
}

const ssh = (remoteCommand, options) => run('ssh', [...SSH_OPTS, SERVER, remoteCommand], options);
const git = (gitArgs) => run('git', gitArgs, { capture: true, allowFail: true });

// ---------- Checks ----------
if (!existsSync(KEY)) {
  fail(`No encuentro la llave SSH en ${KEY}.
Pídela a la persona responsable del servidor o indica su ruta antes de ejecutar el comando:
  Windows (PowerShell):  $env:COCIFLEX_SSH_KEY = "C:\\ruta\\a\\la\\llave.pem"
  Linux / macOS:         export COCIFLEX_SSH_KEY=/ruta/a/la/llave.pem`);
}

step(`Probando la conexión con ${SERVER}`);
const probe = ssh('echo ok', { capture: true, allowFail: true });
if (probe.status !== 0) {
  const detail = `${probe.stderr || ''}`;
  if (/UNPROTECTED PRIVATE KEY|bad permissions|too open/i.test(detail)) {
    fail(`La llave tiene permisos demasiado abiertos. Arréglalo con:
  Windows (PowerShell):
    icacls "${KEY}" /inheritance:r
    icacls "${KEY}" /grant:r "$($env:USERNAME):(R)"
  Linux / macOS:
    chmod 600 "${KEY}"`);
  }
  fail(`No se pudo conectar al servidor:\n${detail.trim()}`);
}
console.log('    Conexión OK');

if (mode === 'anterior') {
  step('Reinstalando la versión anterior');
  const has = ssh('test -f /root/cociflex-release-anterior.tar.gz && echo si || echo no', { capture: true });
  if (has.stdout.trim() !== 'si') fail('No hay una versión anterior guardada en el servidor.');
  ssh('sed -i "s/\\r$//" /root/deploy_nativo.sh && bash /root/deploy_nativo.sh /root/cociflex-release-anterior.tar.gz');
  console.log('\nVersión anterior reinstalada. Los datos de la base no se tocaron.');
  process.exit(0);
}

step('Revisando el repositorio');
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
if (branch !== 'main' && !args.includes('--permitir-rama')) {
  fail(`Estás en la rama "${branch}". El servidor se actualiza solo desde main:
  git switch main
  git pull`);
}
const dirty = git(['status', '--porcelain', '--untracked-files=no']).stdout.trim();
if (dirty) fail(`Tienes cambios sin confirmar (commit). Confírmalos o descártalos antes de desplegar:\n${dirty}`);
const fetched = git(['fetch', '--quiet', 'origin', branch]);
if (fetched.status === 0) {
  const behind = git(['rev-list', '--count', `HEAD..origin/${branch}`]).stdout.trim();
  if (behind && behind !== '0') fail(`Tu ${branch} está ${behind} commit(s) atrás de GitHub. Ejecuta: git pull`);
} else {
  console.log('    AVISO: no pude consultar GitHub; asegúrate de haber hecho git pull.');
}
const commit = git(['log', '-1', '--format=%h %s']).stdout.trim();
console.log(`    Versión a instalar: ${commit}`);

step('Verificando el código (tipos, pruebas y compilación)');
// npm is npm.cmd on Windows, which can only be started through a shell.
run('npm', ['run', 'check'], { shell: process.platform === 'win32' });

step('Compilando el paquete');
run(process.execPath, [path.join('deploy', 'build-release.mjs')]);

step('Respaldando la base y la versión actual en el servidor');
ssh(
  'set -e; f=/root/cociflex-backup-$(date +%F-%H%M).sql; mariadb-dump cociflex > "$f"; echo "    Respaldo: $f"; ' +
    'if [ -f /root/cociflex-release.tar.gz ]; then cp /root/cociflex-release.tar.gz /root/cociflex-release-anterior.tar.gz; echo "    Versión actual guardada como cociflex-release-anterior.tar.gz"; fi'
);

step('Subiendo la nueva versión');
run('scp', [...SSH_OPTS, 'cociflex-release.tar.gz', 'deploy/deploy_nativo.sh', `${SERVER}:/root/`]);

step('Instalando en el servidor');
// Defensive: if the script was saved with Windows line endings, bash would fail.
ssh('sed -i "s/\\r$//" /root/deploy_nativo.sh && bash /root/deploy_nativo.sh');

console.log(`
Actualización terminada (${commit}).
Si algo falla:   npm run servidor:anterior
Ver errores:     ssh -i "${KEY}" ${SERVER} "journalctl -u cociflex -n 50 --no-pager"`);
