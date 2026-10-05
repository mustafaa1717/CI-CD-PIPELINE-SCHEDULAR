const express = require('express');
const router = express.Router();
const yaml = require('js-yaml');
const Project = require('../models/Project');
const Pipeline = require('../models/Pipeline');
const PipelineRun = require('../models/PipelineRun');
const Task = require('../models/Task');

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

    // WEBHOOK AUTOMATION: If user is logged in, attach the webhook to GitHub!
    if (req.user && req.user.accessToken && process.env.NGROK_URL) {
      try {
        // Parse "https://github.com/owner/repo.git" -> "owner/repo"
        const repoPath = repository.replace('https://github.com/', '').replace('.git', '');
        
        console.log(`[Webhook] Attempting to create webhook for ${repoPath}...`);
        
        const githubRes = await fetch(`https://api.github.com/repos/${repoPath}/hooks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${req.user.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
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
          console.error('[Webhook] Failed to attach webhook:', errData);
        }
      } catch (webhookErr) {
        console.error('[Webhook] Error making GitHub API request:', webhookErr);
      }
    }

    res.json({ message: 'Custom setup complete', pipelineId: pipeline._id });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Failed custom setup' });
  }
});

module.exports = router;
