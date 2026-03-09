import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://webapp.confianca.com.br/consultaponto/ponto.aspx';
  const initialResponse = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await initialResponse.text();
  const $ = cheerio.load(html);
  
  const inputs: any[] = [];
  $('input').each((i, el) => {
    inputs.push({
      name: $(el).attr('name'),
      id: $(el).attr('id'),
      type: $(el).attr('type'),
      value: $(el).attr('value')
    });
  });
  
  console.log(JSON.stringify(inputs, null, 2));
}

test();
