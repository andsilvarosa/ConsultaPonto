import { timeEntries, holidays } from "../../src/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

// Corresponde a um GET /api/entries
export async function onRequestGet(context: any) {
  const matricula = context.request.headers.get('x-matricula');
  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  const db = drizzle(context.env.DB);

  try {
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

  const db = drizzle(context.env.DB);

  try {
    const data = await context.request.json();

    // Limpeza de campos vazios
    const timeFields = ['entry_1', 'exit_1', 'entry_2', 'exit_2', 'entry_3', 'exit_3', 'entry_4', 'exit_4', 'entry_5', 'exit_5'];
    const cleanedData: any = { matricula, date: data.date };
    timeFields.forEach(field => {
      cleanedData[field] = (data[field] === '' || data[field] === undefined) ? null : data[field];
    });

    const isExtra = data.is_extra === true;

    await db.insert(timeEntries).values({
      matricula,
      date: cleanedData.date,
      entry_1: cleanedData.entry_1,
      exit_1: cleanedData.exit_1,
      entry_2: cleanedData.entry_2,
      exit_2: cleanedData.exit_2,
      entry_3: cleanedData.entry_3,
      exit_3: cleanedData.exit_3,
      entry_4: cleanedData.entry_4,
      exit_4: cleanedData.exit_4,
      entry_5: cleanedData.entry_5,
      exit_5: cleanedData.exit_5,
      is_manual: true,
      is_extra: isExtra
    }).onConflictDoUpdate({
      target: [timeEntries.matricula, timeEntries.date],
      set: {
        entry_1: cleanedData.entry_1,
        exit_1: cleanedData.exit_1,
        entry_2: cleanedData.entry_2,
        exit_2: cleanedData.exit_2,
        entry_3: cleanedData.entry_3,
        exit_3: cleanedData.exit_3,
        entry_4: cleanedData.entry_4,
        exit_4: cleanedData.exit_4,
        entry_5: cleanedData.entry_5,
        exit_5: cleanedData.exit_5,
        is_manual: true,
        is_extra: isExtra
      }
    });

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: "Erro ao guardar marcação", details: error.message }, { status: 500 });
  }
}
