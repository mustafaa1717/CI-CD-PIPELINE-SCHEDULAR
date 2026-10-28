const http = require('http');

const payload = JSON.stringify({
  ref: 'refs/heads/main',
  after: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
  repository: {
    name: 'demo-backend',
    full_name: 'mustafaa1717/demo-backend',
    clone_url: 'https://github.com/mustafaa1717/demo-backend.git'
  },
  pusher: {
    name: 'mustafaa1717'
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/webhooks/github',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-github-event': 'push',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('Simulating GitHub Push Webhook...');

const req = http.request(options, res => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', error => {
  console.error('Error:', error.message);
});

req.write(payload);
req.end();
