import { useState, useEffect } from 'react';
import { getRunHistory, clearRunHistory } from '../services/api';
import toast from 'react-hot-toast';

export default function RunHistory() {
  const [history, setHistory] = useState([]);
  const [clearing, setClearing] = useState(false);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await getRunHistory();
      setHistory(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load run history');
    }
  };

  const handleClear = async () => {
    if (!window.confirm(`Delete all ${history.length} run records? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await clearRunHistory();
      setHistory([]);
      toast.success('Run history cleared!');
    } catch {
      toast.error('Failed to clear history');
    } finally {
      setClearing(false);
    }
  };

  const statusStyle = (status) => {
    if (status === 'completed') return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' };
    if (status === 'failed')    return { background: 'rgba(239,68,68,0.15)',  color: '#ef4444' };
    return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' };
  };

  const algoLabel = (a) => ({
    fcfs: 'FCFS', priority: 'Priority',
    dependency_aware: 'Dependency-Aware', resource_aware: 'Resource-Aware'
  }[a] || a || '—');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>📋 Run History</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '13px' }}>{history.length} runs</span>
          <button onClick={fetchHistory}
            style={{ padding: '8px 16px', background: '#1e293b', border: '1px solid #374151', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>
            🔄 Refresh
          </button>
          {history.length > 0 && (
            <button onClick={handleClear} disabled={clearing}
              style={{ padding: '8px 16px', background: clearing ? '#7f1d1d' : '#1e293b', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', cursor: clearing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}>
              {clearing ? '⏳ Clearing...' : '🗑 Clear History'}
            </button>
          )}
        </div>
      </div>

      <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid #374151' }}>
              {['Run #', 'Pipeline', 'Algorithm', 'Status', 'Started At', 'Makespan', 'Utilization'].map(h => (
                <th key={h} style={{ padding: '14px 16px', fontWeight: '600', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(run => (
              <tr key={run.id} style={{ borderBottom: '1px solid #0f172a' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#6366f1', fontWeight: '700' }}>#{run.id}</td>
                <td style={{ padding: '14px 16px', color: '#94a3b8' }}>Pipeline #{run.pipeline_id}</td>
                <td style={{ padding: '14px 16px', fontWeight: '600' }}>{algoLabel(run.algorithm)}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', ...statusStyle(run.status) }}>
                    {run.status}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px' }}>
                  {run.start_time ? new Date(run.start_time).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '14px 16px', fontWeight: '700', color: '#6366f1' }}>
                  {run.makespan != null ? `${parseFloat(run.makespan).toFixed(2)}s` : '—'}
                </td>
                <td style={{ padding: '14px 16px', color: '#10b981', fontWeight: '600' }}>
                  {run.overall_utilization != null ? `${parseFloat(run.overall_utilization).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '60px', textAlign: 'center', color: '#4b5563' }}>
                  No run history yet. Run a pipeline to see results here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
