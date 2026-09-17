import { useState, useEffect, useRef } from 'react';
import { getPipelines, runPipeline, getRunStatus, getRunners } from '../services/api';
import toast from 'react-hot-toast';
import { Play } from 'lucide-react';

export default function RunScheduler() {
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [algorithm, setAlgorithm] = useState('FCFS');
  const [runData, setRunData] = useState(null);
  const [runners, setRunners] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
    return () => clearInterval(timerRef.current);
  }, []);

  const fetchInitialData = async () => {
    try {
      const [pipeRes, runRes] = await Promise.all([getPipelines(), getRunners()]);
      setPipelines(pipeRes.data);
      if (pipeRes.data.length > 0) setSelectedPipeline(pipeRes.data[0].id);
      setRunners(runRes.data);
    } catch (err) {
      toast.error('Failed to load initial data');
    }
  };

  const handleStartRun = async () => {
    if (!selectedPipeline) return;
    try {
      const res = await runPipeline(selectedPipeline, algorithm);
      setRunData(res.data);
      setIsRunning(true);
      toast.success('Simulation started!');
      startPolling(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start run');
    }
  };

  const startPolling = (runId) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const res = await getRunStatus(runId);
        setRunData(res.data);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          clearInterval(timerRef.current);
          setIsRunning(false);
          if(res.data.status === 'completed') toast.success('Simulation completed!');
        }
      } catch (err) {
        console.error(err);
      }
    }, 1000);
  };

  const algorithms = [
    { id: 'FCFS', name: 'First Come First Serve', desc: 'Runs tasks in order of creation' },
    { id: 'Priority', name: 'Priority Based', desc: 'Higher priority tasks run first' },
    { id: 'Dependency-Aware', name: 'Dependency Aware', desc: 'Respects DAG dependencies' },
    { id: 'Resource-Aware', name: 'Resource Aware', desc: 'Optimizes based on CPU/RAM limits' }
  ];

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'pending': return 'bg-gray-700';
      case 'ready': return 'bg-blue-600';
      case 'running': return 'bg-amber-500 animate-pulse';
      case 'success': case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-700';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-100px)]">
      {/* Control Panel */}
      <div className="bg-card p-6 rounded-lg border border-gray-700 lg:col-span-1 overflow-y-auto">
        <h2 className="text-xl font-bold mb-6">Simulation Setup</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Pipeline</label>
          <select 
            value={selectedPipeline} 
            onChange={(e) => setSelectedPipeline(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
          >
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium mb-3">Scheduling Algorithm</label>
          <div className="space-y-3">
            {algorithms.map(alg => (
              <label key={alg.id} className={`block p-3 rounded border cursor-pointer transition-colors ${algorithm === alg.id ? 'border-accent bg-accent/10' : 'border-gray-700 hover:border-gray-500'}`}>
                <div className="flex items-center gap-2">
                  <input type="radio" name="algorithm" value={alg.id} checked={algorithm === alg.id} onChange={(e) => setAlgorithm(e.target.value)} className="text-accent focus:ring-accent" />
                  <span className="font-medium text-sm">{alg.name}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-5">{alg.desc}</p>
              </label>
            ))}
          </div>
        </div>

        <button 
          onClick={handleStartRun} 
          disabled={isRunning || !selectedPipeline}
          className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white py-3 rounded font-bold flex items-center justify-center gap-2"
        >
          <Play size={18} /> {isRunning ? 'Running...' : 'Run Pipeline'}
        </button>
      </div>

      {/* Live Execution Panel */}
      <div className="bg-card rounded-lg border border-gray-700 lg:col-span-3 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
          <h2 className="text-xl font-bold">Live Execution Monitor</h2>
          <div className="flex gap-4 text-sm font-medium">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-700"></span> Pending</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600"></span> Ready</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span> Running</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> Success</span>
          </div>
        </div>

        <div className="p-6 flex-grow overflow-y-auto">
          {!runData ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a pipeline and algorithm, then click Run Pipeline to monitor execution.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {runData.tasks?.map(task => (
                <div key={task.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-full h-1 ${getStatusColor(task.status)}`}></div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold">{task.name}</h3>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded uppercase">{task.status || 'PENDING'}</span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>Runner: <span className="text-white">{task.runner_name || 'Unassigned'}</span></p>
                    <p>Duration: <span className="text-white">{task.duration}s</span></p>
                    {task.wait_time > 0 && <p>Wait Time: <span className="text-amber-400">{task.wait_time}s</span></p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
