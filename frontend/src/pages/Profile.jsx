import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPipelines, getRunners, getRunHistory } from '../services/api';
import { User, Mail, Briefcase, Lock, LogOut, Check, Server, Network, Activity, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function Profile() {
  const { user, isAuthenticated, loading, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [role, setRole]                 = useState('');
  const [avatarColor, setAvatarColor]   = useState('#6366f1');
  const [currentPw, setCurrentPw]       = useState('');
  const [newPw, setNewPw]               = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw]         = useState(false);

  const [stats, setStats] = useState({ pipelines: 0, runners: 0, runs: 0 });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setRole(user.role || 'DevOps Engineer');
      setAvatarColor(user.avatar_color || '#6366f1');
    }

    // Load workspace metrics
    async function loadStats() {
      try {
        const [pr, rr, hr] = await Promise.all([getPipelines(), getRunners(), getRunHistory()]);
        setStats({
          pipelines: pr?.data?.length || 0,
          runners:   rr?.data?.length || 0,
          runs:      hr?.data?.length || 0,
        });
      } catch (e) {
        // Stats are decorative, fail silently
      }
    }
    loadStats();
  }, [user, isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) return null;

  const initials = (user.full_name || user.username || 'U')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    await updateProfile({
      full_name: fullName,
      email: email,
      role: role,
      avatar_color: avatarColor,
    });
    setSavingProfile(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPw || !newPw) {
      toast.error('Please enter both current and new password');
      return;
    }
    setSavingPw(true);
    const res = await updateProfile({
      current_password: currentPw,
      new_password: newPw,
    });
    setSavingPw(false);
    if (res.success) {
      setCurrentPw('');
      setNewPw('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '20px',
              background: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', fontWeight: '700', color: '#ffffff',
              boxShadow: `0 8px 24px -4px ${avatarColor}66`,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                  {user.full_name || user.username}
                </h1>
                <span className="badge badge-blue">{user.role}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                @{user.username} • {user.email}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                <Calendar size={13} />
                <span>Account active since {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'recent'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Network size={20} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>{stats.pipelines}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Pipelines Created</div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={20} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>{stats.runners}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Configured Runners</div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color="#34d399" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>{stats.runs}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Executions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Forms Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Personal Details */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="#818cf8" /> Edit Account Details
          </h2>
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#94a3b8', marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#94a3b8', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#94a3b8', marginBottom: '6px' }}>
                Role / Title
              </label>
              <input
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Avatar Theme Color */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#94a3b8', marginBottom: '8px' }}>
                Avatar Color Theme
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: c, border: avatarColor === c ? '2px solid #ffffff' : '2px solid transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                    {avatarColor === c && <Check size={16} color="white" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              {savingProfile ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="#f59e0b" /> Change Password
          </h2>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#94a3b8', marginBottom: '6px' }}>
                Current Password
              </label>
              <input
                type="password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#94a3b8', marginBottom: '6px' }}>
                New Password
              </label>
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="At least 4 characters"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
              Ensure your password contains strong characters to prevent unauthorized access.
            </div>

            <button
              type="submit"
              disabled={savingPw || !currentPw || !newPw}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '14px' }}>
              {savingPw ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
