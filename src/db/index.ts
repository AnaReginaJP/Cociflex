import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Pool } from 'mysql2/promise';
import * as schema from './schema.ts';

declare global {
  var _mariadbPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._mariadbPool) {
    global._mariadbPool = mysql.createPool({
      host: process.env.SQL_HOST,
      port: Number(process.env.SQL_PORT) || 3306,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      charset: 'utf8mb4',
      connectionLimit: 10,
      connectTimeout: 15000,
    });
  }
  return global._mariadbPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema, mode: 'default' });
