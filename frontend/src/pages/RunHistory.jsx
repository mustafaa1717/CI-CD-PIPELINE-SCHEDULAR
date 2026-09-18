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
      toast.success('Run history cleared');
    } catch {
      toast.error('Failed to clear history');
    } finally {
      setClearing(false);
    }
  };

  const statusStyle = (status) => {
    if (status === 'completed') return { color: '#10b981' };
    if (status === 'failed')    return { color: '#ef4444' };
    return { color: '#f59e0b' };
  };

  const algoLabel = (a) => ({
    fcfs: 'FCFS', priority: 'Priority',
    dependency_aware: 'Dependency-Aware', resource_aware: 'Resource-Aware'
  }[a] || a || '—');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', fontFamily: '"Inter", sans-serif', color: '#ededed' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '500', margin: 0 }}>Run History</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: '#888888', fontSize: '14px' }}>{history.length} runs</span>
          <button onClick={fetchHistory}
            style={{ padding: '8px 16px', background: '#0a0a0a', border: '1px solid #27272a', borderRadius: '6px', color: '#ededed', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
            Refresh
          </button>
          {history.length > 0 && (
            <button onClick={handleClear} disabled={clearing}
              style={{ padding: '8px 16px', background: '#0a0a0a', border: '1px solid #27272a', borderRadius: '6px', color: '#ef4444', cursor: clearing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {clearing ? 'Clearing...' : 'Clear History'}
            </button>
          )}
        </div>
      </div>

      <div style={{ background: '#0a0a0a', borderRadius: '8px', border: '1px solid #27272a', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a' }}>
              {['Run #', 'Pipeline', 'Algorithm', 'Status', 'Started At', 'Makespan', 'Utilization'].map(h => (
                <th key={h} style={{ padding: '16px', fontWeight: '500', color: '#888888', fontSize: '13px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(run => (
              <tr key={run.id} style={{ borderBottom: '1px solid #27272a' }}>
                <td style={{ padding: '16px', color: '#ededed' }}>#{run.id}</td>
                <td style={{ padding: '16px', color: '#888888' }}>Pipeline #{run.pipeline_id}</td>
                <td style={{ padding: '16px', color: '#ededed' }}>{algoLabel(run.algorithm)}</td>
                <td style={{ padding: '16px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid #27272a', ...statusStyle(run.status) }}>
                    {run.status}
                  </span>
                </td>
                <td style={{ padding: '16px', color: '#888888' }}>
                  {run.start_time ? new Date(run.start_time).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '16px', color: '#ededed' }}>
                  {run.makespan != null ? `${parseFloat(run.makespan).toFixed(2)}s` : '—'}
                </td>
                <td style={{ padding: '16px', color: '#ededed' }}>
                  {run.overall_utilization != null ? `${parseFloat(run.overall_utilization).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#888888' }}>
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
