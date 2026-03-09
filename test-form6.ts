import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://webapp.confianca.com.br/consultaponto/ponto.aspx';
  const initialResponse = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  
  const rawCookies = initialResponse.headers.get('set-cookie') || '';
  const sessionCookie = rawCookies ? rawCookies.split(',').map(c => c.split(';')[0]).join('; ') : '';
  
  const html = await initialResponse.text();
  const $ = cheerio.load(html);
  
  const viewState = $('input[name="__VIEWSTATE"]').val() as string;
  const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val() as string;
  const eventValidation = $('input[name="__EVENTVALIDATION"]').val() as string;
  
  const formData = new URLSearchParams();
  formData.append('__EVENTTARGET', 'btnConsultar');
  formData.append('__EVENTARGUMENT', '');
  formData.append('__VIEWSTATE', viewState);
  if (viewStateGenerator) formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
  if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);
  formData.append('txtMatricula', '109194');
  
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
  const $final = cheerio.load(finalHtml);
  
  console.log($final('#gridhora').html());
}

test();
