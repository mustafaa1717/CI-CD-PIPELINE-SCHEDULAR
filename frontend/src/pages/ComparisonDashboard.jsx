import { useState, useEffect } from 'react';
import { getPipelines, compareAlgorithms } from '../services/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Crown, Loader } from 'lucide-react';

export default function ComparisonDashboard() {
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    try {
      const res = await getPipelines();
      setPipelines(res.data);
      if (res.data.length > 0) setSelectedPipeline(res.data[0].id);
    } catch (err) {
      toast.error('Failed to load pipelines');
    }
  };

  const handleCompare = async () => {
    if (!selectedPipeline) return;
    setLoading(true);
    try {
      const res = await compareAlgorithms(selectedPipeline);
      setResults(res.data);
      toast.success('Comparison completed!');
    } catch (err) {
      toast.error('Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  // Find best values
  const getBest = (metric, isLowerBetter = true) => {
    if (!results || !results.algorithms) return null;
    let best = results.algorithms[0];
    results.algorithms.forEach(alg => {
      if (isLowerBetter) {
        if (alg[metric] < best[metric]) best = alg;
      } else {
        if (alg[metric] > best[metric]) best = alg;
      }
    });
    return best.name;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-lg border border-gray-700">
        <div>
          <h1 className="text-3xl font-bold">Algorithm Comparison</h1>
          <p className="text-gray-400 mt-1">Simulate and compare scheduling algorithms side-by-side</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <select 
            value={selectedPipeline} 
            onChange={(e) => setSelectedPipeline(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded p-2 text-white flex-grow md:w-64"
          >
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button 
            onClick={handleCompare} 
            disabled={loading || !selectedPipeline}
            className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white px-6 py-2 rounded font-bold whitespace-nowrap flex items-center gap-2"
          >
            {loading ? <><Loader className="animate-spin" size={18} /> Running...</> : 'Compare All'}
          </button>
        </div>
      </div>

      {results && results.algorithms && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {results.algorithms.map((alg) => (
              <div key={alg.name} className="bg-card p-6 rounded-lg border border-gray-700">
                <h3 className="font-bold text-lg border-b border-gray-700 pb-2 mb-4 text-accent">{alg.name}</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Makespan:</span>
                    <span className={`font-bold flex items-center gap-1 ${getBest('makespan', true) === alg.name ? 'text-green-400' : ''}`}>
                      {getBest('makespan', true) === alg.name && <Crown size={14} className="text-yellow-400" />}
                      {alg.makespan}s
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Wait:</span>
                    <span className={`font-bold flex items-center gap-1 ${getBest('avg_wait_time', true) === alg.name ? 'text-green-400' : ''}`}>
                      {getBest('avg_wait_time', true) === alg.name && <Crown size={14} className="text-yellow-400" />}
                      {alg.avg_wait_time}s
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Utilization:</span>
                    <span className={`font-bold flex items-center gap-1 ${getBest('utilization', false) === alg.name ? 'text-green-400' : ''}`}>
                      {getBest('utilization', false) === alg.name && <Crown size={14} className="text-yellow-400" />}
                      {alg.utilization}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-card p-6 rounded-lg border border-gray-700 h-80">
              <h3 className="text-center font-bold mb-4">Makespan (Lower is Better)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.algorithms}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" tick={{fontSize: 12}} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#374151'}} />
                  <Bar dataKey="makespan" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card p-6 rounded-lg border border-gray-700 h-80">
              <h3 className="text-center font-bold mb-4">Avg Wait Time (Lower is Better)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.algorithms}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" tick={{fontSize: 12}} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#374151'}} />
                  <Bar dataKey="avg_wait_time" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card p-6 rounded-lg border border-gray-700 h-80">
              <h3 className="text-center font-bold mb-4">Runner Utilization % (Higher is Better)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.algorithms}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" tick={{fontSize: 12}} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#374151'}} />
                  <Bar dataKey="utilization" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {!results && !loading && (
        <div className="bg-card border border-dashed border-gray-700 p-12 text-center rounded-lg text-gray-500">
          Select a pipeline and click "Compare All" to run simulations and generate charts.
        </div>
      )}
    </div>
  );
}
