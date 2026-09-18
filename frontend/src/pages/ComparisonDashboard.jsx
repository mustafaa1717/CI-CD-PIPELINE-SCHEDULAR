import { useState, useEffect } from 'react';
import { getPipelines, compareAlgorithms } from '../services/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ALGO_LABELS = {
  fcfs: 'FCFS', priority: 'Priority',
  dependency_aware: 'Dep-Aware', resource_aware: 'Res-Aware',
};

const ALGO_COLORS = {
  fcfs: '#8b5cf6', priority: '#06b6d4',
  dependency_aware: '#10b981', resource_aware: '#f59e0b',
};

const glass = (extra = {}) => ({
  background: 'rgba(13,20,42,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: '14px',
  ...extra,
});

export default function ComparisonDashboard() {
  const [pipelines,        setPipelines]        = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [results,          setResults]          = useState(null);
  const [loading,          setLoading]          = useState(false);

  useEffect(() => { fetchPipelines(); }, []);

  const fetchPipelines = async () => {
    try {
      const res = await getPipelines();
      setPipelines(res.data);
      if (res.data.length > 0) setSelectedPipeline(res.data[0].id);
    } catch { toast.error('Failed to load pipelines'); }
  };

  const handleCompare = async () => {
    if (!selectedPipeline) { toast.error('Select a pipeline first'); return; }
    setLoading(true); setResults(null);
    try {
      const res = await compareAlgorithms(selectedPipeline);
      setResults(res.data);
      toast.success('Comparison complete!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Comparison failed');
    } finally { setLoading(false); }
  };

  const getBest = (metric, lowerIsBetter = true) => {
    if (!results || results.length === 0) return null;
    return results.reduce((best, cur) =>
      lowerIsBetter ? (cur[metric] < best[metric] ? cur : best)
                    : (cur[metric] > best[metric] ? cur : best)
    ).algorithm;
  };

  const chartData = results?.map(r => ({ ...r, name: ALGO_LABELS[r.algorithm] || r.algorithm }));

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', animation: 'fade-up 0.4s ease' }}>

      {/* ── Header ── */}
      <div style={glass({ padding: '22px 28px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' })}>
        <div>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#475569', letterSpacing: '0.2em', marginBottom: '6px' }}>≋ ANALYSIS / ALGORITHM COMPARISON</div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', background: 'linear-gradient(135deg,#a78bfa,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Algorithm Benchmark
          </h1>
          <p style={{ color: '#475569', margin: '4px 0 0', fontSize: '13px' }}>Run all 4 scheduling strategies on the same pipeline and compare</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={selectedPipeline} onChange={e => setSelectedPipeline(e.target.value)}
            style={{ background: 'rgba(5,10,22,0.9)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', minWidth: '200px', fontSize: '13px', cursor: 'pointer' }}>
            {pipelines.length === 0 && <option value="">No pipelines</option>}
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleCompare} disabled={loading || !selectedPipeline}
            style={{ padding: '10px 24px', background: loading ? 'rgba(67,56,202,0.6)' : 'linear-gradient(135deg,#7c3aed,#1d4ed8)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: '8px', color: 'white', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', minWidth: '150px', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', boxShadow: loading ? 'none' : '0 0 20px rgba(139,92,246,0.35)' }}>
            {loading ? '⏳ RUNNING...' : '▶ COMPARE ALL'}
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={glass({ padding: '80px 40px', textAlign: 'center' })}>
          <div style={{ fontSize: '56px', animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '20px', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.6))' }}>⚙️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg,#a78bfa,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            RUNNING ALL 4 ALGORITHMS SIMULTANEOUSLY
          </h2>
          <p style={{ color: '#475569', margin: 0, fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
            FCFS · PRIORITY · DEPENDENCY-AWARE · RESOURCE-AWARE
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {results && !loading && (
        <>
          {/* Algorithm Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '14px', marginBottom: '20px' }}>
            {results.map(alg => {
              const isBestMakespan = getBest('makespan', true)      === alg.algorithm;
              const isBestWait    = getBest('avg_wait_time', true)   === alg.algorithm;
              const isBestUtil    = getBest('overall_utilization', false) === alg.algorithm;
              const isBest = isBestMakespan || isBestWait || isBestUtil;
              const clr = ALGO_COLORS[alg.algorithm] || '#8b5cf6';
              return (
                <div key={alg.algorithm} style={{
                  ...glass(),
                  padding: '20px',
                  position: 'relative', overflow: 'hidden',
                  border: isBest ? `1px solid ${clr}55` : '1px solid rgba(139,92,246,0.15)',
                  boxShadow: isBest ? `0 0 20px ${clr}22` : 'none',
                  transition: 'all 0.3s',
                }}>
                  {/* Corner glow */}
                  <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '100px', height: '100px', borderRadius: '50%', background: `radial-gradient(circle, ${clr}22 0%, transparent 70%)`, pointerEvents: 'none' }}/>
                  {/* Bottom strip */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${clr},transparent)` }}/>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#475569', letterSpacing: '0.1em', marginBottom: '4px' }}>ALGORITHM</div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: clr, textShadow: `0 0 15px ${clr}66` }}>
                        {ALGO_LABELS[alg.algorithm] || alg.algorithm}
                      </h3>
                    </div>
                    {isBest && <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 8px gold)' }}>👑</span>}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(139,92,246,0.1)', paddingTop: '14px' }}>
                    {[
                      { label: 'Makespan',    value: `${alg.makespan?.toFixed(2)}s`,              best: isBestMakespan },
                      { label: 'Avg Wait',    value: `${alg.avg_wait_time?.toFixed(3)}s`,          best: isBestWait },
                      { label: 'Utilization', value: `${alg.overall_utilization?.toFixed(1)}%`,    best: isBestUtil },
                      { label: 'Tasks Done',  value: `${alg.successful_tasks ?? '—'}/${alg.total_tasks ?? '—'}`, best: false },
                    ].map(({ label, value, best }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace', letterSpacing: '0.06em' }}>{label.toUpperCase()}</span>
                        <span style={{ fontWeight: '800', color: best ? '#34d399' : '#94a3b8', fontSize: '13px', fontFamily: 'monospace', textShadow: best ? '0 0 8px rgba(52,211,153,0.5)' : 'none' }}>
                          {best && '✓ '}{value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '14px' }}>
            {[
              { title: 'MAKESPAN (s) — LOWER BETTER',      dataKey: 'makespan',             color: '#8b5cf6' },
              { title: 'AVG WAIT TIME (s) — LOWER BETTER', dataKey: 'avg_wait_time',        color: '#f59e0b' },
              { title: 'RUNNER UTILIZATION % — HIGHER',    dataKey: 'overall_utilization',  color: '#10b981' },
            ].map(({ title, dataKey, color }) => (
              <div key={dataKey} style={glass({ padding: '20px', height: '300px' })}>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', letterSpacing: '0.1em', color: '#475569', textAlign: 'center', marginBottom: '14px' }}>{title}</div>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" vertical={false} />
                    <XAxis dataKey="name" stroke="#374151" tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} axisLine={false} tickLine={false}/>
                    <YAxis stroke="#374151" tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} axisLine={false} tickLine={false}/>
                    <Tooltip
                      contentStyle={{ background: 'rgba(13,20,42,0.95)', border: `1px solid ${color}44`, borderRadius: '10px', color: '#e2e8f0', fontSize: '12px', fontFamily: 'monospace', boxShadow: `0 0 15px ${color}22` }}
                      cursor={{ fill: 'rgba(139,92,246,0.05)' }}
                    />
                    <Bar dataKey={dataKey} fill={color} radius={[4,4,0,0]}
                      style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!results && !loading && (
        <div style={glass({ border: '2px dashed rgba(139,92,246,0.2)', padding: '80px 40px', textAlign: 'center' })}>
          <div style={{ fontSize: '56px', marginBottom: '16px', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.4))', opacity: 0.7 }}>📊</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg,#a78bfa,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            READY TO BENCHMARK
          </h2>
          <p style={{ color: '#475569', margin: '0 0 4px', fontSize: '14px' }}>
            Select a pipeline and click <strong style={{ color: '#a78bfa' }}>COMPARE ALL</strong>
          </p>
          <p style={{ color: '#374151', margin: 0, fontSize: '11px', fontFamily: 'monospace' }}>
            RUNS FCFS · PRIORITY · DEPENDENCY-AWARE · RESOURCE-AWARE SIDE BY SIDE
          </p>
        </div>
      )}
    </div>
  );
}
