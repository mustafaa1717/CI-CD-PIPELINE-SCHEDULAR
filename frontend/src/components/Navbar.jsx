import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/',              label: 'Pipelines' },
  { to: '/pipelines/new', label: 'Builder' },
  { to: '/runners',       label: 'Runners' },
  { to: '/run',           label: 'Run' },
  { to: '/compare',       label: 'Compare' },
  { to: '/history',       label: 'History' },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const isActive = (to) => to === '/' ? pathname === '/' : pathname.startsWith(to);

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: '54px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid #27272a',
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '4px',
          background: '#ededed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#ededed', letterSpacing: '-0.01em' }}>
          Scheduler
        </div>
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {NAV.map(({ to, label }) => {
          const active = isActive(to);
          return (
            <Link key={to} to={to} style={{
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '500',
              color: active ? '#ededed' : '#888888',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#cccccc'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#888888'; }}>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888888' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}/>
        Operational
      </div>
    </nav>
  );
}
