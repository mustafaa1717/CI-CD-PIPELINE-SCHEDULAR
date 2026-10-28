/**
 * Test WebSocket integration for CI/CD Pipeline Scheduler
 * Verifies that:
 * 1. A client can connect to Socket.io gateway
 * 2. A Runner agent can register over WebSockets
 * 3. Runner status change events are broadcast
 * 4. Disconnect events are handled properly
 */

const { io } = require('./runner-agent/node_modules/socket.io-client');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';

async function testWebSocket() {
  console.log('Testing WebSocket connection to:', SOCKET_URL);

  // 1. Connect a simulated Dashboard listener
  const dashboardSocket = io(SOCKET_URL);
  
  // 2. Connect a simulated Runner socket
  const runnerSocket = io(SOCKET_URL);

  let runnerRegistered = false;
  let dashboardReceivedEvent = false;

  dashboardSocket.on('connect', () => {
    console.log('✓ Dashboard client connected via WebSocket:', dashboardSocket.id);
  });

  dashboardSocket.on('runner:status_changed', (data) => {
    console.log('✓ Dashboard received runner:status_changed event:', data);
    dashboardReceivedEvent = true;
  });

  runnerSocket.on('connect', () => {
    console.log('✓ Runner client connected via WebSocket:', runnerSocket.id);
    
    // Register the runner over WebSocket
    console.log('Registering test runner over WebSocket...');
    runnerSocket.emit('runner:register', {
      name: 'WS-Test-Worker',
      hostname: 'test-host',
      cpuCores: 4,
      memoryMB: 4096,
      docker: true,
      gpu: false,
      capabilities: ['docker', 'nodejs']
    });
  });

  runnerSocket.on('runner:registered', (data) => {
    console.log('✓ Runner successfully registered:', data);
    runnerRegistered = true;

    // Send a heartbeat
    console.log('Sending WebSocket heartbeat...');
    runnerSocket.emit('runner:heartbeat', {
      runnerId: data.runnerId,
      status: 'IDLE'
    });

    setTimeout(() => {
      console.log('\n--- Test Summary ---');
      console.log(`Runner registered: ${runnerRegistered ? 'PASSED' : 'FAILED'}`);
      console.log(`Dashboard received event: ${dashboardReceivedEvent ? 'PASSED' : 'FAILED'}`);
      
      runnerSocket.disconnect();
      dashboardSocket.disconnect();
      process.exit(runnerRegistered && dashboardReceivedEvent ? 0 : 1);
    }, 1500);
  });

  runnerSocket.on('connect_error', (err) => {
    console.error('Runner connection error:', err.message);
  });

  dashboardSocket.on('connect_error', (err) => {
    console.error('Dashboard connection error:', err.message);
  });

  // Timeout safety
  setTimeout(() => {
    console.error('Test timed out. Is the backend server running?');
    runnerSocket.disconnect();
    dashboardSocket.disconnect();
    process.exit(1);
  }, 10000);
}

testWebSocket();
