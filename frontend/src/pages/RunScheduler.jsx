import { useState, useEffect, useRef } from 'react';
import { getPipelines, getRunners, runMultiPipeline } from '../services/api';
import toast from 'react-hot-toast';

/* ───────── Constants ───────── */
const ALGORITHMS = [
  { id: 'fcfs',             label: 'FCFS',            desc: 'First Come First Serve' },
  { id: 'priority',         label: 'Priority',         desc: 'Highest priority runs first' },
  { id: 'dependency_aware', label: 'Dependency-Aware', desc: 'Unblocking tasks prioritized' },
  { id: 'resource_aware',   label: 'Resource-Aware',   desc: 'Best-fit resource assignment' },
];

const PIPELINE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];

const STATUS_CFG = {
  PENDING: { bg: '#1e293b', border: '#374151', text: '#64748b',  dot: '#374151',  label: 'PENDING'  },
  READY:   { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd',  dot: '#3b82f6',  label: 'READY'    },
  RUNNING: { bg: '#451a03', border: '#f59e0b', text: '#fcd34d',  dot: '#f59e0b',  label: 'RUNNING'  },
  SUCCESS: { bg: '#052e16', border: '#22c55e', text: '#86efac',  dot: '#22c55e',  label: '✓ DONE'   },
  FAILED:  { bg: '#2d0a0a', border: '#ef4444', text: '#fca5a5',  dot: '#ef4444',  label: '✗ FAILED' },
};

/* ───────── Main Component ───────── */
export default function RunScheduler() {
  const [pipelines, setPipelines]       = useState([]);
  const [runners, setRunners]           = useState([]);
  const [selected, setSelected]         = useState([]);    // pipeline IDs checked
  const [algorithm, setAlgorithm]       = useState('fcfs');
  const [isRunning, setIsRunning]       = useState(false);
  const [isReplaying, setIsReplaying]   = useState(false);
  const [replayTasks, setReplayTasks]   = useState([]);
  const [runnerState, setRunnerState]   = useState({});    // runnerName -> task or null
  const [metrics, setMetrics]           = useState(null);
  const [replayPct, setReplayPct]       = useState(0);
  const [pipelineInfo, setPipelineInfo] = useState({});
  const intervalRef  = useRef(null);
  const elapsedRef   = useRef(0);
  const normRef      = useRef([]);       // normalized tasks for replay closure

  useEffect(() => {
    (async () => {
      try {
        const [p, r] = await Promise.all([getPipelines(), getRunners()]);
        setPipelines(p.data);
        setRunners(r.data);
      } catch { toast.error('Failed to load data'); }
    })();
    return () => clearInterval(intervalRef.current);
  }, []);

  const togglePipeline = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  /* ── Run ── */
  const handleRun = async () => {
    if (selected.length === 0) { toast.error('Select at least one pipeline'); return; }
    if (runners.length === 0)  { toast.error('Add runners first!'); return; }
    clearInterval(intervalRef.current);
    setIsRunning(true);
    setReplayTasks([]);
    setRunnerState({});
    setMetrics(null);
    setReplayPct(0);
    setPipelineInfo({});

    try {
      const res = await runMultiPipeline(selected, algorithm);
      const data = res.data;
      if (data.error) { toast.error(data.message); return; }

      const m = data.metrics;
      setMetrics(m);
      setPipelineInfo(data.pipeline_info || {});
      toast.success(`Done! Makespan: ${m.makespan?.toFixed(2)}s`);
      startReplay(m.task_details || [], m.makespan || 5, data.pipeline_info || {});
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Run failed');
    } finally {
      setIsRunning(false);
    }
  };

  /* ── Animated Replay ── */
  const startReplay = (taskDetails, makespan, pInfo) => {
    if (!taskDetails.length) return;

    // Normalize timestamps to 0-based relative time
    const starts = taskDetails.map(t => t.start_time).filter(Boolean);
    if (!starts.length) return;
    const t0 = Math.min(...starts);

    const normalized = taskDetails.map(t => ({
      ...t,
      rel_ready:  t.start_time ? Math.max(0, (t.start_time - t0) - (t.wait_time || 0)) : 0,
      rel_start:  t.start_time ? t.start_time - t0 : null,
      rel_end:    t.end_time   ? t.end_time   - t0 : null,
      currentStatus: 'PENDING',
      progress: 0,
    }));

    normRef.current = normalized;
    setReplayTasks(normalized);
    setIsReplaying(true);
    elapsedRef.current = 0;

    // Replay speed: show makespan in max 10 seconds (1x real speed capped at 10s)
    const REPLAY_MS  = Math.min(makespan * 1000, 10000);
    const TICK_MS    = 50;
    const timeScale  = makespan / (REPLAY_MS / 1000);  // sim-sec per real-sec

    intervalRef.current = setInterval(() => {
      elapsedRef.current += (TICK_MS / 1000) * timeScale;
      const elapsed = elapsedRef.current;

      // Update task statuses
      const updated = normRef.current.map(task => {
        let currentStatus = 'PENDING';
        let progress = 0;

        if (task.rel_end !== null && elapsed >= task.rel_end) {
          currentStatus = task.status;   // SUCCESS | FAILED
          progress = 100;
        } else if (task.rel_start !== null && elapsed >= task.rel_start) {
          currentStatus = 'RUNNING';
          const span = (task.rel_end || task.rel_start + 1) - task.rel_start;
          progress = Math.min(((elapsed - task.rel_start) / span) * 100, 99);
        } else if (elapsed >= task.rel_ready) {
          currentStatus = 'READY';
        }

        return { ...task, currentStatus, progress };
      });

      normRef.current = updated;
      setReplayTasks([...updated]);
      setReplayPct(Math.min((elapsed / makespan) * 100, 100));

      // Runner lanes — which task is currently executing on which runner
      const rMap = {};
      runners.forEach(r => { rMap[r.name] = null; });
      updated.forEach(task => {
        if (task.currentStatus === 'RUNNING' && task.assigned_runner) {
          rMap[task.assigned_runner] = task;
        }
      });
      setRunnerState({ ...rMap });

      if (elapsed >= makespan + 0.5) {
        clearInterval(intervalRef.current);
        setIsReplaying(false);
        setReplayPct(100);
      }
    }, TICK_MS);
  };

  /* ── Helpers ── */
  const getPipelineColor = (task) => {
    if (!task) return '#6366f1';
    // Find pipeline info by matching prefix
    for (const [pid, info] of Object.entries(pipelineInfo)) {
      if (task.id && task.id.startsWith(info.prefix)) return info.color;
    }
    return task.pipeline_color || '#6366f1';
  };

  const kanbanColumns = ['PENDING','READY','RUNNING','SUCCESS','FAILED'].map(status => ({
    status,
    tasks: replayTasks.filter(t => t.currentStatus === status),
  }));

  const allDone = replayTasks.length > 0 && replayTasks.every(t =>
    t.currentStatus === 'SUCCESS' || t.currentStatus === 'FAILED'
  );

  /* ── Render ── */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', height: 'calc(100vh - 90px)' }}>

      {/* ──────── LEFT SIDEBAR ──────── */}
      <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', overflowY: 'auto', padding: '18px' }}>

        {/* Pipeline selection */}
        <h3 style={{ fontWeight: 'bold', fontSize: '14px', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📋 Select Pipelines
        </h3>
        <p style={{ fontSize: '11px', color: '#4b5563', marginBottom: '12px' }}>
          All selected pipelines run simultaneously on shared runners
        </p>
        {pipelines.length === 0
          ? <p style={{ color: '#ef4444', fontSize: '13px' }}>No pipelines. Create one first.</p>
          : pipelines.map((p, i) => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer',
            border: selected.includes(p.id) ? `1px solid ${PIPELINE_COLORS[i % PIPELINE_COLORS.length]}` : '1px solid #374151',
            background: selected.includes(p.id) ? `${PIPELINE_COLORS[i % PIPELINE_COLORS.length]}15` : 'transparent' }}>
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => togglePipeline(p.id)} style={{ accentColor: PIPELINE_COLORS[i % PIPELINE_COLORS.length] }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: PIPELINE_COLORS[i % PIPELINE_COLORS.length], flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '13px' }}>{p.name}</div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>{p.tasks?.length || 0} tasks</div>
            </div>
          </label>
        ))}

        <div style={{ margin: '16px 0', borderTop: '1px solid #374151' }} />

        {/* Algorithm */}
        <h3 style={{ fontWeight: 'bold', fontSize: '14px', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          ⚙️ Algorithm
        </h3>
        {ALGORITHMS.map(alg => (
          <label key={alg.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer',
            border: algorithm === alg.id ? '1px solid #6366f1' : '1px solid #374151',
            background: algorithm === alg.id ? 'rgba(99,102,241,0.1)' : 'transparent' }}>
            <input type="radio" name="algo" value={alg.id} checked={algorithm === alg.id} onChange={e => setAlgorithm(e.target.value)} style={{ accentColor: '#6366f1', marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '13px' }}>{alg.label}</div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>{alg.desc}</div>
            </div>
          </label>
        ))}

        <div style={{ margin: '16px 0', borderTop: '1px solid #374151' }} />

        {/* Runners info */}
        <h3 style={{ fontWeight: 'bold', fontSize: '14px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          🖥️ Runners ({runners.length})
        </h3>
        {runners.length === 0
          ? <p style={{ color: '#ef4444', fontSize: '12px' }}>⚠️ No runners! Go to Runners tab.</p>
          : runners.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '6px', marginBottom: '4px', background: '#0f172a', fontSize: '12px' }}>
            <span style={{ fontWeight: '500' }}>{r.name}</span>
            <span style={{ color: '#64748b' }}>{r.cpu_cores}CPU/{r.ram_gb}GB</span>
          </div>
        ))}

        <button onClick={handleRun} disabled={isRunning || selected.length === 0 || runners.length === 0}
          style={{ width: '100%', marginTop: '16px', padding: '13px', background: isRunning ? '#4338ca' : '#6366f1', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: isRunning ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          {isRunning ? '⏳ Simulating...' : `▶ Run ${selected.length > 1 ? selected.length + ' Pipelines' : 'Pipeline'}`}
        </button>
        {selected.length > 1 && (
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#6366f1', marginTop: '6px' }}>
            🔄 All pipelines share runners simultaneously
          </p>
        )}
      </div>

      {/* ──────── RIGHT MAIN AREA ──────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>

        {/* Empty / Loading */}
        {!isRunning && replayTasks.length === 0 && (
          <div style={{ background: '#1e293b', borderRadius: '10px', border: '2px dashed #374151', padding: '80px', textAlign: 'center', color: '#4b5563' }}>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>🚀</div>
            <p style={{ fontSize: '17px', marginBottom: '8px', color: '#64748b' }}>Select pipelines and click <strong style={{ color: '#6366f1' }}>Run</strong></p>
            <p style={{ fontSize: '13px' }}>The scheduler will assign tasks from all selected pipelines to shared runners</p>
          </div>
        )}

        {isRunning && (
          <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', padding: '80px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</div>
            <p style={{ fontSize: '18px', fontWeight: '600', marginTop: '16px' }}>Scheduler running simulation...</p>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px' }}>Assigning tasks from {selected.length} pipeline(s) to {runners.length} runner(s)</p>
          </div>
        )}

        {replayTasks.length > 0 && !isRunning && (
          <>
            {/* Progress bar */}
            <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', padding: '14px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ fontWeight: '600' }}>
                  {isReplaying ? '🎬 Replaying execution...' : allDone ? '✅ Simulation complete!' : '📊 Results'}
                </span>
                <span style={{ color: '#94a3b8' }}>{Math.round(replayPct)}%</span>
              </div>
              <div style={{ height: '6px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${replayPct}%`, background: '#6366f1', borderRadius: '3px', transition: 'width 0.05s linear' }} />
              </div>
            </div>

            {/* ── RUNNER LANES ── */}
            <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', padding: '16px 20px' }}>
              <h3 style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '14px' }}>🖥️ Runner Lanes</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {runners.map(runner => {
                  const activeTask = runnerState[runner.name];
                  const isBusy = !!activeTask;
                  const taskColor = activeTask ? getPipelineColor(activeTask) : '#374151';
                  return (
                    <div key={runner.id} style={{ border: `1px solid ${isBusy ? taskColor : '#374151'}`, borderRadius: '8px', padding: '12px', background: isBusy ? `${taskColor}10` : '#0f172a', transition: 'all 0.3s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px' }}>🖥 {runner.name}</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: isBusy ? `${taskColor}30` : '#374151', color: isBusy ? taskColor : '#9ca3af', fontWeight: '600' }}>
                          {isBusy ? '● BUSY' : '○ FREE'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                        {runner.cpu_cores} CPU · {runner.ram_gb} GB RAM
                      </div>
                      {isBusy && activeTask ? (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: taskColor, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activeTask.pipeline_name && <span style={{ opacity: 0.7 }}>[{activeTask.pipeline_name}] </span>}
                            {activeTask.name}
                          </div>
                          <div style={{ height: '4px', background: '#374151', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${activeTask.progress || 0}%`, background: taskColor, borderRadius: '2px', transition: 'width 0.1s linear' }} />
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px', textAlign: 'right' }}>{Math.round(activeTask.progress || 0)}%</div>
                        </>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#374151', fontStyle: 'italic' }}>Waiting for tasks...</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── TASK KANBAN FLOW ── */}
            <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', padding: '16px 20px' }}>
              <h3 style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '14px' }}>📊 Task Flow — {replayTasks.length} Total Tasks</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', minHeight: '120px' }}>
                {kanbanColumns.map(({ status, tasks }) => {
                  const cfg = STATUS_CFG[status];
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: cfg.dot, letterSpacing: '0.08em' }}>{status}</span>
                        <span style={{ fontSize: '11px', background: `${cfg.dot}25`, color: cfg.dot, padding: '1px 7px', borderRadius: '20px', fontWeight: '700' }}>{tasks.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {tasks.map(task => {
                          const color = getPipelineColor(task);
                          return (
                            <div key={task.id}
                              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${color}`, borderRadius: '6px', padding: '8px 10px', transition: 'all 0.3s ease' }}>
                              <div style={{ fontWeight: '600', fontSize: '12px', color: cfg.text, marginBottom: '2px' }}>{task.name}</div>
                              {task.pipeline_name && (
                                <div style={{ fontSize: '10px', color: color, opacity: 0.8 }}>{task.pipeline_name}</div>
                              )}
                              {status === 'RUNNING' && (
                                <div style={{ marginTop: '5px', height: '3px', background: '#374151', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${task.progress || 0}%`, background: '#f59e0b', transition: 'width 0.1s linear' }} />
                                </div>
                              )}
                              {(status === 'SUCCESS' || status === 'FAILED') && (
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                  on {task.assigned_runner || '?'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── METRICS SUMMARY ── */}
            {metrics && (
              <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', padding: '16px 20px' }}>
                <h3 style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '14px' }}>📈 Simulation Metrics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  {[
                    { label: '⏱ Makespan',      value: `${metrics.makespan?.toFixed(2)}s`,        color: '#6366f1' },
                    { label: '⏳ Avg Wait',       value: `${metrics.avg_wait_time?.toFixed(3)}s`,   color: '#f59e0b' },
                    { label: '🖥 Utilization',    value: `${metrics.overall_utilization?.toFixed(1)}%`, color: '#10b981' },
                    { label: '✅ Tasks Done',     value: `${metrics.successful_tasks}/${metrics.total_tasks}`, color: '#22c55e' },
                    { label: '❌ Failed',         value: `${metrics.failed_tasks || 0}`,            color: '#ef4444' },
                    { label: '📋 Pipelines',      value: `${selected.length}`,                      color: '#8b5cf6' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: '#0f172a', borderRadius: '8px', padding: '14px', textAlign: 'center', border: '1px solid #374151' }}>
                      <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>{label}</div>
                      <div style={{ color, fontWeight: 'bold', fontSize: '22px' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Per-runner stats */}
                {metrics.runner_stats && metrics.runner_stats.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' }}>Runner Breakdown</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                      {metrics.runner_stats.map(rs => (
                        <div key={rs.runner_id} style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', border: '1px solid #374151' }}>
                          <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '6px' }}>{rs.runner_name}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Tasks: {rs.tasks_completed}</div>
                          <div style={{ height: '4px', background: '#374151', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rs.utilization || 0}%`, background: '#10b981', borderRadius: '2px' }} />
                          </div>
                          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '3px', textAlign: 'right' }}>{rs.utilization?.toFixed(1)}% utilized</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
