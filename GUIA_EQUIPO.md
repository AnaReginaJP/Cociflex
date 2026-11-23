# Guía del equipo CociFlex

CociFlex ya está funcionando en el servidor. Esta guía explica cómo trabajar sin romperlo:

1. [Reglas de oro](#1-reglas-de-oro)
2. [Preparar tu computadora](#2-preparar-tu-computadora)
3. [Flujo para hacer cambios y commits](#3-flujo-para-hacer-cambios-y-commits)
4. [Cambios en la base de datos](#4-cambios-en-la-base-de-datos)
5. [Actualizar la versión en el servidor](#5-actualizar-la-versión-en-el-servidor)
6. [Si algo sale mal: volver a la versión anterior](#6-si-algo-sale-mal-volver-a-la-versión-anterior)
7. [Partes delicadas del sistema](#7-partes-delicadas-del-sistema)

---

## 1. Reglas de oro

1. **Nunca hagas commit directo en `main`.** `main` es la versión que funciona. Todo cambio va en una rama propia y entra a `main` con un *pull request* revisado por otra persona.
2. **Antes de cada commit ejecuta `npm run check`** (revisa tipos, corre las pruebas y compila). Si falla, no hagas commit.
3. **Nunca subas secretos:** archivos `.env`, llaves `.pem` o `id_*`, contraseñas, ni respaldos `.sql` con datos de usuarios. El `.gitignore` ya bloquea `.env`, pero revisa siempre con `git status` antes de `git add`.
4. **No subas archivos generados:** `node_modules/`, `dist/`, `release/` ni `cociflex-release.tar.gz`. Se crean con los scripts.
5. **No cambies tablas existentes de la base sin una migración** (ver sección 4).
6. **Solo la persona responsable actualiza el servidor**, y siempre desde `main` (ver sección 5).
7. **Commits pequeños y claros:** un tema por commit. Es más fácil revisar y deshacer.

---

## 2. Preparar tu computadora

Requisitos: **Node.js 20 o superior**, **Git** y **Docker** (para tener MariaDB de pruebas sin instalarlo).

```bash
git clone git@github.com:AnaReginaJP/Cociflex.git
cd Cociflex
npm install
```

### Base de datos de pruebas (MariaDB en Docker)

```bash
# Crear y arrancar MariaDB (solo la primera vez)
docker run -d --name cociflex-db -p 127.0.0.1:3306:3306 \
  -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=cociflex \
  -e MARIADB_USER=cociflex_app -e MARIADB_PASSWORD=cociflex_dev \
  mariadb:10.11

# Crear las tablas (espera ~15 segundos a que arranque)
docker exec -i cociflex-db mariadb -uroot -proot cociflex < database/schema.sql

# Las siguientes veces solo:
docker start cociflex-db
```

### Archivo `.env`

Copia `.env.example` a `.env` y deja estos valores (son solo de tu computadora, **no se suben**):

```
LLM_BASE_URL="http://localhost:11434/v1"
LLM_MODEL="qwen2.5:7b"
SQL_HOST="127.0.0.1"
SQL_PORT=3306
SQL_USER="cociflex_app"
SQL_PASSWORD="cociflex_dev"
SQL_DB_NAME="cociflex"
PORT=3000
NODE_ENV="development"
```

Si no tienes Ollama, borra la línea `LLM_BASE_URL`: la app devolverá una receta de respaldo y todo lo demás funciona igual.

### Arrancar la app

```bash
npm run dev
```

Abre http://localhost:3000, crea una cuenta de prueba y revisa que tu cambio funcione.

---

## 3. Flujo para hacer cambios y commits

### Paso a paso

```bash
# 1. Parte siempre de la última versión de main
git switch main
git pull

# 2. Crea tu rama (ver nombres abajo)
git switch -c feature/lista-mandado-compartida

# 3. Programa y prueba en tu navegador (npm run dev)

# 4. Verifica que nada se rompió
npm run check

# 5. Revisa qué vas a subir: que no haya .env, llaves ni archivos raros
git status
git diff

# 6. Agrega SOLO los archivos que cambiaste (evita "git add ." a ciegas)
git add src/components/ShoppingList.tsx src/App.tsx

# 7. Commit con un mensaje claro
git commit -m "feat: permitir compartir la lista de mandado"

# 8. Sube tu rama
git push -u origin feature/lista-mandado-compartida
```

9. En GitHub abre un **pull request** de tu rama hacia `main`, describe qué cambiaste y cómo probarlo, y pide a otra persona que lo revise.
10. Cuando lo aprueben, se une a `main`. Después borra tu rama.

### Nombres de rama

| Tipo de cambio | Nombre de rama |
|---|---|
| Función nueva | `feature/descripcion-corta` |
| Corrección de error | `fix/descripcion-corta` |
| Documentación | `docs/descripcion-corta` |
| Cambio en la base de datos | `db/descripcion-corta` |

### Mensajes de commit

Formato: `tipo: qué hace el cambio` (en español, en presente, máximo ~70 caracteres).

| Tipo | Cuándo usarlo | Ejemplo |
|---|---|---|
| `feat` | Algo nuevo para el usuario | `feat: agregar filtro de recetas sin gluten` |
| `fix` | Corrige un error | `fix: el historial no se actualizaba al borrar` |
| `docs` | Solo documentación | `docs: explicar cómo usar el BioAsistente` |
| `style` | Diseño o formato, sin cambiar lógica | `style: ajustar colores del perfil en móvil` |
| `refactor` | Reorganiza código sin cambiar lo que hace | `refactor: separar el motor de coincidencia` |
| `test` | Pruebas | `test: cubrir el escalado de porciones` |
| `db` | Cambios de la base de datos | `db: agregar tabla de favoritos` |

Mal: `cambios`, `arreglos`, `ya quedó`, `asdf`. Esos mensajes no dicen qué cambió y hacen imposible encontrar un error después.

### Antes de abrir el pull request

- [ ] `npm run check` pasa sin errores.
- [ ] Probé el cambio en el navegador con una cuenta de prueba.
- [ ] `git status` no muestra `.env`, llaves, `node_modules`, `dist` ni respaldos.
- [ ] Si cambié la base de datos, incluí la migración (sección 4).
- [ ] Mi rama está al día con `main` (`git pull origin main` y resolví conflictos).

### Si te equivocaste

| Situación | Qué hacer |
|---|---|
| Hice commit pero aún no hago push | `git reset --soft HEAD~1` (deshace el commit y conserva tus cambios) |
| Hice commit en `main` por error, sin push | `git switch -c feature/mi-cambio` y luego `git switch main && git reset --hard origin/main` |
| Ya subí algo malo a mi rama | Corrige y haz otro commit; no uses `git push --force` en ramas compartidas |
| Subí un secreto (contraseña, llave) | **Avisa de inmediato** al equipo: hay que cambiar ese secreto, no basta con borrarlo del repo |

**Nunca uses** `git push --force` sobre `main`, ni `git reset --hard` si no estás seguro de qué se va a perder.

---

## 4. Cambios en la base de datos

El servidor ya tiene datos reales de usuarios. Un cambio mal hecho puede borrarlos.

**Reglas:**

1. **Nunca borres ni renombres columnas o tablas** que ya existen. Si algo ya no se usa, déjalo.
2. Para **agregar** algo, actualiza los tres lugares:
   - `src/db/schema.ts` (lo que usa el código),
   - `database/schema.sql` (instalaciones nuevas),
   - un archivo nuevo de migración `database/migrate_<descripcion>.sql` (instalaciones existentes, como el servidor).
3. La migración debe poder **ejecutarse varias veces sin fallar** (idempotente). Usa siempre:
   ```sql
   CREATE TABLE IF NOT EXISTS ...
   ALTER TABLE `tabla` ADD COLUMN IF NOT EXISTS ...
   CREATE INDEX IF NOT EXISTS ...
   ```
4. Agrega la migración al script de instalación `deploy/deploy_nativo.sh`, junto a la línea de `migrate_local_auth.sql`, y a la lista de archivos que copia `deploy/build_release.sh`.
5. Prueba la migración en tu Docker **dos veces seguidas** sobre una base que ya tenga datos.

Ejemplo de migración: `database/migrate_local_auth.sql`.

---

## 5. Actualizar la versión en el servidor

Lo hace **solo la persona responsable** del servidor, que tiene la llave SSH. La llave se comparte en privado y **nunca se sube al repositorio**.

- Servidor: `79.143.88.199`, usuario `root`
- Llave: `~/.ssh/Inteligencia_Artificial.pem` (si da error de permisos: `chmod 600 ~/.ssh/Inteligencia_Artificial.pem`)

Para abreviar, en tu terminal:

```bash
KEY=~/.ssh/Inteligencia_Artificial.pem
SRV=root@79.143.88.199
```

### Paso 1. Compilar desde `main` en tu PC

```bash
git switch main
git pull
npm install
npm run check
bash deploy/build_release.sh      # genera cociflex-release.tar.gz
```

### Paso 2. Respaldar el servidor (antes de tocar nada)

```bash
ssh -i $KEY $SRV '
  mariadb-dump cociflex > /root/cociflex-backup-$(date +%F-%H%M).sql
  [ -f /root/cociflex-release.tar.gz ] && cp /root/cociflex-release.tar.gz /root/cociflex-release-anterior.tar.gz
  ls -la /root/cociflex-backup-*.sql | tail -3'
```

### Paso 3. Subir la nueva versión

```bash
scp -i $KEY cociflex-release.tar.gz deploy/deploy_nativo.sh $SRV:/root/
```

### Paso 4. Instalar

```bash
ssh -i $KEY $SRV 'bash /root/deploy_nativo.sh'
```

El script es seguro de repetir: **conserva la base de datos, las cuentas y el `.env`**, aplica las migraciones y reinicia la app. Si encuentra otro sitio en NGINX, se detiene sin cambiar nada; en ese caso **pregunta al equipo** antes de usar `FORCE_NGINX=1`.

### Paso 5. Revisar el resultado

Al final el script debe mostrar:

```
App responde en el puerto 3000: OK
NGINX (puerto 80) responde: HTTP 200
Ollama en http://10.8.0.2:11434: OK
```

Si Ollama no responde, **no es un error del código**: hay que encender la PC con Ollama y su VPN WireGuard.

Prueba rápida desde tu PC:

```bash
curl -s http://79.143.88.199/api/auth/me          # debe responder {"user":null}
```

Y en el navegador: abre http://79.143.88.199/, inicia sesión con tu cuenta y genera una receta.

### Paso 6. Etiquetar la versión

```bash
git tag -a v4.1.0 -m "CociFlex 4.1.0: <resumen>"
git push origin v4.1.0
```

Número de versión: `MAYOR.MENOR.PARCHE`. Sube el **PARCHE** si solo corriges errores (4.0.1), el **MENOR** si agregas funciones (4.1.0) y el **MAYOR** si cambias algo grande (5.0.0).

### Comandos útiles en el servidor

```bash
systemctl status cociflex          # estado de la app
journalctl -u cociflex -n 50       # últimos mensajes y errores
journalctl -u cociflex -f          # mensajes en vivo
systemctl restart cociflex         # reiniciar (después de editar /opt/cociflex/.env)
free -h && df -h /                 # memoria y disco
```

---

## 6. Si algo sale mal: volver a la versión anterior

1. **Mira el error:**
   ```bash
   ssh -i $KEY $SRV 'journalctl -u cociflex -n 50 --no-pager'
   ```
2. **Reinstala la versión anterior** (la copia que guardaste en el paso 2):
   ```bash
   ssh -i $KEY $SRV 'bash /root/deploy_nativo.sh /root/cociflex-release-anterior.tar.gz'
   ```
3. **Solo si se dañaron los datos**, restaura el respaldo. Esto reemplaza la base completa, así que avisa al equipo antes:
   ```bash
   ssh -i $KEY $SRV 'ls -la /root/cociflex-backup-*.sql'
   ssh -i $KEY $SRV 'mariadb cociflex < /root/cociflex-backup-AAAA-MM-DD-HHMM.sql && systemctl restart cociflex'
   ```
4. Corrige el problema en una rama `fix/...`, sigue el flujo normal y vuelve a desplegar.

---

## 7. Partes delicadas del sistema

Estos archivos sostienen el inicio de sesión, los datos de los usuarios y el servidor. Cámbialos solo si es necesario, y pide revisión de alguien más.

| Archivo | Qué hace | Riesgo si se rompe |
|---|---|---|
| `src/auth/localAuth.ts` | Contraseñas (scrypt), sesiones y cookies | Nadie puede iniciar sesión o se exponen cuentas |
| `src/middleware/auth.ts` | Verifica la sesión en cada petición | Datos de un usuario visibles para otro |
| `src/db/schema.ts`, `database/*.sql` | Estructura de la base | Pérdida de datos |
| `src/db/cociflexRepo.ts` | Lectura y escritura de datos | Datos que no se guardan |
| `src/ai/localLlm.ts`, `src/ai/limiter.ts` | Conexión con la IA local y cola | Recetas con IA que fallan o saturan el servidor |
| `server.ts` | Todas las rutas de la API | Toda la app |
| `deploy/deploy_nativo.sh`, `deploy/build_release.sh` | Instalación en el servidor | Despliegues fallidos |

**Datos importantes del servidor:**

- El servidor tiene 1 vCPU y ~1 GB de RAM. Evita dependencias pesadas en el servidor.
- La IA de recetas vive en una PC del equipo y el servidor la alcanza por VPN (`10.8.0.2`). Si esa PC está apagada, las recetas con IA fallan con un mensaje amable; lo demás sigue funcionando.
- El puerto 80 no tiene HTTPS todavía: no uses contraseñas importantes en las cuentas de prueba.
- El servidor también tiene Docker y otros servicios: **no los toques** al desplegar CociFlex.
