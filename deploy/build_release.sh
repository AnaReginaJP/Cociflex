#!/usr/bin/env bash
# Run on your PC (not on the server): builds the web app and the server into one release package.
# Output: cociflex-release.tar.gz (dist/ + server.mjs + runtime package.json + SQL schema and migrations)
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=release
rm -rf "$OUT" cociflex-release.tar.gz
mkdir -p "$OUT/database"

echo "==> Instalando dependencias"
npm install --no-audit --no-fund

echo "==> Compilando la interfaz (Vite)"
npm run build
cp -r dist "$OUT/dist"

echo "==> Empaquetando el servidor en un solo archivo"
npx esbuild server.ts --bundle --platform=node --format=esm --target=node20 \
  --packages=external --outfile="$OUT/server.mjs" --log-level=warning

cp database/schema.sql database/migrate_local_auth.sql "$OUT/database/"

echo "==> Generando package.json solo con dependencias de producción"
node -e '
const pkg = require("./package.json");
const keep = ["express", "dotenv", "drizzle-orm", "mysql2"];
const dependencies = {};
for (const name of keep) dependencies[name] = pkg.dependencies[name];
console.log(JSON.stringify({ name: pkg.name, version: pkg.version, private: true, type: "module", dependencies }, null, 2));
' > "$OUT/package.json"

tar -czf cociflex-release.tar.gz -C "$OUT" .
echo "==> Listo: cociflex-release.tar.gz ($(du -h cociflex-release.tar.gz | cut -f1))"
