const mongoose = require('mongoose');
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  repository: { type: String, required: true },
  branch: { type: String, default: 'main' }
}, { timestamps: true });
module.exports = mongoose.model('Project', projectSchema);
