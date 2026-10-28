const http = require('http');

const data = JSON.stringify({
  name: 'heavy-build-job',
  command: 'echo "I need 4 Cores! Only Worker 2 can run me!"',
  image: 'ubuntu:latest',
  requiredCpus: 4,
  requiredMemoryMB: 1024
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/tasks',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`Task submitted. Status Code: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
