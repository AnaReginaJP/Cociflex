# Despliegue de CociFlex en el Nodo 4

Despliegue nativo (sin Docker) en Ubuntu: **MariaDB + Node.js + systemd + NGINX**. Está pensado para los recursos del Nodo 4 (1 vCPU, ~750 MiB de RAM libres, solo el puerto 80 abierto): la app compilada usa unos 120 MiB y MariaDB queda limitada a un buffer de 64 MiB.

Se compila en tu PC y al servidor solo se sube el resultado.

## 1. En tu PC: compilar

Desde la carpeta del proyecto:

```bash
bash deploy/build_release.sh
```

Genera `cociflex-release.tar.gz` (interfaz compilada + servidor en un solo archivo + `schema.sql`).

## 2. Subir al servidor

```bash
scp -i ~/.ssh/Inteligencia_Artificial.pem cociflex-release.tar.gz deploy/deploy_nativo.sh root@79.143.88.199:/root/
```

## 3. En el servidor: instalar

```bash
ssh -i ~/.ssh/Inteligencia_Artificial.pem root@79.143.88.199
bash /root/deploy_nativo.sh
```

El script configura la IA local (Ollama por la VPN, `http://10.8.0.2:11434/v1`, modelo `qwen2.5:7b`). Hace lo siguiente:

1. Revisa disco y conflictos antes de tocar nada.
2. Crea 1 GB de swap si no hay suficiente.
3. Instala MariaDB, NGINX y Node.js (si falta o es menor a 20).
4. Configura MariaDB con poca memoria, escuchando solo en `127.0.0.1`.
5. Crea la base `cociflex` y el usuario `cociflex_app` (solo SELECT, INSERT, UPDATE y DELETE) con una contraseña aleatoria.
6. Instala la app en `/opt/cociflex`, crea las tablas e instala las dependencias de producción.
7. Crea el servicio `cociflex` (usuario sin privilegios, límite de 320 MiB) escuchando solo en `127.0.0.1:3000`.
8. Configura NGINX en el puerto 80 como proxy.
9. Aplica la migración de cuentas locales (`database/migrate_local_auth.sql`), verifica la app y comprueba si alcanza tu Ollama.

**Si ya hay otro sitio en NGINX** (por ejemplo AdaptMobile), el script se detiene sin cambiar nada. Para desactivarlo, con copia de respaldo en `/root/nginx-sites-backup`:

```bash
FORCE_NGINX=1 bash /root/deploy_nativo.sh
```

Para usar otro modelo o dirección: `LLM_MODEL=qwen2.5-coder:1.5b LLM_BASE_URL=http://10.8.0.2:11434/v1 bash /root/deploy_nativo.sh`.

## 4. Cuentas de usuario

Las cuentas son **locales**: correo y contraseña guardados en MariaDB (contraseña cifrada con scrypt, sesión en una cookie `HttpOnly` de 30 días). No se usa Firebase ni ningún servicio externo, así que el login funciona desde cualquier dispositivo en `http://79.143.88.199/`.

Desde el ícono de usuario: **Crear cuenta** (nombre opcional, correo y contraseña de al menos 8 caracteres) o **Iniciar sesión**. Hay un límite de 10 intentos cada 15 minutos por IP.

> El puerto 80 no tiene HTTPS: la contraseña viaja sin cifrar. Para uso real conviene un dominio con HTTPS (Let's Encrypt, requiere abrir el puerto 443). Mientras tanto puedes usar el túnel SSH, que sí va cifrado: `ssh -i ~/.ssh/Inteligencia_Artificial.pem -L 8080:127.0.0.1:80 root@79.143.88.199` y abre http://localhost:8080.

## 5. Qué revisar en el resultado del script

Al final el script muestra:

- `Ollama en ...: OK` o aviso. Ollama corre en tu PC: si el PC o la VPN están apagados, generar una receta muestra un error amable. Con CPU (~2.5 tokens/s) una receta con `qwen2.5:7b` puede tardar varios minutos; para más velocidad usa un modelo pequeño (`qwen2.5-coder:1.5b`). La app atiende una receta a la vez y avisa si está ocupada.
- Un aviso si PostgreSQL sigue activo. Si ya no lo necesitas, libera RAM con `systemctl disable --now postgresql`.

## Operación

```bash
systemctl status cociflex            # estado
journalctl -u cociflex -f            # logs en vivo
systemctl restart cociflex           # reiniciar (después de editar /opt/cociflex/.env)
free -h && df -h /                   # memoria y disco
```

**Actualizar a una versión nueva:** repite los pasos 1, 2 y 3. El script conserva la base de datos, las tablas, la contraseña y el `.env`.

**Cambiar el modelo de IA:** edita `LLM_MODEL` (o `LLM_BASE_URL`) en `/opt/cociflex/.env` y ejecuta `systemctl restart cociflex`.

## Desinstalar

```bash
systemctl disable --now cociflex
rm /etc/systemd/system/cociflex.service /etc/nginx/sites-enabled/cociflex /etc/nginx/sites-available/cociflex
systemctl daemon-reload && systemctl reload nginx
mariadb -e "DROP DATABASE cociflex; DROP USER 'cociflex_app'@'localhost'; DROP USER 'cociflex_app'@'127.0.0.1';"
rm -rf /opt/cociflex
```
