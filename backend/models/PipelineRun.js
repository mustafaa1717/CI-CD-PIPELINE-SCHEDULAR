const mongoose = require('mongoose');
const pipelineRunSchema = new mongoose.Schema({
  pipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  status: { type: String, enum: ['RUNNING', 'SUCCESS', 'FAILED'], default: 'RUNNING' },
  commitSha: { type: String, default: 'manual' },
  triggerType: { type: String, default: 'manual' },
  tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
}, { timestamps: true });
module.exports = mongoose.model('PipelineRun', pipelineRunSchema);
