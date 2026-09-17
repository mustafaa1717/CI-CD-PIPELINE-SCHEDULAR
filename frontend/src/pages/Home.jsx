import { useState, useEffect } from 'react';
import { getPipelines, getRunners } from '../services/api';
import { Link } from 'react-router-dom';
import { Activity, Server } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const [pipelines, setPipelines] = useState([]);
  const [runners, setRunners] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pipeRes, runRes] = await Promise.all([getPipelines(), getRunners()]);
      setPipelines(pipeRes.data);
      setRunners(runRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg border border-gray-700 flex items-center gap-4">
          <div className="p-4 bg-accent/20 rounded-full text-accent">
            <Activity size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{pipelines.length}</h2>
            <p className="text-gray-400">Total Pipelines</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-lg border border-gray-700 flex items-center gap-4">
          <div className="p-4 bg-green-500/20 rounded-full text-green-500">
            <Server size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{runners.length}</h2>
            <p className="text-gray-400">Configured Runners</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold">Recent Pipelines</h2>
          <Link to="/pipelines/new" className="bg-accent text-white px-4 py-2 rounded text-sm hover:bg-accent/90">
            Create New
          </Link>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800/50">
              <th className="p-4 font-semibold text-gray-300">Name</th>
              <th className="p-4 font-semibold text-gray-300">Tasks</th>
              <th className="p-4 font-semibold text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pipelines.map(pipe => (
              <tr key={pipe.id} className="border-t border-gray-700 hover:bg-gray-800/20">
                <td className="p-4 font-medium">{pipe.name}</td>
                <td className="p-4 text-gray-400">{pipe.tasks?.length || 0} tasks</td>
                <td className="p-4 flex gap-2">
                  <Link to="/run" className="text-accent hover:underline text-sm">Run</Link>
                </td>
              </tr>
            ))}
            {pipelines.length === 0 && (
              <tr>
                <td colSpan="3" className="p-8 text-center text-gray-500">
                  No pipelines found. Create one to get started!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
