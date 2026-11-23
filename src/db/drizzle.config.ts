import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const required = ['SQL_HOST', 'SQL_DB_NAME', 'SQL_ADMIN_USER', 'SQL_ADMIN_PASSWORD'] as const;
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} must be set in environment variables.`);
  }
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.SQL_HOST!,
    port: Number(process.env.SQL_PORT) || 3306,
    user: process.env.SQL_ADMIN_USER!,
    password: process.env.SQL_ADMIN_PASSWORD!,
    database: process.env.SQL_DB_NAME!,
  },
  verbose: true,
});
