import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/',              label: 'PIPELINES', icon: '◈' },
  { to: '/pipelines/new', label: 'BUILDER',   icon: '⊕' },
  { to: '/runners',       label: 'RUNNERS',   icon: '▣' },
  { to: '/run',           label: 'RUN',        icon: '▶' },
  { to: '/compare',       label: 'COMPARE',   icon: '≋' },
  { to: '/history',       label: 'HISTORY',   icon: '◷' },
];

export default function Navbar() {
  const { pathname } = useLocation();

  const isActive = (to) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to);

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 200,
      height: '58px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px',
      background: 'rgba(3, 7, 18, 0.92)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(139,92,246,0.2)',
      boxShadow: '0 1px 40px rgba(139,92,246,0.08)',
    }}>
      {/* ── Logo ── */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Animated logo mark */}
        <div style={{
          width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
          background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '17px',
          boxShadow: '0 0 16px rgba(139,92,246,0.6), 0 0 32px rgba(139,92,246,0.2)',
          animation: 'glow-pulse 3s ease-in-out infinite',
        }}>⚡</div>
        <div>
          <div style={{
            fontSize: '13px', fontWeight: '800', letterSpacing: '0.14em',
            fontFamily: 'monospace',
            background: 'linear-gradient(90deg, #a78bfa 0%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>CI/CD SCHEDULER</div>
          <div style={{
            fontSize: '8px', color: '#374151', letterSpacing: '0.25em',
            textTransform: 'uppercase', marginTop: '1px',
          }}>TEAM 18 · RESOURCE-AWARE ENGINE</div>
        </div>
      </Link>

      {/* ── Nav links ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {NAV.map(({ to, label, icon }) => {
          const active = isActive(to);
          return (
            <Link key={to} to={to} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 13px', borderRadius: '6px',
              textDecoration: 'none', fontSize: '10px', fontWeight: '700',
              letterSpacing: '0.1em', fontFamily: 'monospace',
              color: active ? '#a78bfa' : '#475569',
              background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
              border: active
                ? '1px solid rgba(139,92,246,0.35)'
                : '1px solid transparent',
              boxShadow: active ? '0 0 12px rgba(139,92,246,0.18)' : 'none',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'transparent'; } }}>
              <span style={{ fontSize: '13px', lineHeight: 1 }}>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── Status dot ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', color: '#10b981', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981', animation: 'pulse-ring 2s ease-in-out infinite' }}/>
        SYSTEM ONLINE
      </div>
    </nav>
  );
}
