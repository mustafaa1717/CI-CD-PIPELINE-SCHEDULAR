import { useState, useMemo, useEffect } from 'react';
import { createPipeline, getPipeline, updatePipeline } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, Edit3, Trash2, CheckCircle2, X, Plus, Save } from 'lucide-react';

/**
 * 3-Color DFS Cycle Detection for Directed Graph
 */
export function detectCycle(tasks) {
  const adj = {};
  for (const t of tasks) adj[t.name] = [];
  for (const t of tasks) {
    for (const dep of (t.depends_on || [])) {
      if (adj[dep]) {
        adj[dep].push(t.name);
      }
    }
  }

  const visited = new Set();
  const recStack = new Set();
  let cyclePath = null;

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of (adj[node] || [])) {
      if (neighbor === node) {
        cyclePath = [node, node];
        return true;
      }
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, path)) return true;
      } else if (recStack.has(neighbor)) {
        const cycleStartIndex = path.indexOf(neighbor);
        cyclePath = [...path.slice(cycleStartIndex), neighbor];
        return true;
      }
    }

    recStack.delete(node);
    path.pop();
    return false;
  }

  for (const t of tasks) {
    if (!visited.has(t.name)) {
      if (dfs(t.name, [])) {
        const cycleEdges = new Set();
        for (let i = 0; i < cyclePath.length - 1; i++) {
          cycleEdges.add(`${cyclePath[i]}->${cyclePath[i + 1]}`);
        }
        const cycleNodes = new Set(cyclePath);
        return { hasCycle: true, cyclePath, cycleNodes, cycleEdges };
      }
    }
  }

  return { hasCycle: false, cyclePath: [], cycleNodes: new Set(), cycleEdges: new Set() };
}

export default function PipelineBuilder() {
  const { id: editPipelineId } = useParams();
  const isEditingPipeline = Boolean(editPipelineId);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [tasks, setTasks] = useState([]);
  const [fetchingPipeline, setFetchingPipeline] = useState(isEditingPipeline);

  // Form field states
  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState('');
  const [priority, setPriority] = useState(5);
  const [cpu, setCpu] = useState(1);
  const [ram, setRam] = useState(2);
  const [dependsOn, setDependsOn] = useState([]);

  // Editing state for an individual task inside the pipeline
  const [editingIndex, setEditingIndex] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load existing pipeline if in edit mode
  useEffect(() => {
    if (!editPipelineId) return;
    const fetchExisting = async () => {
      setFetchingPipeline(true);
      try {
        const res = await getPipeline(editPipelineId);
        const data = res.data;
        if (data) {
          setName(data.name || '');
          setTasks(data.tasks || []);
        }
      } catch (err) {
        toast.error('Could not load pipeline to edit');
        navigate('/');
      } finally {
        setFetchingPipeline(false);
      }
    };
    fetchExisting();
  }, [editPipelineId, navigate]);

  // Run cycle detection whenever tasks change
  const cycleInfo = useMemo(() => detectCycle(tasks), [tasks]);

  // Start editing a task
  const handleStartEdit = (index) => {
    const task = tasks[index];
    if (!task) return;
    setEditingIndex(index);
    setTaskName(task.name);
    setDuration(task.duration);
    setPriority(task.priority);
    setCpu(task.required_cpu);
    setRam(task.required_ram);
    setDependsOn(task.depends_on || []);
  };

  // Cancel task editing
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setTaskName('');
    setDuration('');
    setPriority(5);
    setCpu(1);
    setRam(2);
    setDependsOn([]);
  };

  // Delete a task
  const handleDeleteTask = (index) => {
    const taskToDelete = tasks[index];
    if (!taskToDelete) return;

    if (editingIndex === index) {
      handleCancelEdit();
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }

    const deletedName = taskToDelete.name;
    // Remove task and strip from any other tasks' depends_on
    setTasks(prev =>
      prev
        .filter((_, i) => i !== index)
        .map(t => ({
          ...t,
          depends_on: (t.depends_on || []).filter(dep => dep !== deletedName)
        }))
    );
    toast.success(`Task "${deletedName}" removed`);
  };

  // Toggle a dependency
  const toggleDependency = (depName) => {
    setDependsOn(prev =>
      prev.includes(depName) ? prev.filter(d => d !== depName) : [...prev, depName]
    );
  };

  // Handle submit for Add OR Update task
  const handleSaveOrUpdateTask = (e) => {
    e.preventDefault();
    const trimmedName = taskName.trim();
    if (!trimmedName) {
      toast.error('Task name cannot be empty');
      return;
    }

    if (editingIndex === null) {
      // Adding new task
      const exists = tasks.some(t => t.name.toLowerCase() === trimmedName.toLowerCase());
      if (exists) {
        toast.error(`A task named "${trimmedName}" already exists`);
        return;
      }

      const newTask = {
        name: trimmedName,
        duration: Math.max(1, Number(duration) || 1),
        priority: Math.min(10, Math.max(1, Number(priority) || 5)),
        required_cpu: Math.max(1, Number(cpu) || 1),
        required_ram: Math.max(1, Number(ram) || 1),
        depends_on: [...dependsOn]
      };

      setTasks(prev => [...prev, newTask]);
      toast.success(`Task "${trimmedName}" added`);
    } else {
      // Updating existing task
      const originalTask = tasks[editingIndex];
      const nameCollision = tasks.some(
        (t, i) => i !== editingIndex && t.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (nameCollision) {
        toast.error(`Another task is already named "${trimmedName}"`);
        return;
      }

      const oldName = originalTask.name;
      const updatedTask = {
        ...originalTask,
        name: trimmedName,
        duration: Math.max(1, Number(duration) || 1),
        priority: Math.min(10, Math.max(1, Number(priority) || 5)),
        required_cpu: Math.max(1, Number(cpu) || 1),
        required_ram: Math.max(1, Number(ram) || 1),
        // A task cannot depend on itself
        depends_on: dependsOn.filter(d => d !== trimmedName)
      };

      // If task was renamed, update references in other tasks
      setTasks(prev =>
        prev.map((t, i) => {
          if (i === editingIndex) return updatedTask;
          if (oldName !== trimmedName && (t.depends_on || []).includes(oldName)) {
            return {
              ...t,
              depends_on: t.depends_on.map(d => (d === oldName ? trimmedName : d))
            };
          }
          return t;
        })
      );

      toast.success(`Task "${trimmedName}" updated`);
      setEditingIndex(null);
    }

    // Reset inputs
    setTaskName('');
    setDuration('');
    setPriority(5);
    setCpu(1);
    setRam(2);
    setDependsOn([]);
  };

  // Save or Update Pipeline
  const handleSavePipeline = async () => {
    if (!name.trim()) { toast.error('Pipeline needs a name'); return; }
    if (tasks.length === 0) { toast.error('Add at least one task'); return; }

    if (cycleInfo.hasCycle) {
      toast.error(`Cannot save pipeline: Cyclic dependency detected (${cycleInfo.cyclePath.join(' ➔ ')})`);
      return;
    }

    setLoading(true);
    try {
      if (isEditingPipeline) {
        await updatePipeline(editPipelineId, { name: name.trim(), tasks });
        toast.success('Pipeline updated successfully!');
      } else {
        await createPipeline({ name: name.trim(), tasks });
        toast.success('Pipeline created successfully!');
      }
      navigate('/');
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to save pipeline');
    } finally {
      setLoading(false);
    }
  };

  // ReactFlow Nodes with cycle highlighting and editing status
  const nodes = useMemo(() => tasks.map((t, idx) => {
    const isCycleNode = cycleInfo.hasCycle && cycleInfo.cycleNodes.has(t.name);
    const isCurrentEditing = editingIndex !== null && tasks[editingIndex]?.name === t.name;

    return {
      id: t.name,
      position: { x: (idx % 3) * 230 + 50, y: Math.floor(idx / 3) * 170 + 50 },
      data: {
        label: `${t.name}\n(${t.duration}s | P${t.priority} | ${t.required_cpu}C/${t.required_ram}GB)`
      },
      style: {
        background: isCycleNode ? '#450a0a' : (isCurrentEditing ? '#1e1b4b' : '#0f172a'),
        color: isCycleNode ? '#fca5a5' : (isCurrentEditing ? '#c7d2fe' : '#f8fafc'),
        border: isCycleNode
          ? '2px solid #ef4444'
          : (isCurrentEditing ? '2px solid #818cf8' : '1px solid #4f46e5'),
        boxShadow: isCycleNode
          ? '0 0 16px rgba(239, 68, 68, 0.6)'
          : (isCurrentEditing ? '0 0 14px rgba(99, 102, 241, 0.5)' : 'none'),
        borderRadius: '8px',
        padding: '12px 14px',
        fontSize: '12px',
        fontWeight: isCycleNode || isCurrentEditing ? '600' : '500',
        whiteSpace: 'pre-line',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }
    };
  }), [tasks, cycleInfo, editingIndex]);

  // ReactFlow Edges with cycle highlighting
  const edges = useMemo(() => {
    const result = [];
    tasks.forEach(t => {
      (t.depends_on || []).forEach(dep => {
        const edgeKey = `${dep}->${t.name}`;
        const isCycleEdge = cycleInfo.hasCycle && cycleInfo.cycleEdges.has(edgeKey);

        result.push({
          id: `e-${dep}-${t.name}`,
          source: dep,
          target: t.name,
          animated: true,
          style: {
            stroke: isCycleEdge ? '#ef4444' : '#6366f1',
            strokeWidth: isCycleEdge ? 3 : 1.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isCycleEdge ? '#ef4444' : '#6366f1',
          }
        });
      });
    });
    return result;
  }, [tasks, cycleInfo]);

  // Handle clicking a node in the graph to edit that task
  const handleNodeClick = (_, node) => {
    const index = tasks.findIndex(t => t.name === node.id);
    if (index !== -1) {
      handleStartEdit(index);
    }
  };

  // Eligible tasks for dependencies: all tasks excluding the current one being edited
  const eligibleDependencyTasks = useMemo(() => {
    if (editingIndex === null) {
      return tasks;
    }
    return tasks.filter((_, idx) => idx !== editingIndex);
  }, [tasks, editingIndex]);

  if (fetchingPipeline) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#94a3b8' }}>
        Loading pipeline...
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: '24px', height: 'calc(100vh - 100px)' }}>

      {/* LEFT: Builder & Task Edit Form */}
      <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏗️</span>
              <span>{isEditingPipeline ? 'Edit CI/CD Pipeline' : 'Pipeline Builder'}</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              {isEditingPipeline ? `Modifying pipeline #${editPipelineId}` : 'Construct task graph and define execution dependencies'}
            </p>
          </div>
          <Link to="/" style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none' }}>
            ← Back
          </Link>
        </div>

        {/* Pipeline Name Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#cbd5e1' }}>Pipeline Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: 'white', boxSizing: 'border-box', fontSize: '14px' }}
            placeholder="e.g., Core-Backend-Release v2"
          />
        </div>

        {/* Task Form (Add or Edit Mode) */}
        <div style={{
          border: editingIndex !== null ? '1px solid #6366f1' : '1px solid #334155',
          background: editingIndex !== null ? 'rgba(99, 102, 241, 0.05)' : '#0f172a',
          borderRadius: '10px',
          padding: '18px',
          marginBottom: '20px',
          transition: 'all 0.2s ease'
        }}>
          {/* Header of Task Form */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: '600', color: editingIndex !== null ? '#a5b4fc' : '#f8fafc' }}>
                {editingIndex !== null ? `✏️ Editing Task: ${tasks[editingIndex]?.name}` : '➕ Add Task'}
              </span>
              {editingIndex !== null && (
                <span style={{ fontSize: '11px', background: '#312e81', color: '#c7d2fe', padding: '2px 8px', borderRadius: '4px', border: '1px solid #4f46e5' }}>
                  Task #{editingIndex + 1}
                </span>
              )}
            </div>
            {editingIndex !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <X size={14} /> Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSaveOrUpdateTask}>
            {/* Task Name */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px', color: '#94a3b8' }}>
                Task Name
              </label>
              <input
                required
                type="text"
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', color: 'white', boxSizing: 'border-box', fontSize: '13px' }}
                placeholder="e.g., Build, Unit-Test, Security-Scan"
              />
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#94a3b8' }}>Duration (s)</label>
                <input required type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)}
                  placeholder="5"
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '7px 10px', color: 'white', boxSizing: 'border-box', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#94a3b8' }}>Priority (1-10)</label>
                <input required type="number" min={1} max={10} value={priority} onChange={e => setPriority(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '7px 10px', color: 'white', boxSizing: 'border-box', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#94a3b8' }}>CPU (Cores)</label>
                <input required type="number" min={1} value={cpu} onChange={e => setCpu(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '7px 10px', color: 'white', boxSizing: 'border-box', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#94a3b8' }}>RAM (GB)</label>
                <input required type="number" min={1} value={ram} onChange={e => setRam(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '7px 10px', color: 'white', boxSizing: 'border-box', fontSize: '12px' }} />
              </div>
            </div>

            {/* Depends On Dependencies Selector */}
            {eligibleDependencyTasks.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#94a3b8' }}>
                    Depends On (Must complete before this task starts)
                  </label>
                  {dependsOn.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#818cf8' }}>
                      {dependsOn.length} selected
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {eligibleDependencyTasks.map(t => {
                    const isSelected = dependsOn.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => toggleDependency(t.name)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '16px',
                          border: isSelected ? '1px solid #6366f1' : '1px solid #334155',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: isSelected ? '600' : '400',
                          background: isSelected ? 'rgba(99, 102, 241, 0.25)' : '#1e293b',
                          color: isSelected ? '#a5b4fc' : '#cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}>
                        <span>{isSelected ? '✓' : '+'}</span>
                        <span>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons: Add vs Update/Cancel */}
            {editingIndex === null ? (
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '9px',
                  background: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}>
                <Plus size={16} /> Add Task
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '9px',
                    background: '#4f46e5',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}>
                  <CheckCircle2 size={16} /> Update Task
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    padding: '9px 16px',
                    background: '#334155',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '13px'
                  }}>
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Added Tasks List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e1', margin: 0 }}>
              Tasks ({tasks.length})
            </p>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Click any task or graph node to edit
            </span>
          </div>

          {tasks.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: '#0f172a', borderRadius: '8px', border: '1px dashed #334155', color: '#64748b', fontSize: '13px' }}>
              No tasks added yet. Add your first task using the form above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {tasks.map((t, i) => {
                const isCurrentEditing = editingIndex === i;
                const isCycleNode = cycleInfo.hasCycle && cycleInfo.cycleNodes.has(t.name);

                return (
                  <div
                    key={t.name + i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: isCycleNode
                        ? 'rgba(239, 68, 68, 0.1)'
                        : (isCurrentEditing ? 'rgba(99, 102, 241, 0.15)' : '#0f172a'),
                      border: isCycleNode
                        ? '1px solid #ef4444'
                        : (isCurrentEditing ? '1px solid #818cf8' : '1px solid #334155'),
                      borderRadius: '8px',
                      transition: 'all 0.15s ease'
                    }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '600', color: isCycleNode ? '#fca5a5' : '#f8fafc', fontSize: '13px' }}>
                          {t.name}
                        </span>
                        <span style={{ fontSize: '10px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '1px 6px', borderRadius: '4px' }}>
                          P{t.priority}
                        </span>
                        {isCurrentEditing && (
                          <span style={{ fontSize: '10px', background: '#312e81', color: '#c7d2fe', padding: '1px 6px', borderRadius: '4px' }}>
                            Editing
                          </span>
                        )}
                        {isCycleNode && (
                          <span style={{ fontSize: '10px', background: '#991b1b', color: '#fee2e2', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            CYCLE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {t.duration}s • {t.required_cpu} CPU • {t.required_ram} GB RAM
                        {t.depends_on && t.depends_on.length > 0 && (
                          <span style={{ marginLeft: '8px', color: '#818cf8' }}>
                            ← depends on: {t.depends_on.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(i)}
                        title="Edit Task"
                        style={{
                          background: isCurrentEditing ? '#4f46e5' : '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: isCurrentEditing ? 'white' : '#cbd5e1',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                        <Edit3 size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(i)}
                        title="Delete Task"
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cycle Error Warning in Form Column if Cycle detected */}
        {cycleInfo.hasCycle && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '12px',
            color: '#fca5a5',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#f87171' }}>Cannot save pipeline:</strong> Cyclic dependency detected in graph ({cycleInfo.cyclePath.join(' ➔ ')}). Edit tasks to remove the loop.
            </div>
          </div>
        )}

        {/* Save Pipeline Button */}
        <button
          onClick={handleSavePipeline}
          disabled={loading || cycleInfo.hasCycle}
          style={{
            width: '100%',
            padding: '14px',
            background: cycleInfo.hasCycle ? '#991b1b' : (loading ? '#4338ca' : '#6366f1'),
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: (loading || cycleInfo.hasCycle) ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background 0.2s ease'
          }}>
          {cycleInfo.hasCycle ? (
            <>
              <AlertTriangle size={18} />
              <span>Resolve Cycle Before Saving</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>{loading ? 'Saving...' : (isEditingPipeline ? 'Update Pipeline' : 'Save Pipeline')}</span>
            </>
          )}
        </button>
      </div>

      {/* RIGHT: Live DAG Preview */}
      <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔗</span>
              <span>Live DAG Preview</span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              {tasks.length === 0
                ? 'Add tasks to visualize execution order'
                : (cycleInfo.hasCycle
                  ? '🚨 Cycle detected — closed loop prevents topological sort'
                  : `✅ Valid DAG (${tasks.length} task${tasks.length === 1 ? '' : 's'}) — arrows show execution flow`)}
            </p>
          </div>

          {cycleInfo.hasCycle ? (
            <span style={{ fontSize: '11px', background: '#7f1d1d', border: '1px solid #ef4444', color: '#fee2e2', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AlertTriangle size={13} color="#fca5a5" /> Cycle Detected
            </span>
          ) : (
            tasks.length > 0 && (
              <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', padding: '4px 10px', borderRadius: '20px', fontWeight: '500' }}>
                Acyclic Graph Ready
              </span>
            )
          )}
        </div>

        {/* Real-time Cycle Warning Banner across top of graph */}
        {cycleInfo.hasCycle && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '12px 20px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertTriangle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 'bold', color: '#f87171', fontSize: '13px' }}>
                Circular Dependency Loop Detected!
              </div>
              <div style={{ fontSize: '12px', marginTop: '3px', color: '#fee2e2' }}>
                Cycle Path: <strong style={{ color: '#fca5a5', fontFamily: 'monospace' }}>{cycleInfo.cyclePath.join(' ➔ ')}</strong>
              </div>
              <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '3px' }}>
                Tasks wait on each other in a closed circle. The scheduler cannot pick a starting task (deadlock). Click on any task on the left to edit its dependencies.
              </div>
            </div>
          </div>
        )}

        {/* ReactFlow Canvas */}
        <div style={{ flexGrow: 1, minHeight: '400px', position: 'relative' }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodeClick={handleNodeClick}
              fitView
              style={{ width: '100%', height: '100%' }}>
              <Background color="#334155" gap={16} />
              <Controls />
              <MiniMap
                nodeColor={n => {
                  if (cycleInfo.hasCycle && cycleInfo.cycleNodes.has(n.id)) return '#ef4444';
                  return '#6366f1';
                }}
                maskColor="rgba(15, 23, 42, 0.7)"
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

    </div>
  );
}