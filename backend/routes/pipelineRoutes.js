const express = require('express');
const router = express.Router();
const yaml = require('js-yaml');
const Project = require('../models/Project');
const Pipeline = require('../models/Pipeline');
const PipelineRun = require('../models/PipelineRun');
const Task = require('../models/Task');
const User = require('../models/User');

// Trigger a pipeline run
router.post('/:pipelineId/run', async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const pipeline = await Pipeline.findById(pipelineId);
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    // Parse YAML
    const parsedYaml = yaml.load(pipeline.yamlDefinition);
    
    // Create PipelineRun
    const pipelineRun = new PipelineRun({
      pipelineId: pipeline._id,
      projectId: pipeline.projectId,
      status: 'RUNNING'
    });
    await pipelineRun.save();

    // Map to track created tasks so we can resolve dependencies
    const taskMap = {}; // { "taskName": TaskObject }
    const createdTasks = [];

    // First pass: Create all tasks in WAITING state
    for (const taskDef of parsedYaml.pipeline.tasks) {
      const task = new Task({
        name: taskDef.name,
        command: taskDef.command,
        image: taskDef.image || 'ubuntu:latest',
        requiredCpus: taskDef.cpus || 1,
        requiredMemoryMB: taskDef.memoryMB || 512,
        pipelineRunId: pipelineRun._id,
        status: 'WAITING'
      });
      await task.save();
      taskMap[taskDef.name] = task;
      createdTasks.push({ def: taskDef, dbTask: task });
    }

    // Second pass: Wire up dependencies
    for (const item of createdTasks) {
      const { def, dbTask } = item;
      if (def.dependsOn && def.dependsOn.length > 0) {
        const depIds = [];
        for (const depName of def.dependsOn) {
          if (taskMap[depName]) {
            depIds.push(taskMap[depName]._id);
          }
        }
        dbTask.dependsOn = depIds;
        await dbTask.save();
      }
    }

    // Link tasks to pipeline run
    pipelineRun.tasks = createdTasks.map(t => t.dbTask._id);
    await pipelineRun.save();

    res.status(201).json({ message: 'Pipeline Run started', runId: pipelineRun._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to run pipeline' });
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
      command: echo "Running Frontend tests..." && sleep 5
      dependsOn:
        - build
      cpus: 2
    - name: test-backend
      command: echo "Running Backend tests..." && sleep 5
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
      // Fallback: Retrieve the authenticated user from MongoDB
      authUser = await User.findOne().sort({ _id: -1 });
    }

    if (!authUser || !authUser.accessToken) {
      console.warn('[Webhook] No GitHub user account found in database. Please log in via GitHub first.');
    } else if (!process.env.NGROK_URL) {
      console.warn('[Webhook] NGROK_URL not configured in backend/.env.');
    } else {
      try {
        // Parse "https://github.com/owner/repo.git" or "https://github.com/owner/repo/" -> "owner/repo"
        const cleanUrl = repository.trim().replace(/\/+$/, '').replace(/\.git$/, '');
        const match = cleanUrl.match(/github\.com[/:]([^/]+\/[^/]+)/);
        const repoPath = match ? match[1] : cleanUrl.replace(/^https?:\/\/github\.com\//, '');
        
        console.log(`[Webhook] Using token for user "${authUser.username}" to create webhook on "${repoPath}"...`);
        
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
              url: `${process.env.NGROK_URL}/api/webhooks/github`,
              content_type: 'json',
              insecure_ssl: '0'
            }
          })
        });
        
        if (githubRes.ok) {
          console.log('[Webhook] Successfully attached webhook to GitHub repository!');
        } else {
          const errData = await githubRes.json();
          const errStr = JSON.stringify(errData);
          if (errStr.includes('Hook already exists') || errStr.includes('already exists')) {
            console.log('[Webhook] Webhook is already installed and active on GitHub for this repository!');
          } else {
            console.error('[Webhook] GitHub rejected webhook creation:', errData.message || errData);
          }
        }
      } catch (webhookErr) {
        console.error('[Webhook] Error making GitHub API request:', webhookErr.message);
      }
    }

    res.json({ message: 'Custom setup complete', pipelineId: pipeline._id });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed custom setup' });
  }
});

module.exports = router;
