import os

path = 'frontend/src/pages/RunScheduler.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# The grid wrapper starts after <GanttChart ... />
# So let's split at `getColor={pipeColor}\n            />\n`
part1, rest = text.split("getColor={pipeColor}\n            />\n", 1)

# Now rest starts with:
# "\n            <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>\n              {/*"
# Or similar.
# Let's find the RUNNER LANES section
runner_start = rest.find("{/* 🚀 RUNNER LANES 🚀 */}")
if runner_start == -1: runner_start = rest.find("{/*") # fallback if emojis are missing/changed
runner_start = rest.find("<div className=\"glass-card\"", runner_start)

# Find METRICS section
metrics_start = rest.find("METRICS", runner_start)
metrics_div_start = rest.rfind("<div className=\"glass-card\"", runner_start, metrics_start) # this is wrong, should be forward
metrics_div_start = rest.find("<div className=\"glass-card\"", metrics_start)

# Find KANBAN section
kanban_start = rest.find("TASK KANBAN", metrics_div_start)
kanban_div_start = rest.find("<div className=\"glass-card\"", kanban_start)

# The runner chunk is from runner_start to the closing </div> before metrics_div_start
runner_chunk = rest[runner_start:metrics_div_start].strip()
runner_chunk = runner_chunk.replace(
    """<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>""",
    """<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>"""
).replace(
    """<div className="glass-card-body" style={{ display:'flex', flexDirection: 'column', gap:'16px' }}>""",
    """<div className="glass-card-body" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'16px' }}>"""
)

# Metrics chunk is from metrics_div_start to the closing </div> before kanban_div_start
# We know the grid ends with a </div>. So it's </div></div> basically.
metrics_chunk = rest[metrics_div_start:kanban_div_start].strip()
if metrics_chunk.endswith("</div>"):
    metrics_chunk = metrics_chunk[:-6].strip()
if metrics_chunk.endswith("</div>"):
    metrics_chunk = metrics_chunk[:-6].strip()

metrics_chunk = metrics_chunk.replace(
    """<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>""",
    """<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginTop: '16px' }}>"""
)
metrics_chunk = "            {phase === 'done' && (\n              " + metrics_chunk + "\n            )}"

# Kanban chunk is from kanban_div_start to the end of the React fragment </main>
# We can just take everything from kanban_start actually
kanban_chunk = rest[kanban_start-20:] 

final_content = part1 + "getColor={pipeColor}\n            />\n\n            " + runner_chunk + "\n\n            " + kanban_chunk
# Wait, I need to insert metrics_chunk AT THE BOTTOM of Kanban chunk!
# Where does Kanban chunk end?
# It ends at `</>\n        )}\n      </main>`
end_idx = final_content.rfind("          </>")
if end_idx != -1:
    final_content = final_content[:end_idx] + "\n" + metrics_chunk + "\n" + final_content[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(final_content)
print("Reorder completed!")
