const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Runner = require('../models/Runner');
const { broadcast } = require('../socket');

// Create a new task (For us to test manually)
router.post('/', async (req, res) => {
  try {
    const { name, command, image, requiredCpus, requiredMemoryMB } = req.body;
    // Task starts as WAITING by default
    const task = new Task({ 
      name, 
      command, 
      image, 
      requiredCpus: requiredCpus || 1, 
      requiredMemoryMB: requiredMemoryMB || 512 
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Runner polls for its explicitly assigned task
router.get('/next/:runnerId', async (req, res) => {
  try {
    const { runnerId } = req.params;
    
    // The Scheduler Engine already set this task to QUEUED and assigned it to this runner.
    // The runner just claims it and marks it RUNNING.
    const task = await Task.findOneAndUpdate(
      { status: 'QUEUED', assignedRunner: runnerId },
      { 
        $set: { 
          status: 'RUNNING', 
          startedAt: Date.now()
        } 
      },
      { returnDocument: 'after', sort: { createdAt: 1 } }
    );
    
    if (task) {
      broadcast('task:status_changed', { taskId: task._id, runnerId, status: 'RUNNING' });
      return res.status(200).json(task);
    }
    
    res.status(204).send(); // No tasks available for me
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch next task' });
  }
});

// Runner submits task result (HTTP fallback)
router.post('/:taskId/result', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { exitCode, durationMs, stdout, stderr, success, runnerId } = req.body;
    const { checkAndUpdatePipelineRun } = require('../utils/pipelineManager');
    const { runScheduler } = require('../scheduler');
    
    const status = success ? 'SUCCESS' : 'FAILED';
    const logs = `--- STDOUT ---\n${stdout || ''}\n--- STDERR ---\n${stderr || ''}`;
    
    const updatedTask = await Task.findByIdAndUpdate(taskId, {
      status,
      exitCode,
      durationMs,
      logs,
      completedAt: Date.now()
    }, { returnDocument: 'after' });
    
    // Release runner resources dynamically
    const runner = await Runner.findById(runnerId);
    if (runner) {
      const reqCpus = updatedTask?.requiredCpus || 1;
      const reqMem = updatedTask?.requiredMemoryMB || 512;

      runner.usedCpus = Math.max(0, (runner.usedCpus || 0) - reqCpus);
      runner.usedMemoryMB = Math.max(0, (runner.usedMemoryMB || 0) - reqMem);
      runner.activeTasks = (runner.activeTasks || []).filter(id => id.toString() !== taskId.toString());
      runner.status = runner.activeTasks.length > 0 ? 'BUSY' : 'IDLE';
      runner.currentTask = runner.activeTasks.length > 0 ? runner.activeTasks[0].toString() : null;
      await runner.save();

      broadcast('runner:status_changed', {
        runnerId: runner._id,
        status: runner.status,
        usedCpus: runner.usedCpus,
        usedMemoryMB: runner.usedMemoryMB,
        activeTaskCount: runner.activeTasks.length
      });
    }

    broadcast('task:status_changed', { taskId, runnerId, status, exitCode, durationMs });
    
    if (updatedTask && updatedTask.pipelineRunId) {
      await checkAndUpdatePipelineRun(updatedTask.pipelineRunId);
    }

    runScheduler();

    res.status(200).json({ message: 'Result saved' });
  } catch (err) {
    console.error('Failed to save result:', err);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// Get all tasks (for dashboard)
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 }).populate('assignedRunner', 'name');
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

module.exports = router;
