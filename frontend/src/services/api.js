import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

export const getPipelines = () => api.get('/pipelines');
export const getPipeline = (id) => api.get(`/pipelines/${id}`);
export const createPipeline = (data) => api.post('/pipelines', data);
export const deletePipeline = (id) => api.delete(`/pipelines/${id}`);
export const addTaskToPipeline = (id, taskData) => api.post(`/pipelines/${id}/tasks`, taskData);

export const getRunners = () => api.get('/runners');
export const createRunner = (data) => api.post('/runners', data);
export const deleteRunner = (id) => api.delete(`/runners/${id}`);

export const runPipeline = (id, algorithm) => api.post(`/run/${id}`, { algorithm });
export const runMultiPipeline = (pipeline_ids, algorithm) => api.post('/run/multi', { pipeline_ids, algorithm });
export const getRunStatus = (runId) => api.get(`/runs/${runId}/status`);
export const getRunHistory = () => api.get('/runs');
export const getRunMetrics = (runId) => api.get(`/runs/${runId}/metrics`);

export const compareAlgorithms = (id) => api.post(`/compare/${id}`);

export default api;
