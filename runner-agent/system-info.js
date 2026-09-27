const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function checkDocker() {
  try {
    await execAsync('docker --version');
    return true;
  } catch (err) {
    return false;
  }
}

async function getSystemInfo() {
  const dockerAvailable = await checkDocker();
  
  const cpus = os.cpus();
  const physicalCores = cpus.length;
  const physicalMemoryMB = Math.round(os.totalmem() / (1024 * 1024));
  
  // Use allocated resources from env vars if provided, otherwise use physical limits
  const cpuCores = process.env.RUNNER_CPUS ? parseFloat(process.env.RUNNER_CPUS) : physicalCores;
  const memoryMB = process.env.RUNNER_MEMORY ? parseInt(process.env.RUNNER_MEMORY, 10) : physicalMemoryMB;
  const name = process.env.RUNNER_NAME || `Runner-${Math.random().toString(36).substr(2, 5)}`;
  
  return {
    name,
    hostname: os.hostname(),
    cpuCores,
    memoryMB,
    gpu: false, // Simple fallback for now
    docker: dockerAvailable,
    capabilities: [
      'node',
      dockerAvailable ? 'docker' : null
    ].filter(Boolean)
  };
}

module.exports = { getSystemInfo };
