import sys

lines = open('frontend/src/pages/RunScheduler.jsx', 'r', encoding='utf-8').read().split('\n')

# Find the start of the grid
grid_start = -1
for i, l in enumerate(lines):
    if "gridTemplateColumns: '1fr 1fr'" in l and "gap: '20px'" in l:
        grid_start = i
        break

runner_start = -1
metrics_start = -1
kanban_start = -1
kanban_end = -1
for i, l in enumerate(lines):
    if "RUNNER LANES" in l: runner_start = i
    if "METRICS" in l: metrics_start = i
    if "TASK KANBAN" in l: kanban_start = i
    if "          </>" in l and kanban_start != -1 and kanban_end == -1: kanban_end = i

# Remove the grid_start line
lines[grid_start] = ""

# Runner chunk
runner_chunk = lines[runner_start:metrics_start]
for i in range(len(runner_chunk)):
    if 'className="glass-card"' in runner_chunk[i] and 'display:' in runner_chunk[i]:
        runner_chunk[i] = runner_chunk[i].replace("""<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>""", """<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>""")
    if 'className="glass-card-body"' in runner_chunk[i] and 'flexDirection' in runner_chunk[i]:
        runner_chunk[i] = runner_chunk[i].replace("""<div className="glass-card-body" style={{ display:'flex', flexDirection: 'column', gap:'16px' }}>""", """<div className="glass-card-body" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'16px' }}>""")

# Metrics chunk
metrics_chunk = lines[metrics_start:kanban_start]
# We must remove the very last </div> from metrics_chunk because it closes the grid!
# The grid was opened at grid_start.
# Searching from the end of metrics_chunk for '</div>'
for i in range(len(metrics_chunk)-1, -1, -1):
    if '</div>' in metrics_chunk[i]:
        metrics_chunk[i] = metrics_chunk[i].replace('</div>', '', 1)
        break

for i in range(len(metrics_chunk)):
    if 'className="glass-card"' in metrics_chunk[i] and 'display:' in metrics_chunk[i]:
        metrics_chunk[i] = metrics_chunk[i].replace("""<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>""", """<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginTop: '16px' }}>""")

metrics_chunk.insert(0, "            {phase === 'done' && (<>")
metrics_chunk.append("            </>)}")

kanban_chunk = lines[kanban_start:kanban_end]
for i in range(len(kanban_chunk)):
    if 'className="glass-card"' in kanban_chunk[i] and 'marginTop:' in kanban_chunk[i]:
        kanban_chunk[i] = kanban_chunk[i].replace("""<div className="glass-card" style={{ marginTop: '20px' }}>""", """<div className="glass-card" style={{ flexShrink: 0, marginTop: '16px' }}>""")


final_lines = lines[:grid_start] + runner_chunk + kanban_chunk + metrics_chunk + lines[kanban_end:]

with open('frontend/src/pages/RunScheduler.jsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(final_lines))

print("Done")
