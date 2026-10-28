const express = require('express');
const router = express.Router();
const Runner = require('../models/Runner');
const { broadcast } = require('../socket');

// Register a new runner
router.post('/register', async (req, res) => {
  try {
    const { name, hostname, cpuCores, memoryMB, gpu, docker, capabilities } = req.body;
    
    // Check if runner already exists (using name as identifier)
    let runner = await Runner.findOne({ name });
    
    if (runner) {
      // Update existing runner
      runner.cpuCapacity = cpuCores;
      runner.memoryCapacity = memoryMB;
      runner.gpuAvailable = gpu;
      runner.dockerAvailable = docker;
      runner.capabilities = capabilities;
      runner.status = 'IDLE';
      runner.lastHeartbeat = Date.now();
      await runner.save();
    } else {
      // Create new runner
      runner = new Runner({
        name,
        hostname,
        cpuCapacity: cpuCores,
        memoryCapacity: memoryMB,
        gpuAvailable: gpu,
        dockerAvailable: docker,
        capabilities,
        status: 'IDLE'
      });
      await runner.save();
    }
    
    broadcast('runner:status_changed', {
      runnerId: runner._id,
      name: runner.name,
      status: 'IDLE'
    });

    res.status(201).json({ 
      message: 'Runner registered successfully', 
      runnerId: runner._id,
      name: runner.name 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register runner' });
  }
});

// Heartbeat
router.post('/:runnerId/heartbeat', async (req, res) => {
  try {
    const { runnerId } = req.params;
    const { status, currentTask } = req.body;
    
    const runner = await Runner.findById(runnerId);
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found' });
    }
    
    runner.lastHeartbeat = Date.now();
    if (status) runner.status = status;
    if (currentTask !== undefined) runner.currentTask = currentTask;
    
    await runner.save();
    
    res.status(200).json({ message: 'Heartbeat received' });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

// Get all runners (for dashboard)
router.get('/', async (req, res) => {
  try {
    // Optionally check heartbeats and mark offline
    const timeoutThreshold = new Date(Date.now() - 30 * 1000); // 30 seconds
    await Runner.updateMany(
      { lastHeartbeat: { $lt: timeoutThreshold }, status: { $ne: 'OFFLINE' } },
      { $set: { status: 'OFFLINE' } }
    );
    
    const runners = await Runner.find().sort({ createdAt: -1 });
    res.status(200).json(runners);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch runners' });
  }
});

module.exports = router;
