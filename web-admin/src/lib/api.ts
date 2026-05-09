import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  timeout: 10000,
});

export const fetchUsers = async () => {
  const { data } = await api.get('/auth/users');
  return data;
};

export const fetchEmergencyLogs = async (status = 'open') => {
  const { data } = await api.get(`/emergency/logs?status=${status}`);
  return data;
};

export const fetchAlertTimeline = async (params) => {
  const { data } = await api.get('/emergency/alerts', { params });
  return data;
};

export const fetchEmergencySmsLogs = async (logId) => {
  const { data } = await api.get(`/emergency/sms/${logId}`);
  return data;
};

export const resolveEmergency = async (logId, notes) => {
  const { data } = await api.post(`/emergency/resolve/${logId}`, { notes });
  return data;
};