import { drizzle } from "drizzle-orm/d1";
import * as cheerio from 'cheerio';

export async function onRequestGet(context: any) {
  try {
    const matricula = '109194'; 
    const url = 'https://webapp.confianca.com.br/consultaponto/ponto.aspx';

    const initialResponse = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    if (!initialResponse.ok) throw new Error("Falha no acesso inicial ao site da empresa.");

    const rawCookies = initialResponse.headers.get('set-cookie') || '';
    const sessionCookie = rawCookies ? rawCookies.split(',').map(c => c.split(';')[0]).join('; ') : '';

    const initialHtml = await initialResponse.text();
    const $initial = cheerio.load(initialHtml);

    const viewState = $initial('input[name="__VIEWSTATE"]').val() as string;
    const viewStateGenerator = $initial('input[name="__VIEWSTATEGENERATOR"]').val() as string;
    const eventValidation = $initial('input[name="__EVENTVALIDATION"]').val() as string;

    const formData = new URLSearchParams();
    formData.append('__VIEWSTATE', viewState);
    if (viewStateGenerator) formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
    if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);
    formData.append('txtMatricula', matricula);
    formData.append('btnConsultar', 'Consultar');

    const postResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': sessionCookie
      },
      body: formData.toString()
    });

    const finalHtml = await postResponse.text();
    
    return new Response(finalHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error: any) {
    return Response.json({ error: "Erro", details: error.message }, { status: 500 });
  }
}
