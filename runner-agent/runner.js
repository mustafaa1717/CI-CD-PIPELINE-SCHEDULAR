require('dotenv').config();
const axios = require('axios');
const { getSystemInfo } = require('./system-info');
const { runInDocker } = require('./docker-executor');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api';
let runnerId = null;
let status = 'IDLE';
let currentTask = null; // Stores task ID
let runnerConfig = null;

async function registerRunner() {
  try {
    const sysInfo = await getSystemInfo();
    runnerConfig = sysInfo;
    console.log(`Registering runner with backend...`);
    console.log(`Allocated resources: ${sysInfo.cpuCores} Cores, ${sysInfo.memoryMB} MB RAM, Docker: ${sysInfo.docker}`);
    
    const response = await axios.post(`${BACKEND_URL}/runners/register`, sysInfo);
    runnerId = response.data.runnerId;
    console.log(`Successfully registered! Runner ID: ${runnerId}, Name: ${response.data.name}`);
    
    // Start heartbeat loop
    setInterval(sendHeartbeat, 10000); // every 10 seconds
    // Start polling for tasks
    setInterval(pollForTasks, 5000); // every 5 seconds
  } catch (error) {
    console.error('Failed to register runner:', error.message);
    // Retry registration
    setTimeout(registerRunner, 5000);
  }
}

async function sendHeartbeat() {
  if (!runnerId) return;
  
  try {
    await axios.post(`${BACKEND_URL}/runners/${runnerId}/heartbeat`, {
      status,
      currentTask
    });
    console.log(`Heartbeat sent. Status: ${status}`);
  } catch (error) {
    console.error('Failed to send heartbeat:', error.message);
  }
}

async function pollForTasks() {
  // Only ask for a task if we are IDLE
  if (!runnerId || status !== 'IDLE') return;

  try {
    const response = await axios.get(`${BACKEND_URL}/tasks/next/${runnerId}`);
    
    // 204 No Content means no tasks available
    if (response.status === 200 && response.data) {
      const task = response.data;
      console.log(`\n>>> Received Task: ${task.name} (${task._id})`);
      console.log(`>>> Command: ${task.command}`);
      
      status = 'BUSY';
      currentTask = task._id;
      
      // Execute the task with resource limits
      const result = await runInDocker(task.image, task.command, runnerConfig.cpuCores, runnerConfig.memoryMB);
      
      console.log(`<<< Task Completed. Success: ${result.success}, ExitCode: ${result.exitCode}, Duration: ${result.durationMs}ms`);
      
      // Submit result
      await axios.post(`${BACKEND_URL}/tasks/${task._id}/result`, {
        ...result,
        runnerId
      });
      
      status = 'IDLE';
      currentTask = null;
    }
  } catch (error) {
    console.error('Error polling for tasks:', error.message);
  }
}

// Start
console.log('Starting Runner Agent...');
registerRunner();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down runner gracefully...');
  process.exit();
});
