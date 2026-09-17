import { useState, useEffect } from 'react';
import { getPipelines, runPipeline, getRunStatus, getRunners, getPipeline } from '../services/api';
import toast from 'react-hot-toast';

const ALGORITHMS = [
  { id: 'fcfs',             label: 'FCFS',             desc: 'First Come First Serve — tasks run in ready order' },
  { id: 'priority',         label: 'Priority',          desc: 'Highest priority task runs first (1–10 scale)' },
  { id: 'dependency_aware', label: 'Dependency-Aware',  desc: 'Tasks unblocking the most others run first' },
  { id: 'resource_aware',   label: 'Resource-Aware',    desc: 'Best-fit assignment to avoid wasting runner resources' },
];

const STATUS_STYLE = {
  PENDING: { background: '#374151', color: '#d1d5db' },
  READY:   { background: '#1d4ed8', color: '#bfdbfe' },
  RUNNING: { background: '#d97706', color: '#fef3c7' },
  SUCCESS: { background: '#15803d', color: '#bbf7d0' },
  FAILED:  { background: '#dc2626', color: '#fee2e2' },
};

export default function RunScheduler() {
  const [pipelines, setPipelines] = useState([]);
  const [runners, setRunners] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [algorithm, setAlgorithm] = useState('fcfs');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);   // {run_id, metrics}
  const [taskDetails, setTaskDetails] = useState([]); // from metrics.task_details

  useEffect(() => {
    (async () => {
      try {
        const [p, r] = await Promise.all([getPipelines(), getRunners()]);
        setPipelines(p.data);
        setRunners(r.data);
        if (p.data.length > 0) setSelectedPipeline(String(p.data[0].id));
      } catch { toast.error('Failed to load data'); }
    })();
  }, []);

  const handleRun = async () => {
    if (!selectedPipeline) { toast.error('Select a pipeline'); return; }
    if (runners.length === 0) { toast.error('Add at least one runner first'); return; }
    setIsRunning(true);
    setRunResult(null);
    setTaskDetails([]);
    try {
      const res = await runPipeline(selectedPipeline, algorithm);
      const data = res.data;

      if (data.error) {
        toast.error(data.message || 'Pipeline error');
        return;
      }

      setRunResult(data);
      // Extract task details from metrics
      const tasks = data.metrics?.task_details || [];
      setTaskDetails(tasks);
      toast.success('Simulation complete!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Run failed');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusStyle = (status) =>
    STATUS_STYLE[status?.toUpperCase()] || STATUS_STYLE.PENDING;

  const metrics = runResult?.metrics;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', height: 'calc(100vh - 100px)' }}>

      {/* LEFT: Control Panel */}
      <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', overflowY: 'auto', padding: '20px' }}>
        <h2 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '20px' }}>⚙️ Setup</h2>

        {/* Pipeline select */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Pipeline</label>
          <select value={selectedPipeline} onChange={e => setSelectedPipeline(e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #374151', borderRadius: '6px', padding: '8px', color: 'white', boxSizing: 'border-box' }}>
            {pipelines.length === 0 && <option value="">No pipelines</option>}
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Algorithm select */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Algorithm</label>
          {ALGORITHMS.map(alg => (
            <label key={alg.id} style={{
              display: 'block', padding: '10px 12px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer',
              border: algorithm === alg.id ? '1px solid #6366f1' : '1px solid #374151',
              background: algorithm === alg.id ? 'rgba(99,102,241,0.1)' : 'transparent'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="radio" name="algo" value={alg.id} checked={algorithm === alg.id}
                  onChange={e => setAlgorithm(e.target.value)} style={{ accentColor: '#6366f1' }} />
                <span style={{ fontWeight: '600', fontSize: '13px' }}>{alg.label}</span>
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0 20px' }}>{alg.desc}</p>
            </label>
          ))}
        </div>

        {/* Runners info */}
        <div style={{ marginBottom: '20px', padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Available Runners ({runners.length})</p>
          {runners.length === 0
            ? <p style={{ fontSize: '12px', color: '#ef4444' }}>⚠️ No runners! Add runners first.</p>
            : runners.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span>{r.name}</span>
                <span style={{ color: '#94a3b8' }}>{r.cpu_cores}CPU / {r.ram_gb}GB</span>
              </div>
            ))
          }
        </div>

        <button onClick={handleRun} disabled={isRunning || pipelines.length === 0 || runners.length === 0}
          style={{ width: '100%', padding: '12px', background: isRunning ? '#4338ca' : '#6366f1', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: isRunning ? 'not-allowed' : 'pointer' }}>
          {isRunning ? '⏳ Simulating...' : '▶ Run Pipeline'}
        </button>
      </div>

      {/* RIGHT: Results Panel */}
      <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 'bold', fontSize: '18px', margin: 0 }}>📊 Execution Results</h2>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
            {Object.entries(STATUS_STYLE).map(([s, style]) => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: style.background, display: 'inline-block' }} />
                {s}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1 }}>
          {/* Loading */}
          {isRunning && (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚙️</div>
              <p style={{ fontSize: '16px', fontWeight: '600' }}>Simulation running...</p>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>The scheduler is assigning tasks to runners</p>
            </div>
          )}

          {/* Empty state */}
          {!isRunning && !runResult && (
            <div style={{ textAlign: 'center', padding: '60px', color: '#4b5563' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚀</div>
              <p>Select a pipeline and algorithm, then click <strong style={{ color: '#6366f1' }}>Run Pipeline</strong></p>
            </div>
          )}

          {/* Results */}
          {runResult && !isRunning && (
            <>
              {/* Metrics summary */}
              {metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { label: '⏱ Makespan', value: `${metrics.makespan?.toFixed(2)}s`, color: '#6366f1' },
                    { label: '⏳ Avg Wait', value: `${metrics.avg_wait_time?.toFixed(3)}s`, color: '#f59e0b' },
                    { label: '🖥 Utilization', value: `${metrics.overall_utilization?.toFixed(1)}%`, color: '#10b981' },
                    { label: '✅ Successful', value: `${metrics.successful_tasks}/${metrics.total_tasks}`, color: '#22c55e' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: '#0f172a', borderRadius: '8px', padding: '14px', border: '1px solid #374151', textAlign: 'center' }}>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 6px' }}>{label}</p>
                      <p style={{ color, fontWeight: 'bold', fontSize: '20px', margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Task cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                {taskDetails.map(task => {
                  const s = getStatusStyle(task.status);
                  return (
                    <div key={task.id} style={{ background: '#0f172a', borderRadius: '8px', padding: '14px', border: '1px solid #374151', position: 'relative', overflow: 'hidden' }}>
                      {/* Top color bar */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: s.background }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '14px' }}>{task.name}</h3>
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', ...s }}>
                          {task.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>Runner</span><span style={{ color: '#c4b5fd' }}>{task.assigned_runner || 'None'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>Exec Time</span><span style={{ color: 'white' }}>{task.execution_time != null ? `${task.execution_time.toFixed(2)}s` : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Wait Time</span><span style={{ color: '#fbbf24' }}>{task.wait_time != null ? `${task.wait_time.toFixed(3)}s` : '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
