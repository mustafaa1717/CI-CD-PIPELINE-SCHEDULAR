import React from 'react';

const STATUS_CONFIG = {
  WAITING: { label: 'Waiting', bg: '#21262d', text: '#8b949e', border: '#30363d', icon: '⏳' },
  READY: { label: 'Ready', bg: '#0c2d6b', text: '#58a6ff', border: '#1f6feb', icon: '🚀' },
  QUEUED: { label: 'Queued', bg: '#3d2b00', text: '#d29922', border: '#9e6a03', icon: '⏱️' },
  RUNNING: { label: 'Running', bg: '#033a16', text: '#3fb950', border: '#238636', icon: '🔄', pulse: true },
  SUCCESS: { label: 'Succeeded', bg: '#0d381e', text: '#3fb950', border: '#238636', icon: '✅' },
  FAILED: { label: 'Failed', bg: '#490202', text: '#f85149', border: '#da3633', icon: '❌' },
  BLOCKED: { label: 'Blocked', bg: '#381600', text: '#ff7b72', border: '#bd561d', icon: '⛔' }
};

export default function DagViewer({ tasks = [], selectedTaskId = null, onSelectTask = () => {} }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        color: '#8b949e',
        backgroundColor: '#0d1117',
        border: '1px dashed #30363d',
        borderRadius: '8px'
      }}>
        No tasks loaded in DAG. Save or run a pipeline to visualize execution.
      </div>
    );
  }

  // 1. Group tasks by stageLevel (or compute levels dynamically if missing)
  const taskMap = new Map();
  tasks.forEach(t => taskMap.set(t._id || t.name, t));

  // Determine stage levels if not populated
  const levels = new Map();
  const getLevel = (t) => {
    const id = t._id || t.name;
    if (levels.has(id)) return levels.get(id);
    if (t.stageLevel !== undefined) {
      levels.set(id, t.stageLevel);
      return t.stageLevel;
    }
    const deps = t.dependsOn || [];
    if (deps.length === 0) {
      levels.set(id, 0);
      return 0;
    }
    let maxDepLevel = 0;
    for (const dep of deps) {
      const depObj = typeof dep === 'object' ? dep : taskMap.get(dep);
      if (depObj && depObj !== t) {
        maxDepLevel = Math.max(maxDepLevel, getLevel(depObj) + 1);
      }
    }
    levels.set(id, maxDepLevel);
    return maxDepLevel;
  };

  tasks.forEach(t => getLevel(t));

  // Group into stages
  const stageColumns = {};
  tasks.forEach(t => {
    const lvl = levels.get(t._id || t.name) || 0;
    if (!stageColumns[lvl]) stageColumns[lvl] = [];
    stageColumns[lvl].push(t);
  });

  const stageKeys = Object.keys(stageColumns).map(Number).sort((a, b) => a - b);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '10px 14px',
        backgroundColor: '#161b22',
        borderRadius: '6px',
        border: '1px solid #30363d',
        fontSize: '12px'
      }}>
        <span style={{ color: '#8b949e', fontWeight: 'bold' }}>Status:</span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: cfg.text }}>
            <span>{cfg.icon}</span> {cfg.label}
          </span>
        ))}
      </div>

      {/* DAG Flowchart Container */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '24px',
        overflowX: 'auto',
        padding: '16px 8px',
        backgroundColor: '#090d13',
        borderRadius: '8px',
        border: '1px solid #30363d'
      }}>
        {stageKeys.map((stageIdx, idx) => {
          const stageTasks = stageColumns[stageIdx];
          const isLastStage = idx === stageKeys.length - 1;

          return (
            <React.Fragment key={stageIdx}>
              {/* Stage Column */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                minWidth: '220px',
                maxWidth: '260px'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#58a6ff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '4px 8px',
                  backgroundColor: '#161b22',
                  borderRadius: '4px',
                  textAlign: 'center',
                  border: '1px solid #30363d'
                }}>
                  Stage {stageIdx + 1}
                </div>

                {stageTasks.map(task => {
                  const taskId = task._id || task.name;
                  const isSelected = selectedTaskId === taskId;
                  const status = task.status || 'WAITING';
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.WAITING;

                  return (
                    <div
                      key={taskId}
                      onClick={() => onSelectTask(task)}
                      style={{
                        backgroundColor: cfg.bg,
                        border: `1px solid ${isSelected ? '#58a6ff' : cfg.border}`,
                        boxShadow: isSelected ? '0 0 10px rgba(88, 166, 255, 0.4)' : 'none',
                        borderRadius: '8px',
                        padding: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        position: 'relative'
                      }}
                    >
                      {/* Top Header: Name & Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#f0f6fc' }}>
                          {task.name}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          backgroundColor: '#0d1117',
                          color: cfg.text,
                          border: `1px solid ${cfg.border}`,
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <span>{cfg.icon}</span> {cfg.label}
                        </span>
                      </div>

                      {/* Command snippet */}
                      <div style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '11px',
                        backgroundColor: '#0d1117',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        color: '#7ee787',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        $ {task.command}
                      </div>

                      {/* Specs: Image & Resources */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8b949e' }}>
                        <span>🐳 {task.image || 'ubuntu:latest'}</span>
                        <span>⚡ {task.requiredCpus || task.cpus || 1} CPU • {task.requiredMemoryMB || task.memoryMB || 512}MB</span>
                      </div>

                      {/* Extra info: Duration or Runner */}
                      {(task.durationMs || task.assignedRunner) && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          paddingTop: '6px',
                          fontSize: '11px',
                          color: '#8b949e'
                        }}>
                          {task.assignedRunner && (
                            <span>🖥️ {task.assignedRunner.name || 'Runner'}</span>
                          )}
                          {task.durationMs !== undefined && task.durationMs !== null && (
                            <span style={{ marginLeft: 'auto', color: '#7ee787' }}>⏱️ {task.durationMs}ms</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Connector Arrow to next stage */}
              {!isLastStage && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#30363d',
                  fontSize: '24px',
                  userSelect: 'none'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
