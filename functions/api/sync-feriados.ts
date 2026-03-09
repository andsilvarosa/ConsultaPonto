import { holidays } from "../../src/db/schema";
import { sql } from "drizzle-orm";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export async function onRequestGet(context: any) {
  const sqlClient = neon(context.env.DATABASE_URL);
  const db = drizzle(sqlClient);

  try {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS holidays (
          date TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT DEFAULT 'national'
        )
      `);
      await db.execute(sql`ALTER TABLE holidays ADD PRIMARY KEY (date)`);
    } catch (e) {}

    const year = new Date().getFullYear();
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    const feriadosList = await response.json() as any[];

    for (const f of feriadosList) {
      await db.insert(holidays)
        .values({ date: f.date, name: f.name, type: f.type || 'national' })
        .onConflictDoUpdate({
          target: holidays.date,
          set: { name: f.name, type: f.type || 'national' }
        });
    }

    return Response.json({ message: `${feriadosList.length} feriados sincronizados com sucesso.`, feriados: feriadosList });
  } catch (error: any) {
    return Response.json({ error: "Erro ao sincronizar feriados", details: error.message }, { status: 500 });
  }
}
