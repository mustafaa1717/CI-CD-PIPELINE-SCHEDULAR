require('dotenv').config();
const axios = require('axios');
const { getSystemInfo } = require('./system-info');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api/runners';
let runnerId = null;
let status = 'IDLE';
let currentTask = null;

async function registerRunner() {
  try {
    const sysInfo = await getSystemInfo();
    console.log(`Registering runner with backend...`);
    console.log(`Detected resources: ${sysInfo.cpuCores} Cores, ${sysInfo.memoryMB} MB RAM, Docker: ${sysInfo.docker}`);
    
    const response = await axios.post(`${BACKEND_URL}/register`, sysInfo);
    runnerId = response.data.runnerId;
    console.log(`Successfully registered! Runner ID: ${runnerId}, Name: ${response.data.name}`);
    
    // Start heartbeat loop
    setInterval(sendHeartbeat, 10000); // every 10 seconds
  } catch (error) {
    console.error('Failed to register runner:', error.message);
    // Retry registration
    setTimeout(registerRunner, 5000);
  }
}

async function sendHeartbeat() {
  if (!runnerId) return;
  
  try {
    await axios.post(`${BACKEND_URL}/${runnerId}/heartbeat`, {
      status,
      currentTask
    });
    console.log(`Heartbeat sent. Status: ${status}`);
  } catch (error) {
    console.error('Failed to send heartbeat:', error.message);
  }
}

// Start
console.log('Starting Runner Agent...');
registerRunner();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down runner gracefully...');
  // Optional: could send an OFFLINE status to backend here synchronously if we wanted
  process.exit();
});
