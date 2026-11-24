#!/usr/bin/env bash
# Native deployment of CociFlex on Ubuntu (Nodo 4): MariaDB + Node.js + systemd + NGINX.
# Run as root ON THE SERVER:  bash deploy_nativo.sh [/root/cociflex-release.tar.gz]
# Safe to re-run: it updates the app and keeps the existing database and .env.
set -euo pipefail

APP_DIR=/opt/cociflex
APP_USER=cociflex
DB_NAME=cociflex
DB_USER=cociflex_app
PORT=3000
RELEASE="${1:-/root/cociflex-release.tar.gz}"

log() { printf '\n==> %s\n' "$*"; }
warn() { printf '    AVISO: %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Ejecuta este script como root."
[ -f "$RELEASE" ] || die "No encuentro $RELEASE (sube cociflex-release.tar.gz primero)."

# ---------- 0. Safety checks (nothing is changed before these pass) ----------
log "Revisando recursos y conflictos"
free_mb=$(df -Pm / | awk 'NR==2 {print $4}')
[ "$free_mb" -ge 1500 ] || die "Solo hay ${free_mb} MB libres en disco; se necesitan al menos 1500."
free -h | sed -n '1,3p'

if [ -d /opt/Los_Telefonos ]; then
  warn "Existe /opt/Los_Telefonos (AdaptMobile). No se toca, pero comparte NGINX y el puerto 80."
fi

# Other NGINX sites would fight for port 80. The stock "default" page is replaced safely.
other_sites=""
if [ -d /etc/nginx/sites-enabled ]; then
  for f in /etc/nginx/sites-enabled/*; do
    [ -e "$f" ] || continue
    name=$(basename "$f")
    [ "$name" = "default" ] || [ "$name" = "cociflex" ] || other_sites="$other_sites $name"
  done
fi
if [ -n "$other_sites" ] && [ "${FORCE_NGINX:-0}" != "1" ]; then
  die "Ya hay sitios de NGINX activos:$other_sites
Para desactivarlos (se guarda copia en /root/nginx-sites-backup) y seguir, ejecuta:
  FORCE_NGINX=1 bash deploy_nativo.sh"
fi

# ---------- 1. Swap (npm install is heavy for 1 GB of RAM) ----------
swap_mb=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$swap_mb" -lt 500 ] && [ ! -f /swapfile ]; then
  log "Creando swap de 1 GB (la RAM es limitada)"
  if fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile; then
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  else
    rm -f /swapfile
    warn "No se pudo crear el swap; sigo sin él."
  fi
fi

# ---------- 2. Packages ----------
log "Instalando paquetes (MariaDB, NGINX, Node.js)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq mariadb-server nginx curl openssl ca-certificates >/dev/null

node_major() { node -v 2>/dev/null | sed 's/^v//; s/\..*//' || echo 0; }
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 20 ]; then
  apt-get install -y -qq nodejs npm >/dev/null
fi
command -v node >/dev/null 2>&1 || die "No se pudo instalar Node.js."
[ "$(node_major)" -ge 20 ] || die "Node.js $(node -v) es muy viejo; se necesita 20 o superior."
echo "    Node $(node -v), npm $(npm -v)"

# ---------- 3. MariaDB (small memory footprint) ----------
log "Configurando MariaDB"
cat > /etc/mysql/mariadb.conf.d/99-cociflex.cnf <<'CNF'
[mysqld]
bind-address            = 127.0.0.1
skip-name-resolve
character-set-server    = utf8mb4
collation-server        = utf8mb4_unicode_ci
innodb_buffer_pool_size = 64M
innodb_log_file_size    = 16M
performance_schema      = OFF
max_connections         = 30
key_buffer_size         = 8M
tmp_table_size          = 16M
max_heap_table_size     = 16M
CNF
systemctl enable --now mariadb >/dev/null 2>&1
systemctl restart mariadb

# Reuse the password on re-runs so the app keeps working
DB_PASS=""
if [ -f "$APP_DIR/.env" ]; then
  DB_PASS=$(grep '^SQL_PASSWORD=' "$APP_DIR/.env" | cut -d= -f2- || true)
fi
[ -n "$DB_PASS" ] || DB_PASS=$(openssl rand -hex 16)

# The app connects over TCP to 127.0.0.1, which MariaDB treats as a different host than 'localhost'.
mariadb <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# ---------- 4. Application files ----------
log "Instalando la aplicación en $APP_DIR"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
rm -rf "$APP_DIR/dist" "$APP_DIR/server.mjs" "$APP_DIR/database"
tar -xzf "$RELEASE" -C "$APP_DIR"

has_users=$(mariadb -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='users';")
if [ "$has_users" = "0" ]; then
  log "Creando las tablas"
  mariadb "$DB_NAME" < "$APP_DIR/database/schema.sql"
else
  echo "    Las tablas ya existen: se conservan los datos."
fi
# Migraciones idempotentes (database/migrate_*.sql), en orden alfabético.
for migration in $(ls "$APP_DIR"/database/migrate_*.sql 2>/dev/null | sort); do
  mariadb "$DB_NAME" < "$migration"
  echo "    Migración aplicada: $(basename "$migration")"
done

log "Instalando dependencias de producción (puede tardar unos minutos)"
(cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund --loglevel=error)

# ---------- 5. Environment file ----------
LLM_BASE_URL="${LLM_BASE_URL:-http://10.8.0.2:11434/v1}"
LLM_MODEL="${LLM_MODEL:-qwen2.5:7b}"
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<ENV
# IA local: Ollama en tu equipo, alcanzado por la VPN WireGuard
LLM_BASE_URL=$LLM_BASE_URL
LLM_MODEL=$LLM_MODEL
LLM_TIMEOUT_MS=600000
LLM_MAX_TOKENS=1100
LLM_MAX_CONCURRENT=1
LLM_MAX_QUEUE=2
SQL_HOST=127.0.0.1
SQL_PORT=3306
SQL_USER=$DB_USER
SQL_PASSWORD=$DB_PASS
SQL_DB_NAME=$DB_NAME
HOST=127.0.0.1
PORT=$PORT
NODE_ENV=production
ENV
  echo "    Archivo .env creado."
else
  echo "    Se conserva el .env existente."
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/.env"

# ---------- 6. systemd ----------
log "Configurando el servicio systemd"
cat > /etc/systemd/system/cociflex.service <<UNIT
[Unit]
Description=CociFlex (Node.js + MariaDB)
After=network.target mariadb.service
Wants=mariadb.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$(command -v node) --max-old-space-size=192 server.mjs
Restart=on-failure
RestartSec=5
MemoryMax=320M
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable cociflex >/dev/null 2>&1
systemctl restart cociflex

# ---------- 7. NGINX ----------
log "Configurando NGINX en el puerto 80"
if [ -n "$other_sites" ]; then
  mkdir -p /root/nginx-sites-backup
  for name in $other_sites; do
    cp -a "/etc/nginx/sites-available/$name" /root/nginx-sites-backup/ 2>/dev/null || true
    rm -f "/etc/nginx/sites-enabled/$name"
  done
  warn "Sitios desactivados:$other_sites (copia en /root/nginx-sites-backup)"
fi
rm -f /etc/nginx/sites-enabled/default
# Listen on IPv6 only when the server has it (otherwise nginx refuses to start)
LISTEN6=""
[ -f /proc/net/if_inet6 ] && LISTEN6="listen [::]:80 default_server;"
cat > /etc/nginx/sites-available/cociflex <<NGINX
server {
    listen 80 default_server;
    $LISTEN6
    server_name _;

    client_max_body_size 1m;
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # La IA local tarda minutos (recetas y "Receta a tu medida"): sin búfer ni compresión y con espera larga
    location ~ ^/api/(generate-recipe|recipes/partition-steps)\$ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        gzip off;
        proxy_read_timeout 900s;
        proxy_send_timeout 900s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/cociflex /etc/nginx/sites-enabled/cociflex
nginx -t
systemctl enable nginx >/dev/null 2>&1
systemctl reload nginx || systemctl restart nginx

# ---------- 8. Health checks ----------
log "Verificando"
ok=0
for _ in $(seq 1 20); do
  if curl -fs -o /dev/null "http://127.0.0.1:$PORT/api/community/validations"; then ok=1; break; fi
  sleep 1
done
if [ "$ok" = "1" ]; then echo "    App responde en el puerto $PORT: OK"; else
  journalctl -u cociflex -n 25 --no-pager; die "La app no respondió. Revisa: journalctl -u cociflex -n 50"
fi
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ || true)
echo "    NGINX (puerto 80) responde: HTTP $code"


# Ollama (IA local) vive en tu PC: solo responde si la VPN y el PC están encendidos
LLM_ROOT=$(grep '^LLM_BASE_URL=' "$APP_DIR/.env" | cut -d= -f2- | sed 's#/v1/*$##')
if [ -n "$LLM_ROOT" ]; then
  if curl -s -m 8 "$LLM_ROOT/api/tags" | grep -q '"models"'; then
    echo "    Ollama en $LLM_ROOT: OK"
  else
    warn "Ollama no responde en $LLM_ROOT. Enciende tu PC y la VPN; las recetas fallarán hasta entonces."
  fi
fi

if systemctl is-active --quiet postgresql 2>/dev/null; then
  warn "PostgreSQL sigue activo y usa RAM. Si ya no lo necesitas: systemctl disable --now postgresql"
fi

log "Listo"
free -h | sed -n '1,3p'
echo
echo "App:        http://$(hostname -I | awk '{print $1}')/"
echo "Servicio:   systemctl status cociflex   |   journalctl -u cociflex -f"
echo "Variables:  $APP_DIR/.env"
