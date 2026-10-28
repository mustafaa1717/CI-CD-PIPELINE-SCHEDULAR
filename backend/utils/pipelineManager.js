const PipelineRun = require('../models/PipelineRun');
const Task = require('../models/Task');

/**
 * Checks whether all tasks in a pipeline run are in terminal states.
 * If so, updates the PipelineRun document to SUCCESS or FAILED and triggers volume cleanup.
 * 
 * @param {string|mongoose.Types.ObjectId} pipelineRunId 
 */
async function checkAndUpdatePipelineRun(pipelineRunId) {
  if (!pipelineRunId) return;

  try {
    const run = await PipelineRun.findById(pipelineRunId);
    if (!run || run.status === 'SUCCESS' || run.status === 'FAILED') {
      return; // Already resolved or does not exist
    }

    const tasks = await Task.find({ pipelineRunId });
    if (!tasks || tasks.length === 0) return;

    const totalTasks = tasks.length;
    const successCount = tasks.filter(t => t.status === 'SUCCESS').length;
    const failedCount = tasks.filter(t => t.status === 'FAILED').length;
    const blockedCount = tasks.filter(t => t.status === 'BLOCKED').length;
    const activeOrPending = tasks.filter(t => ['RUNNING', 'QUEUED', 'READY', 'WAITING'].includes(t.status)).length;

    const now = new Date();
    const durationMs = run.startedAt ? (now.getTime() - new Date(run.startedAt).getTime()) : 0;

    if (successCount === totalTasks) {
      run.status = 'SUCCESS';
      run.completedAt = now;
      await run.save();

      console.log(`[PipelineManager] PipelineRun ${run._id} finished successfully in ${durationMs}ms!`);

      const { broadcast } = require('../socket');
      if (typeof broadcast === 'function') {
        broadcast('pipelinerun:status_changed', {
          pipelineRunId: run._id,
          status: 'SUCCESS',
          completedAt: run.completedAt,
          durationMs
        });
      }

      cleanupPipelineWorkspace(run._id.toString());
    } else if (activeOrPending === 0 && (failedCount > 0 || blockedCount > 0)) {
      run.status = 'FAILED';
      run.completedAt = now;
      await run.save();

      console.log(`[PipelineManager] PipelineRun ${run._id} failed (${failedCount} failed, ${blockedCount} blocked).`);

      const { broadcast } = require('../socket');
      if (typeof broadcast === 'function') {
        broadcast('pipelinerun:status_changed', {
          pipelineRunId: run._id,
          status: 'FAILED',
          completedAt: run.completedAt,
          durationMs
        });
      }

      cleanupPipelineWorkspace(run._id.toString());
    }
  } catch (err) {
    console.error('[PipelineManager] Error checking pipeline run status:', err);
  }
}

/**
 * Instructs runners to clean up Docker volumes created for this pipeline run.
 * @param {string} pipelineRunId 
 */
function cleanupPipelineWorkspace(pipelineRunId) {
  if (!pipelineRunId) return;

  // Small delay so trailing logs can finish transmitting
  setTimeout(() => {
    console.log(`[PipelineManager] Broadcasting volume cleanup command for pipelineRun ${pipelineRunId}`);
    const { broadcast } = require('../socket');
    if (typeof broadcast === 'function') {
      broadcast('pipeline:cleanup_workspace', { pipelineRunId });
    }
  }, 2500);
}

module.exports = {
  checkAndUpdatePipelineRun,
  cleanupPipelineWorkspace
};
