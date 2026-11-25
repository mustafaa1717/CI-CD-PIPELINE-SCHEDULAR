import { useState, useEffect } from 'react';
import { getPipelines, getRunners, deletePipeline } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Network, Server, Play, Plus, Trash2, Shield, User, LogIn, Lock } from 'lucide-react';

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [pipelines, setPipelines] = useState([]);
  const [runners, setRunners] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('ALL');

  useEffect(() => { fetchData(); }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [pipeRes, runRes] = await Promise.all([getPipelines(), getRunners()]);
      setPipelines(pipeRes.data || []);
      setRunners(runRes.data || []);
    } catch { toast.error('Failed to load dashboard data'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete pipeline "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deletePipeline(id);
      toast.success(`Pipeline deleted`);
      setPipelines(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete pipeline');
    } finally {
      setDeleting(null);
    }
  };

  const displayedPipelines = user?.is_admin && ownerFilter !== 'ALL'
    ? pipelines.filter(p => (p.owner_username || 'unassigned') === ownerFilter)
    : pipelines;

  const uniqueOwners = Array.from(new Set(pipelines.map(p => p.owner_username).filter(Boolean)));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', animation: 'fade-in 0.4s ease-out' }}>
      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      {/* Auth Banner if guest */}
      {!isAuthenticated && (
        <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '28px', border: '1px solid rgba(99,102,241,0.3)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.05))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} color="#818cf8" /> Multi-Tenant Authentication Enforced
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
              Sign in with your DevOps account to isolate and manage your own pipelines, or log in as Admin to oversee the shared cluster.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/login" className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              <LogIn size={15} /> Sign In
            </Link>
            <Link to="/signup" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Create Account
            </Link>
          </div>
        </div>
      )}

      {/* Admin Status Banner */}
      {user?.is_admin && (
        <div className="glass-card" style={{ padding: '14px 20px', marginBottom: '24px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399', fontSize: '13px', fontWeight: '500' }}>
            <Shield size={18} />
            <span>Administrator Session Active — You have cluster-wide governance over all user pipelines and runner infrastructure.</span>
          </div>
          <Link to="/admin" className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px', borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}>
            Admin Console →
          </Link>
        </div>
      )}

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em', margin: '0 0 8px 0', color: '#f8fafc' }}>
          {isAuthenticated ? `Workspace of @${user?.username}` : 'CI/CD Cluster Dashboard'}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>
          {user?.is_admin
            ? 'Global overview of all organization pipelines and shared compute nodes.'
            : 'Personal pipeline registry and multi-algorithm execution workspace.'}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {[
          {
            label: user?.is_admin ? 'Total Cluster Pipelines' : 'My Active Pipelines',
            value: pipelines.length,
            icon: Network,
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.1)'
          },
          {
            label: 'Cluster Runner Nodes',
            value: runners.length,
            icon: Server,
            color: '#10b981',
            bg: 'rgba(16,185,129,0.1)'
          },
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
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <Link to="/pipelines/new" className="btn-primary">
          <Plus size={18} /> Create Pipeline
        </Link>
        <Link to="/runners" className="btn-secondary">
          <Server size={18} /> Manage Runners
        </Link>
        <Link to="/run" className="btn-secondary">
          <Play size={18} /> Run Scheduler
        </Link>
        {user?.is_admin && (
          <Link to="/admin" className="btn-secondary" style={{ borderColor: 'rgba(16,185,129,0.3)', color: '#34d399' }}>
            <Shield size={18} /> Admin Console
          </Link>
        )}
      </div>

      {/* Pipelines Table */}
      <div className="glass-card">
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontWeight: '600', fontSize: '16px', margin: 0, color: '#e2e8f0' }}>
              {user?.is_admin ? 'Cluster-Wide Pipelines' : 'Your Pipelines'}
            </h2>
            <span className="badge badge-slate">{displayedPipelines.length} Visible</span>
          </div>

          {/* Admin Owner Filter */}
          {user?.is_admin && uniqueOwners.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Filter Owner:</span>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '4px 10px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Owners ({pipelines.length})</option>
                {uniqueOwners.map(owner => (
                  <option key={owner} value={owner}>@{owner}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <table className="table-container">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th>Pipeline Name</th>
              {user?.is_admin && <th>Owner</th>}
              <th>Task Count</th>
              <th>Last Status</th>
              <th style={{ width: '180px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedPipelines.length === 0 ? (
              <tr>
                <td colSpan={user?.is_admin ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  {isAuthenticated
                    ? 'No pipelines found. Click "Create Pipeline" to construct a new workflow.'
                    : 'Sign in to access and manage your CI/CD pipelines.'}
                </td>
              </tr>
            ) : displayedPipelines.map((pipe) => (
              <tr key={pipe.id}>
                <td style={{ color: '#64748b', fontFamily: 'monospace' }}>#{pipe.id}</td>
                <td style={{ fontWeight: '500', color: '#f8fafc' }}>{pipe.name}</td>
                {user?.is_admin && (
                  <td>
                    <span style={{ fontSize: '12px', color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.2)' }}>
                      @{pipe.owner_username || 'unassigned'}
                    </span>
                  </td>
                )}
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
