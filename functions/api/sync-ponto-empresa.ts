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
        const punchesDoDia: string[] = [];

        $2('#Grid tr, table tr').each((index, element) => {
          const textoLinha = $2(element).text().replace(/\s+/g, ' ').trim();
          const matchesHorario = textoLinha.match(/([0-2]?\d:[0-5]\d)/g);
          
          if (matchesHorario) {
            matchesHorario.forEach(h => {
              let [hora, min] = h.split(':');
              const hFormatada = `${hora.padStart(2, '0')}:${min}`;
              if (!punchesDoDia.includes(hFormatada)) punchesDoDia.push(hFormatada);
            });
          }
        });

        if (punchesDoDia.length > 0) {
          mapaMarcacoes.set(rowDate, punchesDoDia);
        }
      } catch (err) {
        console.error(`Erro ao buscar dia ${dayInfo.day}:`, err);
      }
    };

    // Executar em lotes (batches) de 5 para não sobrecarregar
    const batchSize = 5;
    for (let i = 0; i < daysToFetch.length; i += batchSize) {
      const batch = daysToFetch.slice(i, i + batchSize);
      await Promise.all(batch.map(dayInfo => fetchDay(dayInfo)));
    }

    // 4. Transformar e Guardar no DB
    // 1. Ordenar as marcações de cada dia primeiro
    for (const [date, punches] of mapaMarcacoes.entries()) {
      punches.sort();
    }

    // 2. Corrigir marcações de virada de noite (Move Backward)
    // Fazemos isso PRIMEIRO para que batidas de saída de madrugada voltem para o dia correto
    const sortedDatesForBackward = Array.from(mapaMarcacoes.keys()).sort();
    
    for (let i = 0; i < sortedDatesForBackward.length; i++) {
      const currentDate = sortedDatesForBackward[i];
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

        // 1. Tentar obter as marcações do dia anterior (do mapa ou do DB)
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

        // 2. Aplicar a regra de Interjornada (11 horas)
        // Se o intervalo entre a última marcação de ontem e a primeira de hoje for < 11h, 
        // então a primeira de hoje é continuação de ontem (virada de noite).
        if (prevPunches.length > 0) {
          const lastPunchPrevDay = prevPunches[prevPunches.length - 1];
          const [h1, m1] = firstPunch.split(':').map(Number);
          const [hL, mL] = lastPunchPrevDay.split(':').map(Number);
          
          const minsFirst = h1 * 60 + m1;
          const minsLast = hL * 60 + mL;
          
          // Gap = (tempo até meia-noite de ontem) + (tempo desde meia-noite de hoje)
          const gap = (1440 - minsLast) + minsFirst;
          
          if (gap < 660) { // 11 horas = 660 minutos
            belongsToPreviousDay = true;
          }
        } else {
          // Se não temos dados de ontem, usamos uma heurística conservadora:
          // Só consideramos virada de noite se for MUITO cedo (ex: antes das 04:00)
          // e houver um gap grande para a próxima marcação do próprio dia (> 6h)
          if (firstPunch < '04:00') {
            if (currentPunches.length > 1) {
              const secondPunch = currentPunches[1];
              const [h1, m1] = firstPunch.split(':').map(Number);
              const [h2, m2] = secondPunch.split(':').map(Number);
              if ((h2 * 60 + m2) - (h1 * 60 + m1) > 360) {
                belongsToPreviousDay = true;
              }
            } else {
              belongsToPreviousDay = true;
            }
          }
        }

        if (belongsToPreviousDay) {
          const orphanedPunch = currentPunches.shift()!;
          prevPunches.push(orphanedPunch);
          // Não ordenamos aqui para manter a sequência cronológica (a saída da madrugada fica por último)
          mapaMarcacoes.set(prevDateStr, prevPunches);
          mapaMarcacoes.set(currentDate, currentPunches);
        }
      }
    }

    // 3. Regra de Interjornada (Move Forward): 
    // Se um dia tem uma marcação muito distante da anterior (> 11h), 
    // essa marcação e as seguintes pertencem ao próximo dia.
    // Fazemos isso DEPOIS para separar jornadas que o site da empresa agrupou erroneamente
    const datesForForward = Array.from(mapaMarcacoes.keys()).sort();
    for (const date of datesForForward) {
      const punches = mapaMarcacoes.get(date)!;
      if (punches.length < 2) continue;
      
      for (let i = 1; i < punches.length; i++) {
        const [hPrev, mPrev] = punches[i-1].split(':').map(Number);
        const [hCurr, mCurr] = punches[i].split(':').map(Number);
        const minsPrev = hPrev * 60 + mPrev;
        const minsCurr = hCurr * 60 + mCurr;
        
        if (minsCurr - minsPrev > 660) { // Gap > 11 horas
          const movedPunches = punches.splice(i);
          const [year, month, day] = date.split('-').map(Number);
          const nextDateObj = new Date(year, month - 1, day);
          nextDateObj.setDate(nextDateObj.getDate() + 1);
          const nextDateStr = `${nextDateObj.getFullYear()}-${String(nextDateObj.getMonth() + 1).padStart(2, '0')}-${String(nextDateObj.getDate()).padStart(2, '0')}`;
          
          const existingNext = mapaMarcacoes.get(nextDateStr) || [];
          mapaMarcacoes.set(nextDateStr, Array.from(new Set([...movedPunches, ...existingNext])).sort());
          break; 
        }
      }
    }

    let savedCount = 0;
    const dbErrors: string[] = [];
    for (const [date, punches] of Array.from(mapaMarcacoes.entries())) {
      // Não ordenamos novamente aqui, pois já foi ordenado no início e as madrugadas foram jogadas pro final
      const marcacao: any = {
        matricula: matricula,
        date: date,
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
          entry_1: marcacao.entry_1, exit_1: marcacao.exit_1,
          entry_2: marcacao.entry_2, exit_2: marcacao.exit_2,
          entry_3: marcacao.entry_3, exit_3: marcacao.exit_3,
          entry_4: marcacao.entry_4, exit_4: marcacao.exit_4,
          entry_5: marcacao.entry_5, exit_5: marcacao.exit_5
        }).onConflictDoUpdate({
          target: [timeEntries.matricula, timeEntries.date],
          set: {
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
