import React from 'react';

const STATUS_MAP = {
  WAITING: { label: 'Waiting', color: '#8b949e', bg: '#161b22', dot: '#8b949e' },
  READY: { label: 'Ready', color: '#58a6ff', bg: '#0d1d30', dot: '#58a6ff' },
  QUEUED: { label: 'Queued', color: '#d29922', bg: '#2b1d04', dot: '#d29922' },
  RUNNING: { label: 'Running', color: '#3fb950', bg: '#0c2718', dot: '#3fb950', pulse: true },
  SUCCESS: { label: 'Passed', color: '#3fb950', bg: '#0c2718', dot: '#3fb950' },
  FAILED: { label: 'Failed', color: '#f85149', bg: '#301014', dot: '#f85149' },
  BLOCKED: { label: 'Blocked', color: '#ff7b72', bg: '#261314', dot: '#ff7b72' }
};

export default function DagViewer({ tasks = [], selectedTaskId = null, onSelectTask = () => {} }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: '#8b949e',
        fontSize: '13px',
        backgroundColor: '#0d1117',
        borderRadius: '6px',
        border: '1px dashed #30363d'
      }}>
        Pipeline graph will appear here once configured.
      </div>
    );
  }

  // Compute stage levels
  const taskMap = new Map();
  tasks.forEach(t => taskMap.set(t._id || t.name, t));

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
    let maxLvl = 0;
    for (const dep of deps) {
      const depObj = typeof dep === 'object' ? dep : taskMap.get(dep);
      if (depObj && depObj !== t) {
        maxLvl = Math.max(maxLvl, getLevel(depObj) + 1);
      }
    }
    levels.set(id, maxLvl);
    return maxLvl;
  };

  tasks.forEach(t => getLevel(t));

  const stageColumns = {};
  tasks.forEach(t => {
    const lvl = levels.get(t._id || t.name) || 0;
    if (!stageColumns[lvl]) stageColumns[lvl] = [];
    stageColumns[lvl].push(t);
  });

  const stageKeys = Object.keys(stageColumns).map(Number).sort((a, b) => a - b);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      overflowX: 'auto',
      padding: '12px',
      backgroundColor: '#0d1117',
      borderRadius: '8px',
      border: '1px solid #21262d'
    }}>
      {stageKeys.map((stageIdx, idx) => {
        const stageTasks = stageColumns[stageIdx];
        const isLastStage = idx === stageKeys.length - 1;

        return (
          <React.Fragment key={stageIdx}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minWidth: '160px'
            }}>
              {stageTasks.map(task => {
                const taskId = task._id || task.name;
                const isSelected = selectedTaskId === taskId;
                const status = task.status || 'WAITING';
                const st = STATUS_MAP[status] || STATUS_MAP.WAITING;

                return (
                  <div
                    key={taskId}
                    onClick={() => onSelectTask(task)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: st.bg,
                      border: `1px solid ${isSelected ? '#58a6ff' : '#30363d'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#f0f6fc' }}>
                        {task.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: st.dot,
                          boxShadow: st.pulse ? '0 0 6px #3fb950' : 'none'
                        }} />
                        <span style={{ fontSize: '11px', color: st.color, fontWeight: '500' }}>
                          {st.label}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8b949e' }}>
                      <span>{task.requiredCpus || task.cpus || 1} CPU</span>
                      {task.durationMs !== undefined && task.durationMs !== null ? (
                        <span style={{ color: '#3fb950' }}>{task.durationMs}ms</span>
                      ) : (
                        <span>{task.image ? task.image.split(':')[0] : 'ubuntu'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!isLastStage && (
              <div style={{ color: '#30363d', fontSize: '16px', userSelect: 'none', padding: '0 2px' }}>
                →
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
