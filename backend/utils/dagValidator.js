const yaml = require('js-yaml');

/**
 * Validates a pipeline YAML string and verifies it forms a valid Directed Acyclic Graph (DAG).
 * Performs cycle detection using Kahn's Algorithm (Topological Sort).
 * 
 * @param {string} yamlString - The raw YAML definition
 * @returns {{
 *   isValid: boolean,
 *   error?: string,
 *   pipelineName?: string,
 *   tasks?: Array<Object>,
 *   topologicalOrder?: Array<string>,
 *   totalStages?: number
 * }}
 */
function validateAndParseDAG(yamlString) {
  if (!yamlString || typeof yamlString !== 'string' || !yamlString.trim()) {
    return { isValid: false, error: 'YAML definition cannot be empty.' };
  }

  let parsed;
  try {
    parsed = yaml.load(yamlString);
  } catch (err) {
    return { isValid: false, error: `Invalid YAML syntax: ${err.message}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { isValid: false, error: 'YAML must define a valid object structure.' };
  }

  // Support both { pipeline: { tasks: [...] } } and top-level { tasks: [...] }
  const pipelineObj = parsed.pipeline || parsed;
  const pipelineName = pipelineObj.name || 'unnamed-pipeline';
  const tasks = pipelineObj.tasks;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { isValid: false, error: 'Pipeline must define an array of "tasks" with at least one task.' };
  }

  const taskMap = new Map();
  const taskNames = new Set();

  // 1. Validate individual task schemas and uniqueness
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task || typeof task !== 'object') {
      return { isValid: false, error: `Task at index ${i} is not a valid object.` };
    }

    if (!task.name || typeof task.name !== 'string' || !task.name.trim()) {
      return { isValid: false, error: `Task at index ${i} is missing a valid "name".` };
    }

    const trimmedName = task.name.trim();
    if (taskNames.has(trimmedName)) {
      return { isValid: false, error: `Duplicate task name detected: "${trimmedName}". Task names must be unique.` };
    }

    if (!task.command || typeof task.command !== 'string' || !task.command.trim()) {
      return { isValid: false, error: `Task "${trimmedName}" is missing a "command" to execute.` };
    }

    const cpus = task.cpus !== undefined ? Number(task.cpus) : 1;
    if (isNaN(cpus) || cpus <= 0) {
      return { isValid: false, error: `Task "${trimmedName}" has invalid "cpus" value (${task.cpus}). Must be a positive number.` };
    }

    const memoryMB = task.memoryMB !== undefined ? Number(task.memoryMB) : 512;
    if (isNaN(memoryMB) || memoryMB <= 0) {
      return { isValid: false, error: `Task "${trimmedName}" has invalid "memoryMB" value (${task.memoryMB}). Must be a positive number.` };
    }

    let dependsOn = [];
    if (task.dependsOn) {
      if (Array.isArray(task.dependsOn)) {
        dependsOn = task.dependsOn.map(d => String(d).trim()).filter(Boolean);
      } else if (typeof task.dependsOn === 'string') {
        dependsOn = [task.dependsOn.trim()];
      } else {
        return { isValid: false, error: `Task "${trimmedName}" has invalid "dependsOn" format. Must be an array or string.` };
      }
    }

    taskNames.add(trimmedName);
    taskMap.set(trimmedName, {
      ...task,
      name: trimmedName,
      command: task.command.trim(),
      image: task.image || 'ubuntu:latest',
      cpus,
      memoryMB,
      dependsOn
    });
  }

  // 2. Validate dependencies existence and self-loops
  for (const [name, task] of taskMap.entries()) {
    for (const dep of task.dependsOn) {
      if (dep === name) {
        return {
          isValid: false,
          error: `Circular self-dependency detected: Task "${name}" cannot depend on itself.`
        };
      }
      if (!taskNames.has(dep)) {
        return {
          isValid: false,
          error: `Task "${name}" depends on unknown task "${dep}". Ensure "${dep}" is defined.`
        };
      }
    }
  }

  // 3. Kahn's Algorithm for Topological Sort & Cycle Detection
  const inDegree = new Map();
  const adjacencyList = new Map(); // parent -> [children who depend on parent]
  const levels = new Map(); // topological depth/stage

  for (const name of taskNames) {
    inDegree.set(name, 0);
    adjacencyList.set(name, []);
    levels.set(name, 0);
  }

  for (const [name, task] of taskMap.entries()) {
    inDegree.set(name, task.dependsOn.length);
    for (const dep of task.dependsOn) {
      adjacencyList.get(dep).push(name);
    }
  }

  // Queue of nodes with in-degree 0 (no dependencies)
  const queue = [];
  for (const [name, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(name);
      levels.set(name, 0);
    }
  }

  const topologicalOrder = [];

  while (queue.length > 0) {
    const current = queue.shift();
    topologicalOrder.push(current);
    const currentLevel = levels.get(current);

    const dependents = adjacencyList.get(current) || [];
    for (const depName of dependents) {
      // Dep level is at least currentLevel + 1
      levels.set(depName, Math.max(levels.get(depName), currentLevel + 1));

      const newDegree = inDegree.get(depName) - 1;
      inDegree.set(depName, newDegree);
      if (newDegree === 0) {
        queue.push(depName);
      }
    }
  }

  // If topologicalOrder count does not match total tasks, a cycle exists!
  if (topologicalOrder.length < taskNames.size) {
    const cyclicTasks = [];
    for (const [name, degree] of inDegree.entries()) {
      if (degree > 0) {
        cyclicTasks.push(name);
      }
    }
    return {
      isValid: false,
      error: `Cycle detected in pipeline graph! Tasks involved in circular loop: [${cyclicTasks.join(', ')}]. DAG cannot be scheduled.`
    };
  }

  const enrichedTasks = Array.from(taskMap.values()).map(task => ({
    ...task,
    stageLevel: levels.get(task.name) || 0
  }));

  const maxLevel = Math.max(...Array.from(levels.values()), 0);

  return {
    isValid: true,
    pipelineName,
    tasks: enrichedTasks,
    topologicalOrder,
    totalStages: maxLevel + 1
  };
}

module.exports = { validateAndParseDAG };
