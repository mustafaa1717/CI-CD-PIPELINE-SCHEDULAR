import { useState, useEffect } from 'react';
import { getRunHistory } from '../services/api';
import toast from 'react-hot-toast';

export default function RunHistory() {
  const [history, setHistory] = useState([]);

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

  const statusColor = (status) => {
    if (status === 'completed') return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' };
    if (status === 'failed')    return { background: 'rgba(239,68,68,0.15)',  color: '#ef4444' };
    return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' };
  };

  const algoLabel = (a) => ({
    fcfs: 'FCFS', priority: 'Priority',
    dependency_aware: 'Dependency-Aware', resource_aware: 'Resource-Aware'
  }[a] || a);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>📋 Run History</h1>

      <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(30,41,59,0.8)', borderBottom: '1px solid #374151' }}>
              {['Run ID', 'Pipeline ID', 'Algorithm', 'Status', 'Started At', 'Makespan', 'Utilization'].map(h => (
                <th key={h} style={{ padding: '14px 16px', fontWeight: '600', color: '#94a3b8', fontSize: '13px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(run => (
              <tr key={run.id} style={{ borderBottom: '1px solid #1e293b' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#6366f1' }}>#{run.id}</td>
                <td style={{ padding: '14px 16px', color: '#94a3b8' }}>Pipeline #{run.pipeline_id}</td>
                <td style={{ padding: '14px 16px', fontWeight: '500' }}>{algoLabel(run.algorithm)}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', ...statusColor(run.status) }}>
                    {run.status}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px' }}>
                  {run.start_time ? new Date(run.start_time).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                  {run.makespan != null ? `${run.makespan}s` : '—'}
                </td>
                <td style={{ padding: '14px 16px', color: '#10b981' }}>
                  {run.overall_utilization != null ? `${run.overall_utilization}%` : '—'}
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#4b5563' }}>
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
