const { spawn } = require('child_process');

/**
 * Executes a command inside a Docker container.
 * @param {string} image - The Docker image to use (e.g., 'ubuntu:latest', 'node:18')
 * @param {string} command - The command to run
 * @returns {Promise<Object>} - Contains stdout, stderr, exitCode, duration
 */
async function runInDocker(image = 'ubuntu:latest', command) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdoutData = '';
    let stderrData = '';

    // We use the --rm flag so the container is removed after it exits
    // We pass the command to sh -c to allow complex commands
    const args = ['run', '--rm', image, 'sh', '-c', command];
    
    console.log(`[Docker Executor] Running: docker ${args.join(' ')}`);
    const dockerProcess = spawn('docker', args);

    dockerProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      // Print in real-time to runner console
      process.stdout.write(`[Task stdout] ${data.toString()}`);
    });

    dockerProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      process.stderr.write(`[Task stderr] ${data.toString()}`);
    });

    dockerProcess.on('close', (code) => {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      resolve({
        stdout: stdoutData,
        stderr: stderrData,
        exitCode: code,
        durationMs,
        success: code === 0
      });
    });

    dockerProcess.on('error', (err) => {
      const endTime = Date.now();
      resolve({
        stdout: stdoutData,
        stderr: stderrData + `\nDocker execution error: ${err.message}`,
        exitCode: -1,
        durationMs: endTime - startTime,
        success: false
      });
    });
  });
}

module.exports = { runInDocker };
