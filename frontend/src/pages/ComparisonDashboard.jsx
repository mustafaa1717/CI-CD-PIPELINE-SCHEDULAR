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
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: '#0a0a0a', padding: '24px', borderRadius: '8px', border: '1px solid #27272a', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '500', margin: 0, color: '#ededed' }}>Algorithm Comparison</h1>
          <p style={{ color: '#888888', margin: '8px 0 0', fontSize: '14px' }}>Run all 4 scheduling strategies on the same pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={selectedPipeline} onChange={e => setSelectedPipeline(e.target.value)}
            style={{ background: '#000000', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 14px', color: '#ededed', minWidth: '200px', fontSize: '14px', outline: 'none' }}>
            {pipelines.length === 0 && <option value="">No pipelines</option>}
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleCompare} disabled={loading || !selectedPipeline}
            style={{ padding: '10px 24px', background: loading ? '#0a0a0a' : '#ededed', border: loading ? '1px solid #27272a' : 'none', borderRadius: '6px', color: loading ? '#888888' : '#000000', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', minWidth: '140px', fontSize: '14px' }}>
            {loading ? 'Running...' : 'Compare All'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '64px', color: '#888888', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #27272a' }}>
          <p style={{ fontSize: '16px', fontWeight: '500', color: '#ededed' }}>Running all 4 algorithms simultaneously...</p>
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
                  style={{ background: '#0a0a0a', borderRadius: '8px', padding: '20px', border: '1px solid #27272a' }}>
                  <h3 style={{ color: '#ededed', fontWeight: '500', fontSize: '16px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #27272a', margin: '0 0 16px 0' }}>
                    {ALGO_LABELS[alg.algorithm] || alg.algorithm}
                  </h3>
                  {[
                    { label: 'Makespan', value: `${alg.makespan?.toFixed(2)}s`, best: isBestMakespan },
                    { label: 'Avg Wait', value: `${alg.avg_wait_time?.toFixed(3)}s`, best: isBestWait },
                    { label: 'Utilization', value: `${alg.overall_utilization?.toFixed(1)}%`, best: isBestUtil },
                    { label: 'Tasks Done', value: `${alg.successful_tasks ?? '—'}/${alg.total_tasks ?? '—'}`, best: false },
                  ].map(({ label, value, best }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                      <span style={{ color: '#888888', fontSize: '13px' }}>{label}</span>
                      <span style={{ fontWeight: '500', color: best ? '#10b981' : '#ededed', fontSize: '14px' }}>
                        {value} {best && <span style={{ fontSize: '12px', marginLeft: '4px', color: '#10b981', border: '1px solid #10b981', padding: '1px 4px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)' }}>Best</span>}
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
              { title: 'Makespan (s) — Lower is Better', dataKey: 'makespan', color: '#ededed' },
              { title: 'Avg Wait Time (s) — Lower is Better', dataKey: 'avg_wait_time', color: '#888888' },
              { title: 'Runner Utilization % — Higher is Better', dataKey: 'overall_utilization', color: '#0070f3' },
            ].map(({ title, dataKey, color }) => (
              <div key={dataKey} style={{ background: '#0a0a0a', borderRadius: '8px', border: '1px solid #27272a', padding: '24px', height: '300px' }}>
                <h3 style={{ textAlign: 'center', fontWeight: '500', marginBottom: '24px', fontSize: '14px', color: '#888888', margin: '0 0 24px 0' }}>{title}</h3>
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" stroke="#888888" tick={{ fontSize: 12, fill: '#888888' }} axisLine={{ stroke: '#27272a' }} tickLine={false} />
                    <YAxis stroke="#888888" tick={{ fontSize: 12, fill: '#888888' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#27272a', opacity: 0.4 }} contentStyle={{ backgroundColor: '#000000', borderColor: '#27272a', borderRadius: '6px', color: '#ededed', fontSize: '13px' }} itemStyle={{ color: '#ededed' }} />
                    <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div style={{ background: '#0a0a0a', border: '1px dashed #27272a', padding: '64px', textAlign: 'center', borderRadius: '8px', color: '#888888' }}>
          <p style={{ fontSize: '16px', color: '#ededed', fontWeight: '500', margin: '0 0 8px 0' }}>Select a pipeline and click Compare All to run all 4 algorithms</p>
          <p style={{ fontSize: '14px', margin: 0 }}>You'll see side-by-side metrics and bar charts</p>
        </div>
      )}
    </div>
  );
}
