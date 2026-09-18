import { useState, useEffect } from 'react';
import { getRunners, createRunner, deleteRunner } from '../services/api';
import toast from 'react-hot-toast';
import { Server, Trash2, Cpu, HardDrive } from 'lucide-react';

export default function RunnerSetup() {
  const [runners, setRunners] = useState([]);
  const [name, setName] = useState('');
  const [cpuCores, setCpuCores] = useState(2);
  const [ram, setRam] = useState(4);

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

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '24px' }}>Runner Setup</h1>

      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h2 className="glass-card-header">Add New Runner</h2>
        <form onSubmit={handleAddRunner} style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '13px', marginBottom: '8px', color: '#888888' }}>Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', background: '#000000', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }} placeholder="worker-1" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '13px', marginBottom: '8px', color: '#888888' }}>CPU Cores</label>
            <input required type="number" min="1" value={cpuCores} onChange={e => setCpuCores(e.target.value)} style={{ width: '100%', background: '#000000', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '13px', marginBottom: '8px', color: '#888888' }}>RAM (GB)</label>
            <input required type="number" min="1" value={ram} onChange={e => setRam(e.target.value)} style={{ width: '100%', background: '#000000', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ height: '40px' }}>
            Add Runner
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {runners.map(runner => (
          <div key={runner.id} className="glass-card" style={{ padding: '20px', position: 'relative' }}>
            <button 
              onClick={() => handleDelete(runner.id)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#888888', cursor: 'pointer', padding: '4px' }}
              title="Delete Runner"
            >
              <Trash2 size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid #27272a', color: '#ededed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Server size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ fontWeight: '500', fontSize: '16px', margin: 0 }}>{runner.name}</h3>
                <span className={`badge ${!runner.is_busy ? 'badge-emerald' : 'badge-rose'}`} style={{ width: 'fit-content' }}>
                  {runner.is_busy ? 'Busy' : 'Free'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#888888' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Cpu size={14}/> {runner.cpu_cores} Cores</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><HardDrive size={14}/> {runner.ram_gb} GB</div>
            </div>
          </div>
        ))}
        {runners.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#888888', border: '1px dashed #27272a', borderRadius: '8px', fontSize: '14px' }}>
            No runners configured. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
