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
    if (status === 'completed') return { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 8px rgba(16,185,129,0.25)' };
    if (status === 'failed')    return { background: 'rgba(239,68,68,0.12)',  color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',  boxShadow: '0 0 8px rgba(239,68,68,0.25)' };
    return { background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)', boxShadow: '0 0 8px rgba(6,182,212,0.25)' };
  };

  const algoLabel = (a) => ({
    fcfs: 'FCFS', priority: 'Priority',
    dependency_aware: 'Dependency-Aware', resource_aware: 'Resource-Aware'
  }[a] || a || '—');

  const algoBadgeStyle = (algo) => {
    const map = {
      fcfs:             { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' },
      priority:         { background: 'rgba(6,182,212,0.15)',  color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' },
      dependency_aware: { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' },
      resource_aware:   { background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' },
    };
    return map[algo] || { background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' };
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{
            fontSize: '28px', fontWeight: '800', margin: 0,
            background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontFamily: 'monospace', letterSpacing: '0.08em',
          }}>📋 RUN HISTORY</h1>
          <p style={{ color: '#64748b', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '6px 0 0' }}>
            EXECUTION LOG
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{
            color: '#64748b', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.08em',
            background: 'rgba(13,20,42,0.7)', border: '1px solid rgba(139,92,246,0.15)',
            padding: '4px 10px', borderRadius: '20px',
          }}>{history.length} RUNS</span>
          <button onClick={fetchHistory} style={{
            padding: '8px 16px', background: 'rgba(13,20,42,0.85)',
            border: '1px solid rgba(139,92,246,0.35)', borderRadius: '8px',
            color: '#a78bfa', cursor: 'pointer', fontSize: '12px',
            fontFamily: 'monospace', letterSpacing: '0.06em',
            transition: 'box-shadow 0.2s, border-color 0.2s',
          }}
            onMouseEnter={e => { e.target.style.boxShadow = '0 0 12px rgba(139,92,246,0.35)'; e.target.style.borderColor = 'rgba(139,92,246,0.6)'; }}
            onMouseLeave={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(139,92,246,0.35)'; }}>
            🔄 Refresh
          </button>
          {history.length > 0 && (
            <button onClick={handleClear} disabled={clearing} style={{
              padding: '8px 16px',
              background: clearing ? 'rgba(127,29,29,0.4)' : 'rgba(13,20,42,0.85)',
              border: '1px solid rgba(239,68,68,0.5)', borderRadius: '8px',
              color: '#f87171', cursor: clearing ? 'not-allowed' : 'pointer',
              fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.06em',
              fontWeight: '600', transition: 'box-shadow 0.2s',
            }}
              onMouseEnter={e => { if (!clearing) e.target.style.boxShadow = '0 0 12px rgba(239,68,68,0.35)'; }}
              onMouseLeave={e => { e.target.style.boxShadow = 'none'; }}>
              {clearing ? '⏳ Clearing...' : '🗑 Clear History'}
            </button>
          )}
        </div>
      </div>

      <div style={{
        background: 'rgba(13,20,42,0.85)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px',
        overflow: 'hidden', boxShadow: '0 0 30px rgba(139,92,246,0.07)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{
              background: 'linear-gradient(90deg, rgba(139,92,246,0.18), rgba(6,182,212,0.08))',
              borderBottom: '1px solid rgba(139,92,246,0.25)',
            }}>
              {['Run #', 'Pipeline', 'Algorithm', 'Status', 'Started At', 'Makespan', 'Utilization'].map(h => (
                <th key={h} style={{
                  padding: '14px 16px', fontWeight: '700', color: '#a78bfa',
                  fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(run => (
              <tr key={run.id}
                style={{ borderBottom: '1px solid rgba(139,92,246,0.08)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: '#22d3ee',
                    background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                    padding: '3px 8px', borderRadius: '6px', boxShadow: '0 0 8px rgba(6,182,212,0.2)',
                  }}>#{run.id}</span>
                </td>
                <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}>
                  Pipeline #{run.pipeline_id}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                    fontWeight: '700', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em',
                    ...algoBadgeStyle(run.algorithm),
                  }}>{algoLabel(run.algorithm)}</span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '10px',
                    fontWeight: '700', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
                    ...statusStyle(run.status),
                  }}>{run.status}</span>
                </td>
                <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>
                  {run.start_time ? new Date(run.start_time).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '14px 16px', fontWeight: '700', color: '#a78bfa', fontSize: '13px', fontFamily: 'monospace' }}>
                  {run.makespan != null ? `${parseFloat(run.makespan).toFixed(2)}s` : '—'}
                </td>
                <td style={{ padding: '14px 16px', color: '#34d399', fontWeight: '700', fontSize: '13px', fontFamily: 'monospace' }}>
                  {run.overall_utilization != null ? `${parseFloat(run.overall_utilization).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '64px', textAlign: 'center' }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>📭</div>
                  <p style={{ color: '#374151', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                    NO EXECUTION RECORDS FOUND
                  </p>
                  <p style={{ color: '#374151', fontSize: '11px', fontFamily: 'monospace', marginTop: '6px' }}>
                    Run a pipeline to see results here
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
