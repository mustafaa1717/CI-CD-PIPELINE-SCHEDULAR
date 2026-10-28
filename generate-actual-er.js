const https = require('https');
const fs = require('fs');

const dotGraph = `graph ER {
    // Graph settings
    layout=dot;
    rankdir=LR;
    nodesep=0.5;
    ranksep=1;

    // Entities
    node [shape=box, style=filled, fillcolor=lightgrey, fontname="Arial", margin="0.2,0.1"];
    PIPELINE; TASK; RUNNER; PIPELINE_RUN; TASK_EXECUTION;

    // Attributes
    node [shape=ellipse, style=solid, fillcolor=white, fontname="Arial", margin="0.1,0.05"];
    
    // PIPELINE Attributes
    pipe_id [label=<<U>id</U>>];
    pipe_name [label="name"];
    pipe_status [label="status"];
    
    // TASK Attributes
    task_id [label=<<U>id</U>>];
    task_name [label="name"];
    task_dur [label="duration"];
    task_pri [label="priority"];
    task_cpu [label="req_cpu"];
    task_ram [label="req_ram"];

    // RUNNER Attributes
    runner_id [label=<<U>id</U>>];
    runner_name [label="name"];
    runner_cpu [label="cpu_cores"];
    runner_ram [label="ram_gb"];
    runner_busy [label="is_busy"];

    // PIPELINE_RUN Attributes
    run_id [label=<<U>id</U>>];
    run_algo [label="algorithm"];
    run_span [label="makespan"];
    run_wait [label="avg_wait_time"];
    run_util [label="utilization"];

    // TASK_EXECUTION Attributes
    exec_id [label=<<U>id</U>>];
    exec_stat [label="status"];
    exec_wait [label="wait_time"];
    exec_start [label="start_time"];

    // Relationships
    node [shape=diamond, style=filled, fillcolor=white, fontname="Arial"];
    CONTAINS; HAS_RUNS; INCLUDES; PROCESSES; ASSIGNED_TO;

    // Connect Entities to their Attributes
    PIPELINE -- pipe_id;
    PIPELINE -- pipe_name;
    PIPELINE -- pipe_status;

    TASK -- task_id;
    TASK -- task_name;
    TASK -- task_dur;
    TASK -- task_pri;
    TASK -- task_cpu;
    TASK -- task_ram;

    RUNNER -- runner_id;
    RUNNER -- runner_name;
    RUNNER -- runner_cpu;
    RUNNER -- runner_ram;
    RUNNER -- runner_busy;

    PIPELINE_RUN -- run_id;
    PIPELINE_RUN -- run_algo;
    PIPELINE_RUN -- run_span;
    PIPELINE_RUN -- run_wait;
    PIPELINE_RUN -- run_util;

    TASK_EXECUTION -- exec_id;
    TASK_EXECUTION -- exec_stat;
    TASK_EXECUTION -- exec_wait;
    TASK_EXECUTION -- exec_start;

    // Connect Entities via Relationships with Cardinality
    PIPELINE -- CONTAINS [label="1"];
    CONTAINS -- TASK [label="N"];

    PIPELINE -- HAS_RUNS [label="1"];
    HAS_RUNS -- PIPELINE_RUN [label="N"];

    PIPELINE_RUN -- INCLUDES [label="1"];
    INCLUDES -- TASK_EXECUTION [label="N"];

    TASK -- PROCESSES [label="1"];
    PROCESSES -- TASK_EXECUTION [label="N"];

    RUNNER -- ASSIGNED_TO [label="1"];
    ASSIGNED_TO -- TASK_EXECUTION [label="N"];
}`;

const data = JSON.stringify({
    graph: dotGraph,
    format: 'png'
});

const options = {
    hostname: 'quickchart.io',
    port: 443,
    path: '/graphviz',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(options, (res) => {
    if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream('C:\\CI-CD\\Project_ER_Diagram.png');
        res.pipe(fileStream);
        fileStream.on('finish', () => {
            console.log('Successfully saved classic ER diagram to C:\\CI-CD\\Project_ER_Diagram.png');
        });
    } else {
        console.error(`Failed with status code: ${res.statusCode}`);
        res.on('data', d => process.stdout.write(d));
    }
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
