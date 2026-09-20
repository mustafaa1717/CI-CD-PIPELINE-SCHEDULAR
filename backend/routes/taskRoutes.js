const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Runner = require('../models/Runner');

// Create a new task (For us to test manually)
router.post('/', async (req, res) => {
  try {
    const { name, command, image } = req.body;
    const task = new Task({ name, command, image, status: 'QUEUED' });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Runner polls for a task
router.get('/next/:runnerId', async (req, res) => {
  try {
    const { runnerId } = req.params;
    
    // In Phase 4, the Scheduler will assign tasks. 
    // For Phase 2, the runner just grabs the first QUEUED task.
    const task = await Task.findOneAndUpdate(
      { status: 'QUEUED' },
      { 
        $set: { 
          status: 'RUNNING', 
          assignedRunner: runnerId,
          startedAt: Date.now()
        } 
      },
      { new: true, sort: { createdAt: 1 } }
    );
    
    if (task) {
      // Also mark runner as BUSY
      await Runner.findByIdAndUpdate(runnerId, { status: 'BUSY', currentTask: task._id });
      return res.status(200).json(task);
    }
    
    res.status(204).send(); // No tasks available
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch next task' });
  }
});

// Runner submits task result
router.post('/:taskId/result', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { exitCode, durationMs, stdout, stderr, success, runnerId } = req.body;
    
    const status = success ? 'SUCCESS' : 'FAILED';
    const logs = `--- STDOUT ---\n${stdout}\n--- STDERR ---\n${stderr}`;
    
    await Task.findByIdAndUpdate(taskId, {
      status,
      exitCode,
      durationMs,
      logs,
      completedAt: Date.now()
    });
    
    // Free the runner
    await Runner.findByIdAndUpdate(runnerId, { status: 'IDLE', currentTask: null });
    
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
