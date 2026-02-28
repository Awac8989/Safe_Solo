import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: BASE_URL,
});

export async function fetchUsers() {
  const { data } = await api.get('/users');
  return data;
}

export async function fetchEmergencyLogs(status = 'open') {
  const { data } = await api.get('/admin/emergencies', { params: { status } });
  return data;
}

export async function resolveEmergency(logId, notes) {
  const { data } = await api.patch(`/admin/emergencies/${logId}/resolve`, { notes });
  return data;
}

export async function fetchEmergencySmsLogs(emergencyId) {
  const { data } = await api.get(`/admin/emergencies/${emergencyId}/sms-logs`);
  return data;
}

export async function fetchAlertTimeline(params = {}) {
  const { data } = await api.get('/admin/alerts', { params });
  return data;
}