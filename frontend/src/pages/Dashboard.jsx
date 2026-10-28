import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import DagViewer from '../components/DagViewer';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [repoName, setRepoName] = useState('CI-CD-PIPELINE-SCHEDULAR');
  const [repoUrl, setRepoUrl] = useState('https://github.com/mustafaa1717/CI-CD-PIPELINE-SCHEDULAR.git');
  const [yamlText, setYamlText] = useState(
`pipeline:
  name: ci-pipeline
  tasks:
    - name: install
      command: echo "Installing packages..." && sleep 2
      cpus: 1
      memoryMB: 512
    - name: build
      command: echo "Building application..." && sleep 2
      dependsOn: [install]
      cpus: 2
      memoryMB: 1024
    - name: test-frontend
      command: echo "Testing frontend..." && sleep 3
      dependsOn: [build]
      cpus: 1
      memoryMB: 512
    - name: test-backend
      command: echo "Testing backend..." && sleep 3
      dependsOn: [build]
      cpus: 1
      memoryMB: 512
    - name: deploy
      command: echo "Deploying build!" && sleep 2
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
  const [validationError, setValidationError] = useState(null);
  const logContainerRef = useRef(null);

  // Validate YAML on edit
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await axios.post('http://localhost:3000/api/pipelines/validate', { yamlDefinition: yamlText });
        setValidationError(null);
        if (!activeRun || activeRun.status !== 'RUNNING') {
          setTasks(res.data.tasks.map(t => ({ ...t, status: 'WAITING' })));
        }
      } catch (err) {
        setValidationError(err.response?.data?.error || err.message);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [yamlText, activeRun]);

  // Load initial data & Socket listeners
  useEffect(() => {
    axios.get('http://localhost:3000/auth/current-user', { withCredentials: true })
      .then(res => { if (res.data) setUser(res.data); })
      .catch(() => {});

    axios.get('http://localhost:3000/api/runners')
      .then(res => setRunners(res.data || []))
      .catch(() => {});

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
        text: `[Task] ${data.name || data.taskId} ──► ${data.status}`,
        time: new Date().toLocaleTimeString()
      }]);
    });

    socket.on('task:log', (logChunk) => {
      setLogs(prev => [...prev, {
        text: logChunk.data,
        taskId: logChunk.taskId,
        time: new Date().toLocaleTimeString()
      }]);
    });

    socket.on('pipelinerun:status_changed', (data) => {
      setActiveRun(prev => prev ? { ...prev, status: data.status, completedAt: data.completedAt, durationMs: data.durationMs } : prev);
      setLogs(prev => [...prev, {
        text: `🏁 Pipeline Run finished: ${data.status} (${data.durationMs}ms)`,
        time: new Date().toLocaleTimeString(),
        highlight: true
      }]);
    });

    socket.on('runner:status_changed', (runnerData) => {
      setRunners(prev => {
        const idx = prev.findIndex(r => r._id === runnerData.runnerId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...runnerData };
          return updated;
        }
        return [...prev, runnerData];
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSave = async () => {
    if (validationError) {
      alert('Please fix DAG errors before saving: ' + validationError);
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
      alert('✅ Pipeline saved! Pushing code to GitHub will now automatically trigger this pipeline.');
    } catch (err) {
      alert('Error saving pipeline: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleManualRun = async () => {
    if (!pipelineId) {
      alert('Please save the pipeline first!');
      return;
    }
    try {
      setLogs(prev => [...prev, { text: '🚀 Triggered pipeline run manually...', time: new Date().toLocaleTimeString() }]);
      const res = await axios.post(`http://localhost:3000/api/pipelines/${pipelineId}/run`);
      const runRes = await axios.get(`http://localhost:3000/api/pipelines/runs/${res.data.runId}`);
      if (runRes.data) {
        setActiveRun(runRes.data);
        if (runRes.data.tasks) setTasks(runRes.data.tasks);
      }
    } catch (err) {
      alert('Error starting pipeline: ' + (err.response?.data?.error || err.message));
    }
  };

  const onlineRunnersCount = runners.filter(r => r.status !== 'OFFLINE').length;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0d12',
      color: '#c9d1d9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Clean Top Navbar */}
      <header style={{
        padding: '12px 24px',
        backgroundColor: '#161b22',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#58a6ff' }}>⚡</span> CI/CD Scheduler
          </h1>
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: onlineRunnersCount > 0 ? '#0c2718' : '#21262d',
            color: onlineRunnersCount > 0 ? '#3fb950' : '#8b949e',
            border: `1px solid ${onlineRunnersCount > 0 ? '#238636' : '#30363d'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: onlineRunnersCount > 0 ? '#3fb950' : '#8b949e' }} />
            {onlineRunnersCount > 0 ? `${onlineRunnersCount} Runner Online` : 'No Runners Online'}
          </span>
        </div>

        <div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
              <span>Signed in as <b style={{ color: '#f0f6fc' }}>{user.username}</b></span>
              <a href="http://localhost:3000/auth/logout" style={{ color: '#8b949e', textDecoration: 'none', padding: '3px 8px', borderRadius: '4px', border: '1px solid #30363d', fontSize: '12px' }}>Logout</a>
            </div>
          ) : (
            <a href="http://localhost:3000/auth/github" style={{ padding: '6px 12px', backgroundColor: '#21262d', color: '#c9d1d9', textDecoration: 'none', borderRadius: '6px', border: '1px solid #30363d', fontSize: '12px', fontWeight: '500' }}>
              Sign in with GitHub
            </a>
          )}
        </div>
      </header>

      {/* Main 2-Panel Layout */}
      <div style={{ display: 'flex', flex: 1, padding: '20px 24px', gap: '20px', overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Pipeline Configuration */}
        <div style={{
          width: '420px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: '#161b22',
          padding: '18px',
          borderRadius: '8px',
          border: '1px solid #21262d'
        }}>
          <div>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f0f6fc', fontWeight: '600' }}>
              Pipeline Definition
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>Project Name</label>
                <input
                  value={repoName}
                  onChange={e => setRepoName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>GitHub Repository</label>
                <input
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', color: '#8b949e' }}>Tasks (YAML)</label>
              {validationError && (
                <span style={{ fontSize: '11px', color: '#f85149' }}>⚠️ Invalid DAG</span>
              )}
            </div>
            <textarea
              value={yamlText}
              onChange={e => setYamlText(e.target.value)}
              style={{
                width: '100%',
                flex: 1,
                boxSizing: 'border-box',
                padding: '10px',
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: '12px',
                backgroundColor: '#0d1117',
                border: `1px solid ${validationError ? '#da3633' : '#30363d'}`,
                color: '#7ee787',
                borderRadius: '6px',
                resize: 'none'
              }}
            />
          </div>

          {/* Action & Webhook Info Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  backgroundColor: '#238636',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                Save & Enable Webhook
              </button>
              <button
                onClick={handleManualRun}
                title="Trigger pipeline run manually"
                style={{
                  padding: '9px 12px',
                  backgroundColor: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}
              >
                ▶ Run
              </button>
            </div>

            {/* Simple Webhook Helper Tip */}
            <div style={{
              fontSize: '11px',
              padding: '8px 10px',
              borderRadius: '6px',
              backgroundColor: '#0d1117',
              border: '1px solid #21262d',
              color: '#8b949e',
              lineHeight: '1.4'
            }}>
              💡 <b>Auto-trigger on <code>git push</code>:</b> Make sure <code>ngrok http 3000</code> is running so GitHub can reach your local machine.
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Pipeline DAG & Live Console */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          
          {/* Top: Current Pipeline Run Header */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#161b22',
            borderRadius: '8px',
            border: '1px solid #21262d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', color: '#8b949e' }}>Pipeline Status:</span>
              {activeRun ? (
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '3px 8px',
                  borderRadius: '10px',
                  backgroundColor: activeRun.status === 'SUCCESS' ? '#0c2718' : (activeRun.status === 'FAILED' ? '#301014' : '#0d1d30'),
                  color: activeRun.status === 'SUCCESS' ? '#3fb950' : (activeRun.status === 'FAILED' ? '#f85149' : '#58a6ff'),
                  border: `1px solid ${activeRun.status === 'SUCCESS' ? '#238636' : (activeRun.status === 'FAILED' ? '#da3633' : '#1f6feb')}`
                }}>
                  {activeRun.status}
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: '#8b949e' }}>Idle</span>
              )}
              {activeRun?.triggerType && (
                <span style={{ fontSize: '11px', color: '#8b949e' }}>
                  ({activeRun.triggerType})
                </span>
              )}
            </div>

            {activeRun?.durationMs && (
              <span style={{ fontSize: '12px', color: '#3fb950', fontWeight: '500' }}>
                Completed in {activeRun.durationMs}ms
              </span>
            )}
          </div>

          {/* Middle: DAG Flowchart */}
          <div>
            <DagViewer
              tasks={tasks}
              selectedTaskId={selectedTask?._id || selectedTask?.name}
              onSelectTask={(t) => setSelectedTask(prev => prev?._id === t._id ? null : t)}
            />
          </div>

          {/* Bottom: Console Logs */}
          <div style={{
            flex: 1,
            backgroundColor: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '8px 14px',
              borderBottom: '1px solid #21262d',
              backgroundColor: '#161b22',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px'
            }}>
              <span style={{ color: '#8b949e' }}>Live Execution Logs</span>
              <button
                onClick={() => setLogs([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>

            <div
              ref={logContainerRef}
              style={{
                flex: 1,
                padding: '12px 14px',
                overflowY: 'auto',
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                color: '#e6edf3'
              }}
            >
              {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '3px', color: log.highlight ? '#58a6ff' : '#c9d1d9' }}>
                  <span style={{ color: '#484f58', marginRight: '6px' }}>[{log.time}]</span>
                  <span>{log.text}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <div style={{ color: '#484f58' }}>Waiting for pipeline triggers...</div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
