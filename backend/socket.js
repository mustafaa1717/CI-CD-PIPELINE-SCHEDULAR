const { Server } = require('socket.io');
const Runner = require('./models/Runner');
const Task = require('./models/Task');
const { checkAndUpdatePipelineRun } = require('./utils/pipelineManager');

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
          runner.hostname = hostname || runner.hostname;
          runner.cpuCapacity = cpuCores;
          runner.memoryCapacity = memoryMB;
          runner.usedCpus = 0;
          runner.usedMemoryMB = 0;
          runner.activeTasks = [];
          runner.gpuAvailable = gpu || false;
          runner.dockerAvailable = docker || false;
          runner.capabilities = capabilities || [];
          runner.status = 'IDLE';
          runner.lastHeartbeat = Date.now();
          await runner.save();
        } else {
          runner = new Runner({
            name,
            hostname: hostname || 'unknown-host',
            cpuCapacity: cpuCores,
            memoryCapacity: memoryMB,
            usedCpus: 0,
            usedMemoryMB: 0,
            activeTasks: [],
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

        // Broadcast runner status change to connected dashboards
        io.emit('runner:status_changed', {
          runnerId: runner._id,
          name: runner.name,
          status: 'IDLE',
          cpuCapacity: runner.cpuCapacity,
          memoryCapacity: runner.memoryCapacity,
          usedCpus: 0,
          usedMemoryMB: 0,
          activeTaskCount: 0
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

        const updateData = {
          lastHeartbeat: Date.now()
        };
        if (data.status) updateData.status = data.status;
        if (data.currentTask !== undefined) updateData.currentTask = data.currentTask;

        await Runner.findByIdAndUpdate(runnerId, updateData);
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

        console.log(`[Socket] Task ${taskId} completed with status: ${status} (exitCode: ${exitCode}) in ${durationMs}ms`);

        const updatedTask = await Task.findByIdAndUpdate(taskId, {
          status,
          exitCode,
          durationMs,
          logs,
          completedAt: Date.now()
        }, { returnDocument: 'after' });

        // Dynamic resource release for runner (Multi-Task Concurrency)
        const runner = await Runner.findById(runnerId);
        if (runner) {
          const reqCpus = updatedTask?.requiredCpus || 1;
          const reqMem = updatedTask?.requiredMemoryMB || 512;

          runner.usedCpus = Math.max(0, (runner.usedCpus || 0) - reqCpus);
          runner.usedMemoryMB = Math.max(0, (runner.usedMemoryMB || 0) - reqMem);
          runner.activeTasks = (runner.activeTasks || []).filter(id => id.toString() !== taskId.toString());
          runner.status = runner.activeTasks.length > 0 ? 'BUSY' : 'IDLE';
          runner.currentTask = runner.activeTasks.length > 0 ? runner.activeTasks[0].toString() : null;
          runner.lastHeartbeat = Date.now();
          await runner.save();

          io.emit('runner:status_changed', {
            runnerId: runner._id,
            name: runner.name,
            status: runner.status,
            usedCpus: runner.usedCpus,
            usedMemoryMB: runner.usedMemoryMB,
            cpuCapacity: runner.cpuCapacity,
            memoryCapacity: runner.memoryCapacity,
            activeTaskCount: runner.activeTasks.length
          });
        }

        // Notify UI/dashboards of task completion
        io.emit('task:status_changed', {
          taskId,
          runnerId,
          status,
          exitCode,
          durationMs
        });

        if (typeof callback === 'function') {
          callback({ message: 'Result acknowledged' });
        }

        // Check if PipelineRun is now complete (SUCCESS or FAILED) and trigger volume cleanup
        if (updatedTask && updatedTask.pipelineRunId) {
          await checkAndUpdatePipelineRun(updatedTask.pipelineRunId);
        }

        // Instantly trigger scheduler loop so other queued/waiting tasks can claim released runner slots
        const { runScheduler } = require('./scheduler');
        runScheduler();

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
            runner.usedCpus = 0;
            runner.usedMemoryMB = 0;
            const orphanedTasks = runner.activeTasks || [];
            runner.activeTasks = [];
            runner.currentTask = null;
            await runner.save();

            // Mark any orphaned tasks as FAILED
            if (orphanedTasks.length > 0) {
              for (const oTaskId of orphanedTasks) {
                const failedTask = await Task.findByIdAndUpdate(oTaskId, {
                  status: 'FAILED',
                  logs: 'Task failed due to runner disconnection.',
                  completedAt: Date.now()
                }, { returnDocument: 'after' });

                io.emit('task:status_changed', {
                  taskId: oTaskId,
                  status: 'FAILED',
                  reason: 'Runner disconnected'
                });

                if (failedTask && failedTask.pipelineRunId) {
                  await checkAndUpdatePipelineRun(failedTask.pipelineRunId);
                }
              }
            }

            io.emit('runner:status_changed', {
              runnerId,
              name: runner.name,
              status: 'OFFLINE',
              usedCpus: 0,
              usedMemoryMB: 0,
              activeTaskCount: 0
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
    console.log(`[Socket] Pushing task "${task.name}" directly to runner ${runnerId} over WebSocket`);
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
