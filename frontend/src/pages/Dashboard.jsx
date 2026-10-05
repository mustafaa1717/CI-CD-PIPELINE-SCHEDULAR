import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [repoName, setRepoName] = useState('my-awesome-app');
  const [repoUrl, setRepoUrl] = useState('https://github.com/mustafaa1717/demo-backend.git');
  const [yamlText, setYamlText] = useState(
`pipeline:
  name: my-pipeline
  tasks:
    - name: install
      command: echo "Installing via Frontend!" && sleep 2
      cpus: 1
    - name: build
      command: echo "Building via Frontend!" && sleep 2
      dependsOn: [install]
      cpus: 2`
  );
  
  const [pipelineId, setPipelineId] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:3000/auth/current-user', { withCredentials: true })
      .then(res => {
        if (res.data) setUser(res.data);
      })
      .catch(err => console.log('Not logged in'));
      
    const socket = io('http://localhost:3000');
    socket.on('connect', () => console.log('WebSocket Connected!'));
    
    socket.on('task:status_changed', (data) => {
      setLogs(prev => [...prev, `[System] Task changed to: ${data.status}`]);
    });

    socket.on('task:log', (logChunk) => {
      setLogs(prev => [...prev, logChunk.data]);
    });

    return () => socket.disconnect();
  }, []);

  const handleSave = async () => {
    try {
      const res = await axios.post(
        'http://localhost:3000/api/pipelines/setup-custom',
        {
          name: repoName,
          repository: repoUrl,
          yamlDefinition: yamlText
        },
        { withCredentials: true }
      );
      setPipelineId(res.data.pipelineId);
      alert('Pipeline saved & Webhook registered on GitHub!');
    } catch (err) {
      alert('Error saving pipeline');
    }
  };

  const handleSimulatePush = async () => {
    try {
      setLogs(prev => [...prev, '⚡ [Simulate] Triggering pipeline via GitHub push webhook event...']);
      const cleanRepo = repoUrl.trim().replace('https://github.com/', '').replace('.git', '');
      const repoShortName = cleanRepo.split('/')[1] || cleanRepo;
      await axios.post('http://localhost:3000/api/webhooks/github', {
        ref: 'refs/heads/main',
        after: Math.random().toString(36).substring(2, 10),
        repository: {
          name: repoShortName,
          clone_url: repoUrl,
          html_url: repoUrl
        }
      }, {
        headers: { 'x-github-event': 'push' }
      });
    } catch (err) {
      alert('Error triggering webhook: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0e1117', color: '#c9d1d9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      
      {/* Top Navbar */}
      <div style={{ padding: '16px 32px', backgroundColor: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#58a6ff' }}>⚡ Antigravity CI/CD</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px' }}>Signed in as <b>{user.username}</b></span>
              <a href="http://localhost:3000/auth/logout" style={{ padding: '6px 12px', backgroundColor: '#21262d', color: '#c9d1d9', textDecoration: 'none', borderRadius: '6px', border: '1px solid #30363d', fontSize: '14px' }}>Logout</a>
            </div>
          ) : (
            <span style={{ fontSize: '14px', color: '#8b949e' }}>Not logged in</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', padding: '32px', gap: '32px', height: 'calc(100vh - 73px)' }}>
        
        {/* LEFT COLUMN: Setup */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#161b22', padding: '24px', borderRadius: '8px', border: '1px solid #30363d' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Pipeline Configuration</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8b949e' }}>Project Name</label>
                <input value={repoName} onChange={e => setRepoName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '6px' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8b949e' }}>GitHub Repository URL</label>
                <input value={repoUrl} onChange={e => setRepoUrl(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '6px' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#8b949e' }}>Pipeline YAML</label>
                <textarea 
                  value={yamlText} 
                  onChange={e => setYamlText(e.target.value)} 
                  rows={14} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#7ee787', borderRadius: '6px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <button onClick={handleSave} style={{ padding: '12px 18px', backgroundColor: '#238636', color: '#ffffff', border: '1px solid rgba(240,246,252,0.1)', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                  ⚡ Save & Enable Automated Pipeline
                </button>
                <button onClick={handleSimulatePush} style={{ padding: '8px 14px', backgroundColor: '#21262d', color: '#58a6ff', border: '1px solid #30363d', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}>
                  🧪 Test Webhook (Simulate Git Push)
                </button>
                <span style={{ fontSize: '12px', color: '#8b949e' }}>
                  ℹ️ Automated mode active: Any real <code>git push</code> or clicking the test button will trigger the pipeline.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Terminal Logs */}
        <div style={{ flex: 1, backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #30363d', backgroundColor: '#161b22', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#8b949e' }}>Live Runner Output</h3>
          </div>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '13px', color: '#e6edf3' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '6px' }}>{log}</div>
            ))}
            {logs.length === 0 && <span style={{ color: '#8b949e' }}>$ Waiting for tasks...</span>}
          </div>
        </div>

      </div>
    </div>
  );
}
