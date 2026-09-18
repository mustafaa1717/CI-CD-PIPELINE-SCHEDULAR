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
    <div style={{ maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', sans-serif", color: '#ededed' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '24px', color: '#ededed' }}>Dashboard</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Pipelines', value: pipelines.length },
          { label: 'Configured Runners', value: runners.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#0a0a0a', borderRadius: '8px', border: '1px solid #27272a', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: '500', color: '#ededed' }}>{value}</div>
              <div style={{ color: '#888888', fontSize: '14px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <Link to="/pipelines/new" style={{ padding: '8px 16px', background: '#ededed', borderRadius: '6px', color: '#000000', textDecoration: 'none', fontWeight: '500', fontSize: '14px' }}>
          Create Pipeline
        </Link>
        <Link to="/runners" style={{ padding: '8px 16px', background: '#0a0a0a', border: '1px solid #27272a', borderRadius: '6px', color: '#ededed', textDecoration: 'none', fontWeight: '500', fontSize: '14px' }}>
          Manage Runners
        </Link>
        <Link to="/run" style={{ padding: '8px 16px', background: '#0a0a0a', border: '1px solid #27272a', borderRadius: '6px', color: '#ededed', textDecoration: 'none', fontWeight: '500', fontSize: '14px' }}>
          Run Scheduler
        </Link>
      </div>

      {/* Pipelines Table */}
      <div style={{ background: '#0a0a0a', borderRadius: '8px', border: '1px solid #27272a', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontWeight: '500', fontSize: '16px', margin: 0, color: '#ededed' }}>All Pipelines</h2>
          <span style={{ fontSize: '13px', color: '#888888' }}>{pipelines.length} total</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0a0a0a' }}>
              {['#', 'Name', 'Tasks', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontWeight: '500', color: '#888888', fontSize: '12px', borderBottom: '1px solid #27272a' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pipelines.map((pipe, idx) => (
              <tr key={pipe.id}
                style={{ borderBottom: '1px solid #27272a' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '14px 16px', color: '#888888', fontFamily: 'monospace', fontSize: '13px' }}>{pipe.id}</td>
                <td style={{ padding: '14px 16px', fontWeight: '500', fontSize: '14px', color: '#ededed' }}>{pipe.name}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', color: '#ededed', padding: '4px 8px', borderRadius: '4px', border: '1px solid #27272a', fontSize: '12px', fontWeight: '500' }}>
                    {pipe.tasks?.length || 0} tasks
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', color: pipe.status === 'idle' ? '#888888' : '#10b981', padding: '4px 8px', borderRadius: '4px', border: '1px solid #27272a', fontSize: '12px', fontWeight: '500' }}>
                    {pipe.status || 'idle'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Link to="/run" style={{ color: '#ededed', fontSize: '13px', fontWeight: '500', textDecoration: 'none', padding: '6px 12px', border: '1px solid #27272a', borderRadius: '6px', background: '#0a0a0a' }}>
                      Run
                    </Link>
                    <button
                      onClick={() => handleDelete(pipe.id, pipe.name)}
                      disabled={deleting === pipe.id}
                      style={{ color: '#ef4444', fontSize: '13px', fontWeight: '500', background: '#0a0a0a', border: '1px solid #27272a', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', opacity: deleting === pipe.id ? 0.5 : 1 }}>
                      {deleting === pipe.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pipelines.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: '#888888', fontSize: '14px' }}>
                  No pipelines yet.{' '}
                  <Link to="/pipelines/new" style={{ color: '#ededed', textDecoration: 'none' }}>Create your first pipeline</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
