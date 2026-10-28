const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  githubId: String,
  username: String,
  accessToken: String // We need this later to automatically create Webhooks!
});

module.exports = mongoose.model('User', UserSchema);
