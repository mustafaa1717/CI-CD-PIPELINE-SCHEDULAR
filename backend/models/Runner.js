const mongoose = require('mongoose');

const runnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hostname: { type: String, required: true },
  status: { type: String, enum: ['STARTING', 'IDLE', 'BUSY', 'OFFLINE', 'FAILED'], default: 'STARTING' },
  cpuCapacity: { type: Number, required: true },
  memoryCapacity: { type: Number, required: true },
  usedCpus: { type: Number, default: 0 },
  usedMemoryMB: { type: Number, default: 0 },
  activeTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  gpuAvailable: { type: Boolean, default: false },
  dockerAvailable: { type: Boolean, default: false },
  capabilities: [{ type: String }],
  currentTask: { type: String, default: null },
  lastHeartbeat: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Runner', runnerSchema);
