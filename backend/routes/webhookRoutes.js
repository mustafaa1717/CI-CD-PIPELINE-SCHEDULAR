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

    // 2. Find the project (by repo name or repo URL, regardless of branch)
    const repoSearchTerm = (repository.name || '').replace(/[^a-zA-Z0-9_-]/g, '');
    let project = null;

    if (repoSearchTerm) {
      project = await Project.findOne({ 
        $or: [
          { repository: { $regex: repoSearchTerm, $options: 'i' } },
          { name: { $regex: repoSearchTerm, $options: 'i' } }
        ]
      }).sort({ createdAt: -1 });
    }

    // Fallback: Most recently created project
    if (!project) {
      project = await Project.findOne().sort({ createdAt: -1 });
    }

    if (!project) {
      console.log(`[Webhook] No project found in system. Please configure a pipeline first.`);
      return res.status(404).json({ error: 'No project configured in CI/CD' });
    }

    // Update active branch if changed
    if (project.branch !== branch) {
      project.branch = branch;
      await project.save();
    }

    // 3. Find the pipeline associated with this project (or most recently saved pipeline)
    let pipeline = await Pipeline.findOne({ projectId: project._id }).sort({ createdAt: -1 });
    if (!pipeline) {
      pipeline = await Pipeline.findOne().sort({ createdAt: -1 });
    }

    if (!pipeline) {
      console.log(`[Webhook] No pipeline defined in system.`);
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    console.log(`[Webhook] Triggering pipeline "${pipeline.name}" for commit ${commitSha?.substring(0, 7) || 'latest'} on branch "${branch}"`);

    // 4. Parse & Validate YAML and create PipelineRun
    const { validateAndParseDAG } = require('../utils/dagValidator');
    const validation = validateAndParseDAG(pipeline.yamlDefinition);
    if (!validation.isValid) {
      console.error(`[Webhook] Pipeline YAML invalid: ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }
    
    const pipelineRun = new PipelineRun({
      pipelineId: pipeline._id,
      projectId: pipeline.projectId,
      status: 'RUNNING',
      commitSha: commitSha,
      triggerType: 'github-webhook',
      startedAt: new Date()
    });
    await pipelineRun.save();

    const taskMap = {};
    const createdTasks = [];

    // Create tasks
    for (const taskDef of validation.tasks) {
      const task = new Task({
        name: taskDef.name,
        command: taskDef.command,
        image: taskDef.image || 'ubuntu:latest',
        requiredCpus: taskDef.cpus || 1,
        requiredMemoryMB: taskDef.memoryMB || 512,
        stageLevel: taskDef.stageLevel || 0,
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

    // Instantly trigger scheduler loop without waiting for the 3-second interval
    const { runScheduler } = require('../scheduler');
    runScheduler();

    res.status(201).json({ message: 'Pipeline triggered via webhook', runId: pipelineRun._id });

  } catch (err) {
    console.error('[Webhook] Error processing payload:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
