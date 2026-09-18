import { useState, useEffect } from 'react';
import { getRunHistory, clearRunHistory } from '../services/api';
import toast from 'react-hot-toast';
import { RefreshCw, Trash2 } from 'lucide-react';

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

  const getStatusBadgeClass = (status) => {
    if (status === 'completed') return 'badge badge-emerald';
    if (status === 'failed')    return 'badge badge-rose';
    return 'badge badge-amber';
  };

  const algoLabel = (a) => ({
    fcfs: 'FCFS', priority: 'Priority',
    dependency_aware: 'Dependency-Aware', resource_aware: 'Resource-Aware'
  }[a] || a || '—');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '500', margin: 0 }}>Run History</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: '#888888', fontSize: '14px' }}>{history.length} runs</span>
          <button onClick={fetchHistory} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          {history.length > 0 && (
            <button onClick={handleClear} disabled={clearing} className="btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={14} /> {clearing ? 'Clearing...' : 'Clear History'}
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              {['Run #', 'Pipeline', 'Algorithm', 'Status', 'Started At', 'Makespan', 'Utilization'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(run => (
              <tr key={run.id}>
                <td>#{run.id}</td>
                <td style={{ color: '#888888' }}>Pipeline #{run.pipeline_id}</td>
                <td>{algoLabel(run.algorithm)}</td>
                <td>
                  <span className={getStatusBadgeClass(run.status)}>
                    {run.status}
                  </span>
                </td>
                <td style={{ color: '#888888' }}>
                  {run.start_time ? new Date(run.start_time).toLocaleString() : '—'}
                </td>
                <td>
                  {run.makespan != null ? `${parseFloat(run.makespan).toFixed(2)}s` : '—'}
                </td>
                <td>
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
