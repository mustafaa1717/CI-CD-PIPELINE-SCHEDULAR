import sys

lines = open('frontend/src/pages/RunScheduler.jsx', 'r', encoding='utf-8').read().split('\n')

metrics_start = -1
kanban_start = -1
kanban_end = -1
metrics_end = -1

for i, line in enumerate(lines):
    if "METRICS" in line:
        metrics_start = i
    elif "TASK KANBAN" in line:
        kanban_start = i
    elif "          </>" in line and kanban_start != -1:
        kanban_end = i

# Kanban is after Metrics currently.
# So from metrics_start to kanban_start-2 is the Metrics chunk.
# From kanban_start to kanban_end is Kanban chunk.
metrics_chunk = lines[metrics_start:kanban_start-2]
# Fix metrics chunk wrapping and classes
for i in range(len(metrics_chunk)):
    if 'className="glass-card"' in metrics_chunk[i] and 'display:' in metrics_chunk[i]:
        metrics_chunk[i] = metrics_chunk[i].replace("""<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>""", """<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginTop: '16px' }}>""")

# Wrap in phase === 'done'
metrics_chunk.insert(0, "            {phase === 'done' && (")
metrics_chunk.append("            )}")

kanban_chunk = lines[kanban_start:kanban_end]
for i in range(len(kanban_chunk)):
    if 'className="glass-card"' in kanban_chunk[i] and 'marginTop:' in kanban_chunk[i]:
        kanban_chunk[i] = kanban_chunk[i].replace("""<div className="glass-card" style={{ marginTop: '20px' }}>""", """<div className="glass-card" style={{ flexShrink: 0, marginTop: '16px' }}>""")


final_lines = lines[:metrics_start] + kanban_chunk + [""] + metrics_chunk + lines[kanban_end:]
with open('frontend/src/pages/RunScheduler.jsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(final_lines))

print("Reorder successful via lines!")
