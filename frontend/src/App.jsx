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

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', color: '#ededed', background: '#000000', minHeight: '100vh' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px', fontWeight: '500' }}>Application Error</h2>
          <pre style={{ background: '#0a0a0a', border: '1px solid #27272a', padding: '24px', borderRadius: '6px', color: '#888888', whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.5' }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })}
            style={{ marginTop: '24px', padding: '8px 16px', background: '#ededed', color: '#000000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#ededed', background: '#000000' }}>
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
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0a0a0a',
            border: '1px solid #27272a',
            color: '#ededed',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#000000' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#000000' } },
        }}
      />
    </div>
  );
}

export default App;
