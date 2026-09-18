import { useState, useEffect, useRef } from 'react';
import { getPipelines, getRunners, runMultiPipeline } from '../services/api';
import toast from 'react-hot-toast';

/* ── Constants ── */
const PIPE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
const ALGORITHMS = [
  { id:'fcfs',             label:'FCFS',             desc:'First Come First Serve' },
  { id:'priority',         label:'Priority',          desc:'Highest priority runs first (1-10)' },
  { id:'dependency_aware', label:'Dependency-Aware',  desc:'Unblocking tasks prioritized' },
  { id:'resource_aware',   label:'Resource-Aware',    desc:'Best-fit resource assignment' },
];
const STATUS_STYLE = {
  PENDING: { bg:'#1e293b', border:'#475569', text:'#64748b' },
  READY:   { bg:'#1e3a5f', border:'#3b82f6', text:'#93c5fd' },
  RUNNING: { bg:'#451a03', border:'#f59e0b', text:'#fbbf24' },
  SUCCESS: { bg:'#052e16', border:'#22c55e', text:'#86efac' },
  FAILED:  { bg:'#300a0a', border:'#ef4444', text:'#fca5a5' },
};

/* ── Gantt Chart ── */
function GanttChart({ allTasks, runners, visualMakespan, currentTime, getColor }) {
  if (!allTasks.length || !visualMakespan) return null;

  const tick = (pct) => ((pct / 100) * visualMakespan).toFixed(1) + 's';

  return (
    <div style={{ background:'#1e293b', borderRadius:'12px', border:'1px solid #334155', padding:'16px 20px' }}>
      <h3 style={{ fontWeight:'bold', fontSize:'15px', margin:'0 0 14px' }}>
        🗂 Gantt Chart — Concurrent Execution Timeline
      </h3>

      {/* Axis */}
      <div style={{ marginLeft:'90px', display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#64748b', marginBottom:'6px' }}>
        {[0,25,50,75,100].map(p => <span key={p}>{tick(p)}</span>)}
      </div>

      {/* Runner rows */}
      {runners.map(runner => {
        const rtasks = allTasks.filter(t => t.assigned_runner === runner.name && t.rel_start !== null);
        return (
          <div key={runner.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
            {/* Runner label */}
            <div style={{ width:'82px', fontSize:'11px', fontWeight:'600', flexShrink:0, color:'#94a3b8', lineHeight:'1.2' }}>
              <div>🖥 {runner.name}</div>
              <div style={{ color:'#475569', fontWeight:'400' }}>{runner.cpu_cores}C/{runner.ram_gb}G</div>
            </div>

            {/* Timeline bar */}
            <div style={{ flex:1, height:'34px', background:'#0f172a', borderRadius:'6px', position:'relative', overflow:'hidden', border:'1px solid #1e293b' }}>
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
                    <span style={{ position:'relative', zIndex:1, fontSize:'9px', fontWeight:'700', color:'white',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', padding:'0 3px' }}>
                      {task.name}
                      {task.pipeline_name ? ` [${task.pipeline_name.slice(0,4)}]` : ''}
                    </span>
                  </div>
                );
              })}

              {/* Current time line */}
              {currentTime > 0 && currentTime < visualMakespan && (
                <div style={{ position:'absolute', left:`${(currentTime/visualMakespan)*100}%`,
                  top:0, bottom:0, width:'2px', background:'rgba(255,255,255,0.7)', zIndex:20 }}/>
              )}
            </div>
          </div>
        );
      })}

      {/* Pipeline legend */}
      <div style={{ display:'flex', gap:'16px', marginTop:'10px', flexWrap:'wrap' }}>
        {Object.entries(Object.fromEntries(
          allTasks.filter(t => t.pipeline_name).map(t => [t.pipeline_name, t.pipeline_color || '#6366f1'])
        )).map(([name, clr]) => (
          <span key={name} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#94a3b8' }}>
            <span style={{ width:'12px', height:'12px', borderRadius:'3px', background:clr, display:'inline-block' }}/>
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
  const runnersRef = useRef([]);  // stable ref for timer closure

  useEffect(() => {
    (async () => {
      try {
        const [pr, rr] = await Promise.all([getPipelines(), getRunners()]);
        setPipelines(pr.data || []);
        setRunners(rr.data || []);
        runnersRef.current = rr.data || [];
      } catch {
        toast.error('Could not reach backend — is uvicorn running?');
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
      const spd  = data.speed_multiplier || 5.0;   // how much faster backend ran
      setMetrics(m);
      setPipeInfo(pi);
      toast.success(`✓ Makespan: ${(m.makespan || 0).toFixed(2)}s`);
      // Pass speedMultiplier so animation shows original task durations
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

    // Multiply all time offsets by speedMult so:
    //   - a 5s task that ran in 1s (at 5x speed) animates as 5s
    //   - visualMakespan = actualMakespan * speedMult ≈ original pipeline duration
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

    // Play at 1x real speed (capped at 60s for very long pipelines)
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

      // Runner lane state — map runner name → active task
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
        // Show all runners FREE on completion
        const finalRm = {};
        runnersRef.current.forEach(r => { finalRm[r.name] = null; });
        setRunnerState({ ...finalRm });
      }
    }, TICK);
  };

  /* ── helpers ── */
  const pipeColor = (task) => {
    if (!task) return '#6366f1';
    for (const [, info] of Object.entries(pipeInfo)) {
      if (task.id && info.prefix && task.id.startsWith(info.prefix)) return info.color || '#6366f1';
    }
    return task.pipeline_color || '#6366f1';
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
      // SUCCESS/FAILED: sort by when they finished (first to complete = top of list)
      .sort((a, b) => {
        if (s === 'SUCCESS' || s === 'FAILED') {
          return (a.rel_end || 0) - (b.rel_end || 0);
        }
        // RUNNING: sort by start time
        if (s === 'RUNNING') return (a.rel_start || 0) - (b.rel_start || 0);
        return 0;
      }),
  }));

  /* ════ RENDER ════ */
  return (
    <div style={{ display:'grid', gridTemplateColumns:'230px 1fr', gap:'14px', height:'calc(100vh - 110px)', fontFamily:'system-ui,sans-serif', color:'white' }}>

      {/* ── LEFT: Setup ── */}
      <aside style={{ background:'#1e293b', borderRadius:'12px', border:'1px solid #334155', padding:'16px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'12px' }}>

        <section>
          <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.08em', color:'#64748b', margin:'0 0 8px' }}>
            📋 Pipelines
          </p>
          <p style={{ fontSize:'10px', color:'#475569', margin:'0 0 8px', lineHeight:'1.4' }}>
            All checked pipelines compete for runners simultaneously
          </p>
          {pipelines.length === 0
            ? <p style={{ color:'#ef4444', fontSize:'12px' }}>No pipelines. Create one first.</p>
            : pipelines.map((p, i) => {
                const clr = PIPE_COLORS[i % PIPE_COLORS.length];
                const on  = selected.includes(p.id);
                return (
                  <label key={p.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 9px', borderRadius:'8px', marginBottom:'4px', cursor:'pointer',
                    border:`1px solid ${on ? clr : '#334155'}`, background: on ? clr+'18' : 'transparent' }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ accentColor:clr, width:'14px', height:'14px' }}/>
                    <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:clr, flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:'12px', fontWeight:'600' }}>{p.name}</div>
                      <div style={{ fontSize:'10px', color:'#64748b' }}>{p.tasks?.length || 0} tasks</div>
                    </div>
                  </label>
                );
              })
          }
        </section>

        <hr style={{ border:'none', borderTop:'1px solid #334155', margin:0 }}/>

        <section>
          <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.08em', color:'#64748b', margin:'0 0 8px' }}>⚙️ Algorithm</p>
          {ALGORITHMS.map(a => (
            <label key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'7px 9px', borderRadius:'8px', marginBottom:'4px', cursor:'pointer',
              border:`1px solid ${algorithm===a.id ? '#6366f1' : '#334155'}`, background: algorithm===a.id ? '#6366f115' : 'transparent' }}>
              <input type="radio" name="algo" value={a.id} checked={algorithm===a.id} onChange={e => setAlgorithm(e.target.value)} style={{ accentColor:'#6366f1', marginTop:'2px' }}/>
              <div>
                <div style={{ fontSize:'12px', fontWeight:'600' }}>{a.label}</div>
                <div style={{ fontSize:'10px', color:'#64748b' }}>{a.desc}</div>
              </div>
            </label>
          ))}
        </section>

        <hr style={{ border:'none', borderTop:'1px solid #334155', margin:0 }}/>

        <section>
          <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.08em', color:'#64748b', margin:'0 0 6px' }}>
            🖥️ Shared Runners ({runners.length})
          </p>
          {runners.length === 0
            ? <p style={{ color:'#ef4444', fontSize:'11px' }}>⚠ No runners! Add in Runners tab.</p>
            : runners.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'5px 7px', borderRadius:'5px', marginBottom:'3px', background:'#0f172a', fontSize:'11px' }}>
                <span style={{ fontWeight:'600' }}>{r.name}</span>
                <span style={{ color:'#64748b' }}>{r.cpu_cores}CPU/{r.ram_gb}GB</span>
              </div>
            ))
          }
        </section>

        <button onClick={handleRun} disabled={phase==='running' || !selected.length || !runners.length}
          style={{ marginTop:'auto', padding:'12px', background: phase==='running' ? '#4338ca' : selected.length ? '#6366f1' : '#374151',
            border:'none', borderRadius:'8px', color:'white', fontWeight:'bold', cursor: (phase==='running'||!selected.length) ? 'not-allowed' : 'pointer', fontSize:'13px' }}>
          {phase==='running' ? '⏳ Simulating...' : `▶ Run ${selected.length > 1 ? selected.length+' Pipelines' : 'Pipeline'}`}
        </button>
        {selected.length > 1 && phase !== 'running' &&
          <p style={{ textAlign:'center', fontSize:'10px', color:'#6366f1', margin:0 }}>All share runners simultaneously</p>}
      </aside>

      {/* ── RIGHT: Visualisation ── */}
      <main style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:'12px' }}>

        {/* Empty state */}
        {phase === 'idle' && (
          <div style={{ background:'#1e293b', border:'2px dashed #334155', borderRadius:'12px', padding:'80px 40px', textAlign:'center' }}>
            <div style={{ fontSize:'52px', marginBottom:'14px' }}>🚀</div>
            <p style={{ fontSize:'17px', color:'#94a3b8', marginBottom:'8px' }}>Select pipelines → click <strong style={{ color:'#6366f1' }}>Run</strong></p>
            <p style={{ fontSize:'12px', color:'#475569' }}>Tasks from all pipelines compete for the same runner pool simultaneously</p>
          </div>
        )}

        {/* Loading */}
        {phase === 'running' && (
          <div style={{ background:'#1e293b', borderRadius:'12px', border:'1px solid #334155', padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:'48px', animation:'spin 1s linear infinite', display:'inline-block' }}>⚙️</div>
            <p style={{ fontSize:'17px', fontWeight:'600', marginTop:'14px' }}>Scheduling {selected.length} pipeline(s) across {runners.length} shared runner(s)...</p>
            <p style={{ fontSize:'12px', color:'#94a3b8', marginTop:'6px' }}>
              <strong>{ALGORITHMS.find(a => a.id===algorithm)?.label}</strong> — tasks run at real speed (timer shows actual duration)
            </p>
          </div>
        )}

        {/* ── Replay & Done ── */}
        {(phase === 'replay' || phase === 'done') && (
          <>
            {/* Progress bar */}
            <div style={{ background:'#1e293b', borderRadius:'12px', border:'1px solid #334155', padding:'12px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px' }}>
                <span style={{ fontWeight:'600' }}>
                  {phase==='replay'
                    ? `🎬 ${currentTime.toFixed(1)}s / ${visualMakespan.toFixed(1)}s`
                    : `✅ Completed in ${visualMakespan.toFixed(2)}s`}
                </span>
                <span style={{ color:'#94a3b8', fontWeight:'600' }}>{Math.round(pct)}%</span>
              </div>
              <div style={{ height:'6px', background:'#334155', borderRadius:'3px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:'#6366f1', transition:'width 80ms linear' }}/>
              </div>
            </div>

            {/* ── GANTT CHART ── shows concurrent execution clearly */}
            <GanttChart
              allTasks={replayTasks}
              runners={runners}
              visualMakespan={visualMakespan}
              currentTime={currentTime}
              getColor={pipeColor}
            />

            {/* ── RUNNER LANES ── */}
            <div style={{ background:'#1e293b', borderRadius:'12px', border:'1px solid #334155', padding:'14px 18px' }}>
              <h3 style={{ fontWeight:'bold', fontSize:'14px', margin:'0 0 12px' }}>🖥️ Runner Status (live)</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:'10px' }}>
                {runners.map(runner => {
                  const busy = runnerState[runner.name] || null;
                  const tc   = busy ? pipeColor(busy) : '#475569';
                  const taskElapsed = busy ? elapsed_s(busy) : null;
                  return (
                    <div key={runner.id} style={{ border:`1px solid ${tc}`, borderRadius:'10px', padding:'12px',
                      background: busy ? tc+'12' : '#0f172a', transition:'all .3s' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                        <span style={{ fontWeight:'700', fontSize:'13px' }}>🖥 {runner.name}</span>
                        <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'20px', fontWeight:'700',
                          background: busy ? tc+'30' : '#334155', color: busy ? tc : '#64748b' }}>
                          {busy ? '● BUSY' : '○ FREE'}
                        </span>
                      </div>
                      <div style={{ fontSize:'10px', color:'#64748b', marginBottom:'8px' }}>
                        {runner.cpu_cores} CPU · {runner.ram_gb} GB RAM
                      </div>
                      {busy ? (
                        <>
                          <div style={{ fontSize:'12px', fontWeight:'600', color:tc, marginBottom:'4px' }}>
                            {busy.pipeline_name && <span style={{ opacity:.7 }}>[{busy.pipeline_name}] </span>}{busy.name}
                          </div>
                          {/* ⏱ Task Timer */}
                          <div style={{ fontSize:'18px', fontWeight:'800', color:tc, fontVariantNumeric:'tabular-nums', marginBottom:'5px' }}>
                            ⏱ {taskElapsed !== null ? taskElapsed.toFixed(1) + 's' : '...'}
                          </div>
                          <div style={{ height:'4px', background:'#334155', borderRadius:'2px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${busy.progress||0}%`, background:tc, transition:'width 80ms linear' }}/>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:'11px', color:'#334155', fontStyle:'italic' }}>Waiting for tasks...</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── TASK KANBAN ── */}
            <div style={{ background:'#1e293b', borderRadius:'12px', border:'1px solid #334155', padding:'14px 18px' }}>
              <h3 style={{ fontWeight:'bold', fontSize:'14px', margin:'0 0 12px' }}>📊 Task Flow ({replayTasks.length} tasks across {selected.length} pipeline{selected.length > 1 ? 's' : ''})</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px' }}>
                {columns.map(({ s, items }) => {
                  const st = STATUS_STYLE[s];
                  return (
                    <div key={s}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                        <span style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', color:st.border, letterSpacing:'.06em' }}>{s}</span>
                        <span style={{ fontSize:'10px', background:st.border+'22', color:st.border, padding:'1px 5px', borderRadius:'20px', fontWeight:'700' }}>{items.length}</span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                        {items.map(task => {
                          const pc = pipeColor(task);
                          const dur = elapsed_s(task);
                          return (
                            <div key={task.id} style={{ background:st.bg, border:`1px solid ${st.border}`, borderLeft:`3px solid ${pc}`,
                              borderRadius:'6px', padding:'7px 8px', transition:'all .3s' }}>
                              <div style={{ fontSize:'11px', fontWeight:'700', color:st.text, marginBottom:'2px' }}>{task.name}</div>
                              {task.pipeline_name && <div style={{ fontSize:'9px', color:pc, opacity:.9, marginBottom:'3px' }}>{task.pipeline_name}</div>}

                              {/* Runner info */}
                              {task.assigned_runner && (
                                <div style={{ fontSize:'9px', color:'#64748b' }}>
                                  🖥 {task.assigned_runner}
                                </div>
                              )}

                              {/* Timer / Duration */}
                              {dur !== null && (
                                <div style={{ fontSize:'11px', fontWeight:'800', color: s==='RUNNING' ? '#f59e0b' : st.border, fontVariantNumeric:'tabular-nums', marginTop:'4px' }}>
                                  {s === 'RUNNING' ? `⏱ ${dur.toFixed(1)}s` : `✓ ${dur.toFixed(1)}s`}
                                </div>
                              )}

                              {/* Running progress bar */}
                              {s === 'RUNNING' && (
                                <div style={{ marginTop:'5px', height:'3px', background:'#334155', borderRadius:'2px', overflow:'hidden' }}>
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
              <div style={{ background:'#1e293b', borderRadius:'12px', border:'1px solid #334155', padding:'14px 18px' }}>
                <h3 style={{ fontWeight:'bold', fontSize:'14px', margin:'0 0 12px' }}>
                  📈 {ALGORITHMS.find(a => a.id===algorithm)?.label} Results
                </h3>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'8px', marginBottom:'12px' }}>
                  {[
                    ['⏱ Total Makespan',`${(metrics.makespan||0).toFixed(2)}s`,'#6366f1'],
                    ['⏳ Avg Wait Time', `${(metrics.avg_wait_time||0).toFixed(2)}s`,'#f59e0b'],
                    ['🖥 Utilization',   `${(metrics.overall_utilization||0).toFixed(1)}%`,'#10b981'],
                    ['✅ Tasks Done',    `${metrics.successful_tasks||0}/${metrics.total_tasks||0}`,'#22c55e'],
                    ['❌ Failed',        `${metrics.failed_tasks||0}`,'#ef4444'],
                    ['📋 Pipelines',     `${selected.length}`,'#8b5cf6'],
                  ].map(([label, val, clr]) => (
                    <div key={label} style={{ background:'#0f172a', borderRadius:'8px', padding:'12px', textAlign:'center', border:'1px solid #334155' }}>
                      <div style={{ fontSize:'10px', color:'#64748b', marginBottom:'4px' }}>{label}</div>
                      <div style={{ fontSize:'20px', fontWeight:'bold', color:clr }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Per-runner breakdown */}
                {(metrics.runner_stats||[]).length > 0 && (
                  <>
                    <p style={{ fontSize:'11px', color:'#64748b', margin:'0 0 7px' }}>Runner Breakdown</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'7px' }}>
                      {metrics.runner_stats.map(rs => (
                        <div key={rs.runner_id} style={{ background:'#0f172a', borderRadius:'8px', padding:'10px', border:'1px solid #334155' }}>
                          <div style={{ fontWeight:'600', fontSize:'12px', marginBottom:'4px' }}>{rs.runner_name}</div>
                          <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'3px' }}>{rs.tasks_completed} tasks completed</div>
                          <div style={{ height:'4px', background:'#334155', borderRadius:'2px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${rs.utilization||0}%`, background:'#10b981' }}/>
                          </div>
                          <div style={{ fontSize:'10px', color:'#10b981', marginTop:'2px', textAlign:'right' }}>
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

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
