import { sql } from "drizzle-orm";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export async function onRequestGet(context: any) {
  const sqlClient = neon(context.env.DATABASE_URL);
  const db = drizzle(sqlClient);
  const logs: string[] = [];

  try {
    logs.push("Iniciando fix-db...");

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS time_entries (
          matricula TEXT NOT NULL DEFAULT '000000',
          date TEXT NOT NULL,
          entry_1 TEXT, exit_1 TEXT,
          entry_2 TEXT, exit_2 TEXT,
          entry_3 TEXT, exit_3 TEXT,
          entry_4 TEXT, exit_4 TEXT,
          entry_5 TEXT, exit_5 TEXT,
          is_manual BOOLEAN DEFAULT FALSE,
          is_extra BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (matricula, date)
        )
      `);
      logs.push("CREATE TABLE executado com sucesso.");
    } catch (e: any) {
      logs.push("Erro no CREATE TABLE: " + e.message);
    }

    try {
      await db.execute(sql`DELETE FROM time_entries WHERE date IS NULL`);
      logs.push("DELETE nulos executado com sucesso.");
    } catch (e: any) {
      logs.push("Erro no DELETE nulos: " + e.message);
    }

    try {
      logs.push("Limpando dados e ajustando índices...");
      await db.execute(sql`UPDATE time_entries SET matricula = '000000' WHERE matricula IS NULL`);
      await db.execute(sql`ALTER TABLE time_entries ALTER COLUMN matricula SET NOT NULL`);
      await db.execute(sql`ALTER TABLE time_entries ALTER COLUMN date SET NOT NULL`);
      
      // Remove duplicates
      await db.execute(sql`
        DELETE FROM time_entries a USING time_entries b
        WHERE a.matricula = b.matricula AND a.date = b.date AND a.ctid > b.ctid
      `);
      logs.push("Dados limpos e duplicatas removidas.");
    } catch (e: any) {
      logs.push("Erro ao limpar dados: " + e.message);
    }

    try {
      logs.push("Criando índice único (matricula, date)...");
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS time_entries_matricula_date_idx ON time_entries (matricula, date)`);
      logs.push("Índice único criado com sucesso.");
    } catch (e: any) {
      logs.push("Erro ao criar índice único: " + e.message);
    }

    try {
      const result = await db.execute(sql`SELECT count(*) as total FROM time_entries`);
      const count = Number(result.rows[0].total);
      logs.push("Total de linhas na tabela: " + count);

      if (count === 0) {
        logs.push("Tabela vazia. Tentando recriar do zero...");
        await db.execute(sql`DROP TABLE IF EXISTS time_entries`);
        await db.execute(sql`
          CREATE TABLE time_entries (
            matricula TEXT NOT NULL DEFAULT '000000',
            date TEXT NOT NULL,
            entry_1 TEXT, exit_1 TEXT,
            entry_2 TEXT, exit_2 TEXT,
            entry_3 TEXT, exit_3 TEXT,
            entry_4 TEXT, exit_4 TEXT,
            entry_5 TEXT, exit_5 TEXT,
            is_manual BOOLEAN DEFAULT FALSE,
            is_extra BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (matricula, date)
          )
        `);
        logs.push("Tabela recriada com sucesso com PRIMARY KEY.");
      }
    } catch (e: any) {
      logs.push("Erro ao tentar recriar tabela: " + e.message);
    }

    return Response.json({ success: true, logs });
  } catch (error: any) {
    return Response.json({ error: "Erro geral", details: error.message, logs }, { status: 500 });
  }
}
