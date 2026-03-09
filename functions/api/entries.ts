import { timeEntries, holidays } from "../../src/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
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

// Corresponde a um GET /api/entries
export async function onRequestGet(context: any) {
  const matricula = context.request.headers.get('x-matricula');
  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  const sqlClient = neon(context.env.DATABASE_URL);
  const db = drizzle(sqlClient);

  try {
    await ensureTableExists(db);
    const entriesList = await db.select().from(timeEntries).where(eq(timeEntries.matricula, matricula)).orderBy(desc(timeEntries.date));
    const holidaysList = await db.select().from(holidays);
    return Response.json({ entries: entriesList, holidays: holidaysList });
  } catch (error: any) {
    return Response.json({ error: "Erro ao buscar marcações", details: error.message }, { status: 500 });
  }
}

// Corresponde a um POST /api/entries
export async function onRequestPost(context: any) {
  const matricula = context.request.headers.get('x-matricula');
  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  const sqlClient = neon(context.env.DATABASE_URL);
  const db = drizzle(sqlClient);

  try {
    const data = await context.request.json();
    
    await ensureTableExists(db);

    // Limpeza de campos vazios
    const timeFields = ['entry_1', 'exit_1', 'entry_2', 'exit_2', 'entry_3', 'exit_3', 'entry_4', 'exit_4', 'entry_5', 'exit_5'];
    const cleanedData: any = { matricula, date: data.date };
    timeFields.forEach(field => {
      cleanedData[field] = (data[field] === '' || data[field] === undefined) ? null : data[field];
    });

    const isExtra = data.is_extra === true;

    await db.execute(sql`
      INSERT INTO time_entries (
        matricula, date, 
        entry_1, exit_1, entry_2, exit_2, entry_3, exit_3, entry_4, exit_4, entry_5, exit_5, is_manual, is_extra
      ) VALUES (
        ${matricula}, ${cleanedData.date},
        ${cleanedData.entry_1}, ${cleanedData.exit_1}, ${cleanedData.entry_2}, ${cleanedData.exit_2}, ${cleanedData.entry_3}, ${cleanedData.exit_3}, ${cleanedData.entry_4}, ${cleanedData.exit_4}, ${cleanedData.entry_5}, ${cleanedData.exit_5}, TRUE, ${isExtra}
      )
      ON CONFLICT (matricula, date) DO UPDATE SET
        entry_1 = EXCLUDED.entry_1, exit_1 = EXCLUDED.exit_1,
        entry_2 = EXCLUDED.entry_2, exit_2 = EXCLUDED.exit_2,
        entry_3 = EXCLUDED.entry_3, exit_3 = EXCLUDED.exit_3,
        entry_4 = EXCLUDED.entry_4, exit_4 = EXCLUDED.exit_4,
        entry_5 = EXCLUDED.entry_5, exit_5 = EXCLUDED.exit_5,
        is_manual = TRUE,
        is_extra = EXCLUDED.is_extra
    `);

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: "Erro ao guardar marcação", details: error.message }, { status: 500 });
  }
}
