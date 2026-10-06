require('dotenv').config();
const { io } = require('socket.io-client');
const axios = require('axios');
const { getSystemInfo } = require('./system-info');
const { runInDocker, cleanupWorkspaceVolume } = require('./docker-executor');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api';
const SOCKET_URL = process.env.SOCKET_URL || BACKEND_URL.replace(/\/api\/?$/, '');

let runnerId = null;
let status = 'IDLE';
let runnerConfig = null;
let socket = null;
let isConnectedWs = false;

// Concurrent active tasks tracking
const activeTasks = new Map();

async function executeTask(task) {
  const taskIdStr = task._id.toString();
  activeTasks.set(taskIdStr, task);
  status = 'BUSY';

  console.log(`\n>>> [Task Starting] ${task.name} (${taskIdStr}) [Active Tasks: ${activeTasks.size}]`);
  console.log(`>>> Command: ${task.command}`);
  console.log(`>>> Allocation: ${task.requiredCpus || 1} CPU(s), ${task.requiredMemoryMB || 512} MB`);

  if (isConnectedWs && socket) {
    socket.emit('task:started', { taskId: task._id, runnerId });
  }

  // Execute the task in Docker container with resource constraints & volume passing
  const taskCpus = task.requiredCpus || 1;
  const taskMemory = task.requiredMemoryMB || 512;

  const result = await runInDocker(
    task.image,
    task.command,
    taskCpus,
    taskMemory,
    task.pipelineRunId,
    (logChunk) => {
      if (isConnectedWs && socket) {
        socket.emit('task:log', { taskId: task._id, runnerId, ...logChunk });
      }
    }
  );

  console.log(`<<< [Task Completed] ${task.name}: Success=${result.success}, ExitCode=${result.exitCode}, Duration=${result.durationMs}ms`);

  // Submit result via WebSocket or fallback to HTTP
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
      console.error('Failed to submit result via HTTP fallback:', err.message);
    }
  }

  // Clean up local task tracker
  activeTasks.delete(taskIdStr);
  status = activeTasks.size > 0 ? 'BUSY' : 'IDLE';
  console.log(`[Runner Status] Now ${status} (${activeTasks.size} active tasks remaining)`);
}

async function startRunner() {
  try {
    const sysInfo = await getSystemInfo();
    runnerConfig = sysInfo;
    console.log('==============================================');
    console.log(`🚀 Starting Runner Agent: ${sysInfo.name}`);
    console.log(`💻 Allocated: ${sysInfo.cpuCores} Cores, ${sysInfo.memoryMB} MB RAM, Docker: ${sysInfo.docker}`);
    console.log('==============================================');

    // Connect via WebSocket
    console.log(`Connecting to WebSocket server at ${SOCKET_URL}...`);
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      console.log(`Connected to WebSocket gateway (${socket.id}). Registering runner...`);
      isConnectedWs = true;
      socket.emit('runner:register', sysInfo);
    });

    socket.on('runner:registered', (data) => {
      runnerId = data.runnerId;
      console.log(`✅ Successfully registered via WebSocket! Runner ID: ${runnerId}, Name: ${data.name}`);
    });

    // Real-time task dispatch directly from Backend Scheduler (Multi-task concurrent handler)
    socket.on('task:assign', (task) => {
      const taskIdStr = task._id.toString();
      if (activeTasks.has(taskIdStr)) {
        console.warn(`[Runner] Task "${task.name}" (${taskIdStr}) is already actively executing. Ignoring duplicate assignment.`);
        return;
      }
      console.log(`[Runner] Received task assignment: "${task.name}" (${taskIdStr})`);
      // Run asynchronously without blocking the event loop for other tasks
      executeTask(task).catch(err => {
        console.error(`[Runner Error] Error executing task ${task.name}:`, err.message);
      });
    });

    // Workspace volume cleanup handler triggered when pipeline completes
    socket.on('pipeline:cleanup_workspace', async ({ pipelineRunId }) => {
      console.log(`🧹 Received cleanup instruction for pipeline run workspace: ${pipelineRunId}`);
      await cleanupWorkspaceVolume(pipelineRunId);
    });

    socket.on('disconnect', (reason) => {
      console.log(`Disconnected from WebSocket (${reason}).`);
      isConnectedWs = false;
    });

    socket.on('connect_error', (error) => {
      console.log(`WebSocket connection error: ${error.message}. Retrying...`);
      isConnectedWs = false;
    });

    // Periodic heartbeat to refresh runner status
    setInterval(() => {
      if (isConnectedWs && socket && runnerId) {
        socket.emit('runner:heartbeat', {
          runnerId,
          status,
          activeTaskCount: activeTasks.size,
          activeTaskIds: Array.from(activeTasks.keys())
        });
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
  if (isConnectedWs || !runnerId) return;

  try {
    const response = await axios.get(`${BACKEND_URL}/tasks/next/${runnerId}`);
    if (response.status === 200 && response.data) {
      executeTask(response.data).catch(err => {
        console.error('Error executing task from fallback:', err);
      });
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
