const { spawn } = require('child_process');

/**
 * Executes a command inside a Docker container.
 * @param {string} image - The Docker image to use
 * @param {string} command - The command to run
 * @param {number} cpus - CPU limit (e.g., 2)
 * @param {number} memoryMB - Memory limit in MB (e.g., 2048)
 * @returns {Promise<Object>}
 */
async function runInDocker(image = 'ubuntu:latest', command, cpus = null, memoryMB = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdoutData = '';
    let stderrData = '';

    const args = ['run', '--rm'];
    
    if (cpus) {
      args.push(`--cpus=${cpus}`);
    }
    if (memoryMB) {
      args.push(`--memory=${memoryMB}m`);
    }

    args.push(image, 'sh', '-c', command);
    
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
