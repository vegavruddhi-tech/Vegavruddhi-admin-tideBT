const http = require('http');

http.get('http://localhost:5001/api/fund-transfer', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Endpoint response success:', parsed.success);
      console.log('Transfers count:', parsed.transfers?.length);
      if (parsed.transfers?.length > 0) {
        console.log('Sample transfer:', parsed.transfers[0]);
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e.message);
      console.log('Raw response:', data.slice(0, 500));
    }
  });
}).on('error', (err) => {
  console.error('Endpoint request failed:', err.message);
});
