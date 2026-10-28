require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const runnerRoutes = require('./routes/runnerRoutes');
const taskRoutes = require('./routes/taskRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP Server & WebSocket initialization
const http = require('http');
const server = http.createServer(app);
const { initSocket } = require('./socket');
initSocket(server);

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Authentication Setup ---
const session = require('express-session');
const passport = require('passport');
require('./passport'); // Load our GitHub strategy

app.use(session({
  secret: 'super-secret-cicd-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());

const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);
// ----------------------------

// Routes
app.use('/api/runners', runnerRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/pipelines', pipelineRoutes);
app.use('/api/webhooks', webhookRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cicd-scheduler')
.then(() => {
  console.log('Connected to MongoDB');
  
  // Start the Scheduler Engine
  const { startScheduler } = require('./scheduler');
  startScheduler();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
});
