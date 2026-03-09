import { timeEntries } from "../../../src/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

async function ensureTableExists(db: any) {
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
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add columns if they don't exist
    await db.execute(sql`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS matricula TEXT NOT NULL DEFAULT '000000'`);
    await db.execute(sql`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT FALSE`);
    
    // Fix NULLs and constraints
    try {
      await db.execute(sql`UPDATE time_entries SET matricula = '000000' WHERE matricula IS NULL`);
      await db.execute(sql`ALTER TABLE time_entries ALTER COLUMN matricula SET NOT NULL`);
      await db.execute(sql`ALTER TABLE time_entries ALTER COLUMN date SET NOT NULL`);
      
      // Remove duplicates
      await db.execute(sql`
        DELETE FROM time_entries a USING time_entries b
        WHERE a.matricula = b.matricula AND a.date = b.date AND a.ctid > b.ctid
      `);
      
      // Create unique index for ON CONFLICT
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS time_entries_matricula_date_idx ON time_entries (matricula, date)`);
    } catch (e) {}
  } catch (e: any) {
    console.error("Erro ao configurar tabela:", e);
  }

  // Garantir que as colunas são do tipo TEXT
  const columns = ['entry_1', 'exit_1', 'entry_2', 'exit_2', 'entry_3', 'exit_3', 'entry_4', 'exit_4', 'entry_5', 'exit_5'];
  for (const col of columns) {
    try {
      await db.execute(sql.raw(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS ${col} TEXT`));
      await db.execute(sql.raw(`ALTER TABLE time_entries ALTER COLUMN ${col} TYPE TEXT USING ${col}::TEXT`));
    } catch (e) {}
  }
}

export async function onRequestDelete(context: any) {
  const matricula = context.request.headers.get('x-matricula');
  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  const sqlClient = neon(context.env.DATABASE_URL);
  const db = drizzle(sqlClient);

  try {
    await ensureTableExists(db);
    const date = context.params.date;
    await db.delete(timeEntries).where(and(eq(timeEntries.date, date), eq(timeEntries.matricula, matricula)));
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: "Erro ao deletar marcação", details: error.message }, { status: 500 });
  }
}
