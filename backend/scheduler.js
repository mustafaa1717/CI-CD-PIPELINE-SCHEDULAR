const Task = require('./models/Task');
const Runner = require('./models/Runner');
const { assignTaskToRunner, broadcast, getConnectedRunnerIds } = require('./socket');

async function runScheduler() {
  try {
    // 0. HEALTH CHECK & GHOST RUNNER CLEANUP:
    // Mark any runner as OFFLINE if its heartbeat is older than 25 seconds
    const staleThreshold = new Date(Date.now() - 25000);
    await Runner.updateMany(
      { status: { $in: ['IDLE', 'BUSY'] }, lastHeartbeat: { $lt: staleThreshold } },
      { status: 'OFFLINE' }
    );

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
        console.log(`[Scheduler] Task ${task.name} is now READY (no dependencies)`);
        continue;
      }
      
      let allDependenciesMet = true;
      let anyDependencyFailed = false;

      for (const dep of task.dependsOn) {
        if (dep.status === 'FAILED') {
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
        console.log(`[Scheduler] Task ${task.name} is BLOCKED due to failed dependencies.`);
      } else if (allDependenciesMet) {
        task.status = 'READY';
        await task.save();
        console.log(`[Scheduler] Task ${task.name} is now READY.`);
      }
    }

    // 2. Assign READY tasks to eligible runners (READY -> QUEUED)
    const readyTasks = await Task.find({ status: 'READY' }).sort({ createdAt: 1 });
    
    const mongoose = require('mongoose');
    // Get list of runner IDs actively connected via WebSocket right now
    const liveConnectedRunnerIds = getConnectedRunnerIds();

    for (const task of readyTasks) {
      // Find eligible runners: ONLINE/IDLE, sufficient capacity, AND actively connected to WebSocket
      const runnerQuery = {
        status: 'IDLE',
        cpuCapacity: { $gte: task.requiredCpus },
        memoryCapacity: { $gte: task.requiredMemoryMB }
      };

      if (liveConnectedRunnerIds.length > 0) {
        runnerQuery._id = { 
          $in: liveConnectedRunnerIds.map(id => {
            try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
          })
        };
      } else {
        // If no runners are currently connected via WebSocket, wait for one to connect
        console.log(`[Scheduler] Task "${task.name}" is READY, waiting for a runner to connect...`);
        continue;
      }

      const eligibleRunners = await Runner.find(runnerQuery).sort({ cpuCapacity: 1, memoryCapacity: 1 });

      if (eligibleRunners.length > 0) {
        // Simple selection: Pick the first eligible runner
        const selectedRunner = eligibleRunners[0];
        
        console.log(`\n[Scheduler] -----------------------------`);
        console.log(`[Scheduler] SCHEDULING DECISION MADE:`);
        console.log(`[Scheduler] Task: ${task.name} requires ${task.requiredCpus} CPUs, ${task.requiredMemoryMB} MB RAM`);
        console.log(`[Scheduler] Eligible Runners Found: ${eligibleRunners.length}`);
        console.log(`[Scheduler] Selected Runner: ${selectedRunner.name} (has ${selectedRunner.cpuCapacity} CPUs, ${selectedRunner.memoryCapacity} MB RAM)`);
        console.log(`[Scheduler] -----------------------------\n`);
        
        // Update task
        task.status = 'QUEUED';
        task.assignedRunner = selectedRunner._id;
        await task.save();
        
        // Update runner
        selectedRunner.status = 'BUSY';
        selectedRunner.currentTask = task._id;
        await selectedRunner.save();

        broadcast('task:status_changed', { taskId: task._id, status: 'QUEUED', runnerId: selectedRunner._id });
        broadcast('runner:status_changed', { runnerId: selectedRunner._id, status: 'BUSY' });

        // Push immediately if runner is connected via WebSocket
        assignTaskToRunner(selectedRunner._id.toString(), task);
      }
    }

  } catch (error) {
    console.error('[Scheduler] Error in scheduling loop:', error);
  }
}

function startScheduler() {
  console.log('Starting Scheduler Engine...');
  setInterval(runScheduler, 3000); // Run every 3 seconds
}

module.exports = { startScheduler, runScheduler };
