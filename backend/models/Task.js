const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  name: { type: String, required: true },
  command: { type: String, required: true },
  image: { type: String, default: 'ubuntu:latest' },
  status: { type: String, enum: ['WAITING', 'READY', 'QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'BLOCKED'], default: 'WAITING' },
  pipelineRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PipelineRun', default: null },
  dependsOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  stageLevel: { type: Number, default: 0 },
  requiredCpus: { type: Number, default: 1 },
  requiredMemoryMB: { type: Number, default: 512 },
  assignedRunner: { type: mongoose.Schema.Types.ObjectId, ref: 'Runner', default: null },
  logs: { type: String, default: '' },
  exitCode: { type: Number, default: null },
  durationMs: { type: Number, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
