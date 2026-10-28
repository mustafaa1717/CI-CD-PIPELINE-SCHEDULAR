const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Pipeline = require('../models/Pipeline');
const PipelineRun = require('../models/PipelineRun');
const Task = require('../models/Task');
const User = require('../models/User');
const { validateAndParseDAG } = require('../utils/dagValidator');
const { runScheduler } = require('../scheduler');

// Validate YAML without saving or running
router.post('/validate', (req, res) => {
  const { yamlDefinition } = req.body;
  const validation = validateAndParseDAG(yamlDefinition);
  if (!validation.isValid) {
    return res.status(400).json({ isValid: false, error: validation.error });
  }
  res.json(validation);
});

// Trigger a pipeline run
router.post('/:pipelineId/run', async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const pipeline = await Pipeline.findById(pipelineId);
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    // Validate DAG and detect cycles
    const validation = validateAndParseDAG(pipeline.yamlDefinition);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    // Create PipelineRun
    const pipelineRun = new PipelineRun({
      pipelineId: pipeline._id,
      projectId: pipeline.projectId,
      status: 'RUNNING',
      startedAt: new Date()
    });
    await pipelineRun.save();

    const mongoose = require('mongoose');
    // Pre-allocate ObjectIds for all tasks so dependencies are wired BEFORE saving to DB
    const idMap = new Map();
    for (const taskDef of validation.tasks) {
      idMap.set(taskDef.name, new mongoose.Types.ObjectId());
    }

    const taskDocs = validation.tasks.map(taskDef => {
      const depIds = (taskDef.dependsOn || [])
        .map(depName => idMap.get(depName))
        .filter(Boolean);

      return {
        _id: idMap.get(taskDef.name),
        name: taskDef.name,
        command: taskDef.command,
        image: taskDef.image || 'ubuntu:latest',
        requiredCpus: taskDef.cpus || 1,
        requiredMemoryMB: taskDef.memoryMB || 512,
        stageLevel: taskDef.stageLevel || 0,
        pipelineRunId: pipelineRun._id,
        dependsOn: depIds,
        status: 'WAITING'
      };
    });

    // Atomic DB insert: Tasks enter MongoDB ALREADY having their dependencies wired
    await Task.insertMany(taskDocs);

    // Link tasks to pipeline run
    pipelineRun.tasks = taskDocs.map(t => t._id);
    await pipelineRun.save();

    // Instantly trigger scheduler loop
    runScheduler();

    res.status(201).json({
      message: 'Pipeline Run started',
      runId: pipelineRun._id,
      totalStages: validation.totalStages,
      topologicalOrder: validation.topologicalOrder
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to run pipeline: ' + err.message });
  }
});

// Setup dummy project and pipeline (for testing)
router.post('/setup-demo', async (req, res) => {
  try {
    const project = new Project({
      name: 'demo-backend',
      repository: 'https://github.com/mustafaa1717/demo-backend.git'
    });
    await project.save();

    const yamlDef = `
pipeline:
  name: demo-ci-cd
  tasks:
    - name: install
      command: echo "Installing dependencies..." && sleep 2
      cpus: 1
    - name: build
      command: echo "Building project..." && sleep 2
      dependsOn:
        - install
      cpus: 2
    - name: test-frontend
      command: echo "Running Frontend tests..." && sleep 4
      dependsOn:
        - build
      cpus: 2
    - name: test-backend
      command: echo "Running Backend tests..." && sleep 4
      dependsOn:
        - build
      cpus: 2
    - name: deploy
      command: echo "Deploying to prod!" && sleep 2
      dependsOn:
        - test-frontend
        - test-backend
      cpus: 1
    `;

    const validation = validateAndParseDAG(yamlDef);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    const pipeline = new Pipeline({
      name: 'demo-ci-cd',
      projectId: project._id,
      yamlDefinition: yamlDef.trim()
    });
    await pipeline.save();

    res.json({ message: 'Demo setup complete', pipelineId: pipeline._id });
  } catch(err) {
    res.status(500).json({ error: 'Failed demo setup' });
  }
});

// Setup a CUSTOM project and pipeline (from React Frontend)
router.post('/setup-custom', async (req, res) => {
  try {
    const { name, repository, yamlDefinition } = req.body;

    // Validate DAG & detect cycles BEFORE saving!
    const validation = validateAndParseDAG(yamlDefinition);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    const project = new Project({
      name: name,
      repository: repository
    });
    await project.save();

    const pipeline = new Pipeline({
      name: name + '-pipeline',
      projectId: project._id,
      yamlDefinition: yamlDefinition
    });
    await pipeline.save();

    // WEBHOOK AUTOMATION: If user is logged in (or saved in DB), attach the webhook to GitHub!
    let authUser = req.user;
    if (!authUser || !authUser.accessToken) {
      authUser = await User.findOne().sort({ _id: -1 });
    }

    if (!authUser || !authUser.accessToken) {
      console.warn('[Webhook] No GitHub user account found in database. Please log in via GitHub first.');
    } else if (!process.env.NGROK_URL) {
      console.warn('[Webhook] NGROK_URL not configured in backend/.env.');
    } else {
      try {
        const cleanUrl = repository.trim().replace(/\/+$/, '').replace(/\.git$/, '');
        const match = cleanUrl.match(/github\.com[/:]([^/]+\/[^/]+)/);
        const repoPath = match ? match[1] : cleanUrl.replace(/^https?:\/\/github\.com\//, '');
        
        console.log(`[Webhook] Checking and updating webhook on "${repoPath}" for user "${authUser.username}"...`);
        const targetWebhookUrl = `${process.env.NGROK_URL}/api/webhooks/github`;
        
        const listHooksRes = await fetch(`https://api.github.com/repos/${repoPath}/hooks`, {
          headers: {
            'Authorization': `Bearer ${authUser.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CI-CD-Scheduler'
          }
        });

        let existingHook = null;
        if (listHooksRes.ok) {
          const hooks = await listHooksRes.json();
          existingHook = Array.isArray(hooks) && hooks.find(h => 
            h.config && h.config.url && h.config.url.includes('/api/webhooks/github')
          );
        }

        if (existingHook) {
          console.log(`[Webhook] Found old webhook (ID: ${existingHook.id}). Removing old hook...`);
          await fetch(`https://api.github.com/repos/${repoPath}/hooks/${existingHook.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authUser.accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'CI-CD-Scheduler'
            }
          });
        }

        console.log(`[Webhook] Creating fresh webhook pointing to ${targetWebhookUrl}...`);
        const githubRes = await fetch(`https://api.github.com/repos/${repoPath}/hooks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authUser.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'CI-CD-Scheduler'
          },
          body: JSON.stringify({
            name: 'web',
            active: true,
            events: ['push'],
            config: {
              url: targetWebhookUrl,
              content_type: 'json',
              insecure_ssl: '0'
            }
          })
        });
        
        if (githubRes.ok) {
          console.log(`[Webhook] Successfully installed fresh webhook pointing to ${targetWebhookUrl}!`);
        } else {
          const errData = await githubRes.json();
          console.error('[Webhook] GitHub rejected webhook creation:', errData.message || errData);
        }
      } catch (webhookErr) {
        console.error('[Webhook] Error setting up GitHub webhook:', webhookErr.message);
      }
    }

    res.json({
      message: 'Custom setup complete',
      pipelineId: pipeline._id,
      totalStages: validation.totalStages,
      topologicalOrder: validation.topologicalOrder
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed custom setup: ' + err.message });
  }
});

// Get the latest pipeline run with populated tasks
router.get('/runs/latest', async (req, res) => {
  try {
    const latestRun = await PipelineRun.findOne()
      .sort({ createdAt: -1 })
      .populate('pipelineId')
      .populate({
        path: 'tasks',
        populate: [
          { path: 'assignedRunner', select: 'name hostname' },
          { path: 'dependsOn', select: 'name status' }
        ]
      });

    if (!latestRun) {
      return res.status(404).json({ message: 'No pipeline runs found' });
    }

    res.json(latestRun);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch latest pipeline run' });
  }
});

// Get a specific pipeline run by ID
router.get('/runs/:runId', async (req, res) => {
  try {
    const run = await PipelineRun.findById(req.params.runId)
      .populate('pipelineId')
      .populate({
        path: 'tasks',
        populate: [
          { path: 'assignedRunner', select: 'name hostname' },
          { path: 'dependsOn', select: 'name status' }
        ]
      });

    if (!run) {
      return res.status(404).json({ error: 'Pipeline run not found' });
    }

    res.json(run);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pipeline run' });
  }
});

module.exports = router;
