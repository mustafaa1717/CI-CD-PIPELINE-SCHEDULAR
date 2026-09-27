const mongoose = require('mongoose');
const pipelineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  yamlDefinition: { type: String, required: true }
}, { timestamps: true });
module.exports = mongoose.model('Pipeline', pipelineSchema);
