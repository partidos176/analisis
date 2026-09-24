import fs from 'fs';
import http from 'http';

const boundary = '----TestBoundary123';
const fileData = fs.readFileSync('./.tmp-cortes/test.mp4');
const cortes = JSON.stringify([{time:'00:02',name:'test_corte'}]);

const parts = [
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="test.mp4"\r\nContent-Type: video/mp4\r\n\r\n`),
  fileData,
  Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="segundos"\r\n\r\n5`),
  Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="cortes"\r\n\r\n${cortes}`),
  Buffer.from(`\r\n--${boundary}--\r\n`)
];

const payload = Buffer.concat(parts);

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/cortar',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': payload.length
  }
}, res => {
  if (res.headers['content-type'] === 'application/zip') {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => {
      const zip = Buffer.concat(chunks);
      console.log('ZIP received:', zip.length, 'bytes');
      console.log('ZIP starts with:', zip.slice(0,4).toString('hex'));
    });
  } else {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log('Response:', res.statusCode, data));
  }
});

req.write(payload);
req.end();
