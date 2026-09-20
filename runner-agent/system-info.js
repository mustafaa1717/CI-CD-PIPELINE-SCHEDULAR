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
  // Physical cores are harder to detect perfectly in plain Node.js os module, 
  // but cpus.length gives logical cores. We use that.
  const cpuCores = cpus.length;
  
  // Memory in MB
  const memoryMB = Math.round(os.totalmem() / (1024 * 1024));
  
  return {
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
