import { useState, useCallback, useMemo } from 'react';
import { createPipeline } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export default function PipelineBuilder() {
  const [name, setName] = useState('');
  const [tasks, setTasks] = useState([]);
  
  // Task Form State
  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState('');
  const [priority, setPriority] = useState(1);
  const [cpu, setCpu] = useState(1);
  const [ram, setRam] = useState(1);
  const [dependsOn, setDependsOn] = useState([]);

  const navigate = useNavigate();

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!taskName) return;
    
    const newTask = {
      name: taskName,
      duration: Number(duration),
      priority: Number(priority),
      cpu_required: Number(cpu),
      ram_required: Number(ram),
      depends_on: dependsOn
    };
    
    setTasks([...tasks, newTask]);
    
    // reset form
    setTaskName('');
    setDuration('');
    setPriority(1);
    setCpu(1);
    setRam(1);
    setDependsOn([]);
  };

  const toggleDependency = (depName) => {
    if (dependsOn.includes(depName)) {
      setDependsOn(dependsOn.filter(d => d !== depName));
    } else {
      setDependsOn([...dependsOn, depName]);
    }
  };

  const handleSavePipeline = async () => {
    if (!name) {
      toast.error("Pipeline needs a name");
      return;
    }
    if (tasks.length === 0) {
      toast.error("Add at least one task");
      return;
    }
    
    try {
      await createPipeline({ name, tasks });
      toast.success("Pipeline created successfully!");
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to create pipeline");
    }
  };

  // Generate nodes and edges for React Flow
  const nodes = useMemo(() => {
    return tasks.map((t, idx) => ({
      id: t.name,
      position: { x: (idx % 3) * 200 + 50, y: Math.floor(idx / 3) * 150 + 50 },
      data: { label: `${t.name} (${t.duration}s)` },
      style: { background: '#1e293b', color: 'white', border: '1px solid #6366f1', borderRadius: '8px', padding: '10px' }
    }));
  }, [tasks]);

  const edges = useMemo(() => {
    const newEdges = [];
    tasks.forEach(t => {
      t.depends_on.forEach(dep => {
        newEdges.push({
          id: `e-${dep}-${t.name}`,
          source: dep,
          target: t.name,
          animated: true,
          style: { stroke: '#6366f1' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
        });
      });
    });
    return newEdges;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-100px)]">
      
      {/* LEFT: Builder Form */}
      <div className="bg-card p-6 rounded-lg border border-gray-700 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Pipeline Builder</h2>
        
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2">Pipeline Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" 
            placeholder="e.g., Release v2.0"
          />
        </div>

        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-xl font-semibold mb-4">Add Task</h3>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-gray-300">Task Name</label>
              <input required type="text" value={taskName} onChange={e => setTaskName(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-300">Duration (s)</label>
                <input required type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-300">Priority (1-10)</label>
                <input required type="number" min="1" max="10" value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-300">CPU Cores</label>
                <input required type="number" min="1" value={cpu} onChange={e => setCpu(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-300">RAM (GB)</label>
                <input required type="number" min="1" value={ram} onChange={e => setRam(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" />
              </div>
            </div>

            {tasks.length > 0 && (
              <div>
                <label className="block text-sm mb-2 text-gray-300">Depends On (Select multiple)</label>
                <div className="flex flex-wrap gap-2">
                  {tasks.map(t => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => toggleDependency(t.name)}
                      className={`px-3 py-1 rounded text-sm ${dependsOn.includes(t.name) ? 'bg-accent text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium mt-4">
              + Add Task
            </button>
          </form>
        </div>

        <div className="mt-8">
          <button onClick={handleSavePipeline} className="w-full bg-accent hover:bg-accent/90 text-white py-3 rounded font-bold text-lg shadow-lg">
            Save Pipeline
          </button>
        </div>
      </div>

      {/* RIGHT: DAG Preview */}
      <div className="bg-card rounded-lg border border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-bold">Live DAG Preview</h3>
        </div>
        <div className="flex-grow">
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background color="#334155" gap={16} />
            <Controls />
            <MiniMap nodeColor="#6366f1" maskColor="rgba(15, 23, 42, 0.7)" />
          </ReactFlow>
        </div>
      </div>

    </div>
  );
}
