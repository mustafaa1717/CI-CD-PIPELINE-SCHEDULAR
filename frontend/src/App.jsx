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

/* Error boundary — catches React crashes and shows them on screen */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', color: '#e2e8f0', background: '#030712', minHeight: '100vh' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px', fontFamily: 'monospace' }}>⚠ RENDER ERROR</h2>
          <pre style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', padding: '20px', borderRadius: '10px', color: '#fca5a5', whiteSpace: 'pre-wrap', fontSize: '12px', fontFamily: 'monospace' }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })}
            style={{ marginTop: '20px', padding: '10px 24px', background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontFamily: 'monospace', fontWeight: '700', letterSpacing: '0.08em' }}>
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#e2e8f0' }}>
      <ErrorBoundary>
        <Navbar />
      </ErrorBoundary>
      <main style={{ flexGrow: 1, padding: '20px 24px' }}>
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
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(13,20,42,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(139,92,246,0.3)',
            color: '#e2e8f0',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '13px',
            boxShadow: '0 0 20px rgba(139,92,246,0.2)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#030712' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#030712' } },
        }}
      />
    </div>
  );
}

export default App;
