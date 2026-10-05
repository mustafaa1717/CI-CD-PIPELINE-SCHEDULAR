require('dotenv').config();
const { io } = require('socket.io-client');
const axios = require('axios');
const { getSystemInfo } = require('./system-info');
const { runInDocker } = require('./docker-executor');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api';
const SOCKET_URL = process.env.SOCKET_URL || BACKEND_URL.replace(/\/api\/?$/, '');

let runnerId = null;
let status = 'IDLE';
let currentTask = null; // Stores task ID
let runnerConfig = null;
let socket = null;
let isConnectedWs = false;

async function executeTask(task) {
  console.log(`\n>>> Received Task: ${task.name} (${task._id})`);
  console.log(`>>> Command: ${task.command}`);

  status = 'BUSY';
  currentTask = task._id;

  if (isConnectedWs && socket) {
    socket.emit('task:started', { taskId: task._id, runnerId });
  }

  // Execute the task with resource limits and real-time streaming log callback
  const result = await runInDocker(
    task.image,
    task.command,
    runnerConfig.cpuCores,
    runnerConfig.memoryMB,
    task.pipelineRunId, // Added for Artifact Passing!
    (logChunk) => {
      if (isConnectedWs && socket) {
        socket.emit('task:log', { taskId: task._id, runnerId, ...logChunk });
      }
    }
  );

  console.log(`<<< Task Completed. Success: ${result.success}, ExitCode: ${result.exitCode}, Duration: ${result.durationMs}ms`);

  // Submit result via WebSocket if connected, otherwise via HTTP fallback
  if (isConnectedWs && socket) {
    socket.emit('task:result', {
      ...result,
      taskId: task._id,
      runnerId
    });
  } else {
    try {
      await axios.post(`${BACKEND_URL}/tasks/${task._id}/result`, {
        ...result,
        runnerId
      });
    } catch (err) {
      console.error('Failed to submit result via HTTP:', err.message);
    }
  }

  status = 'IDLE';
  currentTask = null;
}

async function startRunner() {
  try {
    const sysInfo = await getSystemInfo();
    runnerConfig = sysInfo;
    console.log('Starting Runner Agent...');
    console.log(`Allocated resources: ${sysInfo.cpuCores} Cores, ${sysInfo.memoryMB} MB RAM, Docker: ${sysInfo.docker}`);

    // Connect via WebSocket
    console.log(`Connecting to WebSocket server at ${SOCKET_URL}...`);
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      console.log(`Connected to WebSocket gateway (${socket.id}). Registering...`);
      isConnectedWs = true;
      socket.emit('runner:register', sysInfo);
    });

    socket.on('runner:registered', (data) => {
      runnerId = data.runnerId;
      console.log(`Successfully registered via WebSocket! Runner ID: ${runnerId}, Name: ${data.name}`);
    });

    // Real-time task dispatch directly from Backend Scheduler
    socket.on('task:assign', async (task) => {
      if (status !== 'IDLE') {
        console.warn(`[Warning] Task assigned while busy. Ignoring task ${task._id}`);
        return;
      }
      await executeTask(task);
    });

    socket.on('disconnect', (reason) => {
      console.log(`Disconnected from WebSocket (${reason}).`);
      isConnectedWs = false;
    });

    socket.on('connect_error', (error) => {
      console.log(`WebSocket connection error: ${error.message}.`);
      isConnectedWs = false;
    });

    // Periodic heartbeat to refresh MongoDB runner status
    setInterval(() => {
      if (isConnectedWs && socket && runnerId) {
        socket.emit('runner:heartbeat', { runnerId, status, currentTask });
      }
    }, 10000);

    // Fallback polling (active only if WebSocket is disconnected)
    setInterval(pollForTasksFallback, 5000);

  } catch (error) {
    console.error('Failed to start runner:', error.message);
    setTimeout(startRunner, 5000);
  }
}

async function pollForTasksFallback() {
  // Only fallback to HTTP if WebSocket is not connected and runner is registered & idle
  if (isConnectedWs || !runnerId || status !== 'IDLE') return;

  try {
    const response = await axios.get(`${BACKEND_URL}/tasks/next/${runnerId}`);
    if (response.status === 200 && response.data) {
      await executeTask(response.data);
    }
  } catch (error) {
    // Ignore polling errors in fallback mode
  }
}

// Start Runner
startRunner();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down runner gracefully...');
  if (socket) {
    socket.disconnect();
  }
  process.exit();
});
