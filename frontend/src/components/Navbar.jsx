import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Network, Server, PlayCircle, BarChart3, Clock, GitMerge, User, LogOut, ChevronDown, UserPlus, LogIn, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BASE_NAV = [
  { to: '/',              label: 'Pipelines', icon: Network },
  { to: '/pipelines/new', label: 'Builder',   icon: GitMerge },
  { to: '/runners',       label: 'Runners',   icon: Server },
  { to: '/run',           label: 'Run',       icon: PlayCircle },
  { to: '/compare',       label: 'Compare',   icon: BarChart3 },
  { to: '/history',       label: 'History',   icon: Clock },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const dropdownRef = useRef(null);

  const navItems = user?.is_admin
    ? [...BASE_NAV, { to: '/admin', label: 'Admin', icon: Shield, adminOnly: true }]
    : BASE_NAV;

  const isActive = (to) => to === '/' ? pathname === '/' : pathname.startsWith(to);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user
    ? (user.full_name || user.username || 'U')
        .split(' ')
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const avatarColor = user?.avatar_color || '#6366f1';

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: '64px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      background: 'rgba(2, 6, 23, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 4px 20px -2px rgba(0,0,0,0.2)'
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
        }}>
          <Network size={18} color="white" />
        </div>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.02em' }}>
          CI/CD Simulator
        </div>
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {navItems.map(({ to, label, icon: Icon, adminOnly }) => {
          const active = isActive(to);
          return (
            <Link key={to} to={to} style={{
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              color: active ? '#ffffff' : adminOnly ? '#34d399' : '#94a3b8',
              background: active ? (adminOnly ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)') : 'transparent',
              border: adminOnly ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.color = adminOnly ? '#6ee7b7' : '#e2e8f0'; e.currentTarget.style.background = adminOnly ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.color = adminOnly ? '#34d399' : '#94a3b8'; e.currentTarget.style.background = 'transparent'; } }}>
              <Icon size={15} style={{ opacity: active ? 1 : 0.8 }} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right Actions: System Status & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '500', color: '#94a3b8' }}>
          <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
            <span style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: '#10b981', opacity: 0.4, animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
            <span style={{ position: 'relative', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
          </span>
          <span style={{ display: 'none' }}>Online</span>
          <style>{`@keyframes ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }`}</style>
        </div>

        {/* Auth Section */}
        {isAuthenticated && user ? (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '4px 10px 4px 5px',
                borderRadius: '30px',
                background: dropdownOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: avatarColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700', color: '#ffffff',
              }}>
                {initials}
              </div>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#e2e8f0', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name || user.username}
              </span>
              <ChevronDown size={14} color="#94a3b8" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '44px',
                width: '220px',
                background: '#090d16',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                padding: '8px',
                zIndex: 200,
                animation: 'fadein 0.15s ease',
              }}>
                <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff' }}>
                    {user.full_name || user.username}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {user.email}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <span className="badge badge-blue" style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {user.role}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '6px 0' }}>
                  {user?.is_admin && (
                    <Link
                      to="/admin"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        color: '#34d399',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Shield size={15} color="#34d399" /> Admin Console
                    </Link>
                  )}

                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontSize: '13px',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <User size={15} color="#818cf8" /> Account Profile
                  </Link>

                  <button
                    onClick={() => { setDropdownOpen(false); logout(); navigate('/login'); }}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <LogOut size={15} color="#f87171" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to="/login"
              style={{
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#cbd5e1',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.2s',
              }}>
              <LogIn size={14} /> Sign In
            </Link>
            <Link
              to="/signup"
              style={{
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#ffffff',
                background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
                boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
                transition: 'all 0.2s',
              }}>
              <UserPlus size={14} /> Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
