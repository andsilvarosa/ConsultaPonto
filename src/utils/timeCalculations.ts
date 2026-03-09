/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utilitários para cálculos de jornada CLT brasileira.
 * Focado em precisão de minutos e tratamento de hora ficta noturna.
 */

export const JORNADA_PADRAO_MINUTOS = 440; // 07:20:00
export const FATOR_NOTURNO = 60 / 52.5; // 1.142857...

/**
 * Converte string "HH:mm" (com sinal opcional) para minutos totais.
 */
export function timeStrToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const isNegative = timeStr.startsWith('-');
  const cleanStr = timeStr.replace('-', '');
  const parts = cleanStr.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  const total = (isNaN(hours) ? 0 : hours) * 60 + (isNaN(minutes) ? 0 : minutes);
  return isNegative ? -total : total;
}

/**
 * Converte string "HH:mm" para minutos totais desde o início do dia.
 */
export function timeToMinutes(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converte minutos totais para string "HH:mm".
 */
export function minutesToTime(totalMinutes: number): string {
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const sign = totalMinutes < 0 ? '-' : '';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Calcula a interseção entre um período trabalhado e a janela noturna (22:00 - 05:00).
 * Retorna os minutos trabalhados no período noturno.
 */
export function calculateNightMinutes(start: number, end: number): number {
  // Janela noturna em minutos: 22:00 (1320) até 05:00 do dia seguinte (300 + 1440 = 1740)
  // Se o período for após meia-noite, somamos 1440 para facilitar o cálculo linear.
  
  const nightStart = 22 * 60; // 1320
  const nightEnd = 29 * 60;   // 1740 (05:00 do dia seguinte)

  // Ajuste para turnos que cruzam a meia-noite
  let adjustedEnd = end;
  if (end < start) adjustedEnd += 1440;

  // Interseção do período [start, adjustedEnd] com [nightStart, nightEnd]
  const intersectionStart = Math.max(start, nightStart);
  const intersectionEnd = Math.min(adjustedEnd, nightEnd);

  const nightMinutes = Math.max(0, intersectionEnd - intersectionStart);
  
  // Também precisamos checar a janela noturna do INÍCIO do dia (00:00 - 05:00)
  const earlyNightStart = 0;
  const earlyNightEnd = 5 * 60; // 300
  
  const earlyIntersectionStart = Math.max(start, earlyNightStart);
  const earlyIntersectionEnd = Math.min(adjustedEnd, earlyNightEnd);
  
  const earlyNightMinutes = Math.max(0, earlyIntersectionEnd - earlyIntersectionStart);

  return nightMinutes + earlyNightMinutes;
}

export interface PontoResult {
  totalWorked: number;
  nightMinutesFicta: number;
  overtimeNormal: number;
  overtime100: number;
  balance: number;
}

/**
 * Lógica principal de cálculo diário.
 */
export function calculateDay(
  entries: (string | null)[],
  exits: (string | null)[],
  isHolidayOrSunday: boolean = false,
  dailyWorkHours: number = JORNADA_PADRAO_MINUTOS,
  isExtra: boolean = false
): PontoResult {
  let totalMinutes = 0;
  let nightMinutesRaw = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = timeToMinutes(entries[i]);
    const exit = timeToMinutes(exits[i]);

    if (entry !== null && exit !== null) {
      const duration = exit < entry ? (exit + 1440) - entry : exit - entry;
      totalMinutes += duration;
      nightMinutesRaw += calculateNightMinutes(entry, exit < entry ? exit + 1440 : exit);
    }
  }

  // Aplicação da hora ficta noturna: 
  // O trabalhador ganha o adicional de tempo (fator 1.1428)
  const nightMinutesFicta = Math.round(nightMinutesRaw * (FATOR_NOTURNO - 1));
  const totalWithFicta = totalMinutes + nightMinutesFicta;

  const effectiveDailyWorkHours = isExtra ? 0 : dailyWorkHours;
  const balance = totalWithFicta - effectiveDailyWorkHours;
  
  let overtimeNormal = 0;
  let overtime100 = 0;

  if (balance > 0) {
    if (isHolidayOrSunday) {
      overtime100 = balance;
    } else {
      overtimeNormal = balance;
    }
  }

  return {
    totalWorked: totalWithFicta,
    nightMinutesFicta,
    overtimeNormal,
    overtime100,
    balance
  };
}
