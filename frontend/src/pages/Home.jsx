import { useState, useEffect } from 'react';
import { getPipelines, getRunners, deletePipeline } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Network, Server, Play, Plus, Trash2 } from 'lucide-react';

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
      toast.success(`Pipeline deleted`);
      setPipelines(prev => prev.filter(p => p.id !== id));
    } catch {
      toast.error('Failed to delete pipeline');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', animation: 'fade-in 0.4s ease-out' }}>
      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em', margin: '0 0 8px 0', color: '#f8fafc' }}>Dashboard</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>Overview of your pipelines and shared runner resources.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {[
          { label: 'Total Pipelines', value: pipelines.length, icon: Network, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
          { label: 'Configured Runners', value: runners.length, icon: Server, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: bg, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={32} color={color} />
            </div>
            <div>
              <div style={{ fontSize: '40px', fontWeight: '700', color: '#f8fafc', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
              <div style={{ color: '#94a3b8', fontSize: '15px', fontWeight: '500' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <Link to="/pipelines/new" className="btn-primary">
          <Plus size={18} /> Create Pipeline
        </Link>
        <Link to="/runners" className="btn-secondary">
          <Server size={18} /> Manage Runners
        </Link>
        <Link to="/run" className="btn-secondary">
          <Play size={18} /> Run Scheduler
        </Link>
      </div>

      {/* Pipelines Table */}
      <div className="glass-card">
        <div className="glass-card-header">
          <h2 style={{ fontWeight: '600', fontSize: '16px', margin: 0, color: '#e2e8f0' }}>Registered Pipelines</h2>
          <span className="badge badge-slate">{pipelines.length} Total</span>
        </div>
        <table className="table-container">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th>Pipeline Name</th>
              <th>Task Count</th>
              <th>Last Status</th>
              <th style={{ width: '180px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pipelines.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No pipelines found. Create one to get started.
                </td>
              </tr>
            ) : pipelines.map((pipe) => (
              <tr key={pipe.id}>
                <td style={{ color: '#64748b', fontFamily: 'monospace' }}>#{pipe.id}</td>
                <td style={{ fontWeight: '500', color: '#f8fafc' }}>{pipe.name}</td>
                <td>
                  <span className="badge badge-blue">
                    {pipe.tasks?.length || 0} Tasks
                  </span>
                </td>
                <td>
                  <span className={`badge ${pipe.status === 'success' ? 'badge-emerald' : pipe.status === 'failed' ? 'badge-rose' : 'badge-slate'}`}>
                    {(pipe.status || 'idle').toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Link to="/run" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                      <Play size={14} /> Run
                    </Link>
                    <button onClick={() => handleDelete(pipe.id, pipe.name)} disabled={deleting === pipe.id} className="btn-danger">
                      <Trash2 size={14} /> {deleting === pipe.id ? '...' : 'Del'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
