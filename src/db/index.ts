import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn("AVISO: DATABASE_URL não encontrada. O banco de dados não será inicializado corretamente até que a variável de ambiente seja configurada.");
}

const sql = neon(databaseUrl || "");
export const db = drizzle(sql, { schema });
