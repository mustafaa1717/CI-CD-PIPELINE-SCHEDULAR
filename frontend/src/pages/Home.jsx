import { useState, useEffect } from 'react';
import { getPipelines, getRunners, deletePipeline } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

/* ── Design tokens ── */
const C = {
  bg:      '#030712',
  surface: 'rgba(10, 15, 30, 0.9)',
  card:    'rgba(13, 20, 42, 0.8)',
  border:  'rgba(139,92,246,0.2)',
  purple:  '#8b5cf6',
  cyan:    '#06b6d4',
  green:   '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  text:    '#e2e8f0',
  muted:   '#64748b',
};

const glassCard = {
  background: C.card,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${C.border}`,
  borderRadius: '12px',
};

const PIPE_COLORS = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];

export default function Home() {
  const [pipelines, setPipelines] = useState([]);
  const [runners, setRunners]     = useState([]);
  const [deleting, setDeleting]   = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [pr, rr] = await Promise.all([getPipelines(), getRunners()]);
      setPipelines(pr.data);
      setRunners(rr.data);
    } catch { toast.error('Failed to load dashboard'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete pipeline "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deletePipeline(id);
      toast.success(`"${name}" deleted`);
      setPipelines(prev => prev.filter(p => p.id !== id));
    } catch { toast.error('Failed to delete pipeline'); }
    finally  { setDeleting(null); }
  };

  /* stat cards */
  const stats = [
    { label: 'PIPELINES',  value: pipelines.length, icon: '◈', color: C.purple, glow: 'rgba(139,92,246,0.35)' },
    { label: 'RUNNERS',    value: runners.length,   icon: '▣', color: C.cyan,   glow: 'rgba(6,182,212,0.35)'  },
    { label: 'TOTAL TASKS',value: pipelines.reduce((s,p) => s + (p.tasks?.length||0), 0), icon: '◉', color: C.green, glow: 'rgba(16,185,129,0.35)' },
    { label: 'READY TO RUN',value: pipelines.length > 0 && runners.length > 0 ? '✓' : '—', icon: '▶', color: C.amber, glow: 'rgba(245,158,11,0.35)' },
  ];

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', animation: 'fade-up 0.4s ease' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: C.muted, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px' }}>
          ◈ CONTROL ROOM / DASHBOARD
        </div>
        <h1 style={{
          margin: 0, fontSize: '32px', fontWeight: '800', letterSpacing: '-0.01em',
          background: 'linear-gradient(135deg, #a78bfa 0%, #22d3ee 60%, #34d399 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>Mission Control</h1>
        <p style={{ margin: '6px 0 0', color: C.muted, fontSize: '14px' }}>
          CI/CD Pipeline Scheduler — Dependency & Resource Aware Engine
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {stats.map(({ label, value, icon, color, glow }) => (
          <div key={label} style={{
            ...glassCard,
            padding: '20px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* corner glow */}
            <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'80px', height:'80px', borderRadius:'50%', background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, pointerEvents:'none' }}/>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>{icon}</div>
            <div style={{ fontSize: '36px', fontWeight: '800', color, fontFamily: 'monospace', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '6px', fontFamily: 'monospace' }}>{label}</div>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}/>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {[
          { to: '/pipelines/new', label: '⊕  NEW PIPELINE', primary: true  },
          { to: '/run',           label: '▶  RUN SCHEDULER', primary: false },
          { to: '/runners',       label: '▣  MANAGE RUNNERS',primary: false },
          { to: '/compare',       label: '≋  COMPARE ALGOS', primary: false },
        ].map(({ to, label, primary }) => (
          <Link key={to} to={to} style={{
            padding: '9px 20px', borderRadius: '8px', textDecoration: 'none',
            fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', fontFamily: 'monospace',
            color: primary ? 'white' : C.muted,
            background: primary
              ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
              : 'rgba(13,20,42,0.6)',
            border: primary
              ? '1px solid rgba(139,92,246,0.5)'
              : `1px solid ${C.border}`,
            boxShadow: primary ? '0 0 20px rgba(139,92,246,0.3)' : 'none',
            transition: 'all 0.2s',
          }}>
            {label}
          </Link>
        ))}
      </div>

      {/* ── Pipelines Table ── */}
      <div style={{ ...glassCard, overflow: 'hidden' }}>
        {/* Table header bar */}
        <div style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(139,92,246,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: C.purple, display: 'inline-block', boxShadow: `0 0 8px ${C.purple}` }}/>
            <span style={{ fontWeight: '700', fontSize: '13px', letterSpacing: '0.05em' }}>PIPELINE REGISTRY</span>
          </div>
          <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>
            {pipelines.length} RECORDS
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid rgba(139,92,246,0.1)` }}>
              {['ID', 'PIPELINE NAME', 'TASKS', 'STATUS', 'ACTIONS'].map(h => (
                <th key={h} style={{ padding: '11px 18px', fontSize: '10px', fontWeight: '700', color: C.muted, letterSpacing: '0.12em', fontFamily: 'monospace' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pipelines.map((pipe, idx) => {
              const clr = PIPE_COLORS[idx % PIPE_COLORS.length];
              return (
                <tr key={pipe.id}
                  style={{ borderBottom: `1px solid rgba(139,92,246,0.06)`, transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                  {/* ID */}
                  <td style={{ padding: '13px 18px', fontFamily: 'monospace', fontSize: '12px', color: C.muted }}>
                    <span style={{ background: 'rgba(139,92,246,0.1)', padding: '2px 7px', borderRadius: '4px', color: '#a78bfa' }}>#{pipe.id}</span>
                  </td>

                  {/* Name */}
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: clr, flexShrink: 0, boxShadow: `0 0 6px ${clr}` }}/>
                      <span style={{ fontWeight: '700', fontSize: '14px' }}>{pipe.name}</span>
                    </div>
                  </td>

                  {/* Tasks badge */}
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', border: '1px solid rgba(6,182,212,0.2)' }}>
                      {pipe.tasks?.length || 0} TASKS
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', fontFamily: 'monospace', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 5px #34d399' }}/>
                      {(pipe.status || 'IDLE').toUpperCase()}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to="/run" style={{
                        color: '#a78bfa', fontSize: '11px', fontWeight: '700', textDecoration: 'none',
                        padding: '4px 12px', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '6px',
                        fontFamily: 'monospace', letterSpacing: '0.05em',
                        transition: 'all 0.15s',
                      }}>▶ RUN</Link>
                      <button
                        onClick={() => handleDelete(pipe.id, pipe.name)}
                        disabled={deleting === pipe.id}
                        style={{
                          color: '#f87171', fontSize: '11px', fontWeight: '700', background: 'none',
                          border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
                          padding: '4px 12px', cursor: 'pointer', fontFamily: 'monospace',
                          letterSpacing: '0.05em', opacity: deleting === pipe.id ? 0.4 : 1,
                          transition: 'all 0.15s',
                        }}>
                        {deleting === pipe.id ? '...' : '✕ DEL'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pipelines.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>◈</div>
                  <p style={{ color: C.muted, margin: 0, fontSize: '14px' }}>
                    No pipelines registered.{' '}
                    <Link to="/pipelines/new" style={{ color: C.purple, textDecoration: 'none', fontWeight: '600' }}>
                      Create your first →
                    </Link>
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
