import { timeEntries } from "../../src/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as cheerio from 'cheerio';

export async function onRequestPost(context: any) {
  if (!context.env.DB || typeof context.env.DB.prepare !== 'function') {
    return Response.json({ 
      error: "D1 Database binding missing or invalid", 
      details: `A vinculação 'DB' não foi encontrada ou é inválida (tipo: ${typeof context.env.DB}). Certifique-se de que você adicionou uma 'D1 Database Binding' com o nome 'DB' (e não uma variável de ambiente comum) no painel do Cloudflare e que fez um novo deploy.` 
    }, { status: 500 });
  }

  const matricula = context.request.headers.get('x-matricula');
  if (!matricula) return Response.json({ error: "Matrícula não informada" }, { status: 400 });

  const db = drizzle(context.env.DB);

  try {
    const url = 'https://webapp.confianca.com.br/consultaponto/ponto.aspx';

    // 1. GET Inicial e Captura de Cookies da Sessão
    const initialResponse = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    if (!initialResponse.ok) throw new Error("Falha no acesso inicial ao site da empresa.");

    let rawCookies: string[] = [];
    if (typeof initialResponse.headers.getSetCookie === 'function') {
      rawCookies = initialResponse.headers.getSetCookie();
    } else {
      const cookieHeader = initialResponse.headers.get('set-cookie');
      if (cookieHeader) {
        // Fallback for environments without getSetCookie
        // Note: This might break if cookies have commas in their Expires dates,
        // but it's better than nothing.
        rawCookies = cookieHeader.split(',').filter(c => !c.trim().startsWith('expires=') && !c.trim().startsWith('Expires='));
      }
    }
    const sessionCookie = rawCookies.map(c => c.split(';')[0]).join('; ');

    const initialHtml = await initialResponse.text();
    const $initial = cheerio.load(initialHtml);

    const viewState = $initial('input[name="__VIEWSTATE"]').val() as string;
    const viewStateGenerator = $initial('input[name="__VIEWSTATEGENERATOR"]').val() as string;
    const eventValidation = $initial('input[name="__EVENTVALIDATION"]').val() as string;

    if (!viewState) return Response.json({ error: "ViewState não encontrado." }, { status: 500 });

    // 2. Extrair dias do mês atual até hoje
    const todayStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const today = new Date(todayStr);
    const currentDay = today.getDate();
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const currentMonthName = meses[today.getMonth()];

    const daysToFetch: { arg: string, day: number, monthName: string }[] = [];
    $initial('#Calendar a').each((i, el) => {
      const href = $initial(el).attr('href');
      const title = $initial(el).attr('title');
      if (href && href.includes("__doPostBack('Calendar'")) {
        const match = href.match(/'Calendar','(\d+)'/);
        if (match && title) {
          const arg = match[1];
          const parts = title.split(' de ');
          if (parts.length >= 2) {
            const day = parseInt(parts[0]);
            const monthName = parts[1].toLowerCase();
            if (monthName === currentMonthName && day <= currentDay) {
              daysToFetch.push({ arg, day, monthName });
            }
          }
        }
      }
    });

    const mapaMarcacoes: Map<string, any> = new Map();

    // Função auxiliar para buscar um dia específico
    const fetchDay = async (dayInfo: { arg: string, day: number, monthName: string }) => {
      try {
        // 2.1 Selecionar o dia
        const formData1 = new URLSearchParams();
        formData1.append('__EVENTTARGET', 'Calendar');
        formData1.append('__EVENTARGUMENT', dayInfo.arg);
        formData1.append('__VIEWSTATE', viewState);
        if (viewStateGenerator) formData1.append('__VIEWSTATEGENERATOR', viewStateGenerator);
        if (eventValidation) formData1.append('__EVENTVALIDATION', eventValidation);
        formData1.append('txtMatricula', matricula);

        const postResponse1 = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Cookie': sessionCookie
          },
          body: formData1.toString()
        });

        const html1 = await postResponse1.text();
        const $1 = cheerio.load(html1);

        const viewState1 = $1('input[name="__VIEWSTATE"]').val() as string;
        const viewStateGenerator1 = $1('input[name="__VIEWSTATEGENERATOR"]').val() as string;
        const eventValidation1 = $1('input[name="__EVENTVALIDATION"]').val() as string;

        // 2.2 Clicar em Consultar
        const formData2 = new URLSearchParams();
        formData2.append('__EVENTTARGET', 'btnConsultar');
        formData2.append('__EVENTARGUMENT', '');
        formData2.append('__VIEWSTATE', viewState1);
        if (viewStateGenerator1) formData2.append('__VIEWSTATEGENERATOR', viewStateGenerator1);
        if (eventValidation1) formData2.append('__EVENTVALIDATION', eventValidation1);
        formData2.append('txtMatricula', matricula);

        const postResponse2 = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Cookie': sessionCookie
          },
          body: formData2.toString()
        });

        const finalHtml = await postResponse2.text();
        const $2 = cheerio.load(finalHtml);

        // 2.3 Extrair os dados da tabela
        const rowDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(dayInfo.day).padStart(2, '0')}`;
        const punchesDoDia: string[] = mapaMarcacoes.get(rowDate) || [];

        // Procurar a tabela de horários (geralmente a que contém o cabeçalho "Horário")
        let foundHorarioHeader = false;
        
        $2('tr').each((index, element) => {
          const rowText = $2(element).text().trim().toLowerCase();
          
          // Se encontrarmos o cabeçalho, as próximas linhas são dados
          // Usamos includes para ser mais flexível com espaços ou caracteres extras
          if (!foundHorarioHeader && (rowText.includes('horário') || rowText.includes('horario'))) {
            foundHorarioHeader = true;
            return;
          }

          if (!foundHorarioHeader) return;

          // Ignorar linhas de resumo
          if (rowText.includes('total') || rowText.includes('saldo') || rowText.includes('débito') || rowText.includes('crédito') || rowText.includes('horas')) {
            return;
          }

          const matchesHorario = rowText.match(/([0-2]?\d:[0-5]\d)/g);
          
          if (matchesHorario) {
            matchesHorario.forEach(h => {
              let [hora, min] = h.split(':');
              const hFormatada = `${hora.padStart(2, '0')}:${min}`;
              
              // Se a batida é de madrugada (antes das 03:00), ela pertence ao dia anterior
              // Isso resolve a "Regra de Linhas" de forma mais robusta que contando índices
              if (hFormatada < '03:00') {
                const prevDate = new Date(today.getFullYear(), today.getMonth(), dayInfo.day - 1);
                const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
                
                const prevPunches = mapaMarcacoes.get(prevDateStr) || [];
                if (!prevPunches.includes(hFormatada)) {
                  prevPunches.push(hFormatada);
                  prevPunches.sort();
                  mapaMarcacoes.set(prevDateStr, prevPunches);
                }
              } else {
                // Adiciona ao dia atual
                if (!punchesDoDia.includes(hFormatada)) {
                  punchesDoDia.push(hFormatada);
                }
              }
            });
          }
        });

        mapaMarcacoes.set(rowDate, punchesDoDia);
      } catch (err) {
        console.error(`Erro ao buscar dia ${dayInfo.day}:`, err);
      }
    };

    // Executar SEQUENCIALMENTE para evitar race conditions no Map ao mover batidas de madrugada
    for (const dayInfo of daysToFetch) {
      await fetchDay(dayInfo);
    }

    // 4. Transformar e Guardar no DB
    // 1. Ordenar as marcações de cada dia (Standard sort para a lógica de move backward)
    for (const [date, punches] of mapaMarcacoes.entries()) {
      punches.sort();
    }

    const sortedDates = Array.from(mapaMarcacoes.keys()).sort();

    // 3. Corrigir marcações de virada de noite (Move Backward)
    // Esta lógica é uma segunda camada de segurança para batidas que não foram capturadas pela regra das 03:00 AM
    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = sortedDates[i];
      const currentPunches = mapaMarcacoes.get(currentDate)!;
      
      if (currentPunches.length === 0) continue;
      
      const firstPunch = currentPunches[0];
      
      // Se a primeira marcação for de madrugada/manhã (antes das 10:00)
      if (firstPunch < '10:00') {
        const [year, month, day] = currentDate.split('-').map(Number);
        const currDateObj = new Date(year, month - 1, day);
        currDateObj.setDate(currDateObj.getDate() - 1);
        const prevDateStr = `${currDateObj.getFullYear()}-${String(currDateObj.getMonth() + 1).padStart(2, '0')}-${String(currDateObj.getDate()).padStart(2, '0')}`;
        
        let prevPunches: string[] = [];
        let belongsToPreviousDay = false;

        if (mapaMarcacoes.has(prevDateStr)) {
          prevPunches = [...mapaMarcacoes.get(prevDateStr)!];
        } else {
          try {
            const existing = await db.select().from(timeEntries).where(and(eq(timeEntries.matricula, matricula), eq(timeEntries.date, prevDateStr))).limit(1);
            if (existing.length > 0) {
              const row = existing[0] as any;
              const cols = ['entry_1', 'exit_1', 'entry_2', 'exit_2', 'entry_3', 'exit_3', 'entry_4', 'exit_4', 'entry_5', 'exit_5'];
              for (const col of cols) {
                if (row[col]) prevPunches.push(row[col] as string);
              }
            }
          } catch (e) {
            console.error("Erro ao buscar dia anterior do DB:", e);
          }
        }

        if (prevPunches.length > 0) {
          const lastPunchPrevDay = prevPunches[prevPunches.length - 1];
          const [h1, m1] = firstPunch.split(':').map(Number);
          const [hL, mL] = lastPunchPrevDay.split(':').map(Number);
          
          const minsFirst = h1 * 60 + m1;
          const minsLast = hL * 60 + mL;
          const gap = (1440 - minsLast) + minsFirst;
          
          const isPrevDayOpen = prevPunches.length % 2 !== 0;

          if (isPrevDayOpen) {
            // Se o dia anterior está "aberto" (ímpar), puxamos se o gap for < 11h (660 min)
            if (gap < 660) { 
              belongsToPreviousDay = true;
            }
          } else {
            // Se o dia anterior está "fechado" (par), puxamos se o gap for < 8h (480 min)
            // Aumentamos para 8h para cobrir saídas de madrugada mesmo com intervalos longos
            if (gap < 480) { 
              belongsToPreviousDay = true;
            }
          }
        }

        // REGRA DE OURO REFORÇADA: 
        // 1. Se a batida é de madrugada (até 05:00) e o intervalo para a próxima é > 11h, ELA É DE ONTEM.
        // 2. Se a batida é de madrugada (até 03:00) e não há outra batida no dia, ELA É DE ONTEM.
        if (!belongsToPreviousDay) {
          const [h1, m1] = firstPunch.split(':').map(Number);
          const minsFirst = h1 * 60 + m1;

          if (currentPunches.length > 1) {
            const secondPunch = currentPunches[1];
            const [h2, m2] = secondPunch.split(':').map(Number);
            const gapInterno = (h2 * 60 + m2) - minsFirst;
            
            // Se o intervalo para a próxima batida do dia é > 11h, a primeira é resíduo de ontem
            if (gapInterno > 660 && minsFirst < 300) { // Antes das 05:00
              belongsToPreviousDay = true;
            }
          } else if (minsFirst < 180) { // Antes das 03:00 (180 min) e única batida
            belongsToPreviousDay = true;
          }
        }

        // Se ainda assim a batida for antes das 03:00 e estiver sobrando, ela é de ontem
        if (!belongsToPreviousDay && firstPunch < '03:00') {
          belongsToPreviousDay = true;
        }

        if (belongsToPreviousDay) {
          const orphanedPunch = currentPunches.shift()!;
          // Evitar duplicatas ao mover
          if (!prevPunches.includes(orphanedPunch)) {
            prevPunches.push(orphanedPunch);
          }
          mapaMarcacoes.set(prevDateStr, prevPunches);
          mapaMarcacoes.set(currentDate, currentPunches);
        }
      }
    }

    // 4. Ordenação Final Inteligente (Regra: 16:00 < 01:00)
    for (const [date, punches] of mapaMarcacoes.entries()) {
      punches.sort((a, b) => {
        const getV = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return (h < 3 ? h + 24 : h) * 60 + m;
        };
        return getV(a) - getV(b);
      });
    }

    let savedCount = 0;
    const dbErrors: string[] = [];
    for (const [date, punches] of Array.from(mapaMarcacoes.entries())) {
      // Se não houver batidas, marcamos como extra para não gerar saldo negativo (folga)
      const isExtraDay = punches.length === 0;

      const marcacao: any = {
        matricula: matricula,
        date: date,
        is_extra: isExtraDay,
        entry_1: punches[0] || null, exit_1: punches[1] || null,
        entry_2: punches[2] || null, exit_2: punches[3] || null,
        entry_3: punches[4] || null, exit_3: punches[5] || null,
        entry_4: punches[6] || null, exit_4: punches[7] || null,
        entry_5: punches[8] || null, exit_5: punches[9] || null,
      };

      try {
        await db.insert(timeEntries).values({
          matricula,
          date: marcacao.date,
          is_extra: marcacao.is_extra,
          entry_1: marcacao.entry_1, exit_1: marcacao.exit_1,
          entry_2: marcacao.entry_2, exit_2: marcacao.exit_2,
          entry_3: marcacao.entry_3, exit_3: marcacao.exit_3,
          entry_4: marcacao.entry_4, exit_4: marcacao.exit_4,
          entry_5: marcacao.entry_5, exit_5: marcacao.exit_5
        }).onConflictDoUpdate({
          target: [timeEntries.matricula, timeEntries.date],
          set: {
            is_extra: marcacao.is_extra,
            entry_1: marcacao.entry_1, exit_1: marcacao.exit_1,
            entry_2: marcacao.entry_2, exit_2: marcacao.exit_2,
            entry_3: marcacao.entry_3, exit_3: marcacao.exit_3,
            entry_4: marcacao.entry_4, exit_4: marcacao.exit_4,
            entry_5: marcacao.entry_5, exit_5: marcacao.exit_5
          },
          setWhere: sql`time_entries.is_manual IS NOT TRUE`
        });
        savedCount++;
      } catch (e: any) {
        console.error("Erro ao guardar no DB:", e);
        dbErrors.push(e.message);
      }
    }

    if (savedCount === 0) {
      return Response.json({ 
        success: true, 
        count: savedCount, 
        dbErrors: dbErrors.slice(0, 5) // Return first 5 errors to avoid huge payloads
      });
    }

    return Response.json({ success: true, count: savedCount, dbErrors: dbErrors.length > 0 ? dbErrors.slice(0, 5) : undefined });
  } catch (error: any) {
    return Response.json({ error: "Erro no processamento do scraping", details: error.message }, { status: 500 });
  }
}
