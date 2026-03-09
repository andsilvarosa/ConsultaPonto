import { holidays } from "../../src/db/schema";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export async function onRequestGet(context: any) {
  if (!context.env.DB) {
    return Response.json({ 
      error: "D1 Database binding missing", 
      details: "A vinculação do banco de dados D1 (DB) não foi encontrada nas configurações do Cloudflare Pages. Por favor, adicione a vinculação 'DB' no painel do Cloudflare." 
    }, { status: 500 });
  }

  const db = drizzle(context.env.DB);

  try {
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
