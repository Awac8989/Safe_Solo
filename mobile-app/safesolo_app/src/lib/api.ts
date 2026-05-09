// src/lib/api.ts
// SafeSolo backend API client (Express routes)

const BASE_URL = ''; // Proxied by Vite or set to backend URL

const getHeaders = (withAuth = true) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (withAuth) {
    const token = localStorage.getItem('safesolo_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth
  register: async (data: {
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
  }) => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  login: async (email: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  verifyOTP: async (email: string, otp: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('safesolo_token', data.token);
    }
    return data;
  },

  // Check‑in (heartbeat)
  checkin: async (location: { lat: number; lng: number }) => {
    // Note: Prisma routes use req.user.id from token, no need for userId in path
    const res = await fetch(`${BASE_URL}/api/location/update`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ latitude: location.lat, longitude: location.lng }),
    });
    return res.json();
  },

  // Update timer interval (Map to profile update for now if no specific route)
  updateTimer: async (minutes: number) => {
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ timerIntervalMinutes: minutes }),
    });
    return res.json();
  },

  // Update location (manual)
  updateLocation: async (userId: string, location: { lat: number; lng: number }) => {
    const res = await fetch(`/api/users/${userId}/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location }),
    });
    return res.json();
  },

  // Update preferences (quiet hours, grace minutes)
  updatePreferences: async (
    userId: string,
    prefs: { quietHoursStart: string; quietHoursEnd: string; falseAlertGraceMinutes: number }
  ) => {
    const res = await fetch(`/api/users/${userId}/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    return res.json();
  },

  // Sleep mode (stealth)
  setSleepMode: async (userId: string, minutes: number) => {
    const res = await fetch(`/api/users/${userId}/sleep-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    });
    return res.json();
  },

  // Feed – status update
  postStatus: async (data: any) => {
    const res = await fetch(`${BASE_URL}/api/feed/status`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getCircleFeed: async () => {
    const res = await fetch(`${BASE_URL}/api/feed/circle`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // Community – heroes
  getHero: async (id: string) => {
    const res = await fetch(`${BASE_URL}/api/community/heroes/${id}`, {
      headers: getHeaders(),
    });
    return res.json();
  },
  thankHero: async (id: string) => {
    const res = await fetch(`${BASE_URL}/api/community/heroes/${id}/thank-you`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  // SOS / Radar
  broadcastSOS: async (payload: any) => {
    const res = await fetch(`${BASE_URL}/api/radar/broadcast`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  getNearbyIncidents: async (params: any) => {
    const qs = new URLSearchParams(params as any).toString();
    const res = await fetch(`${BASE_URL}/api/radar/nearby?${qs}`, {
      headers: getHeaders(),
    });
    return res.json();
  },
  acceptIncident: async (incidentId: string) => {
    const res = await fetch(`${BASE_URL}/api/radar/${incidentId}/accept`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },
  getIncident: async (incidentId: string) => {
    const res = await fetch(`${BASE_URL}/api/radar/${incidentId}`, {
      headers: getHeaders(),
    });
    return res.json();
  },
  resolveIncident: async (incidentId: string) => {
    const res = await fetch(`${BASE_URL}/api/radar/${incidentId}/resolve`, {
      method: 'PUT',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Chat
  uploadVoice: async (roomId: string, file: File) => {
    const form = new FormData();
    form.append('voice', file);
    const res = await fetch(`${BASE_URL}/api/chat/${roomId}/upload-voice`, {
      method: 'POST',
      headers: { Authorization: getHeaders()['Authorization'] || '' },
      body: form,
    });
    return res.json();
  },
  getMessages: async (roomId: string) => {
    const res = await fetch(`${BASE_URL}/api/chat/${roomId}/messages`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // Profile & Medical
  getProfile: async () => {
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      headers: getHeaders(),
    });
    return res.json();
  },
  updateProfile: async (data: any) => {
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  deactivateAccount: async () => {
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Medical
  getMedical: async () => {
    const res = await fetch(`${BASE_URL}/api/medical`, {
      headers: getHeaders(),
    });
    return res.json();
  },
  updateMedical: async (data: any) => {
    const res = await fetch(`${BASE_URL}/api/medical`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Guardians
  getGuardians: async () => {
    const res = await fetch(`${BASE_URL}/api/guardians`, {
      headers: getHeaders(),
    });
    return res.json();
  },
  addGuardian: async (data: any) => {
    const res = await fetch(`${BASE_URL}/api/guardians`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  removeGuardian: async (guardianId: string) => {
    const res = await fetch(`${BASE_URL}/api/guardians/${guardianId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Community
  getCommunity: async () => {
    const res = await fetch(`${BASE_URL}/api/community/heroes`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // KYC
  getKYC: async () => {
    const res = await fetch(`${BASE_URL}/api/kyc/status`, {
      headers: getHeaders(),
    });
    return res.json();
  },
  submitKYC: async (data: any) => {
    const res = await fetch(`${BASE_URL}/api/kyc/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
