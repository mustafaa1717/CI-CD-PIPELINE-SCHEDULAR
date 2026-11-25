import { useState, useEffect } from 'react';
import { getRunners, createRunner, deleteRunner } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Server, Trash2, Cpu, HardDrive, Shield, Info } from 'lucide-react';

export default function RunnerSetup() {
  const { user } = useAuth();
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
    if (!user?.is_admin) {
      toast.error('Only Administrators can add runners');
      return;
    }
    try {
      await createRunner({ name, cpu_cores: Number(cpuCores), ram_gb: Number(ram) });
      toast.success('Runner added to cluster');
      setName('');
      fetchRunners();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to add runner');
    }
  };

  const handleDelete = async (id) => {
    if (!user?.is_admin) {
      toast.error('Only Administrators can delete runners');
      return;
    }
    try {
      await deleteRunner(id);
      toast.success('Runner deleted from cluster');
      fetchRunners();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to delete runner');
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 6px 0', color: '#f8fafc' }}>Runner Cluster</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Shared compute nodes for running CI/CD workload simulations.</p>
        </div>
        {user?.is_admin ? (
          <span className="badge badge-emerald" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
            <Shield size={14} /> Admin Privileges Enabled
          </span>
        ) : (
          <span className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
            <Info size={14} /> Shared Cluster (Read-Only)
          </span>
        )}
      </div>

      {/* Admin Provisioning Card */}
      {user?.is_admin ? (
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <h2 className="glass-card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={16} /> Provision New Runner Node
          </h2>
          <form onSubmit={handleAddRunner} style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '13px', marginBottom: '8px', color: '#888888' }}>Node Name</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', background: '#000000', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }} placeholder="Runner-Delta" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '13px', marginBottom: '8px', color: '#888888' }}>vCPU Cores</label>
              <input required type="number" min="1" value={cpuCores} onChange={e => setCpuCores(e.target.value)} style={{ width: '100%', background: '#000000', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '13px', marginBottom: '8px', color: '#888888' }}>RAM (GB)</label>
              <input required type="number" min="1" value={ram} onChange={e => setRam(e.target.value)} style={{ width: '100%', background: '#000000', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ededed', fontSize: '14px', outline: 'none' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ height: '40px' }}>
              Provision Runner
            </button>
          </form>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px', border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Info size={18} color="#60a5fa" />
          <div style={{ fontSize: '13px', color: '#93c5fd', lineHeight: '1.5' }}>
            Runner nodes are shared compute infrastructure provisioned by system administrators. You can schedule pipelines across all active nodes below.
          </div>
        </div>
      )}

      {/* Cluster Nodes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {runners.map(runner => (
          <div key={runner.id} className="glass-card" style={{ padding: '20px', position: 'relative' }}>
            {user?.is_admin && (
              <button 
                onClick={() => handleDelete(runner.id)} 
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                title="Delete Runner"
              >
                <Trash2 size={16} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid #27272a', color: '#ededed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Server size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ fontWeight: '500', fontSize: '16px', margin: 0 }}>{runner.name}</h3>
                <span className={`badge ${!runner.is_busy ? 'badge-emerald' : 'badge-rose'}`} style={{ width: 'fit-content' }}>
                  {runner.is_busy ? 'Busy' : 'Available'}
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
            No cluster runners active.
          </div>
        )}
      </div>
    </div>
  );
}
