import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import DagViewer from '../components/DagViewer';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [repoName, setRepoName] = useState('my-awesome-app');
  const [repoUrl, setRepoUrl] = useState('https://github.com/mustafaa1717/demo-backend.git');
  const [yamlText, setYamlText] = useState(
`pipeline:
  name: full-ci-cd
  tasks:
    - name: install
      command: echo "Installing dependencies..." && sleep 2
      cpus: 1
      memoryMB: 512
    - name: build
      command: echo "Compiling artifacts..." && sleep 2
      dependsOn: [install]
      cpus: 2
      memoryMB: 1024
    - name: test-frontend
      command: echo "Running Frontend test suite..." && sleep 3
      dependsOn: [build]
      cpus: 1
      memoryMB: 512
    - name: test-backend
      command: echo "Running Backend test suite..." && sleep 3
      dependsOn: [build]
      cpus: 1
      memoryMB: 512
    - name: deploy
      command: echo "Deploying container image to cluster!" && sleep 2
      dependsOn: [test-frontend, test-backend]
      cpus: 1
      memoryMB: 512`
  );

  const [pipelineId, setPipelineId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [runners, setRunners] = useState([]);
  const [validationState, setValidationState] = useState({ isValid: true, error: null, totalStages: 0 });
  const [activeTab, setActiveTab] = useState('dag'); // 'dag' | 'yaml'
  const logContainerRef = useRef(null);

  // Validate YAML on change (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await axios.post('http://localhost:3000/api/pipelines/validate', {
          yamlDefinition: yamlText
        });
        setValidationState({
          isValid: true,
          error: null,
          totalStages: res.data.totalStages,
          tasks: res.data.tasks
        });
        // If not running an active run, preview tasks in DAG
        if (!activeRun || activeRun.status !== 'RUNNING') {
          setTasks(res.data.tasks.map(t => ({ ...t, status: 'WAITING' })));
        }
      } catch (err) {
        setValidationState({
          isValid: false,
          error: err.response?.data?.error || err.message,
          totalStages: 0
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [yamlText, activeRun]);

  // Load initial data & Socket listeners
  useEffect(() => {
    axios.get('http://localhost:3000/auth/current-user', { withCredentials: true })
      .then(res => { if (res.data) setUser(res.data); })
      .catch(() => console.log('Not logged in'));

    // Fetch runners
    axios.get('http://localhost:3000/api/runners')
      .then(res => setRunners(res.data || []))
      .catch(() => {});

    // Fetch latest pipeline run
    axios.get('http://localhost:3000/api/pipelines/runs/latest')
      .then(res => {
        if (res.data) {
          setActiveRun(res.data);
          setPipelineId(res.data.pipelineId?._id || res.data.pipelineId);
          if (res.data.tasks && res.data.tasks.length > 0) {
            setTasks(res.data.tasks);
          }
        }
      })
      .catch(() => {});

    const socket = io('http://localhost:3000');

    socket.on('connect', () => {
      setLogs(prev => [...prev, { text: '🟢 Connected to CI/CD Gateway WebSocket', time: new Date().toLocaleTimeString() }]);
    });

    // Task status change
    socket.on('task:status_changed', (data) => {
      setTasks(prev => prev.map(t => {
        if (t._id === data.taskId || t.name === data.name) {
          return {
            ...t,
            status: data.status,
            assignedRunner: data.runnerName ? { name: data.runnerName } : t.assignedRunner,
            exitCode: data.exitCode !== undefined ? data.exitCode : t.exitCode,
            durationMs: data.durationMs !== undefined ? data.durationMs : t.durationMs
          };
        }
        return t;
      }));

      setLogs(prev => [...prev, {
        text: `[Task] Task "${data.taskId || ''}" transitioned to ${data.status}`,
        taskId: data.taskId,
        time: new Date().toLocaleTimeString()
      }]);
    });

    // Live Task Logs
    socket.on('task:log', (logChunk) => {
      setLogs(prev => [...prev, {
        text: logChunk.data,
        taskId: logChunk.taskId,
        stream: logChunk.stream,
        time: new Date().toLocaleTimeString()
      }]);
    });

    // PipelineRun completion
    socket.on('pipelinerun:status_changed', (data) => {
      setActiveRun(prev => prev ? { ...prev, status: data.status, completedAt: data.completedAt, durationMs: data.durationMs } : prev);
      setLogs(prev => [...prev, {
        text: `🏁 [Pipeline] Run ${data.pipelineRunId} ended with status: ${data.status} (${data.durationMs}ms)`,
        time: new Date().toLocaleTimeString(),
        highlight: true
      }]);
    });

    // Workspace Volume cleanup
    socket.on('pipeline:cleanup_workspace', (data) => {
      setLogs(prev => [...prev, {
        text: `🧹 [Cleanup] Workspace volume cicd-workspace-${data.pipelineRunId} scheduled for purging.`,
        time: new Date().toLocaleTimeString()
      }]);
    });

    // Runner status change
    socket.on('runner:status_changed', (runnerData) => {
      setRunners(prev => {
        const idx = prev.findIndex(r => r._id === runnerData.runnerId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...runnerData };
          return updated;
        } else {
          return [...prev, runnerData];
        }
      });
    });

    return () => socket.disconnect();
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSave = async () => {
    if (!validationState.isValid) {
      alert('Cannot save pipeline with DAG errors: ' + validationState.error);
      return;
    }
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
      alert('✅ Pipeline saved & Webhook verified on GitHub!');
    } catch (err) {
      alert('Error saving pipeline: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRunPipeline = async () => {
    if (!pipelineId) {
      alert('Please save the pipeline first!');
      return;
    }
    try {
      setLogs(prev => [...prev, { text: '🚀 Triggering Pipeline Run...', time: new Date().toLocaleTimeString() }]);
      const res = await axios.post(`http://localhost:3000/api/pipelines/${pipelineId}/run`);
      // Reload latest run
      const runRes = await axios.get(`http://localhost:3000/api/pipelines/runs/${res.data.runId}`);
      if (runRes.data) {
        setActiveRun(runRes.data);
        if (runRes.data.tasks) setTasks(runRes.data.tasks);
      }
    } catch (err) {
      alert('Error triggering pipeline: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSimulatePush = async () => {
    try {
      setLogs(prev => [...prev, { text: '📦 [Simulate] Triggering pipeline via simulated GitHub push webhook...', time: new Date().toLocaleTimeString() }]);
      const cleanRepo = repoUrl.trim().replace('https://github.com/', '').replace('.git', '');
      const repoShortName = cleanRepo.split('/')[1] || cleanRepo;
      const res = await axios.post('http://localhost:3000/api/webhooks/github', {
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

      if (res.data?.runId) {
        const runRes = await axios.get(`http://localhost:3000/api/pipelines/runs/${res.data.runId}`);
        if (runRes.data) {
          setActiveRun(runRes.data);
          if (runRes.data.tasks) setTasks(runRes.data.tasks);
        }
      }
    } catch (err) {
      alert('Error triggering webhook: ' + (err.response?.data?.error || err.message));
    }
  };

  // Filter logs if a task is selected
  const filteredLogs = selectedTask
    ? logs.filter(l => !l.taskId || l.taskId === selectedTask._id || l.taskId === selectedTask.name)
    : logs;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0d12',
      color: '#c9d1d9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Top Navbar */}
      <div style={{
        padding: '12px 28px',
        backgroundColor: '#161b22',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', color: '#58a6ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span> Antigravity CI/CD Scheduler
          </h1>
          <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}>
            DAG & Resource Aware
          </span>
        </div>

        {/* User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px' }}>Signed in as <b style={{ color: '#f0f6fc' }}>{user.username}</b></span>
              <a href="http://localhost:3000/auth/logout" style={{ padding: '4px 10px', backgroundColor: '#21262d', color: '#c9d1d9', textDecoration: 'none', borderRadius: '6px', border: '1px solid #30363d', fontSize: '12px' }}>Logout</a>
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: '#8b949e' }}>Guest Mode</span>
          )}
        </div>
      </div>

      {/* Cluster Runners Monitor Bar */}
      <div style={{
        padding: '10px 28px',
        backgroundColor: '#11161d',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        overflowX: 'auto',
        fontSize: '12px'
      }}>
        <span style={{ color: '#8b949e', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🖥️ Active Runners ({runners.filter(r => r.status !== 'OFFLINE').length} Online):
        </span>
        {runners.length === 0 && <span style={{ color: '#8b949e' }}>No runners registered yet. Start a runner agent!</span>}
        {runners.map(runner => {
          const isOnline = runner.status !== 'OFFLINE';
          const cpuUsed = runner.usedCpus || 0;
          const cpuTotal = runner.cpuCapacity || 1;
          const memUsed = runner.usedMemoryMB || 0;
          const memTotal = runner.memoryCapacity || 512;
          const cpuPct = Math.min(100, Math.round((cpuUsed / cpuTotal) * 100));

          return (
            <div key={runner._id || runner.name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px',
              backgroundColor: '#161b22',
              borderRadius: '6px',
              border: `1px solid ${isOnline ? '#30363d' : '#490202'}`
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isOnline ? (runner.status === 'BUSY' ? '#d29922' : '#3fb950') : '#f85149'
              }} />
              <b style={{ color: '#f0f6fc' }}>{runner.name}</b>
              <span style={{ color: '#8b949e' }}>({runner.status})</span>
              {isOnline && (
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#7ee787' }}>
                  <span>⚡ CPU: {cpuUsed}/{cpuTotal} ({cpuPct}%)</span>
                  <span>💾 RAM: {memUsed}/{memTotal}MB</span>
                  {runner.activeTaskCount > 0 && <span>🏃 {runner.activeTaskCount} task(s)</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, padding: '24px 28px', gap: '24px', overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Controls & DAG / YAML tabs */}
        <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          
          {/* Action Header & Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveTab('dag')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: activeTab === 'dag' ? '#1f6feb' : '#21262d',
                  color: '#ffffff',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                📊 Interactive DAG Graph
              </button>
              <button
                onClick={() => setActiveTab('yaml')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: activeTab === 'yaml' ? '#1f6feb' : '#21262d',
                  color: '#ffffff',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                📝 YAML Configuration
              </button>
            </div>

            {/* Pipeline Trigger Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleRunPipeline}
                disabled={!validationState.isValid}
                style={{
                  padding: '8px 14px',
                  backgroundColor: validationState.isValid ? '#238636' : '#21262d',
                  color: '#ffffff',
                  border: '1px solid rgba(240,246,252,0.1)',
                  cursor: validationState.isValid ? 'pointer' : 'not-allowed',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                ▶️ Trigger Run Now
              </button>
              <button
                onClick={handleSimulatePush}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#21262d',
                  color: '#58a6ff',
                  border: '1px solid #30363d',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                🧪 Simulate Push
              </button>
            </div>
          </div>

          {/* Validation & Cycle Detection Banner */}
          <div>
            {validationState.isValid ? (
              <div style={{
                padding: '8px 14px',
                backgroundColor: 'rgba(35, 134, 54, 0.15)',
                border: '1px solid #238636',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#3fb950',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>✅</span>
                <span><b>Valid DAG:</b> {validationState.tasks?.length || tasks.length} Tasks across {validationState.totalStages || 1} Stages. Kahn's cycle test passed.</span>
              </div>
            ) : (
              <div style={{
                padding: '8px 14px',
                backgroundColor: 'rgba(218, 54, 51, 0.15)',
                border: '1px solid #da3633',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#f85149',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>🚨</span>
                <span><b>DAG Validation Error:</b> {validationState.error}</span>
              </div>
            )}
          </div>

          {/* Active Pipeline Run Status Banner */}
          {activeRun && (
            <div style={{
              padding: '12px 18px',
              backgroundColor: '#161b22',
              borderRadius: '8px',
              border: '1px solid #30363d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#8b949e' }}>Current Run:</span>
                <b style={{ color: '#f0f6fc' }}>#{String(activeRun._id).substring(18)}</b>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '11px',
                  backgroundColor: activeRun.status === 'SUCCESS' ? '#0d381e' : (activeRun.status === 'FAILED' ? '#490202' : '#0c2d6b'),
                  color: activeRun.status === 'SUCCESS' ? '#3fb950' : (activeRun.status === 'FAILED' ? '#f85149' : '#58a6ff'),
                  border: `1px solid ${activeRun.status === 'SUCCESS' ? '#238636' : (activeRun.status === 'FAILED' ? '#da3633' : '#1f6feb')}`
                }}>
                  {activeRun.status}
                </span>
                <span style={{ color: '#8b949e', fontSize: '12px' }}>
                  Trigger: <code>{activeRun.triggerType || 'manual'}</code>
                </span>
              </div>

              {activeRun.durationMs && (
                <span style={{ color: '#7ee787', fontWeight: '500' }}>
                  Duration: {activeRun.durationMs}ms
                </span>
              )}
            </div>
          )}

          {/* TAB 1: Visual DAG Graph */}
          {activeTab === 'dag' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <DagViewer
                tasks={tasks}
                selectedTaskId={selectedTask?._id || selectedTask?.name}
                onSelectTask={(t) => setSelectedTask(prev => prev?._id === t._id ? null : t)}
              />
            </div>
          )}

          {/* TAB 2: YAML Configuration Form */}
          {activeTab === 'yaml' && (
            <div style={{
              backgroundColor: '#161b22',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #30363d',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              flex: 1,
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#8b949e' }}>Project Name</label>
                  <input
                    value={repoName}
                    onChange={e => setRepoName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#8b949e' }}>Repository URL</label>
                  <input
                    value={repoUrl}
                    onChange={e => setRepoUrl(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#8b949e' }}>Pipeline Definition (YAML)</label>
                <textarea
                  value={yamlText}
                  onChange={e => setYamlText(e.target.value)}
                  rows={12}
                  style={{
                    width: '100%',
                    flex: 1,
                    boxSizing: 'border-box',
                    padding: '12px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    backgroundColor: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#7ee787',
                    borderRadius: '6px',
                    fontSize: '13px',
                    resize: 'none'
                  }}
                />
              </div>

              <button
                onClick={handleSave}
                disabled={!validationState.isValid}
                style={{
                  padding: '10px 16px',
                  backgroundColor: validationState.isValid ? '#238636' : '#21262d',
                  color: '#ffffff',
                  border: '1px solid rgba(240,246,252,0.1)',
                  cursor: validationState.isValid ? 'pointer' : 'not-allowed',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                💾 Save Pipeline & Attach Webhook
              </button>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Terminal Logs Output */}
        <div style={{
          flex: 1,
          backgroundColor: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid #30363d',
            backgroundColor: '#161b22',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#c9d1d9' }}>
                📟 Live Execution Console
              </span>
              {selectedTask && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: '#0c2d6b',
                  color: '#58a6ff'
                }}>
                  Filtered: {selectedTask.name}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedTask && (
                <button
                  onClick={() => setSelectedTask(null)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    borderRadius: '4px',
                    fontSize: '11px',
                    padding: '2px 8px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Filter
                </button>
              )}
              <button
                onClick={() => setLogs([])}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #30363d',
                  color: '#8b949e',
                  borderRadius: '4px',
                  fontSize: '11px',
                  padding: '2px 8px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Terminal stream */}
          <div
            ref={logContainerRef}
            style={{
              padding: '16px',
              overflowY: 'auto',
              flex: 1,
              fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
              fontSize: '12px',
              color: '#e6edf3',
              lineHeight: '1.5'
            }}
          >
            {filteredLogs.map((log, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '4px',
                  color: log.highlight ? '#58a6ff' : (log.stream === 'stderr' ? '#f85149' : '#c9d1d9'),
                  wordBreak: 'break-all',
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <span style={{ color: '#484f58', userSelect: 'none' }}>[{log.time || '--:--:--'}]</span>
                <span>{log.text}</span>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div style={{ color: '#484f58' }}>$ Ready for pipeline execution...</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
