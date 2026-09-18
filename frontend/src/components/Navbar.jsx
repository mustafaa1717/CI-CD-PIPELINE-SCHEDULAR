import { Link, useLocation } from 'react-router-dom';
import { Network, Server, PlayCircle, BarChart3, Clock, GitMerge } from 'lucide-react';

const NAV = [
  { to: '/',              label: 'Pipelines', icon: Network },
  { to: '/pipelines/new', label: 'Builder',   icon: GitMerge },
  { to: '/runners',       label: 'Runners',   icon: Server },
  { to: '/run',           label: 'Run',       icon: PlayCircle },
  { to: '/compare',       label: 'Compare',   icon: BarChart3 },
  { to: '/history',       label: 'History',   icon: Clock },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const isActive = (to) => to === '/' ? pathname === '/' : pathname.startsWith(to);

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: '64px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px',
      background: 'rgba(2, 6, 23, 0.7)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link key={to} to={to} style={{
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: active ? '#ffffff' : '#94a3b8',
              background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; } }}>
              <Icon size={16} style={{ opacity: active ? 1 : 0.7 }} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>
        <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
          <span style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: '#10b981', opacity: 0.4, animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
          <span style={{ position: 'relative', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
        </span>
        System Online
        <style>{`@keyframes ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }`}</style>
      </div>
    </nav>
  );
}
