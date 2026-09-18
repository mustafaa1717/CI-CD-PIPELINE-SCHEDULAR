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

// Error boundary to show crash message instead of blank page
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', color: 'white', background: '#0f172a', minHeight: '100vh' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>🐛 React Error</h2>
          <pre style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', color: '#fca5a5', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: '20px', padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: 'white' }}>
      <ErrorBoundary>
        <Navbar />
      </ErrorBoundary>
      <main style={{ flexGrow: 1, padding: '24px' }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pipelines/new" element={<PipelineBuilder />} />
            <Route path="/runners" element={<RunnerSetup />} />
            <Route path="/run" element={<RunScheduler />} />
            <Route path="/compare" element={<ComparisonDashboard />} />
            <Route path="/history" element={<RunHistory />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
