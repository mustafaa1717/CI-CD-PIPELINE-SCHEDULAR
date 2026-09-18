import re

with open('frontend/src/pages/RunScheduler.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

grid_start_pattern = r"<div style=\{\{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' \}\}>\s*"
code = re.sub(grid_start_pattern, "", code)

runner_pattern = r"(?s)( *\{/\*.*?RUNNER LANES.*?\*/\}.*?)(?= *\{/\*.*?METRICS.*?\*/\})"
m_runner = re.search(runner_pattern, code)
runner_code = m_runner.group(1) if m_runner else ""

runner_code = runner_code.replace(
    """<div className="glass-card-body" style={{ display:'flex', flexDirection: 'column', gap:'16px' }}>""",
    """<div className="glass-card-body" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'16px' }}>"""
)
runner_code = runner_code.replace("""<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>""", """<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>""")

metrics_pattern = r"(?s)( *\{/\*.*?METRICS.*?\*/\}.*?)(?= *</div>\s*\{/\*.*?TASK KANBAN.*?\*/\})"
m_metrics = re.search(metrics_pattern, code)
metrics_code = m_metrics.group(1) if m_metrics else ""

# Ensure we wrap metrics safely, and we modify the inner div
metrics_code = metrics_code.replace("""<div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>""", """<div className="glass-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginTop: '16px' }}>""")
metrics_code = "            {phase === 'done' && (\n" + metrics_code + "\n            )}\n"

kanban_pattern = r"(?s)( *\{/\*.*?TASK KANBAN.*?\*/\}.*?)(?= *</>\s*\)\}\s*</main>)"
m_kanban = re.search(kanban_pattern, code)
kanban_code = m_kanban.group(1) if m_kanban else ""

if not (runner_code and metrics_code and kanban_code):
    print("Kanban:", bool(kanban_code))
    exit(1)

code_to_remove = r"(?s) *\{/\*.*?RUNNER LANES.*?\*/\}.*?</div>\s*(?=\{/\*.*?TASK KANBAN.*?\*/\})"
code = re.sub(code_to_remove, "", code)

code_to_remove_kanban = r"(?s) *\{/\*.*?TASK KANBAN.*?\*/\}.*?(?= *</>\s*\)\}\s*</main>)"
code = re.sub(code_to_remove_kanban, "", code)

insert_marker = r"getColor=\{pipeColor\}\s*/>\s*"
m_insert = re.search(insert_marker, code)
if m_insert:
    insert_pos = m_insert.end()
    final_code = code[:insert_pos] + "\n" + runner_code + "\n" + kanban_code + "\n" + metrics_code + "\n" + code[insert_pos:]
    with open('frontend/src/pages/RunScheduler.jsx', 'w', encoding='utf-8') as f:
        f.write(final_code)
    print("Success!")
else:
    print("Could not find insertion marker!")
