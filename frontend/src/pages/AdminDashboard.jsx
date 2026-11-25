import { useState, useEffect } from 'react';
import {
  getAdminStats,
  getAdminUsers,
  updateAdminUserRole,
  deleteAdminUser,
  getAdminPipelines,
  deletePipelineAdmin,
  clearRunHistory
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Shield,
  Users,
  Network,
  Server,
  Activity,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  UserX,
  Play
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user && !user.is_admin) {
      toast.error('Access denied: Admin credentials required');
      navigate('/');
      return;
    }
    loadAdminData();
  }, [user]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [sRes, uRes, pRes] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminPipelines()
      ]);
      setStats(sRes.data);
      setUsers(uRes.data);
      setPipelines(pRes.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load admin telemetry');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (targetUser) => {
    const newAdminStatus = !targetUser.is_admin;
    const newRole = newAdminStatus ? 'Admin' : 'DevOps Engineer';
    try {
      await updateAdminUserRole(targetUser.id, { role: newRole, is_admin: newAdminStatus });
      toast.success(`User @${targetUser.username} role updated to ${newRole}`);
      loadAdminData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update user role');
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Permanently delete user @${targetUser.username} and all their pipelines?`)) return;
    try {
      await deleteAdminUser(targetUser.id);
      toast.success(`User @${targetUser.username} removed`);
      loadAdminData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleDeletePipeline = async (pipe) => {
    if (!window.confirm(`Delete pipeline "${pipe.name}" owned by @${pipe.owner_username || 'unassigned'}?`)) return;
    try {
      await deletePipelineAdmin(pipe.id);
      toast.success(`Pipeline #${pipe.id} deleted by Admin`);
      loadAdminData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete pipeline');
    }
  };

  const handleClearRuns = async () => {
    if (!window.confirm('Clear all simulation run history across the system?')) return;
    setActionLoading(true);
    try {
      await clearRunHistory();
      toast.success('Simulation run history cleared');
      loadAdminData();
    } catch (err) {
      toast.error('Failed to clear run history');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        Loading Admin Telemetry...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', animation: 'fade-in 0.4s ease-out' }}>
      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ padding: '6px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399', display: 'flex' }}>
              <Shield size={20} />
            </span>
            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
              Admin Control Center
            </h1>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            Root governance, user directory management, and multi-tenant pipeline administration.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={loadAdminData} className="btn-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={14} /> Refresh
          </button>
          <button onClick={handleClearRuns} disabled={actionLoading} className="btn-danger" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trash2 size={14} /> Flush Run Logs
          </button>
        </div>
      </div>

      {/* Telemetry Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'Registered Users', value: stats?.total_users || 0, icon: Users, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
          { label: 'Total Pipelines', value: stats?.total_pipelines || 0, icon: Network, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
          { label: 'Cluster Compute', value: `${stats?.total_cpu_cores || 0}C / ${stats?.total_ram_gb || 0}G`, icon: Server, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Simulations Run', value: stats?.total_runs || 0, icon: Activity, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: bg, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={24} color={color} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc', lineHeight: 1.2 }}>{value}</div>
              <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '2px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* User Directory Table */}
      <div className="glass-card" style={{ marginBottom: '32px' }}>
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} style={{ color: '#6366f1' }} /> User Account Management ({users.length})
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Real-time user isolation &amp; role assignment</span>
        </div>

        <table className="table-container">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Pipelines Owned</th>
              <th>Status</th>
              <th style={{ width: '180px', textAlign: 'right' }}>Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ color: '#64748b', fontFamily: 'monospace' }}>#{u.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: u.avatar_color || '#6366f1',
                      color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '600', fontSize: '13px', flexShrink: 0
                    }}>
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#f8fafc', fontSize: '14px' }}>{u.full_name || u.username}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: '#cbd5e1', fontSize: '13px' }}>{u.email}</td>
                <td>
                  <span style={{
                    fontSize: '12px', padding: '3px 8px', borderRadius: '4px',
                    background: u.is_admin ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.06)',
                    color: u.is_admin ? '#34d399' : '#e2e8f0',
                    border: u.is_admin ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)'
                  }}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className="badge badge-blue">
                    {u.pipeline_count || 0} Pipelines
                  </span>
                </td>
                <td>
                  {u.is_admin ? (
                    <span className="badge badge-emerald">Admin</span>
                  ) : (
                    <span className="badge badge-slate">Engineer</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {u.username !== 'admin_devops' && (
                      <button
                        onClick={() => handleToggleAdmin(u)}
                        className="btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        title={u.is_admin ? 'Demote to Engineer' : 'Promote to Admin'}
                      >
                        {u.is_admin ? <UserX size={13} /> : <UserCheck size={13} />}
                        {u.is_admin ? 'Demote' : 'Make Admin'}
                      </button>
                    )}
                    {u.id !== user?.id && u.username !== 'admin_devops' && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="btn-danger"
                        style={{ padding: '5px 8px', fontSize: '12px' }}
                        title="Delete User"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Global Pipeline Overseer */}
      <div className="glass-card">
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#ededed', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Network size={16} style={{ color: '#0ea5e9' }} /> Cluster-Wide Pipeline Registry ({pipelines.length})
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Admin can audit or remove any pipeline in the cluster</span>
        </div>

        <table className="table-container">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th>Pipeline Name</th>
              <th>Account Owner</th>
              <th>Task Count</th>
              <th>Status</th>
              <th style={{ width: '140px', textAlign: 'right' }}>Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            {pipelines.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No pipelines found in the system.
                </td>
              </tr>
            ) : pipelines.map(p => (
              <tr key={p.id}>
                <td style={{ color: '#64748b', fontFamily: 'monospace' }}>#{p.id}</td>
                <td style={{ fontWeight: '500', color: '#f8fafc' }}>{p.name}</td>
                <td>
                  <span style={{ fontSize: '12px', color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.2)' }}>
                    @{p.owner_username || 'unassigned'}
                  </span>
                </td>
                <td>
                  <span className="badge badge-blue">{p.tasks?.length || 0} Tasks</span>
                </td>
                <td>
                  <span className={`badge ${p.status === 'success' ? 'badge-emerald' : p.status === 'failed' ? 'badge-rose' : 'badge-slate'}`}>
                    {(p.status || 'idle').toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Link to="/run" className="btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}>
                      <Play size={13} /> Run
                    </Link>
                    <button
                      onClick={() => handleDeletePipeline(p)}
                      className="btn-danger"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      title="Admin Delete"
                    >
                      <Trash2 size={13} /> Del
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
