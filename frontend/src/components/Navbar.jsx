import { Link } from 'react-router-dom';
import { Activity, Play, Settings, List, PlusCircle, BarChart2, History } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-card border-b border-gray-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Activity className="text-accent h-6 w-6" />
        <span className="text-xl font-bold font-mono">CI/CD Simulator</span>
      </div>
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-1 hover:text-accent transition-colors"><List size={18} /> Pipelines</Link>
        <Link to="/pipelines/new" className="flex items-center gap-1 hover:text-accent transition-colors"><PlusCircle size={18} /> Builder</Link>
        <Link to="/runners" className="flex items-center gap-1 hover:text-accent transition-colors"><Settings size={18} /> Runners</Link>
        <Link to="/run" className="flex items-center gap-1 hover:text-accent transition-colors"><Play size={18} /> Run</Link>
        <Link to="/compare" className="flex items-center gap-1 hover:text-accent transition-colors"><BarChart2 size={18} /> Compare</Link>
        <Link to="/history" className="flex items-center gap-1 hover:text-accent transition-colors"><History size={18} /> History</Link>
      </div>
    </nav>
  );
}
