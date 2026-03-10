import { drizzle } from "drizzle-orm/d1";
import { users } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

export async function onRequestPost(context: any) {
  if (!context.env.DB || typeof context.env.DB.prepare !== 'function') {
    return Response.json({ error: "D1 Database binding missing" }, { status: 500 });
  }

  const db = drizzle(context.env.DB);
  const { matricula } = await context.request.json();

  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  try {
    const existing = await db.select().from(users).where(eq(users.matricula, matricula)).limit(1);
    return Response.json({ registered: existing.length > 0 });
  } catch (error: any) {
    return Response.json({ error: "Erro ao verificar matrícula", details: error.message }, { status: 500 });
  }
}
