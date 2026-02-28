import { useEffect, useMemo, useState } from 'react';

import {
  fetchEmergencySmsLogs,
  fetchAlertTimeline,
  fetchEmergencyLogs,
  fetchUsers,
  resolveEmergency,
} from './services/api';
import { socket } from './services/socket';

function statusClass(status) {
  if (status === 'SOS') return 'status status-sos';
  if (status === 'WARNING' || status === 'REMINDER') return 'status status-warning';
  return 'status status-safe';
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [alertTimeline, setAlertTimeline] = useState([]);
  const [selectedEmergencyId, setSelectedEmergencyId] = useState('');
  const [smsLogs, setSmsLogs] = useState([]);
  const [smsFilter, setSmsFilter] = useState('all');
  const [activeSos, setActiveSos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sosCount = useMemo(
    () => users.filter((user) => user.currentStatus === 'SOS').length,
    [users],
  );

  const filteredSmsLogs = useMemo(() => {
    if (smsFilter === 'success') {
      return smsLogs.filter((item) => item.success);
    }
    if (smsFilter === 'fail') {
      return smsLogs.filter((item) => !item.success);
    }
    return smsLogs;
  }, [smsLogs, smsFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [usersData, emergenciesData, alertData] = await Promise.all([
        fetchUsers(),
        fetchEmergencyLogs('open'),
        fetchAlertTimeline({ page: 1, limit: 20 }),
      ]);
      setUsers(usersData);
      setEmergencies(emergenciesData);
      setAlertTimeline(alertData.items || []);
    } catch (err) {
      setError(err.message || 'Khong the tai du lieu');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const onEmergency = async (payload) => {
      try {
        setActiveSos(payload);
        await loadData();
        if (payload?.emergencyLogId) {
          await loadSmsLogs(payload.emergencyLogId, true);
        }
      } catch (err) {
        setError(err.message || 'Khong the cap nhat SOS realtime');
      }
    };

    socket.on('EMERGENCY_SOS', onEmergency);
    socket.on('CHECKIN_WARNING', loadData);
    socket.on('CHECKIN_REMINDER', loadData);
    socket.on('ALERT_EVENT', loadData);

    return () => {
      socket.off('EMERGENCY_SOS', onEmergency);
      socket.off('CHECKIN_WARNING', loadData);
      socket.off('CHECKIN_REMINDER', loadData);
      socket.off('ALERT_EVENT', loadData);
    };
  }, []);

  async function handleResolve(logId) {
    const notes = window.prompt('Nhap ghi chu xu ly su co:', 'Da lien he nguoi than');
    try {
      await resolveEmergency(logId, notes || '');
      await loadData();
      setActiveSos(null);
    } catch (err) {
      setError(err.message || 'Khong the cap nhat su co');
    }
  }

  async function loadSmsLogs(logId, resetFilter = false) {
    if (!logId) {
      setSelectedEmergencyId('');
      setSmsLogs([]);
      return;
    }

    const logs = await fetchEmergencySmsLogs(logId);
    setSelectedEmergencyId(logId);
    setSmsLogs(logs || []);
    if (resetFilter) {
      setSmsFilter('all');
    }
  }

  async function handleViewSmsLogs(logId) {
    try {
      await loadSmsLogs(logId, true);
    } catch (err) {
      setError(err.message || 'Khong the tai SMS logs');
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>SafeSolo - Web Admin</h1>
        <button onClick={loadData}>Lam moi</button>
      </header>

      {activeSos && (
        <section className="sos-banner">
          <h2>CANH BAO SOS</h2>
          <p>
            {activeSos.fullName} - {activeSos.phoneNumber}
          </p>
          <p>
            Vi tri: {activeSos.location?.lat ?? 'N/A'}, {activeSos.location?.lng ?? 'N/A'}
          </p>
        </section>
      )}

      {error ? <p className="error">{error}</p> : null}

      {loading ? (
        <p>Dang tai du lieu...</p>
      ) : (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <p>Tong user</p>
              <strong>{users.length}</strong>
            </article>
            <article className="stat-card">
              <p>Dang SOS</p>
              <strong>{sosCount}</strong>
            </article>
            <article className="stat-card">
              <p>Su co chua xu ly</p>
              <strong>{emergencies.length}</strong>
            </article>
          </section>

          <section className="panel">
            <h3>Danh sach user</h3>
            <table>
              <thead>
                <tr>
                  <th>Ho ten</th>
                  <th>SĐT</th>
                  <th>Trang thai</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>{user.fullName}</td>
                    <td>{user.phoneNumber}</td>
                    <td>
                      <span className={statusClass(user.currentStatus)}>{user.currentStatus}</span>
                    </td>
                    <td>{new Date(user.nextDeadline).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3>Su co SOS chua xu ly</h3>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Thoi diem</th>
                  <th>Vi tri</th>
                  <th>Hanh dong</th>
                </tr>
              </thead>
              <tbody>
                {emergencies.length === 0 ? (
                  <tr>
                    <td colSpan="4">Khong co su co ton dong</td>
                  </tr>
                ) : (
                  emergencies.map((item) => (
                    <tr
                      key={item._id}
                      className={selectedEmergencyId === item._id ? 'selected-emergency-row' : ''}
                    >
                      <td>{item.userId?.fullName || 'Unknown'}</td>
                      <td>{new Date(item.triggeredAt).toLocaleString()}</td>
                      <td>
                        {item.locationSnapshot?.lat ?? 'N/A'}, {item.locationSnapshot?.lng ?? 'N/A'}
                      </td>
                      <td>
                        <button onClick={() => handleResolve(item._id)}>Danh dau da xu ly</button>{' '}
                        <button onClick={() => handleViewSmsLogs(item._id)}>SMS logs</button>
                        {selectedEmergencyId === item._id ? (
                          <span className="monitoring-badge" title="Dang theo doi emergency nay">
                            👁️ Dang theo doi
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3>Timeline canh bao</h3>
            <table>
              <thead>
                <tr>
                  <th>Thoi gian</th>
                  <th>User</th>
                  <th>Cap do</th>
                  <th>Trang thai</th>
                  <th>Noi dung</th>
                </tr>
              </thead>
              <tbody>
                {alertTimeline.length === 0 ? (
                  <tr>
                    <td colSpan="5">Chua co su kien canh bao</td>
                  </tr>
                ) : (
                  alertTimeline.map((item) => (
                    <tr key={item._id}>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                      <td>{item.user?.fullName || item.userId}</td>
                      <td>{item.level}</td>
                      <td>{item.status}</td>
                      <td>{item.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3>SMS Dispatch Logs {selectedEmergencyId ? `(Emergency: ${selectedEmergencyId})` : ''}</h3>
            <div className="filter-row">
              <button
                className={smsFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setSmsFilter('all')}
              >
                Tat ca
              </button>
              <button
                className={smsFilter === 'success' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setSmsFilter('success')}
              >
                Success
              </button>
              <button
                className={smsFilter === 'fail' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setSmsFilter('fail')}
              >
                Fail
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Thoi gian</th>
                  <th>To</th>
                  <th>Provider</th>
                  <th>Attempt</th>
                  <th>Ket qua</th>
                  <th>Chi tiet loi</th>
                </tr>
              </thead>
              <tbody>
                {!selectedEmergencyId ? (
                  <tr>
                    <td colSpan="6">Chon "SMS logs" tai mot su co de xem chi tiet</td>
                  </tr>
                ) : filteredSmsLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6">Khong co ban ghi phu hop bo loc</td>
                  </tr>
                ) : (
                  filteredSmsLogs.map((item) => (
                    <tr key={item._id}>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                      <td>{item.toPhone}</td>
                      <td>{item.provider}</td>
                      <td>{item.attempt}</td>
                      <td>
                        <span className={item.success ? 'status status-safe' : 'status status-sos'}>
                          {item.success ? 'SUCCESS' : 'FAIL'}
                        </span>
                      </td>
                      <td>{item.errorMessage || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}