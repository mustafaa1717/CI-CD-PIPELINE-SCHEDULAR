import { useState, useMemo } from 'react';
import { createPipeline } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export default function PipelineBuilder() {
  const [name, setName] = useState('');
  const [tasks, setTasks] = useState([]);
  
  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState('');
  const [priority, setPriority] = useState(5);
  const [cpu, setCpu] = useState(1);
  const [ram, setRam] = useState(2);
  const [dependsOn, setDependsOn] = useState([]);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    
    const newTask = {
      name: taskName.trim(),
      duration: Number(duration),
      priority: Number(priority),
      required_cpu: Number(cpu),
      required_ram: Number(ram),
      depends_on: [...dependsOn]
    };
    
    setTasks(prev => [...prev, newTask]);
    setTaskName('');
    setDuration('');
    setPriority(5);
    setCpu(1);
    setRam(2);
    setDependsOn([]);
  };

  const toggleDependency = (depName) => {
    setDependsOn(prev =>
      prev.includes(depName) ? prev.filter(d => d !== depName) : [...prev, depName]
    );
  };

  const handleSavePipeline = async () => {
    if (!name.trim()) { toast.error('Pipeline needs a name'); return; }
    if (tasks.length === 0) { toast.error('Add at least one task'); return; }
    
    setLoading(true);
    try {
      await createPipeline({ name: name.trim(), tasks });
      toast.success('Pipeline created!');
      navigate('/');
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to create pipeline');
    } finally {
      setLoading(false);
    }
  };

  const nodes = useMemo(() => tasks.map((t, idx) => ({
    id: t.name,
    position: { x: (idx % 3) * 220 + 50, y: Math.floor(idx / 3) * 160 + 50 },
    data: { label: `${t.name}\n(${t.duration}s | P${t.priority})` },
    style: {
      background: '#1e293b', color: 'white',
      border: '1px solid #6366f1', borderRadius: '8px', padding: '10px',
      fontSize: '12px', whiteSpace: 'pre-line', textAlign: 'center'
    }
  })), [tasks]);

  const edges = useMemo(() => {
    const result = [];
    tasks.forEach(t => {
      (t.depends_on || []).forEach(dep => {
        result.push({
          id: `e-${dep}-${t.name}`,
          source: dep, target: t.name,
          animated: true,
          style: { stroke: '#6366f1' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
        });
      });
    });
    return result;
  }, [tasks]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', height: 'calc(100vh - 100px)' }}>
      
      {/* LEFT: Builder Form */}
      <div style={{ background: '#1e293b', borderRadius: '8px', border: '1px solid #374151', overflowY: 'auto', padding: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px' }}>🏗️ Pipeline Builder</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#94a3b8' }}>Pipeline Name</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #374151', borderRadius: '6px', padding: '8px 12px', color: 'white', boxSizing: 'border-box' }}
            placeholder="e.g., Java Release v2.0"
          />
        </div>

        <div style={{ borderTop: '1px solid #374151', paddingTop: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Add Task</h3>
          <form onSubmit={handleAddTask}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#94a3b8' }}>Task Name</label>
              <input required type="text" value={taskName} onChange={e => setTaskName(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #374151', borderRadius: '6px', padding: '8px', color: 'white', boxSizing: 'border-box' }}
                placeholder="e.g., Build, Unit Test, Deploy" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              {[
                { label: 'Duration (s)', value: duration, setter: setDuration, min: 1, placeholder: '5' },
                { label: 'Priority (1-10)', value: priority, setter: setPriority, min: 1, max: 10 },
                { label: 'CPU Cores', value: cpu, setter: setCpu, min: 1 },
                { label: 'RAM (GB)', value: ram, setter: setRam, min: 1 },
              ].map(({ label, value, setter, min, max, placeholder }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#94a3b8' }}>{label}</label>
                  <input required type="number" min={min} max={max} value={value} onChange={e => setter(e.target.value)}
                    placeholder={placeholder}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #374151', borderRadius: '6px', padding: '8px', color: 'white', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            {tasks.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: '#94a3b8' }}>Depends On</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {tasks.map(t => (
                    <button key={t.name} type="button" onClick={() => toggleDependency(t.name)}
                      style={{ padding: '4px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px',
                        background: dependsOn.includes(t.name) ? '#6366f1' : '#374151',
                        color: 'white' }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="submit"
              style={{ width: '100%', padding: '10px', background: '#374151', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: '500' }}>
              + Add Task
            </button>
          </form>
        </div>

        {tasks.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #374151', paddingTop: '16px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Tasks ({tasks.length})</p>
            {tasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#0f172a', borderRadius: '6px', marginBottom: '6px', fontSize: '13px' }}>
                <span>{t.name}</span>
                <span style={{ color: '#6366f1' }}>{t.duration}s | P{t.priority} | {t.required_cpu}CPU/{t.required_ram}GB</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleSavePipeline} disabled={loading}
          style={{ width: '100%', marginTop: '20px', padding: '14px', background: loading ? '#4338ca' : '#6366f1', border: 'none', borderRadius: '8px', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          {loading ? 'Saving...' : '💾 Save Pipeline'}
        </button>
      </div>

      {/* RIGHT: DAG Preview */}
      <div style={{ background: '#1e293b', borderRadius: '8px', border: '1px solid #374151', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #374151' }}>
          <h3 style={{ fontWeight: 'bold', margin: 0 }}>🔗 Live DAG Preview</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            {tasks.length === 0 ? 'Add tasks to see the dependency graph' : `${tasks.length} task(s) — arrows show dependencies`}
          </p>
        </div>
        <div style={{ flexGrow: 1, minHeight: '400px' }}>
          <ReactFlowProvider>
            <ReactFlow nodes={nodes} edges={edges} fitView style={{ width: '100%', height: '100%' }}>
              <Background color="#334155" gap={16} />
              <Controls />
              <MiniMap nodeColor="#6366f1" maskColor="rgba(15, 23, 42, 0.7)" />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

    </div>
  );
}
