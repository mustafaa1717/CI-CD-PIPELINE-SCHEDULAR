const Task = require('./models/Task');
const Runner = require('./models/Runner');
const { assignTaskToRunner, broadcast } = require('./socket');

async function runScheduler() {
  try {
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
    
    for (const task of readyTasks) {
      // Find eligible runners: ONLINE/IDLE, sufficient capacity
      // BEST-FIT ALGORITHM: Sort eligible runners by smallest available CPU and Memory first
      // This ensures we don't waste massive servers on tiny tasks.
      const eligibleRunners = await Runner.find({
        status: 'IDLE',
        cpuCapacity: { $gte: task.requiredCpus },
        memoryCapacity: { $gte: task.requiredMemoryMB }
      }).sort({ cpuCapacity: 1, memoryCapacity: 1 });

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

module.exports = { startScheduler };
