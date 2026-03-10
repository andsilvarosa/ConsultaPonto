import { drizzle } from "drizzle-orm/d1";
import { users } from "../../../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function onRequestPost(context: any) {
  if (!context.env.DB || typeof context.env.DB.prepare !== 'function') {
    return Response.json({ error: "D1 Database binding missing" }, { status: 500 });
  }

  const db = drizzle(context.env.DB);
  const { matricula, password } = await context.request.json();

  if (!matricula || !password) {
    return Response.json({ error: "Matrícula e senha são obrigatórios" }, { status: 400 });
  }

  try {
    const existing = await db.select().from(users).where(eq(users.matricula, matricula)).limit(1);
    if (existing.length === 0) {
      return Response.json({ error: "Matrícula não cadastrada" }, { status: 404 });
    }

    const user = existing[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return Response.json({ error: "Senha incorreta" }, { status: 401 });
    }

    return Response.json({ success: true, message: "Login realizado com sucesso" });
  } catch (error: any) {
    return Response.json({ error: "Erro ao fazer login", details: error.message }, { status: 500 });
  }
}
