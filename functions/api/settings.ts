import { settings } from "../../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export async function onRequestGet(context: any) {
  const matricula = context.request.headers.get('x-matricula');
  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  const db = drizzle(context.env.DB);

  try {
    const allSettings = await db.select().from(settings).where(
      sql`${settings.key} LIKE ${matricula + '_%'}`
    );
    const settingsMap = allSettings.reduce((acc: any, curr: any) => {
      // Remove matricula prefix for the client
      const key = curr.key.replace(`${matricula}_`, '');
      acc[key] = curr.value;
      return acc;
    }, {});
    return Response.json(settingsMap);
  } catch (error: any) {
    return Response.json({ error: "Erro ao buscar configurações", details: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const matricula = context.request.headers.get('x-matricula');
  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  const db = drizzle(context.env.DB);

  try {
    const { previous_balance, daily_work_hours } = await context.request.json();
    
    if (previous_balance !== undefined) {
      const key = `${matricula}_previous_balance`;
      await db.insert(settings)
        .values({ key, value: previous_balance.toString() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: previous_balance.toString() }
        });
    }

    if (daily_work_hours !== undefined) {
      const key = `${matricula}_daily_work_hours`;
      await db.insert(settings)
        .values({ key, value: daily_work_hours.toString() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: daily_work_hours.toString() }
        });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: "Erro ao salvar configurações", details: error.message }, { status: 500 });
  }
}
