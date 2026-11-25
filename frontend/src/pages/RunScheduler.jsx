import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getPipelines, getRunners, runMultiAllPipelines } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Play, Server, Clock, Activity, CheckCircle, XCircle, Trophy, Zap, BarChart2, LogIn, Shield } from 'lucide-react';

/* ---- Constants ---- */
const PIPE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ALGORITHMS = [
  { id: 'fcfs',             label: 'FCFS',       desc: 'First Come First Serve',       color: '#6366f1' },
  { id: 'priority',         label: 'Priority',    desc: 'Highest priority runs first',  color: '#f59e0b' },
  { id: 'dependency_aware', label: 'Dep-Aware',   desc: 'Unblocking tasks prioritized', color: '#10b981' },
  { id: 'resource_aware',   label: 'Res-Aware',   desc: 'Best-fit resource assignment', color: '#0ea5e9' },
];

const ALGO_LABELS = {
  fcfs: 'FCFS',
  priority: 'Priority',
  dependency_aware: 'Dep-Aware',
  resource_aware: 'Res-Aware',
};

const STATUS_STYLE = {
  PENDING: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.08)', text: '#888888', badge: 'badge badge-slate' },
  READY:   { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)',  text: '#ededed', badge: 'badge badge-blue' },
  RUNNING: { bg: 'rgba(245,158,11,0.05)',  border: 'rgba(245,158,11,0.2)',   text: '#f59e0b', badge: 'badge badge-amber' },
  SUCCESS: { bg: 'rgba(16,185,129,0.05)',  border: 'rgba(16,185,129,0.2)',   text: '#10b981', badge: 'badge badge-emerald' },
  FAILED:  { bg: 'rgba(239,68,68,0.05)',   border: 'rgba(239,68,68,0.2)',    text: '#ef4444', badge: 'badge badge-rose' },
};

/* ---- helpers (defined at module scope, never inside JSX) ---- */
function hexAlpha(hex, alpha) {
  return hex + alpha;
}
function pxVal(n) {
  return n + 'px';
}
function pctVal(n) {
  return n + '%';
}
function timeVal(n) {
  return n.toFixed(1) + 's';
}
function solidBorder(w, color) {
  return w + ' solid ' + color;
}
function animStr(name, dur) {
  return name + ' ' + dur + 's linear infinite';
}

/* ---- Gantt Chart ---- */
function GanttChart({ allTasks, runners, visualMakespan, currentTime, getColor }) {
  if (!allTasks.length || !visualMakespan) return null;

  const ticks = [0, 25, 50, 75, 100].map(p => ({
    p,
    label: ((p / 100) * visualMakespan).toFixed(1) + 's',
  }));

  return (
    <div className="glass-card" style={{ marginBottom: '16px' }}>
      <div className="glass-card-header">
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} style={{ color: '#888888' }} /> Gantt Chart
        </h3>
      </div>
      <div className="glass-card-body" style={{ paddingTop: '16px' }}>
        <div style={{ marginLeft: '90px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888888', marginBottom: '12px' }}>
          {ticks.map(t => <span key={t.p}>{t.label}</span>)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {runners.map(runner => {
            const rtasks = allTasks.filter(t => t.assigned_runner === runner.name && t.rel_start !== null);
            return (
              <div key={runner.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '82px', fontSize: '12px', fontWeight: '500', flexShrink: 0, color: '#888888', lineHeight: '1.4' }}>
                  <div style={{ color: '#ededed' }}>{runner.name}</div>
                  <div style={{ fontSize: '11px' }}>{runner.cpu_cores}C/{runner.ram_gb}G</div>
                </div>
                <div style={{ flex: 1, height: '36px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {rtasks.map(task => {
                    const left    = (task.rel_start / visualMakespan) * 100;
                    const width   = Math.max(((task.rel_end - task.rel_start) / visualMakespan) * 100, 1);
                    const clr     = getColor(task);
                    const done    = currentTime >= task.rel_end;
                    const running = currentTime >= task.rel_start && currentTime < task.rel_end;
                    const prog    = running ? Math.min((currentTime - task.rel_start) / (task.rel_end - task.rel_start), 1) : (done ? 1 : 0);

                    // Build style values as variables — no concat inside JSX style props
                    const taskBg     = done ? clr : running ? hexAlpha(clr, '88') : hexAlpha(clr, '22');
                    const taskBorder = solidBorder('1px', clr);
                    const progW      = pctVal(prog * 100);
                    const progBg     = hexAlpha(clr, '60');
                    const leftPct    = pctVal(left);
                    const widthPct   = pctVal(width);
                    const taskTitle  = task.name + ' (' + (task.rel_end - task.rel_start).toFixed(1) + 's)';
                    const pipeSuffix = task.pipeline_name ? ' [' + task.pipeline_name.slice(0, 4) + ']' : '';
                    const cursorPos  = pctVal((currentTime / visualMakespan) * 100);

                    return (
                      <div key={task.id} title={taskTitle}
                        style={{ position: 'absolute', left: leftPct, width: widthPct, top: '4px', height: '26px',
                          background: taskBg, borderRadius: '4px', border: taskBorder,
                          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>
                        {running && <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: progW, background: progBg }} />}
                        <span style={{ position: 'relative', zIndex: 1, fontSize: '11px', fontWeight: '500',
                          color: done ? '#000000' : '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden',
                          textOverflow: 'ellipsis', padding: '0 6px', textShadow: done ? 'none' : '0 1px 2px rgba(0,0,0,0.5)' }}>
                          {task.name}{pipeSuffix}
                        </span>
                      </div>
                    );
                  })}
                  {currentTime > 0 && currentTime < visualMakespan && (
                    <div style={{ position: 'absolute', left: pctVal((currentTime / visualMakespan) * 100), top: 0, bottom: 0, width: '2px', background: 'rgba(255,255,255,0.8)', zIndex: 20 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {Object.entries(
            Object.fromEntries(allTasks.filter(t => t.pipeline_name).map(t => [t.pipeline_name, t.pipeline_color || '#0070f3']))
          ).map(([name, clr]) => (
            <span key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ededed', fontWeight: '500' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: clr, display: 'inline-block' }} />
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Comparison Panel ---- */
function ComparisonPanel({ allResults, bestAlgo, pipelineCount }) {
  const bestAlgoObj = ALGORITHMS.find(a => a.id === bestAlgo);
  const bestColor   = bestAlgoObj ? bestAlgoObj.color : '#10b981';

  const rows = ALGORITHMS.map(a => {
    const r = allResults[a.id];
    if (!r || r.error) return { ...a, makespan: null, avgWait: null, util: null, error: true };
    const taskStr = (r.successful_tasks || 0) + '/' + (r.total_tasks || 0);
    return { ...a, makespan: r.makespan, avgWait: r.avg_wait_time, util: r.overall_utilization,
      tasks: taskStr, isBest: a.id === bestAlgo };
  });

  const makespans = rows.filter(r => r.makespan != null).map(r => r.makespan);
  const maxMs = Math.max(...makespans, 1);

  const bestBg     = 'rgba(16,185,129,0.09)';
  const bestBorder = '1px solid rgba(16,185,129,0.25)';
  const bestIconBg = 'rgba(16,185,129,0.13)';

  return (
    <div className="glass-card" style={{ flexShrink: 0, marginTop: '8px' }}>
      <div className="glass-card-header">
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={16} style={{ color: '#888888' }} /> Algorithm Comparison Results
        </h3>
      </div>
      <div className="glass-card-body">
        {/* Best Algorithm Banner */}
        {bestAlgo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderRadius: '10px', marginBottom: '20px',
            background: bestBg, border: bestBorder }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bestIconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trophy size={20} style={{ color: bestColor }} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Best Algorithm for Your Workload
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: bestColor }}>
                {ALGO_LABELS[bestAlgo] || bestAlgo}
                <span style={{ fontSize: '13px', color: '#888888', fontWeight: '400', marginLeft: '10px' }}>
                  — fastest makespan across {pipelineCount} pipeline(s)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: '#888888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {['Algorithm', 'Makespan', 'Relative Speed', 'Avg Wait', 'Utilization', 'Tasks'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowBg       = row.isBest ? 'rgba(99,102,241,0.05)' : 'transparent';
                const nameColor   = row.isBest ? row.color : '#ededed';
                const barWidth    = row.makespan != null ? pctVal((row.makespan / maxMs) * 100) : '0%';
                const barPct      = row.makespan != null ? ((row.makespan / maxMs) * 100).toFixed(0) + '%' : '';
                const utilColor   = row.util > 70 ? '#10b981' : '#f59e0b';
                const bestTagBg   = 'rgba(99,102,241,0.15)';
                const makespanStr = row.makespan != null ? row.makespan.toFixed(2) + 's' : '';
                const avgWaitStr  = row.avgWait != null ? row.avgWait.toFixed(2) + 's' : '—';
                const utilStr     = row.util != null ? row.util.toFixed(1) + '%' : '—';
                return (
                  <tr key={row.id} style={{ background: rowBg }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color, display: 'inline-block', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: '600', color: nameColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {row.label}
                            {row.isBest && (
                              <span style={{ fontSize: '10px', background: bestTagBg, color: row.color, padding: '1px 7px', borderRadius: '99px', fontWeight: '700' }}>BEST</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#888888', marginTop: '2px' }}>{row.desc}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {row.error
                        ? <span style={{ color: '#ef4444', fontSize: '12px' }}>Error</span>
                        : <span style={{ fontWeight: '600', color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>{makespanStr}</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {!row.error && row.makespan != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', minWidth: '80px' }}>
                            <div style={{ height: '100%', width: barWidth, background: row.color, borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: '#888888', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {barPct}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', color: '#ededed', fontVariantNumeric: 'tabular-nums' }}>
                      {avgWaitStr}
                    </td>
                    <td style={{ padding: '12px', fontVariantNumeric: 'tabular-nums' }}>
                      {row.error ? '—' : (
                        <span style={{ color: utilColor }}>{utilStr}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', color: '#888888' }}>
                      {row.error ? '—' : row.tasks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Main Component ---- */
export default function RunScheduler() {
  const { user, isAuthenticated } = useAuth();
  const [pipelines,      setPipelines]      = useState([]);
  const [runners,        setRunners]        = useState([]);
  const [selected,       setSelected]       = useState([]);
  const [phase,          setPhase]          = useState('idle');
  const [allResults,     setAllResults]     = useState({});
  const [bestAlgo,       setBestAlgo]       = useState(null);
  const [pipeInfo,       setPipeInfo]       = useState({});
  const [activeTab,      setActiveTab]      = useState('fcfs');
  const [tabState,       setTabState]       = useState({});

  const timersRef    = useRef({});
  const snapRefs     = useRef({});
  const runnersRef   = useRef([]);
  const doneAlgosRef = useRef(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [pr, rr] = await Promise.all([getPipelines(), getRunners()]);
        const pipeList = pr.data || [];
        setPipelines(pipeList);
        setRunners(rr.data || []);
        runnersRef.current = rr.data || [];
        // Auto-select all available pipelines for quick testing
        if (pipeList.length > 0) {
          setSelected(pipeList.map(p => p.id));
        }
      } catch {
        toast.error('Could not reach backend');
      }
    })();
    return () => Object.values(timersRef.current).forEach(clearInterval);
  }, [isAuthenticated]);

  const toggle = (id) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const pipeColor = (task, pi) => {
    if (!task) return '#6366f1';
    const info = pi || pipeInfo;
    for (const [, inf] of Object.entries(info)) {
      if (task.id && inf.prefix && task.id.startsWith(inf.prefix)) return inf.color || '#6366f1';
    }
    return task.pipeline_color || '#6366f1';
  };

  const handleRun = async () => {
    if (!isAuthenticated) {
      toast.error('Sign-in required to execute simulations');
      return;
    }
    if (!selected.length) { toast.error('Select at least one pipeline'); return; }
    if (!runners.length)  { toast.error('No runners — add them first'); return; }

    Object.values(timersRef.current).forEach(clearInterval);
    timersRef.current = {};
    snapRefs.current  = {};
    doneAlgosRef.current = new Set();

    setPhase('running');
    setAllResults({});
    setBestAlgo(null);
    setTabState({});
    setPipeInfo({});

    try {
      const { data } = await runMultiAllPipelines(selected);
      if (!data || data.error) { toast.error(data?.message || 'Run failed'); setPhase('idle'); return; }

      const results = data.results || {};
      const best    = data.best_algorithm;
      const pi      = data.pipeline_info || {};
      const spd     = data.speed_multiplier || 5.0;

      setAllResults(results);
      setBestAlgo(best);
      setPipeInfo(pi);

      const initState = {};
      ALGORITHMS.forEach(a => {
        initState[a.id] = { replayTasks: [], runnerState: {}, pct: 0, currentTime: 0, visualMakespan: 0, done: false };
      });
      setTabState(initState);
      setPhase('replay');
      setActiveTab('fcfs');

      ALGORITHMS.forEach(a => {
        const m = results[a.id];
        if (!m || m.error) {
          setTabState(prev => ({ ...prev, [a.id]: { ...prev[a.id], done: true, pct: 100 } }));
          return;
        }
        beginReplayForAlgo(a.id, m.task_details || [], m.makespan || 1, pi, spd, best);
      });

    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Simulation failed');
      setPhase('idle');
    }
  };

  const beginReplayForAlgo = (algoId, tasks, actualMakespan, pi, speedMult, bestWinner) => {
    if (!tasks.length) {
      setTabState(prev => ({ ...prev, [algoId]: { ...prev[algoId], done: true, pct: 100 } }));
      return;
    }
    const starts = tasks.map(t => t.start_time).filter(Boolean);
    if (!starts.length) {
      setTabState(prev => ({ ...prev, [algoId]: { ...prev[algoId], done: true, pct: 100 } }));
      return;
    }
    const t0       = Math.min(...starts);
    const visualMs = actualMakespan * speedMult;

    const norm = tasks.map(t => ({
      ...t,
      rel_ready: t.start_time ? Math.max(0, ((t.start_time - t0) - (t.wait_time || 0)) * speedMult) : 0,
      rel_start: t.start_time ? (t.start_time - t0) * speedMult : null,
      rel_end:   t.end_time   ? (t.end_time   - t0) * speedMult : null,
      curStatus: 'PENDING',
      progress:  0,
    }));

    snapRefs.current[algoId] = norm;
    setTabState(prev => ({ ...prev, [algoId]: { ...prev[algoId], replayTasks: [...norm], visualMakespan: visualMs } }));

    const REPLAY_MS = Math.min(visualMs * 1000, 60000);
    const TICK      = 80;
    const scale     = visualMs / (REPLAY_MS / 1000);
    let   elapsed   = 0;
    const runnersSnapshot = runnersRef.current;

    timersRef.current[algoId] = setInterval(() => {
      elapsed += (TICK / 1000) * scale;
      const t = elapsed;

      const updated = (snapRefs.current[algoId] || norm).map(task => {
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

      snapRefs.current[algoId] = updated;

      const rm = {};
      runnersSnapshot.forEach(r => { rm[r.name] = null; });
      updated.forEach(task => {
        if (task.curStatus === 'RUNNING' && task.assigned_runner) rm[task.assigned_runner] = task;
      });

      const pct = Math.min((t / visualMs) * 100, 100);

      if (t >= visualMs + 0.5) {
        clearInterval(timersRef.current[algoId]);
        const finalRm = {};
        runnersSnapshot.forEach(r => { finalRm[r.name] = null; });
        doneAlgosRef.current.add(algoId);

        setTabState(prev => ({
          ...prev,
          [algoId]: {
            replayTasks: updated,
            runnerState: finalRm,
            pct: 100,
            currentTime: visualMs,
            visualMakespan: visualMs,
            done: true,
          }
        }));

        if (doneAlgosRef.current.size === ALGORITHMS.length) {
          setPhase('done');
          if (bestWinner) {
            const bestLabel = ALGO_LABELS[bestWinner] || bestWinner;
            toast.success('Simulation Completed! Recommended Best: ' + bestLabel, { icon: '🏆', duration: 4000 });
          }
        }
        return;
      }
      setTabState(prev => ({ ...prev, [algoId]: { ...prev[algoId], replayTasks: updated, runnerState: rm, pct, currentTime: t, visualMakespan: visualMs } }));
    }, TICK);
  };

  const elapsed_s = (task, currentTime) => {
    if (!task || task.rel_start === null) return null;
    if (task.curStatus === 'RUNNING') return Math.max(0, currentTime - task.rel_start);
    if (task.rel_end !== null) return task.rel_end - task.rel_start;
    return null;
  };

  const activeAlgo     = ALGORITHMS.find(a => a.id === activeTab);
  const ts             = tabState[activeTab] || {};
  const replayTasks    = ts.replayTasks    || [];
  const runnerState    = ts.runnerState    || {};
  const pct            = ts.pct            || 0;
  const currentTime    = ts.currentTime    || 0;
  const visualMakespan = ts.visualMakespan || 0;

  const STATUSES = ['PENDING', 'READY', 'RUNNING', 'SUCCESS', 'FAILED'];
  const columns  = STATUSES.map(s => ({
    s,
    items: replayTasks.filter(t => t.curStatus === s).sort((a, b) => {
      if (s === 'SUCCESS' || s === 'FAILED') return (a.rel_end || 0) - (b.rel_end || 0);
      if (s === 'RUNNING') return (a.rel_start || 0) - (b.rel_start || 0);
      return 0;
    }),
  }));

  const isRunning  = phase === 'running';
  const hasStarted = phase === 'replay' || phase === 'done';

  /* pre-compute spinner ring styles (never computed inside JSX) */
  const spinnerRings = ALGORITHMS.map((a, i) => {
    const size    = 50 + i * 18;
    const half    = 25 + i * 9;
    const dur     = (0.9 + i * 0.3).toFixed(1);
    const bdr     = hexAlpha(a.color, '30');
    const negHalf = '-' + pxVal(half);
    return { id: a.id, color: a.color, size, half, dur, border: bdr, negHalf };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', height: 'calc(100vh - 110px)' }}>

      {/* LEFT: Setup */}
      <aside className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
        <div className="glass-card-header">
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed' }}>Run Setup</h3>
        </div>
        <div className="glass-card-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, padding: '20px' }}>

          {/* Pipelines */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Pipelines</p>
              {user?.is_admin && (
                <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Shield size={12} /> All Accounts
                </span>
              )}
            </div>
            {pipelines.length === 0
              ? (
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '12px', color: '#94a3b8' }}>
                  {isAuthenticated
                    ? 'No pipelines found for your account. Create one in Pipeline Builder.'
                    : 'Sign in to access your registered pipelines.'}
                </div>
              )
              : pipelines.map((p, i) => {
                  const clr = PIPE_COLORS[i % PIPE_COLORS.length];
                  const on  = selected.includes(p.id);
                  const labelBorder = on ? solidBorder('1px', clr) : '1px solid rgba(255,255,255,0.08)';
                  const labelBg     = on ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)';
                  const nameColor   = on ? '#ffffff' : '#ededed';
                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer',
                      border: labelBorder, background: labelBg, transition: 'all 0.2s' }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ accentColor: clr, width: '16px', height: '16px' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: clr, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: nameColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          {p.owner_username && (
                            <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>
                              @{p.owner_username}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888888', marginTop: '2px' }}>{p.tasks?.length || 0} tasks</div>
                      </div>
                    </label>
                  );
                })
            }
          </section>

          {/* Algo info */}
          <section>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={12} /> All 4 Algorithms
            </p>
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#a5b4fc', lineHeight: '1.6', marginBottom: '12px' }}>
              All 4 scheduling algorithms run simultaneously. After completion, the system recommends the best performing one for your workload.
            </div>
            {ALGORITHMS.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888888', marginBottom: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                <span style={{ color: '#ededed', fontWeight: '500' }}>{a.label}</span>
                <span>— {a.desc}</span>
              </div>
            ))}
          </section>

          {/* Runners */}
          <section>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} /> Shared Runners ({runners.length})
            </p>
            {runners.length === 0
              ? <p style={{ color: '#ef4444', fontSize: '13px' }}>No runners added.</p>
              : runners.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px' }}>
                  <span style={{ fontWeight: '500', color: '#ededed' }}>{r.name}</span>
                  <span style={{ color: '#888888', fontSize: '12px' }}>{r.cpu_cores}C / {r.ram_gb}G</span>
                </div>
              ))
            }
          </section>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          {!isAuthenticated ? (
            <Link to="/login" className="btn-primary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogIn size={16} /> Sign In to Run Simulations
            </Link>
          ) : (
            <button onClick={handleRun} disabled={isRunning || !selected.length || !runners.length}
              className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {isRunning
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Running all 4 Algorithms...
                  </span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Play size={16} />
                    Run &amp; Compare Algorithms
                  </span>
              }
            </button>
          )}
        </div>
      </aside>

      {/* RIGHT: Visualisation */}
      <main style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>

        {/* Empty state */}
        {phase === 'idle' && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 40px', textAlign: 'center', height: '100%' }}>
            <BarChart2 size={48} style={{ color: '#334155', marginBottom: '24px' }} />
            <p style={{ fontSize: '18px', color: '#ffffff', marginBottom: '12px', fontWeight: '500' }}>Compare All Scheduling Algorithms</p>
            <p style={{ fontSize: '14px', color: '#888888', maxWidth: '420px', lineHeight: '1.6' }}>
              Select pipelines and click <strong style={{ color: '#ededed' }}>Run &amp; Compare Algorithms</strong>. All 4 scheduling algorithms run simultaneously on your tasks, then the system recommends the best fit.
            </p>
          </div>
        )}

        {/* Loading spinner */}
        {isRunning && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center', height: '100%' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '32px' }}>
              {spinnerRings.map(ring => (
                <div key={ring.id} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: pxVal(ring.size), height: pxVal(ring.size),
                  marginLeft: ring.negHalf, marginTop: ring.negHalf,
                  border: solidBorder('2px', ring.border), borderTopColor: ring.color,
                  borderRadius: '50%', animation: animStr('runspin', ring.dur)
                }} />
              ))}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
                <Zap size={22} style={{ color: '#ededed' }} />
              </div>
            </div>
            <p style={{ fontSize: '18px', fontWeight: '500', color: '#ffffff', marginBottom: '8px' }}>Running all 4 algorithms in parallel...</p>
            <p style={{ fontSize: '14px', color: '#888888' }}>Scheduling {selected.length} pipeline(s) across {runners.length} runner(s)</p>
            <style>{`@keyframes runspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Tabs + Replay */}
        {hasStarted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Algorithm Tabs */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {ALGORITHMS.map(a => {
                  const tsA      = tabState[a.id] || {};
                  const isActive = activeTab === a.id;
                  const isBest   = a.id === bestAlgo;
                  const m        = allResults[a.id];
                  const tabBorderBottom = isActive ? solidBorder('2px', a.color) : '2px solid transparent';
                  const makespanLabel   = m && !m.error && tsA.done ? m.makespan.toFixed(2) + 's' : null;
                  const tabNameColor    = isActive ? '#ffffff' : '#888888';
                  const msColor        = isBest ? a.color : '#888888';
                  const miniBarWidth   = pctVal(tsA.pct || 0);
                  return (
                    <button key={a.id} onClick={() => setActiveTab(a.id)}
                      style={{ flex: 1, padding: '14px 10px', background: 'transparent', border: 'none', cursor: 'pointer',
                        borderBottom: tabBorderBottom, transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: a.color }} />
                          <span style={{ fontSize: '13px', fontWeight: '600', color: tabNameColor }}>{a.label}</span>
                          {phase === 'done' && isBest && <Trophy size={12} style={{ color: a.color }} />}
                        </div>
                        {makespanLabel
                          ? <span style={{ fontSize: '11px', color: msColor, fontVariantNumeric: 'tabular-nums' }}>{makespanLabel}</span>
                          : !tsA.done
                          ? <div style={{ width: '36px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: miniBarWidth, background: a.color, transition: 'width 80ms linear' }} />
                            </div>
                          : <span style={{ fontSize: '11px', color: '#888888' }}>—</span>
                        }
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress bar for active tab */}
            <div className="glass-card" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: '500', color: '#ffffff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} style={{ color: '#888888' }} />
                  <span style={{ color: activeAlgo ? activeAlgo.color : '#888888' }}>{activeAlgo ? activeAlgo.label : ''}</span>
                  {ts.done
                    ? ' — completed in ' + visualMakespan.toFixed(2) + 's'
                    : ' : ' + currentTime.toFixed(1) + 's running'}
                </span>
                {ts.done ? (
                  <span className="badge badge-emerald">Completed</span>
                ) : (
                  <span className="badge badge-blue">
                    {replayTasks.filter(t => t.curStatus === 'SUCCESS' || t.curStatus === 'FAILED').length}/{replayTasks.length} tasks
                  </span>
                )}
              </div>
              <div style={{ height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ height: '100%', width: ts.done ? '100%' : pctVal(pct), background: activeAlgo ? activeAlgo.color : '#0070f3', transition: 'width 80ms linear' }} />
              </div>
            </div>

            {/* Gantt */}
            <GanttChart allTasks={replayTasks} runners={runners} visualMakespan={visualMakespan} currentTime={currentTime} getColor={(task) => pipeColor(task, pipeInfo)} />

            {/* Runner Status */}
            <div className="glass-card" style={{ flexShrink: 0 }}>
              <div className="glass-card-header">
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={16} style={{ color: '#888888' }} /> Runner Status
                  <span style={{ fontSize: '12px', color: activeAlgo ? activeAlgo.color : '#888888' }}>({activeAlgo ? activeAlgo.label : ''})</span>
                </h3>
              </div>
              <div className="glass-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {runners.map(runner => {
                  const busy        = runnerState[runner.name] || null;
                  const tc          = busy ? pipeColor(busy, pipeInfo) : 'rgba(255,255,255,0.08)';
                  const dur         = busy ? elapsed_s(busy, currentTime) : null;
                  const cardBorder  = solidBorder('1px', busy ? tc : 'rgba(255,255,255,0.08)');
                  const cardBg      = busy ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)';
                  const progWidth   = pctVal(busy ? (busy.progress || 0) : 0);
                  const durStr      = dur !== null ? dur.toFixed(1) + 's' : '...';
                  return (
                    <div key={runner.id} style={{ border: cardBorder, borderRadius: '8px', padding: '16px', background: cardBg, transition: 'all .3s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '500', fontSize: '14px', color: '#ffffff' }}>{runner.name}</span>
                        <span className={busy ? 'badge badge-amber' : 'badge badge-slate'} style={{ fontSize: '10px', padding: '2px 8px' }}>
                          {busy ? 'BUSY' : 'FREE'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888888', marginBottom: '14px' }}>{runner.cpu_cores}C / {runner.ram_gb}G</div>
                      {busy ? (
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: tc, marginBottom: '6px' }}>
                            {busy.pipeline_name && <span style={{ opacity: 0.7 }}>[{busy.pipeline_name}] </span>}{busy.name}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={12} style={{ color: '#888888' }} /> {durStr}
                          </div>
                          <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: progWidth, background: tc, transition: 'width 80ms linear' }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#64748b', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                          Waiting for tasks...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task Flow */}
            <div className="glass-card" style={{ flexShrink: 0 }}>
              <div className="glass-card-header">
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} style={{ color: '#888888' }} /> Task Flow
                  <span style={{ fontSize: '12px', color: activeAlgo ? activeAlgo.color : '#888888' }}>({activeAlgo ? activeAlgo.label : ''})</span>
                </h3>
              </div>
              <div className="glass-card-body" style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))', gap: '16px' }}>
                  {columns.map(({ s, items }) => {
                    const st = STATUS_STYLE[s];
                    return (
                      <div key={s} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '0 4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: st.text, letterSpacing: '0.05em' }}>{s}</span>
                          <span className={st.badge}>{items.length}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {items.map(task => {
                            const pc          = pipeColor(task, pipeInfo);
                            const dur         = elapsed_s(task, currentTime);
                            const cardBorderL = solidBorder('3px', pc);
                            const durStr      = dur !== null ? dur.toFixed(1) + 's' : null;
                            const isRunning2  = s === 'RUNNING';
                            const taskProgW   = pctVal(task.progress || 0);
                            const timeColor   = isRunning2 ? '#f59e0b' : '#888888';
                            return (
                              <div key={task.id} className="glass-card" style={{ background: st.bg, border: solidBorder('1px', st.border), borderLeft: cardBorderL, padding: '10px', boxShadow: 'none' }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff', marginBottom: '5px', lineHeight: '1.4' }}>{task.name}</div>
                                {task.pipeline_name && <div style={{ fontSize: '11px', color: pc, opacity: 0.9, marginBottom: '6px', fontWeight: '500' }}>{task.pipeline_name}</div>}
                                {task.assigned_runner && (
                                  <div style={{ fontSize: '11px', color: '#888888', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Server size={11} /> {task.assigned_runner}
                                  </div>
                                )}
                                {durStr !== null && (
                                  <div style={{ fontSize: '12px', fontWeight: '500', color: timeColor, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={11} /> {durStr}
                                  </div>
                                )}
                                {isRunning2 && (
                                  <div style={{ marginTop: '8px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: taskProgW, background: '#f59e0b', transition: 'width 80ms linear' }} />
                                  </div>
                                )}
                                {s === 'SUCCESS' && <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}><CheckCircle size={13} style={{ color: '#10b981' }} /></div>}
                                {s === 'FAILED'  && <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}><XCircle size={13} style={{ color: '#ef4444' }} /></div>}
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

            {/* Comparison Panel after done */}
            {phase === 'done' && Object.keys(allResults).length > 0 && (
              <ComparisonPanel allResults={allResults} bestAlgo={bestAlgo} pipelineCount={selected.length} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
