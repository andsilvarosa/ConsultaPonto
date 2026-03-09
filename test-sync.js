const fetch = require('node-fetch');

async function test() {
  const res = await fetch('http://localhost:3000/api/sync-ponto-empresa', {
    method: 'POST',
    headers: {
      'x-matricula': '123456',
      'x-debug-inputs': 'true'
    }
  });
  const data = await res.json();
  console.log(data);
}

test();
