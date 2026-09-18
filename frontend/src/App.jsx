import { Routes, Route } from 'react-router-dom';
import { Component } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PipelineBuilder from './pages/PipelineBuilder';
import RunnerSetup from './pages/RunnerSetup';
import RunScheduler from './pages/RunScheduler';
import ComparisonDashboard from './pages/ComparisonDashboard';
import RunHistory from './pages/RunHistory';
import { Toaster } from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '60px', maxWidth: '800px', margin: '0 auto', color: '#f8fafc' }}>
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171', marginBottom: '20px' }}>
              <AlertTriangle size={28} />
              <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Application Error</h2>
            </div>
            <pre style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '24px', borderRadius: '8px', color: '#94a3b8', whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.6' }}>
              {this.state.error.toString()}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button className="btn-secondary" onClick={() => this.setState({ error: null })} style={{ marginTop: '24px' }}>
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ErrorBoundary>
        <Navbar />
      </ErrorBoundary>
      <main style={{ flexGrow: 1, padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/"               element={<Home />} />
            <Route path="/pipelines/new"  element={<PipelineBuilder />} />
            <Route path="/runners"        element={<RunnerSetup />} />
            <Route path="/run"            element={<RunScheduler />} />
            <Route path="/compare"        element={<ComparisonDashboard />} />
            <Route path="/history"        element={<RunHistory />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
