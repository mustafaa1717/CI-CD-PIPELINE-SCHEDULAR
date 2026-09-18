import { useState, useEffect, useRef } from 'react';
import { getPipelines, getRunners, runMultiPipeline } from '../services/api';
import toast from 'react-hot-toast';

/* ── Design tokens ── */
const PIPE_COLORS = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];

const ALGORITHMS = [
  { id:'fcfs',             label:'FCFS',             desc:'First Come First Serve' },
  { id:'priority',         label:'Priority',          desc:'Highest priority runs first (1-10)' },
  { id:'dependency_aware', label:'Dependency-Aware',  desc:'Unblocking tasks prioritized' },
  { id:'resource_aware',   label:'Resource-Aware',    desc:'Best-fit resource assignment' },
];

const STATUS_STYLE = {
  PENDING: { bg:'rgba(15,20,40,0.8)',  border:'rgba(71,85,105,0.6)',  text:'#475569', glow:'none' },
  READY:   { bg:'rgba(6,50,100,0.5)',  border:'rgba(6,182,212,0.6)',  text:'#22d3ee', glow:'0 0 8px rgba(6,182,212,0.25)' },
  RUNNING: { bg:'rgba(80,40,5,0.6)',   border:'rgba(245,158,11,0.7)', text:'#fbbf24', glow:'0 0 10px rgba(245,158,11,0.35)' },
  SUCCESS: { bg:'rgba(5,40,22,0.6)',   border:'rgba(16,185,129,0.6)', text:'#34d399', glow:'0 0 8px rgba(16,185,129,0.25)' },
  FAILED:  { bg:'rgba(50,10,10,0.6)',  border:'rgba(239,68,68,0.6)',  text:'#f87171', glow:'0 0 8px rgba(239,68,68,0.25)' },
};

const glass = (extra={}) => ({
  background: 'rgba(13,20,42,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: '14px',
  ...extra,
});

/* ── Futuristic Gantt Chart ── */
function GanttChart({ allTasks, runners, visualMakespan, currentTime, getColor }) {
  if (!allTasks.length || !visualMakespan) return null;
  const tick = (pct) => ((pct / 100) * visualMakespan).toFixed(1) + 's';

  return (
    <div style={glass({ padding: '18px 22px' })}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
        <div style={{ width:'3px', height:'18px', background:'linear-gradient(180deg,#8b5cf6,#06b6d4)', borderRadius:'2px' }}/>
        <span style={{ fontWeight:'800', fontSize:'13px', letterSpacing:'0.08em', fontFamily:'monospace' }}>GANTT CHART</span>
        <span style={{ fontSize:'10px', color:'#475569', letterSpacing:'0.12em', fontFamily:'monospace' }}>CONCURRENT EXECUTION TIMELINE</span>
      </div>

      {/* Time axis */}
      <div style={{ marginLeft:'96px', display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#475569', marginBottom:'8px', fontFamily:'monospace', letterSpacing:'0.05em' }}>
        {[0,25,50,75,100].map(p => <span key={p}>{tick(p)}</span>)}
      </div>

      {/* Runner rows */}
      {runners.map(runner => {
        const rtasks = allTasks.filter(t => t.assigned_runner === runner.name && t.rel_start !== null);
        const hasTask = rtasks.some(t => currentTime >= t.rel_start && currentTime < (t.rel_end||Infinity));
        return (
          <div key={runner.id} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
            {/* Runner label */}
            <div style={{
              width:'86px', flexShrink:0, fontFamily:'monospace',
              padding:'4px 6px', borderRadius:'5px',
              background: hasTask ? 'rgba(139,92,246,0.12)' : 'rgba(5,10,22,0.6)',
              border: hasTask ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.04)',
              transition: 'all 0.3s',
            }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color: hasTask ? '#a78bfa' : '#64748b' }}>▣ {runner.name}</div>
              <div style={{ fontSize:'9px', color:'#374151' }}>{runner.cpu_cores}C·{runner.ram_gb}G</div>
            </div>

            {/* Timeline lane */}
            <div style={{
              flex:1, height:'32px', borderRadius:'6px', position:'relative', overflow:'hidden',
              background: 'rgba(5,10,22,0.8)',
              border: '1px solid rgba(139,92,246,0.08)',
              backgroundImage: 'linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)',
              backgroundSize: '10% 100%',
            }}>
              {rtasks.map(task => {
                const left  = (task.rel_start / visualMakespan) * 100;
                const width = Math.max(((task.rel_end - task.rel_start) / visualMakespan) * 100, 1);
                const clr   = getColor(task);
                const done  = currentTime >= task.rel_end;
                const running = currentTime >= task.rel_start && currentTime < task.rel_end;
                const prog  = running ? Math.min((currentTime - task.rel_start)/(task.rel_end - task.rel_start),1) : (done ? 1 : 0);
                return (
                  <div key={task.id}
                    title={`${task.name} (${(task.rel_end-task.rel_start).toFixed(1)}s)`}
                    style={{
                      position:'absolute', left:`${left}%`, width:`${width}%`, top:'3px', height:'26px',
                      background: done ? clr+'cc' : running ? clr+'55' : clr+'18',
                      borderRadius:'4px',
                      border: `1px solid ${clr}${done ? '' : '88'}`,
                      boxShadow: running ? `0 0 10px ${clr}55` : 'none',
                      overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'background 0.3s, box-shadow 0.3s',
                    }}>
                    {running && <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${prog*100}%`, background:`${clr}44` }}/>}
                    <span style={{ position:'relative', zIndex:1, fontSize:'8px', fontWeight:'800', color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', padding:'0 4px', fontFamily:'monospace', letterSpacing:'0.04em' }}>
                      {task.name}{task.pipeline_name ? ` ·${task.pipeline_name.slice(0,4).toUpperCase()}` : ''}
                    </span>
                  </div>
                );
              })}
              {/* Playhead */}
              {currentTime > 0 && currentTime < visualMakespan && (
                <div style={{ position:'absolute', left:`${(currentTime/visualMakespan)*100}%`, top:0, bottom:0, width:'2px', background:'rgba(255,255,255,0.8)', boxShadow:'0 0 6px rgba(255,255,255,0.5)', zIndex:20 }}/>
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ display:'flex', gap:'14px', marginTop:'12px', flexWrap:'wrap' }}>
        {Object.entries(Object.fromEntries(
          allTasks.filter(t => t.pipeline_name).map(t => [t.pipeline_name, t.pipeline_color || '#8b5cf6'])
        )).map(([name, clr]) => (
          <span key={name} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'10px', color:'#64748b', fontFamily:'monospace' }}>
            <span style={{ width:'10px', height:'10px', borderRadius:'2px', background:clr, display:'inline-block', boxShadow:`0 0 5px ${clr}` }}/>
            {name.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
export default function RunScheduler() {
  /* ── ALL STATE & LOGIC UNCHANGED ── */
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

  const timerRef   = useRef(null);
  const elapsed    = useRef(0);
  const snapRef    = useRef([]);
  const runnersRef = useRef([]);

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
      const m   = data.metrics || {};
      const pi  = data.pipeline_info || {};
      const spd = data.speed_multiplier || 5.0;
      setMetrics(m);
      setPipeInfo(pi);
      toast.success(`✓ Makespan: ${(m.makespan || 0).toFixed(2)}s`);
      beginReplay(m.task_details || [], m.makespan || 1, pi, spd);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Simulation failed');
      setPhase('idle');
    }
  };

  const beginReplay = (tasks, actualMakespan, pi, speedMult) => {
    if (!tasks.length) { setPhase('done'); return; }
    const starts = tasks.map(t => t.start_time).filter(Boolean);
    if (!starts.length) { setPhase('done'); return; }
    const t0 = Math.min(...starts);
    const visualMs = actualMakespan * speedMult;
    const norm = tasks.map(t => ({
      ...t,
      rel_ready: t.start_time ? Math.max(0, ((t.start_time - t0) - (t.wait_time || 0)) * speedMult) : 0,
      rel_start: t.start_time ? (t.start_time - t0) * speedMult : null,
      rel_end:   t.end_time   ? (t.end_time   - t0) * speedMult : null,
      curStatus: 'PENDING', progress: 0,
    }));
    snapRef.current = norm;
    setReplayTasks([...norm]);
    setVisualMakespan(visualMs);
    setPhase('replay');
    elapsed.current = 0;
    const REPLAY_MS = Math.min(visualMs * 1000, 60000);
    const TICK = 80;
    const scale = visualMs / (REPLAY_MS / 1000);
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
        } else if (t >= task.rel_ready) { curStatus = 'READY'; }
        return { ...task, curStatus, progress };
      });
      snapRef.current = updated;
      setReplayTasks([...updated]);
      setPct(Math.min((t / visualMs) * 100, 100));
      const rm = {};
      runnersRef.current.forEach(r => { rm[r.name] = null; });
      updated.forEach(task => { if (task.curStatus === 'RUNNING' && task.assigned_runner) rm[task.assigned_runner] = task; });
      setRunnerState({ ...rm });
      if (t >= visualMs + 0.5) {
        clearInterval(timerRef.current);
        setPhase('done'); setPct(100); setCurrentTime(visualMs);
        const finalRm = {};
        runnersRef.current.forEach(r => { finalRm[r.name] = null; });
        setRunnerState({ ...finalRm });
      }
    }, TICK);
  };

  const pipeColor = (task) => {
    if (!task) return '#8b5cf6';
    for (const [, info] of Object.entries(pipeInfo)) {
      if (task.id && info.prefix && task.id.startsWith(info.prefix)) return info.color || '#8b5cf6';
    }
    return task.pipeline_color || '#8b5cf6';
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
    items: replayTasks.filter(t => t.curStatus === s)
      .sort((a, b) => {
        if (s === 'SUCCESS' || s === 'FAILED') return (a.rel_end||0) - (b.rel_end||0);
        if (s === 'RUNNING') return (a.rel_start||0) - (b.rel_start||0);
        return 0;
      }),
  }));

  /* ════ RENDER ════ */
  return (
    <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:'14px', height:'calc(100vh - 90px)', color:'#e2e8f0' }}>

      {/* ══ LEFT SIDEBAR ══ */}
      <aside style={{ ...glass(), padding:'16px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'12px' }}>

        {/* Label */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'3px', height:'16px', background:'linear-gradient(180deg,#8b5cf6,#06b6d4)', borderRadius:'2px' }}/>
          <span style={{ fontSize:'10px', fontWeight:'800', letterSpacing:'0.15em', color:'#64748b', fontFamily:'monospace' }}>SCHEDULER CONFIG</span>
        </div>

        {/* Pipelines */}
        <section>
          <p style={{ fontSize:'9px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.12em', color:'#475569', margin:'0 0 6px', fontFamily:'monospace' }}>
            ◈ SELECT PIPELINES
          </p>
          <p style={{ fontSize:'9px', color:'#374151', margin:'0 0 8px', lineHeight:'1.5', fontFamily:'monospace' }}>
            All checked run simultaneously on shared runners
          </p>
          {pipelines.length === 0
            ? <p style={{ color:'#ef4444', fontSize:'11px', fontFamily:'monospace' }}>⚠ No pipelines found</p>
            : pipelines.map((p, i) => {
                const clr = PIPE_COLORS[i % PIPE_COLORS.length];
                const on  = selected.includes(p.id);
                return (
                  <label key={p.id} style={{
                    display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px',
                    borderRadius:'8px', marginBottom:'4px', cursor:'pointer',
                    border: on ? `1px solid ${clr}55` : '1px solid rgba(255,255,255,0.04)',
                    background: on ? `${clr}18` : 'rgba(5,10,22,0.5)',
                    boxShadow: on ? `0 0 12px ${clr}22` : 'none',
                    transition: 'all 0.2s',
                  }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ accentColor:clr, width:'13px', height:'13px' }}/>
                    <span style={{ width:'7px', height:'7px', borderRadius:'2px', background:clr, flexShrink:0, boxShadow:`0 0 6px ${clr}` }}/>
                    <div>
                      <div style={{ fontSize:'12px', fontWeight:'700', color: on ? '#e2e8f0' : '#94a3b8' }}>{p.name}</div>
                      <div style={{ fontSize:'9px', color:'#475569', fontFamily:'monospace' }}>{p.tasks?.length || 0} TASKS</div>
                    </div>
                  </label>
                );
              })
          }
        </section>

        <div style={{ height:'1px', background:'rgba(139,92,246,0.12)' }}/>

        {/* Algorithm */}
        <section>
          <p style={{ fontSize:'9px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.12em', color:'#475569', margin:'0 0 8px', fontFamily:'monospace' }}>
            ⚙ ALGORITHM
          </p>
          {ALGORITHMS.map(a => (
            <label key={a.id} style={{
              display:'flex', alignItems:'flex-start', gap:'8px', padding:'7px 10px',
              borderRadius:'8px', marginBottom:'4px', cursor:'pointer',
              border: algorithm===a.id ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.04)',
              background: algorithm===a.id ? 'rgba(139,92,246,0.12)' : 'rgba(5,10,22,0.5)',
              boxShadow: algorithm===a.id ? '0 0 10px rgba(139,92,246,0.15)' : 'none',
              transition: 'all 0.2s',
            }}>
              <input type="radio" name="algo" value={a.id} checked={algorithm===a.id} onChange={e => setAlgorithm(e.target.value)} style={{ accentColor:'#8b5cf6', marginTop:'2px' }}/>
              <div>
                <div style={{ fontSize:'11px', fontWeight:'700', color: algorithm===a.id ? '#a78bfa' : '#64748b' }}>{a.label}</div>
                <div style={{ fontSize:'9px', color:'#374151', lineHeight:'1.4' }}>{a.desc}</div>
              </div>
            </label>
          ))}
        </section>

        <div style={{ height:'1px', background:'rgba(139,92,246,0.12)' }}/>

        {/* Runners */}
        <section>
          <p style={{ fontSize:'9px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.12em', color:'#475569', margin:'0 0 6px', fontFamily:'monospace' }}>
            ▣ SHARED RUNNERS ({runners.length})
          </p>
          {runners.length === 0
            ? <p style={{ color:'#ef4444', fontSize:'10px', fontFamily:'monospace' }}>⚠ No runners configured</p>
            : runners.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', borderRadius:'5px', marginBottom:'3px', background:'rgba(5,10,22,0.7)', border:'1px solid rgba(139,92,246,0.08)', fontSize:'10px', fontFamily:'monospace' }}>
                <span style={{ fontWeight:'700', color:'#94a3b8' }}>{r.name}</span>
                <span style={{ color:'#475569' }}>{r.cpu_cores}C·{r.ram_gb}G</span>
              </div>
            ))
          }
        </section>

        {/* RUN BUTTON */}
        <button onClick={handleRun} disabled={phase==='running' || !selected.length || !runners.length}
          style={{
            marginTop:'auto', padding:'13px',
            background: phase==='running'
              ? 'rgba(67,56,202,0.6)'
              : selected.length
                ? 'linear-gradient(135deg, #7c3aed, #1d4ed8)'
                : 'rgba(20,25,45,0.8)',
            border: selected.length ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.05)',
            borderRadius:'10px', color:'white', fontWeight:'800',
            cursor: (phase==='running'||!selected.length) ? 'not-allowed' : 'pointer',
            fontSize:'12px', letterSpacing:'0.1em', fontFamily:'monospace',
            boxShadow: selected.length && phase!=='running' ? '0 0 20px rgba(139,92,246,0.35)' : 'none',
            transition: 'all 0.2s',
          }}>
          {phase==='running' ? '⏳ SIMULATING...' : `▶ RUN ${selected.length > 1 ? selected.length+' PIPELINES' : 'PIPELINE'}`}
        </button>
        {selected.length > 1 && phase !== 'running' &&
          <p style={{ textAlign:'center', fontSize:'9px', color:'#4f46e5', margin:0, fontFamily:'monospace', letterSpacing:'0.08em' }}>
            ALL PIPELINES SHARE RUNNERS
          </p>}
      </aside>

      {/* ══ RIGHT: VISUALIZATION ══ */}
      <main style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:'12px', paddingRight:'2px' }}>

        {/* IDLE */}
        {phase === 'idle' && (
          <div style={{ ...glass({ border:'2px dashed rgba(139,92,246,0.2)' }), padding:'80px 40px', textAlign:'center', flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:'64px', marginBottom:'20px', filter:'drop-shadow(0 0 30px rgba(139,92,246,0.5))' }}>🚀</div>
            <h2 style={{ margin:'0 0 8px', fontSize:'20px', fontWeight:'800', background:'linear-gradient(135deg,#a78bfa,#22d3ee)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              SCHEDULER READY
            </h2>
            <p style={{ color:'#475569', margin:'0 0 4px', fontSize:'14px' }}>
              Select pipelines → choose algorithm → click RUN
            </p>
            <p style={{ color:'#374151', margin:0, fontSize:'12px', fontFamily:'monospace' }}>
              TASKS FROM ALL PIPELINES COMPETE FOR THE SAME RUNNER POOL
            </p>
          </div>
        )}

        {/* LOADING */}
        {phase === 'running' && (
          <div style={{ ...glass(), padding:'80px 40px', textAlign:'center', flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:'56px', animation:'spin 1s linear infinite', display:'inline-block', marginBottom:'20px', filter:'drop-shadow(0 0 20px rgba(139,92,246,0.6))' }}>⚙️</div>
            <h2 style={{ margin:'0 0 10px', fontSize:'18px', fontWeight:'800', background:'linear-gradient(135deg,#a78bfa,#22d3ee)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              SCHEDULING {selected.length} PIPELINE{selected.length>1?'S':''} ON {runners.length} RUNNER{runners.length>1?'S':''}
            </h2>
            <p style={{ color:'#475569', margin:0, fontSize:'11px', fontFamily:'monospace', letterSpacing:'0.08em' }}>
              ALGORITHM: {ALGORITHMS.find(a => a.id===algorithm)?.label.toUpperCase()} · REAL-SPEED SIMULATION
            </p>
          </div>
        )}

        {/* REPLAY / DONE */}
        {(phase === 'replay' || phase === 'done') && (
          <>
            {/* ── Progress bar ── */}
            <div style={glass({ padding:'14px 20px' })}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  {phase==='replay' && <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#8b5cf6', boxShadow:'0 0 8px #8b5cf6', animation:'pulse-ring 1.5s ease-in-out infinite' }}/>}
                  <span style={{ fontWeight:'700', fontSize:'12px', fontFamily:'monospace', color: phase==='done' ? '#34d399' : '#a78bfa' }}>
                    {phase==='replay'
                      ? `◷ ${currentTime.toFixed(1)}s / ${visualMakespan.toFixed(1)}s`
                      : `✓ COMPLETED IN ${visualMakespan.toFixed(2)}s`}
                  </span>
                </div>
                <span style={{ fontFamily:'monospace', fontWeight:'800', fontSize:'13px', color: phase==='done' ? '#34d399' : '#a78bfa' }}>
                  {Math.round(pct)}%
                </span>
              </div>
              <div style={{ height:'5px', background:'rgba(5,10,22,0.8)', borderRadius:'3px', overflow:'hidden', border:'1px solid rgba(139,92,246,0.1)' }}>
                <div style={{
                  height:'100%', width:`${pct}%`,
                  background: phase==='done' ? 'linear-gradient(90deg,#10b981,#06b6d4)' : 'linear-gradient(90deg,#7c3aed,#06b6d4)',
                  transition:'width 80ms linear',
                  boxShadow: '0 0 10px rgba(139,92,246,0.5)',
                }}/>
              </div>
            </div>

            {/* ── GANTT ── */}
            <GanttChart allTasks={replayTasks} runners={runners} visualMakespan={visualMakespan} currentTime={currentTime} getColor={pipeColor}/>

            {/* ── RUNNER LANES ── */}
            <div style={glass({ padding:'16px 20px' })}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                <div style={{ width:'3px', height:'16px', background:'linear-gradient(180deg,#06b6d4,#10b981)', borderRadius:'2px' }}/>
                <span style={{ fontWeight:'800', fontSize:'12px', letterSpacing:'0.08em', fontFamily:'monospace' }}>RUNNER STATUS</span>
                <span style={{ fontSize:'9px', color:'#475569', fontFamily:'monospace' }}>LIVE</span>
                {phase==='replay' && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#06b6d4', boxShadow:'0 0 6px #06b6d4', animation:'pulse-ring 1s ease-in-out infinite' }}/>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'10px' }}>
                {runners.map(runner => {
                  const busy = runnerState[runner.name] || null;
                  const tc   = busy ? pipeColor(busy) : '#334155';
                  const taskElapsed = busy ? elapsed_s(busy) : null;
                  return (
                    <div key={runner.id} style={{
                      borderRadius:'10px', padding:'12px',
                      background: busy ? `${tc}0f` : 'rgba(5,10,22,0.7)',
                      border: `1px solid ${busy ? tc+'55' : 'rgba(255,255,255,0.04)'}`,
                      boxShadow: busy ? `0 0 15px ${tc}22` : 'none',
                      transition: 'all 0.4s',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                        <span style={{ fontWeight:'800', fontSize:'12px', fontFamily:'monospace' }}>▣ {runner.name}</span>
                        <span style={{
                          fontSize:'9px', padding:'2px 8px', borderRadius:'20px', fontWeight:'800', fontFamily:'monospace', letterSpacing:'0.06em',
                          background: busy ? `${tc}22` : 'rgba(255,255,255,0.04)',
                          color: busy ? tc : '#374151',
                          boxShadow: busy ? `0 0 8px ${tc}33` : 'none',
                          border: `1px solid ${busy ? tc+'33' : 'rgba(255,255,255,0.04)'}`,
                        }}>
                          {busy ? '● BUSY' : '○ FREE'}
                        </span>
                      </div>
                      <div style={{ fontSize:'9px', color:'#374151', marginBottom:'8px', fontFamily:'monospace' }}>
                        {runner.cpu_cores} CPU · {runner.ram_gb} GB RAM
                      </div>
                      {busy ? (
                        <>
                          <div style={{ fontSize:'11px', fontWeight:'700', color:tc, marginBottom:'4px', lineHeight:'1.3' }}>
                            {busy.pipeline_name && <span style={{ opacity:.6, fontSize:'9px', fontFamily:'monospace' }}>[{busy.pipeline_name.toUpperCase()}] </span>}
                            {busy.name}
                          </div>
                          <div style={{ fontSize:'20px', fontWeight:'900', color:tc, fontVariantNumeric:'tabular-nums', marginBottom:'6px', fontFamily:'monospace', letterSpacing:'-0.02em', textShadow:`0 0 10px ${tc}` }}>
                            ⏱ {taskElapsed !== null ? taskElapsed.toFixed(1)+'s' : '---'}
                          </div>
                          <div style={{ height:'3px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${busy.progress||0}%`, background:tc, boxShadow:`0 0 6px ${tc}`, transition:'width 80ms linear' }}/>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:'10px', color:'#1e293b', fontStyle:'italic', fontFamily:'monospace' }}>AWAITING TASK...</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── TASK KANBAN ── */}
            <div style={glass({ padding:'16px 20px' })}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                <div style={{ width:'3px', height:'16px', background:'linear-gradient(180deg,#f59e0b,#ec4899)', borderRadius:'2px' }}/>
                <span style={{ fontWeight:'800', fontSize:'12px', letterSpacing:'0.08em', fontFamily:'monospace' }}>TASK FLOW</span>
                <span style={{ fontSize:'9px', color:'#475569', fontFamily:'monospace' }}>{replayTasks.length} TASKS · {selected.length} PIPELINE{selected.length>1?'S':''}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px' }}>
                {columns.map(({ s, items }) => {
                  const st = STATUS_STYLE[s];
                  return (
                    <div key={s}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'7px' }}>
                        <span style={{ fontSize:'9px', fontWeight:'800', textTransform:'uppercase', color:st.border.replace('rgba','rgb').replace(',0.6)','').replace(',0.7)',''), letterSpacing:'.08em', fontFamily:'monospace' }}>{s}</span>
                        <span style={{ fontSize:'9px', background:`${st.border.replace('rgba','rgba').replace(',0.6)',',0.15)').replace(',0.7)',',0.15)')}`, color:st.text, padding:'1px 6px', borderRadius:'20px', fontWeight:'800', fontFamily:'monospace', border:`1px solid ${st.border}` }}>
                          {items.length}
                        </span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                        {items.map(task => {
                          const pc  = pipeColor(task);
                          const dur = elapsed_s(task);
                          return (
                            <div key={task.id} style={{
                              background: st.bg, borderRadius:'7px', padding:'7px 8px',
                              border: `1px solid ${st.border}`,
                              borderLeft: `3px solid ${pc}`,
                              boxShadow: st.glow,
                              transition: 'all 0.3s',
                            }}>
                              <div style={{ fontSize:'11px', fontWeight:'700', color:st.text, marginBottom:'2px', lineHeight:'1.2' }}>{task.name}</div>
                              {task.pipeline_name && (
                                <div style={{ fontSize:'8px', color:pc, fontFamily:'monospace', marginBottom:'3px', letterSpacing:'0.08em' }}>
                                  {task.pipeline_name.toUpperCase()}
                                </div>
                              )}
                              {task.assigned_runner && (
                                <div style={{ fontSize:'9px', color:'#374151', fontFamily:'monospace' }}>▣ {task.assigned_runner}</div>
                              )}
                              {dur !== null && (
                                <div style={{ fontSize:'11px', fontWeight:'900', color: s==='RUNNING' ? '#fbbf24' : st.text, fontVariantNumeric:'tabular-nums', marginTop:'4px', fontFamily:'monospace', textShadow: s==='RUNNING' ? '0 0 8px rgba(251,191,36,0.6)' : 'none' }}>
                                  {s === 'RUNNING' ? `⏱ ${dur.toFixed(1)}s` : `✓ ${dur.toFixed(1)}s`}
                                </div>
                              )}
                              {s === 'RUNNING' && (
                                <div style={{ marginTop:'5px', height:'2px', background:'rgba(255,255,255,0.05)', borderRadius:'1px', overflow:'hidden' }}>
                                  <div style={{ height:'100%', width:`${task.progress||0}%`, background:'#f59e0b', boxShadow:'0 0 5px rgba(245,158,11,0.7)', transition:'width 80ms linear' }}/>
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
              <div style={glass({ padding:'16px 20px' })}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                  <div style={{ width:'3px', height:'16px', background:'linear-gradient(180deg,#10b981,#8b5cf6)', borderRadius:'2px' }}/>
                  <span style={{ fontWeight:'800', fontSize:'12px', letterSpacing:'0.08em', fontFamily:'monospace' }}>
                    {ALGORITHMS.find(a => a.id===algorithm)?.label.toUpperCase()} · PERFORMANCE METRICS
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:'8px', marginBottom:'14px' }}>
                  {[
                    ['MAKESPAN',   `${(metrics.makespan||0).toFixed(2)}s`,                     '#8b5cf6'],
                    ['AVG WAIT',   `${(metrics.avg_wait_time||0).toFixed(2)}s`,                '#f59e0b'],
                    ['UTIL%',      `${(metrics.overall_utilization||0).toFixed(1)}%`,          '#06b6d4'],
                    ['COMPLETED',  `${metrics.successful_tasks||0}/${metrics.total_tasks||0}`, '#10b981'],
                    ['FAILED',     `${metrics.failed_tasks||0}`,                               '#ef4444'],
                    ['PIPELINES',  `${selected.length}`,                                       '#ec4899'],
                  ].map(([label, val, clr]) => (
                    <div key={label} style={{ background:'rgba(5,10,22,0.8)', borderRadius:'8px', padding:'12px 10px', textAlign:'center', border:'1px solid rgba(255,255,255,0.04)', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at top, ${clr}0a 0%, transparent 70%)` }}/>
                      <div style={{ fontSize:'8px', color:'#475569', marginBottom:'6px', fontFamily:'monospace', letterSpacing:'0.1em', position:'relative' }}>{label}</div>
                      <div style={{ fontSize:'18px', fontWeight:'900', color:clr, fontFamily:'monospace', textShadow:`0 0 15px ${clr}88`, position:'relative' }}>{val}</div>
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'1px', background:`linear-gradient(90deg,transparent,${clr},transparent)` }}/>
                    </div>
                  ))}
                </div>
                {(metrics.runner_stats||[]).length > 0 && (
                  <>
                    <p style={{ fontSize:'9px', color:'#475569', margin:'0 0 8px', fontFamily:'monospace', letterSpacing:'0.1em' }}>RUNNER BREAKDOWN</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'7px' }}>
                      {metrics.runner_stats.map(rs => (
                        <div key={rs.runner_id} style={{ background:'rgba(5,10,22,0.8)', borderRadius:'8px', padding:'10px', border:'1px solid rgba(139,92,246,0.1)' }}>
                          <div style={{ fontWeight:'700', fontSize:'11px', marginBottom:'4px', fontFamily:'monospace', color:'#94a3b8' }}>▣ {rs.runner_name}</div>
                          <div style={{ fontSize:'9px', color:'#475569', marginBottom:'5px', fontFamily:'monospace' }}>{rs.tasks_completed} TASKS COMPLETED</div>
                          <div style={{ height:'3px', background:'rgba(255,255,255,0.04)', borderRadius:'2px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${rs.utilization||0}%`, background:'linear-gradient(90deg,#10b981,#06b6d4)', boxShadow:'0 0 6px rgba(16,185,129,0.5)', transition:'width 0.5s' }}/>
                          </div>
                          <div style={{ fontSize:'9px', color:'#10b981', marginTop:'3px', textAlign:'right', fontFamily:'monospace', fontWeight:'700' }}>
                            {(rs.utilization||0).toFixed(1)}%
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
