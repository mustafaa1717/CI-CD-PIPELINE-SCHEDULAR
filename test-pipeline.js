const http = require('http');

function makeRequest(path, method = 'POST') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  try {
    console.log('1. Setting up Demo Project and Pipeline...');
    const setupRes = await makeRequest('/api/pipelines/setup-demo');
    console.log('Pipeline created with ID:', setupRes.pipelineId);
    
    console.log('\n2. Triggering Pipeline Run...');
    const runRes = await makeRequest(`/api/pipelines/${setupRes.pipelineId}/run`);
    console.log('Success! Pipeline Run started:', runRes.runId);
    
    console.log('\n>>> Look at your Backend Scheduler terminal! It will start assigning the dependencies in order: install -> build -> test -> deploy');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runTest();
