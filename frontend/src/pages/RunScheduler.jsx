import { useState, useEffect, useRef } from 'react';
import { getPipelines, getRunners, runMultiPipeline } from '../services/api';
import toast from 'react-hot-toast';

/* ── Constants ── */
const PIPE_COLORS = ['#0070f3','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
const ALGORITHMS = [
  { id:'fcfs',             label:'FCFS',             desc:'First Come First Serve' },
  { id:'priority',         label:'Priority',          desc:'Highest priority runs first (1-10)' },
  { id:'dependency_aware', label:'Dependency-Aware',  desc:'Unblocking tasks prioritized' },
  { id:'resource_aware',   label:'Resource-Aware',    desc:'Best-fit resource assignment' },
];
const STATUS_STYLE = {
  PENDING: { bg:'#0a0a0a', border:'#27272a', text:'#888888' },
  READY:   { bg:'#0a0a0a', border:'#27272a', text:'#ededed' },
  RUNNING: { bg:'#0a0a0a', border:'#27272a', text:'#f59e0b' },
  SUCCESS: { bg:'#0a0a0a', border:'#27272a', text:'#10b981' },
  FAILED:  { bg:'#0a0a0a', border:'#27272a', text:'#ef4444' },
};

/* ── Gantt Chart ── */
function GanttChart({ allTasks, runners, visualMakespan, currentTime, getColor }) {
  if (!allTasks.length || !visualMakespan) return null;

  const tick = (pct) => ((pct / 100) * visualMakespan).toFixed(1) + 's';

  return (
    <div style={{ background:'#0a0a0a', borderRadius:'8px', border:'1px solid #27272a', padding:'16px 20px' }}>
      <h3 style={{ fontWeight:'500', fontSize:'14px', margin:'0 0 14px', color: '#ededed' }}>
        Gantt Chart
      </h3>

      {/* Axis */}
      <div style={{ marginLeft:'90px', display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#888888', marginBottom:'6px' }}>
        {[0,25,50,75,100].map(p => <span key={p}>{tick(p)}</span>)}
      </div>

      {/* Runner rows */}
      {runners.map(runner => {
        const rtasks = allTasks.filter(t => t.assigned_runner === runner.name && t.rel_start !== null);
        return (
          <div key={runner.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
            {/* Runner label */}
            <div style={{ width:'82px', fontSize:'11px', fontWeight:'500', flexShrink:0, color:'#888888', lineHeight:'1.2' }}>
              <div>{runner.name}</div>
              <div style={{ color:'#888888', fontWeight:'400' }}>{runner.cpu_cores}C/{runner.ram_gb}G</div>
            </div>

            {/* Timeline bar */}
            <div style={{ flex:1, height:'34px', background:'#000000', borderRadius:'4px', position:'relative', overflow:'hidden', border:'1px solid #27272a' }}>
              {rtasks.map(task => {
                const left  = (task.rel_start / visualMakespan) * 100;
                const width = Math.max(((task.rel_end - task.rel_start) / visualMakespan) * 100, 1);
                const clr   = getColor(task);
                const done  = currentTime >= task.rel_end;
                const running = currentTime >= task.rel_start && currentTime < task.rel_end;
                const prog  = running ? Math.min((currentTime - task.rel_start)/(task.rel_end - task.rel_start),1) : (done ? 1 : 0);

                return (
                  <div key={task.id} title={`${task.name} (${(task.rel_end-task.rel_start).toFixed(1)}s)`}
                    style={{ position:'absolute', left:`${left}%`, width:`${width}%`, top:'3px', height:'28px',
                      background: done ? clr : running ? clr+'88' : clr+'22',
                      borderRadius:'4px', border:`1px solid ${clr}`, overflow:'hidden',
                      display:'flex', alignItems:'center', justifyContent:'center', cursor:'default' }}>
                    {/* progress fill */}
                    {running && <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${prog*100}%`, background:clr+'60' }}/>}
                    <span style={{ position:'relative', zIndex:1, fontSize:'10px', fontWeight:'500', color: done ? '#000000' : '#ededed',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', padding:'0 4px' }}>
                      {task.name}
                      {task.pipeline_name ? ` [${task.pipeline_name.slice(0,4)}]` : ''}
                    </span>
                  </div>
                );
              })}

              {/* Current time line */}
              {currentTime > 0 && currentTime < visualMakespan && (
                <div style={{ position:'absolute', left:`${(currentTime/visualMakespan)*100}%`,
                  top:0, bottom:0, width:'1px', background:'rgba(255,255,255,0.4)', zIndex:20 }}/>
              )}
            </div>
          </div>
        );
      })}

      {/* Pipeline legend */}
      <div style={{ display:'flex', gap:'16px', marginTop:'10px', flexWrap:'wrap' }}>
        {Object.entries(Object.fromEntries(
          allTasks.filter(t => t.pipeline_name).map(t => [t.pipeline_name, t.pipeline_color || '#0070f3'])
        )).map(([name, clr]) => (
          <span key={name} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#888888' }}>
            <span style={{ width:'8px', height:'8px', borderRadius:'2px', background:clr, display:'inline-block' }}/>
            {name}
          </span>
        ))}
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
    <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:'16px', height:'calc(100vh - 110px)', fontFamily:"'Inter', sans-serif", color:'#ededed' }}>

      {/* ── LEFT: Setup ── */}
      <aside style={{ background:'#0a0a0a', borderRadius:'8px', border:'1px solid #27272a', padding:'16px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'16px' }}>

        <section>
          <p style={{ fontSize:'12px', fontWeight:'500', color:'#888888', margin:'0 0 12px' }}>
            Pipelines
          </p>
          {pipelines.length === 0
            ? <p style={{ color:'#ef4444', fontSize:'12px' }}>No pipelines.</p>
            : pipelines.map((p, i) => {
                const clr = PIPE_COLORS[i % PIPE_COLORS.length];
                const on  = selected.includes(p.id);
                return (
                  <label key={p.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'6px', marginBottom:'6px', cursor:'pointer',
                    border:`1px solid ${on ? clr : '#27272a'}`, background: on ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ accentColor:clr, width:'14px', height:'14px' }}/>
                    <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:clr, flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'500', color:'#ededed' }}>{p.name}</div>
                      <div style={{ fontSize:'11px', color:'#888888' }}>{p.tasks?.length || 0} tasks</div>
                    </div>
                  </label>
                );
              })
          }
        </section>

        <hr style={{ border:'none', borderTop:'1px solid #27272a', margin:0 }}/>

        <section>
          <p style={{ fontSize:'12px', fontWeight:'500', color:'#888888', margin:'0 0 12px' }}>Algorithm</p>
          {ALGORITHMS.map(a => (
            <label key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 10px', borderRadius:'6px', marginBottom:'6px', cursor:'pointer',
              border:`1px solid ${algorithm===a.id ? '#ededed' : '#27272a'}`, background: algorithm===a.id ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
              <input type="radio" name="algo" value={a.id} checked={algorithm===a.id} onChange={e => setAlgorithm(e.target.value)} style={{ accentColor:'#ededed', marginTop:'2px' }}/>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'500', color:'#ededed' }}>{a.label}</div>
                <div style={{ fontSize:'11px', color:'#888888' }}>{a.desc}</div>
              </div>
            </label>
          ))}
        </section>

        <hr style={{ border:'none', borderTop:'1px solid #27272a', margin:0 }}/>

        <section>
          <p style={{ fontSize:'12px', fontWeight:'500', color:'#888888', margin:'0 0 12px' }}>
            Shared Runners ({runners.length})
          </p>
          {runners.length === 0
            ? <p style={{ color:'#ef4444', fontSize:'12px' }}>No runners added.</p>
            : runners.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', borderRadius:'6px', marginBottom:'6px', background:'#000000', border:'1px solid #27272a', fontSize:'12px' }}>
                <span style={{ fontWeight:'500', color:'#ededed' }}>{r.name}</span>
                <span style={{ color:'#888888' }}>{r.cpu_cores}C / {r.ram_gb}G</span>
              </div>
            ))
          }
        </section>

        <button onClick={handleRun} disabled={phase==='running' || !selected.length || !runners.length}
          style={{ marginTop:'auto', padding:'12px', background: phase==='running' ? '#000000' : selected.length ? '#ededed' : '#0a0a0a',
            border: selected.length && phase!=='running' ? 'none' : '1px solid #27272a', borderRadius:'6px', color: selected.length && phase!=='running' ? '#000000' : '#888888', fontWeight:'500', cursor: (phase==='running'||!selected.length) ? 'not-allowed' : 'pointer', fontSize:'14px' }}>
          {phase==='running' ? 'Simulating...' : `Run ${selected.length > 1 ? selected.length+' Pipelines' : 'Pipeline'}`}
        </button>
      </aside>

      {/* ── RIGHT: Visualisation ── */}
      <main style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* Empty state */}
        {phase === 'idle' && (
          <div style={{ background:'#0a0a0a', border:'1px dashed #27272a', borderRadius:'8px', padding:'80px 40px', textAlign:'center' }}>
            <p style={{ fontSize:'16px', color:'#ededed', marginBottom:'8px', fontWeight:'500' }}>Select pipelines and run</p>
            <p style={{ fontSize:'13px', color:'#888888' }}>Tasks from all pipelines compete for the same runner pool simultaneously</p>
          </div>
        )}

        {/* Loading */}
        {phase === 'running' && (
          <div style={{ background:'#0a0a0a', borderRadius:'8px', border:'1px solid #27272a', padding:'60px', textAlign:'center' }}>
            <p style={{ fontSize:'16px', fontWeight:'500', marginTop:'14px', color:'#ededed' }}>Scheduling {selected.length} pipeline(s) across {runners.length} shared runner(s)...</p>
            <p style={{ fontSize:'13px', color:'#888888', marginTop:'6px' }}>
              {ALGORITHMS.find(a => a.id===algorithm)?.label}
            </p>
          </div>
        )}

        {/* ── Replay & Done ── */}
        {(phase === 'replay' || phase === 'done') && (
          <>
            {/* Progress bar */}
            <div style={{ background:'#0a0a0a', borderRadius:'8px', border:'1px solid #27272a', padding:'14px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'8px' }}>
                <span style={{ fontWeight:'500', color:'#ededed' }}>
                  {phase==='replay'
                    ? `${currentTime.toFixed(1)}s / ${visualMakespan.toFixed(1)}s`
                    : `Completed in ${visualMakespan.toFixed(2)}s`}
                </span>
                <span style={{ color:'#888888', fontWeight:'500' }}>{Math.round(pct)}%</span>
              </div>
              <div style={{ height:'4px', background:'#27272a', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:'#ededed', transition:'width 80ms linear' }}/>
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

            {/* ── RUNNER LANES ── */}
            <div style={{ background:'#0a0a0a', borderRadius:'8px', border:'1px solid #27272a', padding:'16px 20px' }}>
              <h3 style={{ fontWeight:'500', fontSize:'14px', margin:'0 0 16px', color:'#ededed' }}>Runner Status</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'12px' }}>
                {runners.map(runner => {
                  const busy = runnerState[runner.name] || null;
                  const tc   = busy ? pipeColor(busy) : '#27272a';
                  const taskElapsed = busy ? elapsed_s(busy) : null;
                  return (
                    <div key={runner.id} style={{ border:`1px solid ${busy ? tc : '#27272a'}`, borderRadius:'6px', padding:'14px',
                      background: busy ? 'rgba(255,255,255,0.02)' : '#000000', transition:'all .3s' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                        <span style={{ fontWeight:'500', fontSize:'13px', color:'#ededed' }}>{runner.name}</span>
                        <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'4px', fontWeight:'500',
                          background: busy ? 'rgba(255,255,255,0.05)' : '#0a0a0a', border: '1px solid #27272a', color: busy ? tc : '#888888' }}>
                          {busy ? 'BUSY' : 'FREE'}
                        </span>
                      </div>
                      <div style={{ fontSize:'11px', color:'#888888', marginBottom:'10px' }}>
                        {runner.cpu_cores}C / {runner.ram_gb}G
                      </div>
                      {busy ? (
                        <>
                          <div style={{ fontSize:'12px', fontWeight:'500', color:tc, marginBottom:'6px' }}>
                            {busy.pipeline_name && <span style={{ opacity:.7 }}>[{busy.pipeline_name}] </span>}{busy.name}
                          </div>
                          {/* ⏱ Task Timer */}
                          <div style={{ fontSize:'14px', fontWeight:'500', color:'#ededed', fontVariantNumeric:'tabular-nums', marginBottom:'8px' }}>
                            {taskElapsed !== null ? taskElapsed.toFixed(1) + 's' : '...'}
                          </div>
                          <div style={{ height:'2px', background:'#27272a', borderRadius:'1px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${busy.progress||0}%`, background:tc, transition:'width 80ms linear' }}/>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:'12px', color:'#555555' }}>Waiting for tasks...</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── TASK KANBAN ── */}
            <div style={{ background:'#0a0a0a', borderRadius:'8px', border:'1px solid #27272a', padding:'16px 20px' }}>
              <h3 style={{ fontWeight:'500', fontSize:'14px', margin:'0 0 16px', color:'#ededed' }}>Task Flow</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px' }}>
                {columns.map(({ s, items }) => {
                  const st = STATUS_STYLE[s];
                  return (
                    <div key={s}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                        <span style={{ fontSize:'11px', fontWeight:'500', textTransform:'uppercase', color:st.text }}>{s}</span>
                        <span style={{ fontSize:'10px', background:'rgba(255,255,255,0.05)', color:st.text, padding:'2px 6px', borderRadius:'4px', border:'1px solid #27272a', fontWeight:'500' }}>{items.length}</span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                        {items.map(task => {
                          const pc = pipeColor(task);
                          const dur = elapsed_s(task);
                          return (
                            <div key={task.id} style={{ background:st.bg, border:`1px solid ${st.border}`, borderLeft:`3px solid ${pc}`,
                              borderRadius:'6px', padding:'10px 12px', transition:'all .3s' }}>
                              <div style={{ fontSize:'12px', fontWeight:'500', color:'#ededed', marginBottom:'4px' }}>{task.name}</div>
                              {task.pipeline_name && <div style={{ fontSize:'10px', color:pc, opacity:.9, marginBottom:'6px' }}>{task.pipeline_name}</div>}

                              {/* Runner info */}
                              {task.assigned_runner && (
                                <div style={{ fontSize:'10px', color:'#888888', marginBottom:'4px' }}>
                                  {task.assigned_runner}
                                </div>
                              )}

                              {/* Timer / Duration */}
                              {dur !== null && (
                                <div style={{ fontSize:'11px', fontWeight:'500', color: s==='RUNNING' ? '#f59e0b' : '#888888', fontVariantNumeric:'tabular-nums' }}>
                                  {dur.toFixed(1)}s
                                </div>
                              )}

                              {/* Running progress bar */}
                              {s === 'RUNNING' && (
                                <div style={{ marginTop:'8px', height:'2px', background:'#27272a', borderRadius:'1px', overflow:'hidden' }}>
                                  <div style={{ height:'100%', width:`${task.progress||0}%`, background:'#f59e0b', transition:'width 80ms linear' }}/>
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

            {/* ── METRICS ── */}
            {metrics && (
              <div style={{ background:'#0a0a0a', borderRadius:'8px', border:'1px solid #27272a', padding:'16px 20px' }}>
                <h3 style={{ fontWeight:'500', fontSize:'14px', margin:'0 0 16px', color:'#ededed' }}>
                  Results: {ALGORITHMS.find(a => a.id===algorithm)?.label}
                </h3>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'12px', marginBottom:'16px' }}>
                  {[
                    ['Total Makespan',`${(metrics.makespan||0).toFixed(2)}s`,'#ededed'],
                    ['Avg Wait Time', `${(metrics.avg_wait_time||0).toFixed(2)}s`,'#888888'],
                    ['Utilization',   `${(metrics.overall_utilization||0).toFixed(1)}%`,'#10b981'],
                    ['Tasks Done',    `${metrics.successful_tasks||0}/${metrics.total_tasks||0}`,'#10b981'],
                    ['Failed',        `${metrics.failed_tasks||0}`,'#ef4444'],
                    ['Pipelines',     `${selected.length}`,'#888888'],
                  ].map(([label, val, clr]) => (
                    <div key={label} style={{ background:'#000000', borderRadius:'6px', padding:'14px', border:'1px solid #27272a' }}>
                      <div style={{ fontSize:'11px', color:'#888888', marginBottom:'6px' }}>{label}</div>
                      <div style={{ fontSize:'18px', fontWeight:'500', color:clr }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Per-runner breakdown */}
                {(metrics.runner_stats||[]).length > 0 && (
                  <>
                    <p style={{ fontSize:'12px', color:'#888888', margin:'0 0 10px', fontWeight:'500' }}>Runner Breakdown</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'12px' }}>
                      {metrics.runner_stats.map(rs => (
                        <div key={rs.runner_id} style={{ background:'#000000', borderRadius:'6px', padding:'12px', border:'1px solid #27272a' }}>
                          <div style={{ fontWeight:'500', fontSize:'13px', marginBottom:'6px', color:'#ededed' }}>{rs.runner_name}</div>
                          <div style={{ fontSize:'11px', color:'#888888', marginBottom:'6px' }}>{rs.tasks_completed} tasks completed</div>
                          <div style={{ height:'2px', background:'#27272a', borderRadius:'1px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${rs.utilization||0}%`, background:'#ededed' }}/>
                          </div>
                          <div style={{ fontSize:'11px', color:'#888888', marginTop:'6px', textAlign:'right' }}>
                            {(rs.utilization||0).toFixed(1)}% utilized
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

    </div>
  );
}
