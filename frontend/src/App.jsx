import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PipelineBuilder from './pages/PipelineBuilder';
import RunnerSetup from './pages/RunnerSetup';
import RunScheduler from './pages/RunScheduler';
import ComparisonDashboard from './pages/ComparisonDashboard';
import RunHistory from './pages/RunHistory';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pipelines/new" element={<PipelineBuilder />} />
          <Route path="/runners" element={<RunnerSetup />} />
          <Route path="/run" element={<RunScheduler />} />
          <Route path="/compare" element={<ComparisonDashboard />} />
          <Route path="/history" element={<RunHistory />} />
        </Routes>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
