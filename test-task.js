const http = require('http');

const data = JSON.stringify({
  name: 'hello-world',
  command: 'echo "Hello from Docker! The runner executed me!"',
  image: 'ubuntu:latest'
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
