const fs = require('fs');
const file = 'frontend/src/pages/RunScheduler.jsx';
let code = fs.readFileSync(file, 'utf8');

// The layout right now looks like this:
// <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
//   {/* 🚀 RUNNER LANES 🚀 */} ...
//   {/* 📊 METRICS 📊 */} ...
// </div>
// {/* 🌊 TASK KANBAN 🌊 */} ...

// But we want:
// {/* 🚀 RUNNER LANES 🚀 */} (standalone, grid-based)
// {/* 🌊 TASK KANBAN 🌊 */}
// {phase === 'done' && ( {/* 📊 METRICS 📊 */} )}

const gridStart = `<div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>`;
const runnerStart = `              {/* 🚀 RUNNER LANES 🚀 */}`;
const runnerEndHeader = `<div className="glass-card-body" style={{ display:'flex', flexDirection: 'column', gap:'16px' }}>`;
const newRunnerHeader = `<div className="glass-card-body" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'16px' }}>`;

const metricsStart = `              {/* 📊 METRICS 📊 */}`;
const metricsEndDiv = `              </div>\n            </div>`; // End of metrics card + end of grid container
const kanbanStart = `            {/* 🌊 TASK KANBAN 🌊 */}`;
const endOfMain = `          </>\n        )}\n      </main>`; // Kanban ends right before this

let idxGridStart = code.indexOf(gridStart);
let idxRunner = code.indexOf(runnerStart);
let idxMetrics = code.indexOf(metricsStart);
let idxKanban = code.indexOf(kanbanStart);
let idxEndOfMain = code.indexOf(`          </>\n        )}\n      </main>`);

if (idxGridStart === -1 || idxRunner === -1 || idxMetrics === -1 || idxKanban === -1) {
  console.log("Could not find markers!", { idxGridStart, idxRunner, idxMetrics, idxKanban });
  process.exit(1);
}

// Extract the chunks
let runnerChunk = code.substring(idxRunner, idxMetrics);
// Modify runnerChunk to use grid instead of flex column
runnerChunk = runnerChunk.replace(runnerEndHeader, newRunnerHeader);

// Find the end of metrics. We know it ends exactly before kanbanStart
let metricsChunk = code.substring(idxMetrics, idxKanban);
// Remove the closing `</div>` of the grid that is at the end of metricsChunk
metricsChunk = metricsChunk.trimEnd();
if (metricsChunk.endsWith('</div>')) {
    metricsChunk = metricsChunk.slice(0, -6).trimEnd();
}
if (metricsChunk.endsWith('</div>')) {
    metricsChunk = metricsChunk.slice(0, -6).trimEnd();
}
// Actually, it's safer to just extract up to `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>`
// and completely restructure.

// To avoid bad slicing, let's use a simpler replace strategy:
code = code.replace(gridStart, '');
// Now gridStart is removed.
// We need to remove the closing </div> of that grid.
// Let's just find `</div>\n\n            {/* 🌊 TASK KANBAN 🌊 */}`
code = code.replace(/<\/div>\s*\{\/\* 🌊 TASK KANBAN 🌊 \*\/\}/, '{/* 🌊 TASK KANBAN 🌊 */}');

// Now the flow is: RUNNER LANES -> METRICS -> TASK KANBAN.
// We want: RUNNER LANES -> TASK KANBAN -> METRICS.

let newIdxRunner = code.indexOf(runnerStart);
let newIdxMetrics = code.indexOf(metricsStart);
let newIdxKanban = code.indexOf(kanbanStart);
let newIdxEnd = code.indexOf(`          </>\n        )}\n      </main>`);

let runnerCode = code.substring(newIdxRunner, newIdxMetrics);
runnerCode = runnerCode.replace(runnerEndHeader, newRunnerHeader);
runnerCode = runnerCode.replace(`<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>`, `<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>`);


let metricsCode = code.substring(newIdxMetrics, newIdxKanban);
metricsCode = metricsCode.replace(`<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>`, `<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginTop: '20px' }}>`);
// Wrap metrics in {phase === 'done' && ( ... )}
metricsCode = `            {phase === 'done' && (\n` + metricsCode + `\n            )}\n`;

let kanbanCode = code.substring(newIdxKanban, newIdxEnd);
kanbanCode = kanbanCode.replace(`<div className="glass-card" style={{ marginTop: '20px' }}>`, `<div className="glass-card" style={{ flexShrink: 0, marginTop: '20px' }}>`);


let beforeRunner = code.substring(0, newIdxRunner);
let afterEnd = code.substring(newIdxEnd);

let finalCode = beforeRunner + runnerCode + kanbanCode + metricsCode + afterEnd;

fs.writeFileSync(file, finalCode);
console.log("Successfully reordered!");
