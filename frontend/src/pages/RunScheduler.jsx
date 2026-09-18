import { useState, useEffect, useRef } from 'react';
import { getPipelines, getRunners, runMultiPipeline } from '../services/api';
import toast from 'react-hot-toast';
import { Play, Server, Clock, Activity, CheckCircle, XCircle } from 'lucide-react';

/* ── Constants ── */
const PIPE_COLORS = ['#0070f3', '#3b82f6', '#64748b', '#0ea5e9', '#475569', '#818cf8'];
const ALGORITHMS = [
  { id:'fcfs',             label:'FCFS',             desc:'First Come First Serve' },
  { id:'priority',         label:'Priority',          desc:'Highest priority runs first (1-10)' },
  { id:'dependency_aware', label:'Dependency-Aware',  desc:'Unblocking tasks prioritized' },
  { id:'resource_aware',   label:'Resource-Aware',    desc:'Best-fit resource assignment' },
];
const STATUS_STYLE = {
  PENDING: { bg:'rgba(255,255,255,0.02)', border:'rgba(255,255,255,0.08)', text:'#888888', badge: 'badge badge-slate' },
  READY:   { bg:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.1)', text:'#ededed', badge: 'badge badge-blue' },
  RUNNING: { bg:'rgba(245,158,11,0.05)',  border:'rgba(245,158,11,0.2)', text:'#f59e0b', badge: 'badge badge-amber' },
  SUCCESS: { bg:'rgba(16,185,129,0.05)',  border:'rgba(16,185,129,0.2)', text:'#10b981', badge: 'badge badge-emerald' },
  FAILED:  { bg:'rgba(239,68,68,0.05)',   border:'rgba(239,68,68,0.2)', text:'#ef4444', badge: 'badge badge-rose' },
};

/* ── Gantt Chart ── */
function GanttChart({ allTasks, runners, visualMakespan, currentTime, getColor }) {
  if (!allTasks.length || !visualMakespan) return null;

  const tick = (pct) => ((pct / 100) * visualMakespan).toFixed(1) + 's';

  return (
    <div className="glass-card" style={{ marginBottom: '16px' }}>
      <div className="glass-card-header">
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} style={{ color: '#888888' }} /> Gantt Chart
        </h3>
      </div>
      <div className="glass-card-body" style={{ paddingTop: '16px' }}>
        {/* Axis */}
        <div style={{ marginLeft:'90px', display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#888888', marginBottom:'12px' }}>
          {[0,25,50,75,100].map(p => <span key={p}>{tick(p)}</span>)}
        </div>

        {/* Runner rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {runners.map(runner => {
          const rtasks = allTasks.filter(t => t.assigned_runner === runner.name && t.rel_start !== null);
          return (
            <div key={runner.id} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              {/* Runner label */}
              <div style={{ width:'82px', fontSize:'12px', fontWeight:'500', flexShrink:0, color:'#888888', lineHeight:'1.4' }}>
                <div style={{ color: '#ededed' }}>{runner.name}</div>
                <div style={{ fontSize: '11px' }}>{runner.cpu_cores}C/{runner.ram_gb}G</div>
              </div>

              {/* Timeline bar */}
              <div style={{ flex:1, height:'36px', background:'rgba(0,0,0,0.5)', borderRadius:'6px', position:'relative', overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
                {rtasks.map(task => {
                  const left  = (task.rel_start / visualMakespan) * 100;
                  const width = Math.max(((task.rel_end - task.rel_start) / visualMakespan) * 100, 1);
                  const clr   = getColor(task);
                  const done  = currentTime >= task.rel_end;
                  const running = currentTime >= task.rel_start && currentTime < task.rel_end;
                  const prog  = running ? Math.min((currentTime - task.rel_start)/(task.rel_end - task.rel_start),1) : (done ? 1 : 0);

                  return (
                    <div key={task.id} title={`${task.name} (${(task.rel_end-task.rel_start).toFixed(1)}s)`}
                      style={{ position:'absolute', left:`${left}%`, width:`${width}%`, top:'4px', height:'26px',
                        background: done ? clr : running ? clr+'88' : clr+'22',
                        borderRadius:'4px', border:`1px solid ${clr}`, overflow:'hidden',
                        display:'flex', alignItems:'center', justifyContent:'center', cursor:'default' }}>
                      {/* progress fill */}
                      {running && <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${prog*100}%`, background:clr+'60' }}/>}
                      <span style={{ position:'relative', zIndex:1, fontSize:'11px', fontWeight:'500', color: done ? '#000000' : '#ffffff',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', padding:'0 6px', textShadow: done ? 'none' : '0 1px 2px rgba(0,0,0,0.5)' }}>
                        {task.name}
                        {task.pipeline_name ? ` [${task.pipeline_name.slice(0,4)}]` : ''}
                      </span>
                    </div>
                  );
                })}

                {/* Current time line */}
                {currentTime > 0 && currentTime < visualMakespan && (
                  <div style={{ position:'absolute', left:`${(currentTime/visualMakespan)*100}%`,
                    top:0, bottom:0, width:'2px', background:'rgba(255,255,255,0.8)', zIndex:20, boxShadow: '0 0 4px rgba(0,0,0,0.5)' }}/>
                )}
              </div>
            </div>
          );
        })}
        </div>

        {/* Pipeline legend */}
        <div style={{ display:'flex', gap:'16px', marginTop:'20px', flexWrap:'wrap', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {Object.entries(Object.fromEntries(
            allTasks.filter(t => t.pipeline_name).map(t => [t.pipeline_name, t.pipeline_color || '#0070f3'])
          )).map(([name, clr]) => (
            <span key={name} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#ededed', fontWeight: '500' }}>
              <span style={{ width:'10px', height:'10px', borderRadius:'3px', background:clr, display:'inline-block' }}/>
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
export default function RunScheduler() {
  const [pipelines,   setPipelines]   = useState([]);
  const [runners,     setRunners]     = useState([]);
  const [selected,    setSelected]    = useState([]);
  const [algorithm,   setAlgorithm]   = useState('fcfs');
  const [phase,       setPhase]       = useState('idle');
  const [replayTasks, setReplayTasks] = useState([]);
  const [runnerState, setRunnerState] = useState({});
  const [metrics,     setMetrics]     = useState(null);
  const [pct,         setPct]         = useState(0);
  const [pipeInfo,    setPipeInfo]    = useState({});
  const [currentTime, setCurrentTime] = useState(0);
  const [visualMakespan, setVisualMakespan] = useState(0);

  const timerRef  = useRef(null);
  const elapsed   = useRef(0);
  const snapRef   = useRef([]);
  const runnersRef = useRef([]);

  useEffect(() => {
    (async () => {
      try {
        const [pr, rr] = await Promise.all([getPipelines(), getRunners()]);
        setPipelines(pr.data || []);
        setRunners(rr.data || []);
        runnersRef.current = rr.data || [];
      } catch {
        toast.error('Could not reach backend');
      }
    })();
    return () => clearInterval(timerRef.current);
  }, []);

  const toggle = (id) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  /* ── RUN ── */
  const handleRun = async () => {
    if (!selected.length) { toast.error('Select at least one pipeline'); return; }
    if (!runners.length)  { toast.error('No runners — add them first'); return; }

    clearInterval(timerRef.current);
    setPhase('running');
    setReplayTasks([]); setRunnerState({}); setMetrics(null);
    setPct(0); setCurrentTime(0); setVisualMakespan(0); setPipeInfo({});

    try {
      const { data } = await runMultiPipeline(selected, algorithm);
      if (!data || data.error) { toast.error(data?.message || 'Run failed'); setPhase('idle'); return; }

      const m    = data.metrics || {};
      const pi   = data.pipeline_info || {};
      const spd  = data.speed_multiplier || 5.0;
      setMetrics(m);
      setPipeInfo(pi);
      toast.success(`Makespan: ${(m.makespan || 0).toFixed(2)}s`);
      beginReplay(m.task_details || [], m.makespan || 1, pi, spd);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Simulation failed');
      setPhase('idle');
    }
  };

  /* ── REPLAY ── */
  const beginReplay = (tasks, actualMakespan, pi, speedMult) => {
    if (!tasks.length) { setPhase('done'); return; }
    const starts = tasks.map(t => t.start_time).filter(Boolean);
    if (!starts.length) { setPhase('done'); return; }
    const t0 = Math.min(...starts);

    const visualMs = actualMakespan * speedMult;

    const norm = tasks.map(t => ({
      ...t,
      rel_ready: t.start_time
        ? Math.max(0, ((t.start_time - t0) - (t.wait_time || 0)) * speedMult)
        : 0,
      rel_start: t.start_time ? (t.start_time - t0) * speedMult : null,
      rel_end:   t.end_time   ? (t.end_time   - t0) * speedMult : null,
      curStatus: 'PENDING',
      progress:  0,
    }));

    snapRef.current  = norm;
    setReplayTasks([...norm]);
    setVisualMakespan(visualMs);
    setPhase('replay');
    elapsed.current = 0;

    const REPLAY_MS = Math.min(visualMs * 1000, 60000);
    const TICK      = 80;
    const scale     = visualMs / (REPLAY_MS / 1000);

    timerRef.current = setInterval(() => {
      elapsed.current += (TICK / 1000) * scale;
      const t = elapsed.current;
      setCurrentTime(t);

      const updated = snapRef.current.map(task => {
        let curStatus = 'PENDING', progress = 0;
        if (task.rel_end !== null && t >= task.rel_end) {
          curStatus = task.status; progress = 100;
        } else if (task.rel_start !== null && t >= task.rel_start) {
          curStatus = 'RUNNING';
          const span = (task.rel_end || task.rel_start + 1) - task.rel_start;
          progress = Math.min(((t - task.rel_start) / span) * 100, 99);
        } else if (t >= task.rel_ready) {
          curStatus = 'READY';
        }
        return { ...task, curStatus, progress };
      });

      snapRef.current = updated;
      setReplayTasks([...updated]);
      setPct(Math.min((t / visualMs) * 100, 100));

      const rm = {};
      runnersRef.current.forEach(r => { rm[r.name] = null; });
      updated.forEach(task => {
        if (task.curStatus === 'RUNNING' && task.assigned_runner) {
          rm[task.assigned_runner] = task;
        }
      });
      setRunnerState({ ...rm });

      if (t >= visualMs + 0.5) {
        clearInterval(timerRef.current);
        setPhase('done');
        setPct(100);
        setCurrentTime(visualMs);
        const finalRm = {};
        runnersRef.current.forEach(r => { finalRm[r.name] = null; });
        setRunnerState({ ...finalRm });
      }
    }, TICK);
  };

  /* ── helpers ── */
  const pipeColor = (task) => {
    if (!task) return '#0070f3';
    for (const [, info] of Object.entries(pipeInfo)) {
      if (task.id && info.prefix && task.id.startsWith(info.prefix)) return info.color || '#0070f3';
    }
    return task.pipeline_color || '#0070f3';
  };

  const elapsed_s = (task) => {
    if (!task || task.rel_start === null) return null;
    if (task.curStatus === 'RUNNING') return Math.max(0, currentTime - task.rel_start);
    if (task.rel_end !== null) return task.rel_end - task.rel_start;
    return null;
  };

  const STATUSES = ['PENDING','READY','RUNNING','SUCCESS','FAILED'];
  const columns  = STATUSES.map(s => ({
    s,
    items: replayTasks
      .filter(t => t.curStatus === s)
      .sort((a, b) => {
        if (s === 'SUCCESS' || s === 'FAILED') {
          return (a.rel_end || 0) - (b.rel_end || 0);
        }
        if (s === 'RUNNING') return (a.rel_start || 0) - (b.rel_start || 0);
        return 0;
      }),
  }));

  /* ════ RENDER ════ */
  return (
    <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'20px', height:'calc(100vh - 110px)' }}>

      {/* ── LEFT: Setup ── */}
      <aside className="glass-card" style={{ display:'flex', flexDirection:'column', overflowY: 'hidden' }}>
        <div className="glass-card-header">
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
             Run Setup
          </h3>
        </div>
        <div className="glass-card-body" style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:'24px', flex:1, padding: '20px' }}>

          <section>
            <p style={{ fontSize:'12px', fontWeight:'600', color:'#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin:'0 0 12px' }}>
              Pipelines
            </p>
            {pipelines.length === 0
              ? <p style={{ color:'#ef4444', fontSize:'13px' }}>No pipelines.</p>
              : pipelines.map((p, i) => {
                  const clr = PIPE_COLORS[i % PIPE_COLORS.length];
                  const on  = selected.includes(p.id);
                  return (
                    <label key={p.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px', borderRadius:'8px', marginBottom:'8px', cursor:'pointer',
                      border:`1px solid ${on ? clr : 'rgba(255,255,255,0.08)'}`, background: on ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)', transition: 'all 0.2s' }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ accentColor:clr, width:'16px', height:'16px' }}/>
                      <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:clr, flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:'500', color: on ? '#ffffff' : '#ededed' }}>{p.name}</div>
                        <div style={{ fontSize:'12px', color:'#888888', marginTop: '2px' }}>{p.tasks?.length || 0} tasks</div>
                      </div>
                    </label>
                  );
                })
            }
          </section>

          <section>
            <p style={{ fontSize:'12px', fontWeight:'600', color:'#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin:'0 0 12px' }}>Algorithm</p>
            {ALGORITHMS.map(a => (
              <label key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:'12px', padding:'10px 12px', borderRadius:'8px', marginBottom:'8px', cursor:'pointer',
                border:`1px solid ${algorithm===a.id ? '#0070f3' : 'rgba(255,255,255,0.08)'}`, background: algorithm===a.id ? 'rgba(0,112,243,0.05)' : 'rgba(0,0,0,0.2)', transition: 'all 0.2s' }}>
                <input type="radio" name="algo" value={a.id} checked={algorithm===a.id} onChange={e => setAlgorithm(e.target.value)} style={{ accentColor:'#0070f3', marginTop:'2px', width: '16px', height: '16px' }}/>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'500', color: algorithm===a.id ? '#ffffff' : '#ededed' }}>{a.label}</div>
                  <div style={{ fontSize:'12px', color:'#888888', marginTop: '2px' }}>{a.desc}</div>
                </div>
              </label>
            ))}
          </section>

          <section>
            <p style={{ fontSize:'12px', fontWeight:'600', color:'#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin:'0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} /> Shared Runners ({runners.length})
            </p>
            {runners.length === 0
              ? <p style={{ color:'#ef4444', fontSize:'13px' }}>No runners added.</p>
              : runners.map(r => (
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems: 'center', padding:'10px 12px', borderRadius:'8px', marginBottom:'8px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', fontSize:'13px' }}>
                  <span style={{ fontWeight:'500', color:'#ededed' }}>{r.name}</span>
                  <span style={{ color:'#888888', fontSize: '12px' }}>{r.cpu_cores}C / {r.ram_gb}G</span>
                </div>
              ))
            }
          </section>

        </div>
        
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <button onClick={handleRun} disabled={phase==='running' || !selected.length || !runners.length}
            className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            <Play size={16} />
            {phase==='running' ? 'Simulating...' : `Run ${selected.length > 1 ? selected.length+' Pipelines' : 'Pipeline'}`}
          </button>
        </div>
      </aside>

      {/* ── RIGHT: Visualisation ── */}
      <main style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:'20px', paddingRight: '4px' }}>

        {/* Empty state */}
        {phase === 'idle' && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding:'100px 40px', textAlign:'center', height: '100%' }}>
            <Activity size={48} style={{ color: '#334155', marginBottom: '24px' }} />
            <p style={{ fontSize:'18px', color:'#ffffff', marginBottom:'12px', fontWeight:'500' }}>Select pipelines and run</p>
            <p style={{ fontSize:'14px', color:'#888888', maxWidth: '400px', lineHeight: '1.5' }}>Tasks from all pipelines will compete for the same runner pool simultaneously using your chosen scheduling algorithm.</p>
          </div>
        )}

        {/* Loading */}
        {phase === 'running' && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding:'100px 40px', textAlign:'center', height: '100%' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #334155', borderTopColor: '#0070f3', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }} />
            <p style={{ fontSize:'18px', fontWeight:'500', color:'#ffffff', marginBottom: '12px' }}>Scheduling {selected.length} pipeline(s) across {runners.length} shared runner(s)...</p>
            <p style={{ fontSize:'14px', color:'#888888' }}>
              Algorithm: {ALGORITHMS.find(a => a.id===algorithm)?.label}
            </p>
            <style>
              {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
            </style>
          </div>
        )}

        {/* ── Replay & Done ── */}
        {(phase === 'replay' || phase === 'done') && (
          <>
            {/* Progress bar */}
            <div className="glass-card" style={{ padding:'16px 24px', marginBottom: '4px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom:'12px' }}>
                <span style={{ fontWeight:'500', color:'#ffffff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} style={{ color: '#888888' }} />
                  {phase==='replay'
                    ? `Time: ${currentTime.toFixed(1)}s / ${visualMakespan.toFixed(1)}s`
                    : `Simulation completed in ${visualMakespan.toFixed(2)}s`}
                </span>
                <span className="badge badge-blue">{Math.round(pct)}%</span>
              </div>
              <div style={{ height:'6px', background:'rgba(0,0,0,0.5)', borderRadius:'3px', overflow:'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:'#0070f3', transition:'width 80ms linear' }}/>
              </div>
            </div>

            {/* ── GANTT CHART ── */}
            <GanttChart
              allTasks={replayTasks}
              runners={runners}
              visualMakespan={visualMakespan}
              currentTime={currentTime}
              getColor={pipeColor}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* ── RUNNER LANES ── */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="glass-card-header">
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Server size={16} style={{ color: '#888888' }} /> Runner Status
                  </h3>
                </div>
                <div className="glass-card-body" style={{ display:'flex', flexDirection: 'column', gap:'16px' }}>
                  {runners.map(runner => {
                    const busy = runnerState[runner.name] || null;
                    const tc   = busy ? pipeColor(busy) : 'rgba(255,255,255,0.08)';
                    const taskElapsed = busy ? elapsed_s(busy) : null;
                    return (
                      <div key={runner.id} style={{ border:`1px solid ${busy ? tc : 'rgba(255,255,255,0.08)'}`, borderRadius:'8px', padding:'16px',
                        background: busy ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)', transition:'all .3s' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                          <span style={{ fontWeight:'500', fontSize:'14px', color:'#ffffff' }}>{runner.name}</span>
                          <span className={busy ? 'badge badge-amber' : 'badge badge-slate'} style={{ fontSize: '10px', padding: '2px 8px' }}>
                            {busy ? 'BUSY' : 'FREE'}
                          </span>
                        </div>
                        <div style={{ fontSize:'12px', color:'#888888', marginBottom:'16px' }}>
                          {runner.cpu_cores}C / {runner.ram_gb}G
                        </div>
                        {busy ? (
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize:'13px', fontWeight:'500', color:tc, marginBottom:'8px' }}>
                              {busy.pipeline_name && <span style={{ opacity:.7 }}>[{busy.pipeline_name}] </span>}{busy.name}
                            </div>
                            <div style={{ fontSize:'14px', fontWeight:'500', color:'#ffffff', fontVariantNumeric:'tabular-nums', marginBottom:'10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={14} style={{ color: '#888888' }} /> {taskElapsed !== null ? taskElapsed.toFixed(1) + 's' : '...'}
                            </div>
                            <div style={{ height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'2px', overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${busy.progress||0}%`, background:tc, transition:'width 80ms linear' }}/>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize:'13px', color:'#64748b', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                            Waiting for tasks...
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── METRICS ── */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="glass-card-header">
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={16} style={{ color: '#888888' }} /> Results: {ALGORITHMS.find(a => a.id===algorithm)?.label}
                  </h3>
                </div>
                <div className="glass-card-body">
                  {metrics ? (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px', marginBottom:'24px' }}>
                        {[
                          ['Total Makespan',`${(metrics.makespan||0).toFixed(2)}s`,'#ffffff'],
                          ['Avg Wait Time', `${(metrics.avg_wait_time||0).toFixed(2)}s`,'#ffffff'],
                          ['Utilization',   `${(metrics.overall_utilization||0).toFixed(1)}%`,'#10b981'],
                          ['Tasks Done',    `${metrics.successful_tasks||0}/${metrics.total_tasks||0}`,'#10b981'],
                          ['Failed',        `${metrics.failed_tasks||0}`,'#ef4444'],
                          ['Pipelines',     `${selected.length}`,'#cbd5e1'],
                        ].map(([label, val, clr]) => (
                          <div key={label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'8px', padding:'16px', border:'1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ fontSize:'12px', color:'#888888', marginBottom:'8px', fontWeight: '500' }}>{label}</div>
                            <div style={{ fontSize:'20px', fontWeight:'500', color:clr }}>{val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Per-runner breakdown */}
                      {(metrics.runner_stats||[]).length > 0 && (
                        <>
                          <p style={{ fontSize:'12px', color:'#888888', margin:'0 0 12px', fontWeight:'600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Runner Breakdown</p>
                          <div style={{ display:'flex', flexDirection: 'column', gap:'12px' }}>
                            {metrics.runner_stats.map(rs => (
                              <div key={rs.runner_id} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'8px', padding:'16px', border:'1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                  <div style={{ fontWeight:'500', fontSize:'14px', color:'#ffffff' }}>{rs.runner_name}</div>
                                  <div style={{ fontSize:'12px', color:'#888888' }}>{rs.tasks_completed} tasks</div>
                                </div>
                                <div style={{ height:'6px', background:'rgba(255,255,255,0.08)', borderRadius:'3px', overflow:'hidden', marginBottom: '8px' }}>
                                  <div style={{ height:'100%', width:`${rs.utilization||0}%`, background:'#0070f3' }}/>
                                </div>
                                <div style={{ fontSize:'12px', color:'#888888', textAlign:'right', fontWeight: '500' }}>
                                  {(rs.utilization||0).toFixed(1)}% utilized
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                     <div style={{ textAlign: 'center', color: '#888888', fontSize: '13px', padding: '40px 0' }}>
                       Metrics will appear here after simulation.
                     </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── TASK KANBAN ── */}
            <div className="glass-card" style={{ marginTop: '20px' }}>
              <div className="glass-card-header">
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} style={{ color: '#888888' }} /> Task Flow
                </h3>
              </div>
              <div className="glass-card-body" style={{ overflowX: 'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(200px, 1fr))', gap:'16px' }}>
                  {columns.map(({ s, items }) => {
                    const st = STATUS_STYLE[s];
                    return (
                      <div key={s} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', padding: '0 4px' }}>
                          <span style={{ fontSize:'12px', fontWeight:'600', textTransform:'uppercase', color:st.text, letterSpacing: '0.05em' }}>{s}</span>
                          <span className={st.badge}>{items.length}</span>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                          {items.map(task => {
                            const pc = pipeColor(task);
                            const dur = elapsed_s(task);
                            return (
                              <div key={task.id} className="glass-card" style={{ background:st.bg, border:`1px solid ${st.border}`, borderLeft:`3px solid ${pc}`,
                                padding:'12px', transition:'all .3s', boxShadow: 'none' }}>
                                <div style={{ fontSize:'13px', fontWeight:'500', color:'#ffffff', marginBottom:'6px', lineHeight: '1.4' }}>{task.name}</div>
                                {task.pipeline_name && <div style={{ fontSize:'11px', color:pc, opacity:.9, marginBottom:'8px', fontWeight: '500' }}>{task.pipeline_name}</div>}

                                {/* Runner info */}
                                {task.assigned_runner && (
                                  <div style={{ fontSize:'11px', color:'#888888', marginBottom:'6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Server size={12} /> {task.assigned_runner}
                                  </div>
                                )}

                                {/* Timer / Duration */}
                                {dur !== null && (
                                  <div style={{ fontSize:'12px', fontWeight:'500', color: s==='RUNNING' ? '#f59e0b' : '#888888', fontVariantNumeric:'tabular-nums', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} /> {dur.toFixed(1)}s
                                  </div>
                                )}

                                {/* Running progress bar */}
                                {s === 'RUNNING' && (
                                  <div style={{ marginTop:'10px', height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'2px', overflow:'hidden' }}>
                                    <div style={{ height:'100%', width:`${task.progress||0}%`, background:'#f59e0b', transition:'width 80ms linear' }}/>
                                  </div>
                                )}
                                
                                {s === 'SUCCESS' && (
                                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                                    <CheckCircle size={14} style={{ color: '#10b981' }} />
                                  </div>
                                )}
                                {s === 'FAILED' && (
                                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                                    <XCircle size={14} style={{ color: '#ef4444' }} />
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
            </div>

          </>
        )}
      </main>

    </div>
  );
}
