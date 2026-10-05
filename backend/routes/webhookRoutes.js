const express = require('express');
const router = express.Router();
const yaml = require('js-yaml');
const Project = require('../models/Project');
const Pipeline = require('../models/Pipeline');
const PipelineRun = require('../models/PipelineRun');
const Task = require('../models/Task');

// GitHub Webhook Endpoint
router.post('/github', async (req, res) => {
  try {
    // 1. Extract details from GitHub payload
    // A push event payload contains repository.clone_url (or html_url), ref (branch), and after (commit SHA)
    const event = req.headers['x-github-event'];
    
    // We only care about push events for now
    if (event !== 'push') {
      return res.status(200).json({ message: 'Event ignored. Only push events trigger pipelines.' });
    }

    const { repository, ref, after: commitSha } = req.body;
    
    if (!repository || !ref) {
      return res.status(400).json({ error: 'Invalid payload: missing repository or ref data' });
    }

    // Convert refs/heads/main to just 'main'
    const branch = ref.replace('refs/heads/', '');
    
    // GitHub provides multiple URLs. We'll check against clone_url or html_url.
    // For simplicity, we'll try to find a project where the repository URL matches either.
    const repoUrlStr = repository.clone_url || repository.html_url;

    console.log(`\n[Webhook] Received push event for repo: ${repoUrlStr}, branch: ${branch}, commit: ${commitSha}`);

    // 2. Find the project
    let project = await Project.findOne({ 
      repository: { $regex: new RegExp(repository.name, 'i') }, 
      branch: branch
    });

    // Fallback if branch name differs (e.g., master vs main)
    if (!project) {
      project = await Project.findOne({ 
        repository: { $regex: new RegExp(repository.name, 'i') }
      });
    }

    if (!project) {
      console.log(`[Webhook] No project found matching repository ${repository.name}.`);
      return res.status(404).json({ error: 'Project not found for this repository' });
    }

    // 3. Find the pipeline associated with this project
    const pipeline = await Pipeline.findOne({ projectId: project._id });
    if (!pipeline) {
      console.log(`[Webhook] No pipeline defined for project ${project.name}.`);
      return res.status(404).json({ error: 'Pipeline not found for project' });
    }

    console.log(`[Webhook] Triggering pipeline: ${pipeline.name}`);

    // 4. Parse YAML and create PipelineRun (Same logic as manual trigger)
    const parsedYaml = yaml.load(pipeline.yamlDefinition);
    
    const pipelineRun = new PipelineRun({
      pipelineId: pipeline._id,
      projectId: pipeline.projectId,
      status: 'RUNNING',
      commitSha: commitSha,
      triggerType: 'github-webhook'
    });
    await pipelineRun.save();

    const taskMap = {};
    const createdTasks = [];

    // Create tasks
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

    // Wire dependencies
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

    pipelineRun.tasks = createdTasks.map(t => t.dbTask._id);
    await pipelineRun.save();

    console.log(`[Webhook] Pipeline Run ${pipelineRun._id} successfully created and queued!`);
    res.status(201).json({ message: 'Pipeline triggered via webhook', runId: pipelineRun._id });

  } catch (err) {
    console.error('[Webhook] Error processing payload:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
