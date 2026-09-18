import { useState, useEffect } from 'react';
import { getPipelines, getRunners, deletePipeline } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Home() {
  const [pipelines, setPipelines] = useState([]);
  const [runners, setRunners] = useState([]);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [pipeRes, runRes] = await Promise.all([getPipelines(), getRunners()]);
      setPipelines(pipeRes.data);
      setRunners(runRes.data);
    } catch { toast.error('Failed to load dashboard'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete pipeline "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deletePipeline(id);
      toast.success(`"${name}" deleted`);
      setPipelines(prev => prev.filter(p => p.id !== id));
    } catch {
      toast.error('Failed to delete pipeline');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '24px' }}>🏠 Dashboard</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Pipelines', value: pipelines.length, icon: '⚡', color: '#6366f1' },
          { label: 'Configured Runners', value: runners.length, icon: '🖥️', color: '#10b981' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ fontSize: '36px', width: '60px', height: '60px', borderRadius: '50%', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color }}>{value}</div>
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <Link to="/pipelines/new" style={{ padding: '10px 20px', background: '#6366f1', borderRadius: '8px', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          + Create Pipeline
        </Link>
        <Link to="/runners" style={{ padding: '10px 20px', background: '#1e293b', border: '1px solid #374151', borderRadius: '8px', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          ⚙️ Manage Runners
        </Link>
        <Link to="/run" style={{ padding: '10px 20px', background: '#1e293b', border: '1px solid #374151', borderRadius: '8px', color: 'white', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          ▶ Run Scheduler
        </Link>
      </div>

      {/* Pipelines Table */}
      <div style={{ background: '#1e293b', borderRadius: '10px', border: '1px solid #374151', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 'bold', fontSize: '18px', margin: 0 }}>📋 All Pipelines</h2>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>{pipelines.length} total</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(15,23,42,0.5)' }}>
              {['#', 'Name', 'Tasks', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontWeight: '600', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pipelines.map((pipe, idx) => (
              <tr key={pipe.id}
                style={{ borderTop: '1px solid #1e293b' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '14px 16px', color: '#4b5563', fontFamily: 'monospace', fontSize: '13px' }}>{pipe.id}</td>
                <td style={{ padding: '14px 16px', fontWeight: '600', fontSize: '15px' }}>{pipe.name}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                    {pipe.tasks?.length || 0} tasks
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                    {pipe.status || 'idle'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Link to="/run" style={{ color: '#6366f1', fontSize: '13px', fontWeight: '600', textDecoration: 'none', padding: '4px 12px', border: '1px solid #6366f1', borderRadius: '6px' }}>
                      ▶ Run
                    </Link>
                    <button
                      onClick={() => handleDelete(pipe.id, pipe.name)}
                      disabled={deleting === pipe.id}
                      style={{ color: '#ef4444', fontSize: '13px', fontWeight: '600', background: 'none', border: '1px solid #ef4444', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', opacity: deleting === pipe.id ? 0.5 : 1 }}>
                      {deleting === pipe.id ? '...' : '🗑 Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pipelines.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: '#4b5563' }}>
                  No pipelines yet.{' '}
                  <Link to="/pipelines/new" style={{ color: '#6366f1' }}>Create your first pipeline →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
