import { calculateDay } from "../../src/utils/timeCalculations";

export async function onRequestPost(context: any) {
  try {
    const { entries, exits, is_holiday, daily_work_hours } = await context.request.json();
    const result = calculateDay(entries, exits, is_holiday, daily_work_hours);
    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: "Erro ao calcular ponto", details: error.message }, { status: 500 });
  }
}
