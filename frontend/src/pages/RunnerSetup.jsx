import { useState, useEffect } from 'react';
import { getRunners, createRunner, deleteRunner } from '../services/api';
import toast from 'react-hot-toast';
import { Server, Trash2, Cpu, MemoryStick } from 'lucide-react';

export default function RunnerSetup() {
  const [runners, setRunners] = useState([]);
  const [name, setName] = useState('');
  const [cpuCores, setCpuCores] = useState(2);
  const [ram, setRam] = useState(4);
  const [hoveredDelete, setHoveredDelete] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  useEffect(() => {
    fetchRunners();
  }, []);

  const fetchRunners = async () => {
    try {
      const res = await getRunners();
      setRunners(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch runners');
    }
  };

  const handleAddRunner = async (e) => {
    e.preventDefault();
    try {
      await createRunner({ name, cpu_cores: Number(cpuCores), ram_gb: Number(ram) });
      toast.success('Runner added');
      setName('');
      fetchRunners();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to add runner');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRunner(id);
      toast.success('Runner deleted');
      fetchRunners();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete runner');
    }
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(10,15,30,0.9)',
    border: '1px solid rgba(139,92,246,0.35)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '14px',
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '10px',
    fontFamily: 'monospace',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#a78bfa',
    marginBottom: '6px',
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '8px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px', fontWeight: '800', margin: 0,
          background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: 'monospace', letterSpacing: '0.08em',
        }}>RUNNER CONFIGURATION</h1>
        <p style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '6px 0 0' }}>
          REGISTERED COMPUTE NODES
        </p>
      </div>

      <div style={{
        background: 'rgba(13,20,42,0.85)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px',
        padding: '24px', marginBottom: '28px',
        boxShadow: '0 0 30px rgba(139,92,246,0.07)',
      }}>
        <h2 style={{
          fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#a78bfa', margin: '0 0 20px 0',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 8px rgba(139,92,246,0.8)' }} />
          ADD NEW RUNNER
        </h2>
        <form onSubmit={handleAddRunner} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Runner Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)}
              style={inputStyle} placeholder="worker-1"
              onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.7)'; e.target.style.boxShadow = '0 0 15px rgba(139,92,246,0.25)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(139,92,246,0.35)'; e.target.style.boxShadow = 'none'; }} />
          </div>
          <div>
            <label style={labelStyle}>CPU Cores</label>
            <input required type="number" min="1" value={cpuCores} onChange={e => setCpuCores(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.7)'; e.target.style.boxShadow = '0 0 15px rgba(139,92,246,0.25)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(139,92,246,0.35)'; e.target.style.boxShadow = 'none'; }} />
          </div>
          <div>
            <label style={labelStyle}>RAM (GB)</label>
            <input required type="number" min="1" value={ram} onChange={e => setRam(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.7)'; e.target.style.boxShadow = '0 0 15px rgba(139,92,246,0.25)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(139,92,246,0.35)'; e.target.style.boxShadow = 'none'; }} />
          </div>
          <button type="submit" style={{
            padding: '10px 22px',
            background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
            border: 'none', borderRadius: '8px', color: '#fff',
            fontWeight: '700', fontSize: '12px', fontFamily: 'monospace',
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
            height: '42px', whiteSpace: 'nowrap',
            boxShadow: '0 0 15px rgba(139,92,246,0.4), 0 0 30px rgba(139,92,246,0.15)',
            transition: 'box-shadow 0.2s, transform 0.1s',
          }}
            onMouseEnter={e => { e.target.style.boxShadow = '0 0 25px rgba(139,92,246,0.7), 0 0 50px rgba(139,92,246,0.25)'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.target.style.boxShadow = '0 0 15px rgba(139,92,246,0.4), 0 0 30px rgba(139,92,246,0.15)'; e.target.style.transform = 'translateY(0)'; }}>
            + Add Runner
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {runners.map(runner => (
          <div key={runner.id}
            onMouseEnter={() => setHoveredRow(runner.id)}
            onMouseLeave={() => setHoveredRow(null)}
            style={{
              background: 'rgba(13,20,42,0.85)', backdropFilter: 'blur(20px)',
              border: hoveredRow === runner.id ? '1px solid rgba(6,182,212,0.4)' : '1px solid rgba(139,92,246,0.2)',
              borderRadius: '12px', padding: '20px', position: 'relative',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: hoveredRow === runner.id ? '0 0 20px rgba(6,182,212,0.12)' : '0 0 15px rgba(139,92,246,0.07)',
            }}>
            <button onClick={() => handleDelete(runner.id)}
              onMouseEnter={() => setHoveredDelete(runner.id)}
              onMouseLeave={() => setHoveredDelete(null)}
              style={{
                position: 'absolute', top: '14px', right: '14px',
                background: hoveredDelete === runner.id ? 'rgba(239,68,68,0.15)' : 'transparent',
                border: hoveredDelete === runner.id ? '1px solid rgba(239,68,68,0.5)' : '1px solid transparent',
                borderRadius: '6px', padding: '5px', cursor: 'pointer',
                color: hoveredDelete === runner.id ? '#f87171' : '#374151',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: hoveredDelete === runner.id ? '0 0 10px rgba(239,68,68,0.3)' : 'none',
              }}>
              <Trash2 size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                padding: '10px',
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.25)',
                borderRadius: '10px', color: '#a78bfa',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 12px rgba(139,92,246,0.2)',
              }}>
                <Server size={22} />
              </div>
              <div>
                <h3 style={{ fontWeight: '700', fontSize: '15px', color: '#e2e8f0', margin: '0 0 5px 0', fontFamily: 'monospace' }}>
                  {runner.name}
                </h3>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.1em',
                  textTransform: 'uppercase', fontWeight: '700', padding: '3px 8px', borderRadius: '20px',
                  background: !runner.is_busy ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: !runner.is_busy ? '#34d399' : '#f87171',
                  border: !runner.is_busy ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: !runner.is_busy ? '#10b981' : '#ef4444',
                    boxShadow: !runner.is_busy ? '0 0 8px rgba(16,185,129,0.9)' : '0 0 8px rgba(239,68,68,0.9)',
                  }} />
                  {runner.is_busy ? 'BUSY' : 'FREE'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                  <Cpu size={11} /> CPU CORES
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a78bfa', fontWeight: '700' }}>{runner.cpu_cores}</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(139,92,246,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min((runner.cpu_cores / 16) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', borderRadius: '4px',
                  boxShadow: '0 0 8px rgba(139,92,246,0.6)', transition: 'width 0.5s ease',
                }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                  <MemoryStick size={11} /> RAM
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#22d3ee', fontWeight: '700' }}>{runner.ram_gb} GB</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(6,182,212,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min((runner.ram_gb / 64) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #0891b2, #22d3ee)', borderRadius: '4px',
                  boxShadow: '0 0 8px rgba(6,182,212,0.6)', transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          </div>
        ))}

        {runners.length === 0 && (
          <div style={{
            gridColumn: '1 / -1', textAlign: 'center', padding: '64px 24px',
            border: '1px dashed rgba(139,92,246,0.3)', borderRadius: '12px',
            background: 'rgba(13,20,42,0.5)', backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontSize: '42px', marginBottom: '14px' }}>⚙️</div>
            <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'monospace', letterSpacing: '0.05em', margin: 0 }}>
              NO RUNNERS CONFIGURED
            </p>
            <p style={{ color: '#374151', fontSize: '11px', fontFamily: 'monospace', marginTop: '6px' }}>
              Add a compute node above to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
