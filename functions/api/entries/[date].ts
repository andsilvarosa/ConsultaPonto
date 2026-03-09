import { timeEntries } from "../../../src/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export async function onRequestDelete(context: any) {
  const matricula = context.request.headers.get('x-matricula');
  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  const db = drizzle(context.env.DB);

  try {
    const date = context.params.date;
    await db.delete(timeEntries).where(and(eq(timeEntries.date, date), eq(timeEntries.matricula, matricula)));
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: "Erro ao deletar marcação", details: error.message }, { status: 500 });
  }
}
