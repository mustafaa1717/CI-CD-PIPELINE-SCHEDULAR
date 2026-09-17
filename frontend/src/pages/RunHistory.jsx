import { useState, useEffect } from 'react';
import { getRunHistory } from '../services/api';
import toast from 'react-hot-toast';

export default function RunHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await getRunHistory();
      setHistory(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load run history');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Run History</h1>

      <div className="bg-card rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-700">
              <th className="p-4 font-semibold text-gray-300">Run ID</th>
              <th className="p-4 font-semibold text-gray-300">Algorithm</th>
              <th className="p-4 font-semibold text-gray-300">Status</th>
              <th className="p-4 font-semibold text-gray-300">Started At</th>
              <th className="p-4 font-semibold text-gray-300">Makespan</th>
            </tr>
          </thead>
          <tbody>
            {history.map(run => (
              <tr key={run.id} className="border-b border-gray-700 hover:bg-gray-800/20 cursor-pointer">
                <td className="p-4 font-mono text-sm text-accent">{run.id.substring(0, 8)}...</td>
                <td className="p-4">{run.algorithm}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs uppercase ${run.status === 'completed' ? 'bg-green-500/20 text-green-500' : run.status === 'failed' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                    {run.status}
                  </span>
                </td>
                <td className="p-4 text-gray-400">{new Date(run.created_at).toLocaleString()}</td>
                <td className="p-4 font-medium">{run.metrics?.makespan || '-'} s</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-500">
                  No run history available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
