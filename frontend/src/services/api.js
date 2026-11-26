import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

// Automatically inject JWT Bearer token into outgoing requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cicd_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// ── Auth APIs ────────────────────────────────────────────────────────────────
export const signupUser    = (data) => api.post('/auth/signup', data);
export const loginUser     = (data) => api.post('/auth/login', data);
export const getMe         = ()     => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);

// ── Pipelines APIs ───────────────────────────────────────────────────────────
export const getPipelines       = ()           => api.get('/pipelines');
export const getPipeline        = (id)         => api.get(`/pipelines/${id}`);
export const createPipeline     = (data)       => api.post('/pipelines', data);
export const updatePipeline     = (id, data)   => api.put(`/pipelines/${id}`, data);
export const deletePipeline     = (id)         => api.delete(`/pipelines/${id}`);
export const addTaskToPipeline  = (id, task)   => api.post(`/pipelines/${id}/tasks`, task);

// ── Runners APIs ─────────────────────────────────────────────────────────────
export const getRunners     = ()       => api.get('/runners');
export const createRunner   = (data)   => api.post('/runners', data);
export const deleteRunner   = (id)     => api.delete(`/runners/${id}`);

// ── Execution & Simulation APIs ──────────────────────────────────────────────
export const runPipeline         = (id, algo)      => api.post(`/run/${id}`, { algorithm: algo });
export const runMultiPipeline    = (ids, algo)     => api.post('/run/multi', { pipeline_ids: ids, algorithm: algo });
export const runMultiAllPipelines = (pipeline_ids) => api.post('/run/multi-all', { pipeline_ids });
export const getRunStatus        = (runId)         => api.get(`/runs/${runId}/status`);
export const getRunHistory       = ()              => api.get('/runs');
export const getRunMetrics       = (runId)         => api.get(`/runs/${runId}/metrics`);
export const clearRunHistory     = ()              => api.delete('/runs');
export const compareAlgorithms   = (id)            => api.post(`/compare/${id}`);

// ── Admin APIs ───────────────────────────────────────────────────────────────
export const getAdminStats         = ()              => api.get('/admin/stats');
export const getAdminUsers         = ()              => api.get('/admin/users');
export const updateAdminUserRole   = (userId, data)  => api.put(`/admin/users/${userId}/role`, data);
export const deleteAdminUser       = (userId)        => api.delete(`/admin/users/${userId}`);
export const getAdminPipelines     = ()              => api.get('/admin/pipelines');
export const deletePipelineAdmin   = (id)            => api.delete(`/admin/pipelines/${id}`);

export default api;
