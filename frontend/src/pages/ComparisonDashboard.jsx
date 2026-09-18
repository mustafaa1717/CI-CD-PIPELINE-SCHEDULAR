import { useState, useEffect } from 'react';
import { getPipelines, compareAlgorithms } from '../services/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ALGO_LABELS = {
  fcfs: 'FCFS',
  priority: 'Priority',
  dependency_aware: 'Dep-Aware',
  resource_aware: 'Res-Aware',
};

export default function ComparisonDashboard() {
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [results, setResults] = useState(null);   // flat array from API
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
      setResults(res.data);   // flat array: [{algorithm, makespan, avg_wait_time, overall_utilization, ...}]
      toast.success('Comparison complete!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  // Find best algorithm for a metric
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

  const cardBorder = (algo, metric, lower = true) =>
    getBest(metric, lower) === algo ? '1px solid #22c55e' : '1px solid #374151';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: '#1e293b', padding: '24px', borderRadius: '10px', border: '1px solid #374151', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', margin: 0 }}>⚡ Algorithm Comparison</h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '14px' }}>Run all 4 scheduling strategies on the same pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={selectedPipeline} onChange={e => setSelectedPipeline(e.target.value)}
            style={{ background: '#0f172a', border: '1px solid #374151', borderRadius: '8px', padding: '10px 14px', color: 'white', minWidth: '200px' }}>
            {pipelines.length === 0 && <option value="">No pipelines</option>}
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleCompare} disabled={loading || !selectedPipeline}
            style={{ padding: '10px 24px', background: loading ? '#4338ca' : '#6366f1', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', minWidth: '140px' }}>
            {loading ? '⏳ Running...' : '▶ Compare All'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', background: '#1e293b', borderRadius: '10px', border: '1px solid #374151' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️</div>
          <p style={{ fontSize: '18px', fontWeight: '600' }}>Running all 4 algorithms simultaneously...</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>This may take a few seconds</p>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {results.map(alg => {
              const isBestMakespan = getBest('makespan', true) === alg.algorithm;
              const isBestWait = getBest('avg_wait_time', true) === alg.algorithm;
              const isBestUtil = getBest('overall_utilization', false) === alg.algorithm;
              return (
                <div key={alg.algorithm}
                  style={{ background: '#1e293b', borderRadius: '10px', padding: '20px', border: isBestMakespan || isBestWait || isBestUtil ? '1px solid #6366f1' : '1px solid #374151' }}>
                  <h3 style={{ color: '#6366f1', fontWeight: 'bold', fontSize: '16px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #374151' }}>
                    {ALGO_LABELS[alg.algorithm] || alg.algorithm}
                  </h3>
                  {[
                    { label: 'Makespan', value: `${alg.makespan?.toFixed(2)}s`, best: isBestMakespan },
                    { label: 'Avg Wait', value: `${alg.avg_wait_time?.toFixed(3)}s`, best: isBestWait },
                    { label: 'Utilization', value: `${alg.overall_utilization?.toFixed(1)}%`, best: isBestUtil },
                    { label: 'Tasks Done', value: `${alg.successful_tasks ?? '—'}/${alg.total_tasks ?? '—'}`, best: false },
                  ].map(({ label, value, best }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{label}</span>
                      <span style={{ fontWeight: '700', color: best ? '#22c55e' : 'white', fontSize: '14px' }}>
                        {best && '👑 '}{value}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {[
              { title: '⏱ Makespan (s) — Lower is Better', dataKey: 'makespan', color: '#6366f1' },
              { title: '⏳ Avg Wait Time (s) — Lower is Better', dataKey: 'avg_wait_time', color: '#f59e0b' },
              { title: '🖥 Runner Utilization % — Higher is Better', dataKey: 'overall_utilization', color: '#10b981' },
            ].map(({ title, dataKey, color }) => (
              <div key={dataKey} style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', padding: '20px', height: '300px' }}>
                <h3 style={{ textAlign: 'center', fontWeight: '600', marginBottom: '12px', fontSize: '13px', color: '#94a3b8' }}>{title}</h3>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#374151', borderRadius: '8px' }} />
                    <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div style={{ background: '#1e293b', border: '2px dashed #374151', padding: '64px', textAlign: 'center', borderRadius: '10px', color: '#4b5563' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <p style={{ fontSize: '16px' }}>Select a pipeline and click <strong style={{ color: '#6366f1' }}>Compare All</strong> to run all 4 algorithms</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>You'll see side-by-side metrics and bar charts</p>
        </div>
      )}
    </div>
  );
}
