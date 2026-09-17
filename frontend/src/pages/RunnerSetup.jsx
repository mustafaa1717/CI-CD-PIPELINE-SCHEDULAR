import { useState, useEffect } from 'react';
import { getRunners, createRunner, deleteRunner } from '../services/api';
import toast from 'react-hot-toast';
import { Server, Trash2, Cpu, MemoryStick } from 'lucide-react';

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
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Runner Setup</h1>

      <div className="bg-card p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Add New Runner</h2>
        <form onSubmit={handleAddRunner} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm mb-1 text-gray-300">Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" placeholder="worker-1" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-300">CPU Cores</label>
            <input required type="number" min="1" value={cpuCores} onChange={e => setCpuCores(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-300">RAM (GB)</label>
            <input required type="number" min="1" value={ram} onChange={e => setRam(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" />
          </div>
          <button type="submit" className="bg-accent hover:bg-accent/90 text-white py-2 rounded font-medium h-[42px]">
            Add Runner
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {runners.map(runner => (
          <div key={runner.id} className="bg-card p-5 rounded-lg border border-gray-700 relative group">
            <button 
              onClick={() => handleDelete(runner.id)} 
              className="absolute top-4 right-4 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={18} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gray-800 rounded-full text-accent">
                <Server size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">{runner.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${!runner.is_busy ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {runner.is_busy ? 'BUSY' : 'FREE'}
                </span>
              </div>
            </div>
            <div className="flex gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1"><Cpu size={14}/> {runner.cpu_cores} Cores</div>
              <div className="flex items-center gap-1"><MemoryStick size={14}/> {runner.ram_gb} GB</div>
            </div>
          </div>
        ))}
        {runners.length === 0 && (
          <div className="col-span-3 text-center p-12 text-gray-500 border border-dashed border-gray-700 rounded-lg">
            No runners configured. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
