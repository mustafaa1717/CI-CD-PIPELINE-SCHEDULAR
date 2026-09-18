import { useState, useEffect } from 'react';
import { getPipelines, compareAlgorithms } from '../services/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, Activity, Server } from 'lucide-react';

const ALGO_LABELS = {
  fcfs: 'FCFS',
  priority: 'Priority',
  dependency_aware: 'Dep-Aware',
  resource_aware: 'Res-Aware',
};

export default function ComparisonDashboard() {
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchPipelines(); }, []);

  const fetchPipelines = async () => {
    try {
      const res = await getPipelines();
      setPipelines(res.data);
      if (res.data.length > 0) setSelectedPipeline(res.data[0].id);
    } catch {
      toast.error('Failed to load pipelines');
    }
  };

  const handleCompare = async () => {
    if (!selectedPipeline) { toast.error('Select a pipeline first'); return; }
    setLoading(true);
    setResults(null);
    try {
      const res = await compareAlgorithms(selectedPipeline);
      setResults(res.data);
      toast.success('Comparison complete');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  const getBest = (metric, lowerIsBetter = true) => {
    if (!results || results.length === 0) return null;
    return results.reduce((best, cur) =>
      lowerIsBetter ? (cur[metric] < best[metric] ? cur : best)
                    : (cur[metric] > best[metric] ? cur : best)
    ).algorithm;
  };

  const chartData = results?.map(r => ({
    ...r,
    name: ALGO_LABELS[r.algorithm] || r.algorithm,
  }));

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: '"Inter", sans-serif', color: '#ededed' }}>
      <style>
        {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
      </style>
      
      {/* Header */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '24px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '500', margin: 0, color: '#ededed', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <Activity style={{ color: '#888888' }} size={24} /> Algorithm Comparison
          </h1>
          <p style={{ color: '#888888', margin: '8px 0 0', fontSize: '14px', marginLeft: '36px' }}>Run all 4 scheduling strategies on the same pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={selectedPipeline} onChange={e => setSelectedPipeline(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#ededed', minWidth: '200px', fontSize: '14px', outline: 'none' }}>
            {pipelines.length === 0 && <option value="">No pipelines</option>}
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleCompare} disabled={loading || !selectedPipeline}
            className="btn-primary" style={{ minWidth: '140px' }}>
            {loading ? (
               <>
                 <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Running...
               </>
            ) : (
               <><Play size={16} /> Compare All</>
            )}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '80px 40px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #334155', borderTopColor: '#0070f3', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px auto' }} />
          <p style={{ fontSize: '18px', fontWeight: '500', color: '#ffffff', margin: '0 0 12px 0' }}>Running all 4 algorithms simultaneously...</p>
          <p style={{ fontSize: '14px', color: '#888888', margin: 0 }}>This may take a few seconds</p>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {results.map(alg => {
              const isBestMakespan = getBest('makespan', true) === alg.algorithm;
              const isBestWait = getBest('avg_wait_time', true) === alg.algorithm;
              const isBestUtil = getBest('overall_utilization', false) === alg.algorithm;
              return (
                <div key={alg.algorithm} className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ color: '#ffffff', fontWeight: '500', fontSize: '16px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Server size={16} style={{ color: '#888888' }} /> {ALGO_LABELS[alg.algorithm] || alg.algorithm}
                  </h3>
                  {[
                    { label: 'Makespan', value: `${alg.makespan?.toFixed(2)}s`, best: isBestMakespan },
                    { label: 'Avg Wait', value: `${alg.avg_wait_time?.toFixed(3)}s`, best: isBestWait },
                    { label: 'Utilization', value: `${alg.overall_utilization?.toFixed(1)}%`, best: isBestUtil },
                    { label: 'Tasks Done', value: `${alg.successful_tasks ?? '—'}/${alg.total_tasks ?? '—'}`, best: false },
                  ].map(({ label, value, best }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                      <span style={{ color: '#888888', fontSize: '13px' }}>{label}</span>
                      <span style={{ fontWeight: '500', color: best ? '#10b981' : '#ededed', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {value} {best && <span className="badge badge-emerald" style={{ padding: '2px 6px', fontSize: '10px' }}>Best</span>}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {[
              { title: 'Makespan (s) — Lower is Better', dataKey: 'makespan', color: '#3b82f6' },
              { title: 'Avg Wait Time (s) — Lower is Better', dataKey: 'avg_wait_time', color: '#64748b' },
              { title: 'Runner Utilization % — Higher is Better', dataKey: 'overall_utilization', color: '#10b981' },
            ].map(({ title, dataKey, color }) => (
              <div key={dataKey} className="glass-card" style={{ padding: '24px', height: '320px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ textAlign: 'center', fontWeight: '500', fontSize: '13px', color: '#888888', margin: '0 0 24px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h3>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="#888888" tick={{ fontSize: 12, fill: '#888888' }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                      <YAxis stroke="#888888" tick={{ fontSize: 12, fill: '#888888' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }} itemStyle={{ color: '#ffffff', fontWeight: '500' }} />
                      <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div className="glass-card" style={{ padding: '80px 40px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Activity size={48} style={{ color: '#334155', margin: '0 auto 24px auto' }} />
          <p style={{ fontSize: '18px', color: '#ffffff', fontWeight: '500', margin: '0 0 12px 0' }}>Select a pipeline and click Compare All to run all 4 algorithms</p>
          <p style={{ fontSize: '14px', color: '#888888', margin: 0 }}>You'll see side-by-side metrics and bar charts</p>
        </div>
      )}
    </div>
  );
}
