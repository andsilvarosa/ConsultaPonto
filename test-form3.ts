import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://webapp.confianca.com.br/consultaponto/ponto.aspx';
  const initialResponse = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await initialResponse.text();
  const $ = cheerio.load(html);
  
  console.log($('form').html());
}

test();
