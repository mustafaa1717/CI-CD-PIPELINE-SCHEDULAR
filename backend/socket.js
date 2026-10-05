const { Server } = require('socket.io');
const Runner = require('./models/Runner');
const Task = require('./models/Task');

let io = null;

// Map runnerId (string) -> socket.id
const runnerSockets = new Map();
// Map socket.id -> runnerId (string)
const socketToRunner = new Map();

/**
 * Initialize Socket.io on the HTTP server
 * @param {import('http').Server} server
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // --- Runner Registration ---
    socket.on('runner:register', async (data, callback) => {
      try {
        const { name, hostname, cpuCores, memoryMB, gpu, docker, capabilities } = data;

        let runner = await Runner.findOne({ name });
        if (runner) {
          runner.cpuCapacity = cpuCores;
          runner.memoryCapacity = memoryMB;
          runner.gpuAvailable = gpu || false;
          runner.dockerAvailable = docker || false;
          runner.capabilities = capabilities || [];
          runner.status = 'IDLE';
          runner.lastHeartbeat = Date.now();
          await runner.save();
        } else {
          runner = new Runner({
            name,
            hostname,
            cpuCapacity: cpuCores,
            memoryCapacity: memoryMB,
            gpuAvailable: gpu || false,
            dockerAvailable: docker || false,
            capabilities: capabilities || [],
            status: 'IDLE'
          });
          await runner.save();
        }

        const runnerIdStr = runner._id.toString();
        runnerSockets.set(runnerIdStr, socket.id);
        socketToRunner.set(socket.id, runnerIdStr);
        socket.join(`runner:${runnerIdStr}`);

        console.log(`[Socket] Runner registered: ${runner.name} (${runnerIdStr}) on socket ${socket.id}`);

        const responsePayload = {
          message: 'Runner registered via WebSocket',
          runnerId: runner._id,
          name: runner.name
        };

        if (typeof callback === 'function') {
          callback(responsePayload);
        } else {
          socket.emit('runner:registered', responsePayload);
        }

        // Broadcast runner status change to any connected dashboards
        io.emit('runner:status_changed', {
          runnerId: runner._id,
          name: runner.name,
          status: 'IDLE'
        });
      } catch (err) {
        console.error('[Socket] Error in runner:register:', err);
        if (typeof callback === 'function') callback({ error: 'Registration failed' });
      }
    });

    // --- Runner Heartbeat ---
    socket.on('runner:heartbeat', async (data) => {
      try {
        const runnerId = socketToRunner.get(socket.id) || data.runnerId;
        if (!runnerId) return;

        await Runner.findByIdAndUpdate(runnerId, {
          lastHeartbeat: Date.now(),
          status: data.status || 'IDLE',
          currentTask: data.currentTask || null
        });
      } catch (err) {
        console.error('[Socket] Error in runner:heartbeat:', err);
      }
    });

    // --- Task Started ---
    socket.on('task:started', async ({ taskId, runnerId }) => {
      try {
        console.log(`[Socket] Task ${taskId} started by runner ${runnerId}`);
        await Task.findByIdAndUpdate(taskId, {
          status: 'RUNNING',
          startedAt: Date.now()
        });

        io.emit('task:status_changed', {
          taskId,
          runnerId,
          status: 'RUNNING'
        });
      } catch (err) {
        console.error('[Socket] Error in task:started:', err);
      }
    });

    // --- Live Task Log Streaming ---
    socket.on('task:log', async ({ taskId, runnerId, stream, data }) => {
      try {
        // Broadcast streaming log chunk to real-time dashboard listeners
        io.emit('task:log', { taskId, runnerId, stream, data });
      } catch (err) {
        console.error('[Socket] Error in task:log:', err);
      }
    });

    // --- Task Result Submission ---
    socket.on('task:result', async (resultData, callback) => {
      try {
        const { taskId, runnerId, exitCode, durationMs, stdout, stderr, success } = resultData;
        const status = success ? 'SUCCESS' : 'FAILED';
        const logs = `--- STDOUT ---\n${stdout || ''}\n--- STDERR ---\n${stderr || ''}`;

        console.log(`[Socket] Task ${taskId} completed with status: ${status} (exitCode: ${exitCode})`);

        await Task.findByIdAndUpdate(taskId, {
          status,
          exitCode,
          durationMs,
          logs,
          completedAt: Date.now()
        });

        // Free runner
        await Runner.findByIdAndUpdate(runnerId, {
          status: 'IDLE',
          currentTask: null,
          lastHeartbeat: Date.now()
        });

        // Notify UI/dashboards
        io.emit('task:status_changed', {
          taskId,
          runnerId,
          status,
          exitCode,
          durationMs
        });

        io.emit('runner:status_changed', {
          runnerId,
          status: 'IDLE'
        });

        if (typeof callback === 'function') {
          callback({ message: 'Result acknowledged' });
        }
      } catch (err) {
        console.error('[Socket] Error in task:result:', err);
        if (typeof callback === 'function') callback({ error: 'Failed to save result' });
      }
    });

    // --- Disconnect Handler ---
    socket.on('disconnect', async (reason) => {
      const runnerId = socketToRunner.get(socket.id);
      if (runnerId) {
        console.log(`[Socket] Runner ${runnerId} disconnected (${reason})`);
        runnerSockets.delete(runnerId);
        socketToRunner.delete(socket.id);

        try {
          const runner = await Runner.findById(runnerId);
          if (runner) {
            runner.status = 'OFFLINE';
            await runner.save();

            // If it was executing a task, mark it failed so it does not hang forever
            if (runner.currentTask) {
              await Task.findByIdAndUpdate(runner.currentTask, {
                status: 'FAILED',
                logs: 'Task failed due to runner disconnection.',
                completedAt: Date.now()
              });
              io.emit('task:status_changed', {
                taskId: runner.currentTask,
                status: 'FAILED',
                reason: 'Runner disconnected'
              });
            }

            io.emit('runner:status_changed', {
              runnerId,
              name: runner.name,
              status: 'OFFLINE'
            });
          }
        } catch (dbErr) {
          console.error('[Socket] Error handling runner disconnect in DB:', dbErr);
        }
      } else {
        console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
      }
    });
  });

  return io;
}

/**
 * Check if a runner is currently connected via WebSocket and assign a task to it.
 * @param {string} runnerId 
 * @param {Object} task 
 * @returns {boolean} True if pushed via WebSocket, false if runner is not connected via WS
 */
function assignTaskToRunner(runnerId, task) {
  if (!io) return false;
  const socketId = runnerSockets.get(runnerId.toString());
  if (socketId) {
    console.log(`[Socket] Pushing task ${task.name} directly to runner ${runnerId} over WebSocket`);
    io.to(socketId).emit('task:assign', {
      _id: task._id,
      name: task.name,
      command: task.command,
      image: task.image,
      requiredCpus: task.requiredCpus,
      requiredMemoryMB: task.requiredMemoryMB,
      pipelineRunId: task.pipelineRunId
    });
    return true;
  }
  return false;
}

/**
 * Broadcast general events to connected clients/dashboards
 */
function broadcast(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

function getIO() {
  return io;
}

function getConnectedRunnerIds() {
  return Array.from(runnerSockets.keys());
}

function isRunnerConnected(runnerId) {
  return runnerSockets.has(runnerId.toString());
}

module.exports = {
  initSocket,
  assignTaskToRunner,
  broadcast,
  getIO,
  getConnectedRunnerIds,
  isRunnerConnected
};
