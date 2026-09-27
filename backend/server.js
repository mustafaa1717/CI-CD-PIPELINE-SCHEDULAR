require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const runnerRoutes = require('./routes/runnerRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/runners', runnerRoutes);
app.use('/api/tasks', taskRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cicd-scheduler')
.then(() => {
  console.log('Connected to MongoDB');
  
  // Start the Scheduler Engine
  const { startScheduler } = require('./scheduler');
  startScheduler();

  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
});
