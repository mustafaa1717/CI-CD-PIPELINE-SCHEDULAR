const mongoose = require('mongoose');
const Task = require('./models/Task');
const Runner = require('./models/Runner');
const { assignTaskToRunner, broadcast, getConnectedRunnerIds } = require('./socket');
const { checkAndUpdatePipelineRun } = require('./utils/pipelineManager');

let isScheduling = false;
let queuedSchedule = false;

async function runScheduler() {
  if (isScheduling) {
    queuedSchedule = true;
    return;
  }
  isScheduling = true;

  try {
    // 0. HEALTH CHECK & GHOST RUNNER CLEANUP:
    // Mark any runner as OFFLINE if its heartbeat is older than 25 seconds
    const staleThreshold = new Date(Date.now() - 25000);
    const staleRunners = await Runner.find({
      status: { $in: ['IDLE', 'BUSY'] },
      lastHeartbeat: { $lt: staleThreshold }
    });

    if (staleRunners.length > 0) {
      for (const r of staleRunners) {
        r.status = 'OFFLINE';
        r.usedCpus = 0;
        r.usedMemoryMB = 0;
        r.activeTasks = [];
        r.currentTask = null;
        await r.save();
        broadcast('runner:status_changed', {
          runnerId: r._id,
          name: r.name,
          status: 'OFFLINE',
          usedCpus: 0,
          usedMemoryMB: 0
        });
      }
    }

    // AUTO-RECOVERY: If any task is stuck in QUEUED or RUNNING on an OFFLINE runner, reset it to READY
    const offlineRunners = await Runner.find({ status: 'OFFLINE' }).select('_id');
    const offlineRunnerIds = offlineRunners.map(r => r._id);
    if (offlineRunnerIds.length > 0) {
      const recovered = await Task.updateMany(
        { status: { $in: ['QUEUED', 'RUNNING'] }, assignedRunner: { $in: offlineRunnerIds } },
        { status: 'READY', assignedRunner: null }
      );
      if (recovered.modifiedCount > 0) {
        console.log(`[Scheduler] Auto-recovered ${recovered.modifiedCount} task(s) from offline runners.`);
      }
    }

    // 1. Resolve Dependencies (WAITING -> READY or BLOCKED)
    const waitingTasks = await Task.find({ status: 'WAITING' }).populate('dependsOn');
    for (const task of waitingTasks) {
      if (!task.dependsOn || task.dependsOn.length === 0) {
        task.status = 'READY';
        await task.save();
        console.log(`[Scheduler] Task "${task.name}" is now READY (no dependencies)`);
        broadcast('task:status_changed', { taskId: task._id, status: 'READY' });
        continue;
      }
      
      let allDependenciesMet = true;
      let anyDependencyFailed = false;

      for (const dep of task.dependsOn) {
        if (dep.status === 'FAILED' || dep.status === 'BLOCKED') {
          anyDependencyFailed = true;
          break;
        }
        if (dep.status !== 'SUCCESS') {
          allDependenciesMet = false;
        }
      }

      if (anyDependencyFailed) {
        task.status = 'BLOCKED';
        await task.save();
        console.log(`[Scheduler] Task "${task.name}" is BLOCKED due to failed dependencies.`);
        broadcast('task:status_changed', { taskId: task._id, status: 'BLOCKED' });
        // Check if this failure causes the parent pipeline to terminate
        await checkAndUpdatePipelineRun(task.pipelineRunId);
      } else if (allDependenciesMet) {
        task.status = 'READY';
        await task.save();
        console.log(`[Scheduler] Task "${task.name}" is now READY.`);
        broadcast('task:status_changed', { taskId: task._id, status: 'READY' });
      }
    }

    // 2. Assign READY tasks to eligible runners with Multi-Task Resource Awareness
    const readyTasks = await Task.find({ status: 'READY' }).sort({ createdAt: 1 });
    const liveConnectedRunnerIds = getConnectedRunnerIds();

    if (readyTasks.length > 0 && liveConnectedRunnerIds.length === 0) {
      // Waiting for runners to connect
      return;
    }

    for (const task of readyTasks) {
      const liveObjectIds = liveConnectedRunnerIds.map(id => {
        try { return new mongoose.Types.ObjectId(id); } catch (e) { return id; }
      });

      // Find all live runners that are not OFFLINE
      const activeRunners = await Runner.find({
        _id: { $in: liveObjectIds },
        status: { $in: ['IDLE', 'BUSY'] }
      });

      // Filter runners by remaining dynamic capacity (Multi-Task Concurrency)
      const eligibleRunners = activeRunners.filter(runner => {
        const availableCpus = runner.cpuCapacity - (runner.usedCpus || 0);
        const availableMemoryMB = runner.memoryCapacity - (runner.usedMemoryMB || 0);
        const reqCpus = task.requiredCpus || 1;
        const reqMem = task.requiredMemoryMB || 512;
        return availableCpus >= reqCpus && availableMemoryMB >= reqMem;
      });

      if (eligibleRunners.length > 0) {
        // Load balancing heuristic: Pick runner with greatest remaining CPU capacity
        eligibleRunners.sort((a, b) => {
          const remA = a.cpuCapacity - (a.usedCpus || 0);
          const remB = b.cpuCapacity - (b.usedCpus || 0);
          return remB - remA;
        });

        const selectedRunner = eligibleRunners[0];

        const reqCpus = task.requiredCpus || 1;
        const reqMem = task.requiredMemoryMB || 512;

        console.log(`\n[Scheduler] -----------------------------`);
        console.log(`[Scheduler] RESOURCE-AWARE TASK ASSIGNMENT:`);
        console.log(`[Scheduler] Task: "${task.name}" requires ${reqCpus} CPUs, ${reqMem} MB RAM`);
        console.log(`[Scheduler] Selected Runner: ${selectedRunner.name}`);
        console.log(`[Scheduler] Runner Capacity: ${selectedRunner.cpuCapacity} CPUs, ${selectedRunner.memoryCapacity} MB RAM`);
        console.log(`[Scheduler] Allocated: ${selectedRunner.usedCpus || 0} + ${reqCpus} CPUs | ${selectedRunner.usedMemoryMB || 0} + ${reqMem} MB RAM`);
        console.log(`[Scheduler] -----------------------------\n`);

        // Allocate resources
        selectedRunner.usedCpus = (selectedRunner.usedCpus || 0) + reqCpus;
        selectedRunner.usedMemoryMB = (selectedRunner.usedMemoryMB || 0) + reqMem;
        if (!selectedRunner.activeTasks) selectedRunner.activeTasks = [];
        selectedRunner.activeTasks.push(task._id);
        selectedRunner.status = 'BUSY';
        selectedRunner.currentTask = task._id.toString();
        await selectedRunner.save();

        // Update task
        task.status = 'QUEUED';
        task.assignedRunner = selectedRunner._id;
        await task.save();

        broadcast('task:status_changed', {
          taskId: task._id,
          status: 'QUEUED',
          runnerId: selectedRunner._id,
          runnerName: selectedRunner.name
        });

        broadcast('runner:status_changed', {
          runnerId: selectedRunner._id,
          name: selectedRunner.name,
          status: selectedRunner.status,
          usedCpus: selectedRunner.usedCpus,
          usedMemoryMB: selectedRunner.usedMemoryMB,
          cpuCapacity: selectedRunner.cpuCapacity,
          memoryCapacity: selectedRunner.memoryCapacity,
          activeTaskCount: selectedRunner.activeTasks.length
        });

        // Dispatch task immediately via WebSocket
        assignTaskToRunner(selectedRunner._id.toString(), task);
      }
    }

  } catch (error) {
    console.error('[Scheduler] Error in scheduling loop:', error);
  } finally {
    isScheduling = false;
    if (queuedSchedule) {
      queuedSchedule = false;
      setImmediate(runScheduler);
    }
  }
}

function startScheduler() {
  console.log('Starting Scheduler Engine...');
  setInterval(runScheduler, 3000); // Run every 3 seconds
}

module.exports = { startScheduler, runScheduler };
