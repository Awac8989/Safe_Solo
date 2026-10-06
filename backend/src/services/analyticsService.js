const CheckInHistory = require('../models/CheckInHistory');
const AlertEvent = require('../models/AlertEvent');
const RescueIncident = require('../models/RescueIncident');
const DeviceSignal = require('../models/DeviceSignal');
const User = require('../models/User');
const EmergencyLog = require('../models/EmergencyLog');

/**
 * Analytics Service — aggregates platform data for the Web Admin Dashboard.
 *
 * Provides:
 *  1. Check-in trend (daily counts, on-time vs late)
 *  2. SOS/Incident response metrics
 *  3. False alarm rate tracking
 *  4. Check-in method distribution
 *  5. Vitals signal summary (heart rate / SpO2 averages)
 *  6. Platform KPIs (DAU, retention proxy)
 */

function daysBetween(start, end) {
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function buildDayLabels(startDate, days) {
  const labels = [];
  const d = new Date(startDate);
  for (let i = 0; i < days; i++) {
    labels.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return labels;
}

/**
 * Get check-in trend data grouped by day for the given period.
 * @param {number} days — number of days to look back (default 30)
 */
async function getCheckinTrend(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const pipeline = [
    { $match: { checkinTime: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$checkinTime' },
        },
        total: { $sum: 1 },
        onTime: {
          $sum: { $cond: [{ $eq: ['$isSystemAutoTriggered', false] }, 1, 0] },
        },
        late: {
          $sum: { $cond: [{ $eq: ['$isSystemAutoTriggered', true] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const raw = await CheckInHistory.aggregate(pipeline);

  // Fill in zero-days
  const dayLabels = buildDayLabels(since, days);
  const map = new Map(raw.map((r) => [r._id, r]));
  return dayLabels.map((label) => ({
    date: label,
    total: map.get(label)?.total || 0,
    onTime: map.get(label)?.onTime || 0,
    late: map.get(label)?.late || 0,
  }));
}

/**
 * Get check-in method distribution for the given period.
 */
async function getCheckinMethodDistribution(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const pipeline = [
    { $match: { checkinTime: { $gte: since } } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ];

  const raw = await CheckInHistory.aggregate(pipeline);
  return raw.map((r) => ({
    method: r._id || 'UNKNOWN',
    count: r.count,
  }));
}

/**
 * Get SOS / incident response metrics.
 */
async function getIncidentMetrics(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Count incidents by type
  const byTypePipeline = [
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: '$incidentType',
        count: { $sum: 1 },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] },
        },
      },
    },
  ];

  const byType = await RescueIncident.aggregate(byTypePipeline);

  // Daily incident count
  const dailyPipeline = [
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const dailyRaw = await RescueIncident.aggregate(dailyPipeline);

  const dayLabels = buildDayLabels(since, days);
  const dailyMap = new Map(dailyRaw.map((r) => [r._id, r.count]));
  const dailyTrend = dayLabels.map((label) => ({
    date: label,
    incidents: dailyMap.get(label) || 0,
  }));

  // Average response time (createdAt -> resolvedAt)
  const resolvedPipeline = [
    {
      $match: {
        createdAt: { $gte: since },
        resolvedAt: { $ne: null },
      },
    },
    {
      $project: {
        responseMs: { $subtract: ['$resolvedAt', '$createdAt'] },
      },
    },
    {
      $group: {
        _id: null,
        avgResponseMs: { $avg: '$responseMs' },
        minResponseMs: { $min: '$responseMs' },
        maxResponseMs: { $max: '$responseMs' },
        count: { $sum: 1 },
      },
    },
  ];

  const [responseSummary] = await RescueIncident.aggregate(resolvedPipeline);

  return {
    byType: byType.map((r) => ({
      type: r._id || 'UNKNOWN',
      count: r.count,
      resolved: r.resolved,
    })),
    dailyTrend,
    responseTime: responseSummary
      ? {
          avgSeconds: Math.round((responseSummary.avgResponseMs || 0) / 1000),
          minSeconds: Math.round((responseSummary.minResponseMs || 0) / 1000),
          maxSeconds: Math.round((responseSummary.maxResponseMs || 0) / 1000),
          resolvedCount: responseSummary.count,
        }
      : { avgSeconds: 0, minSeconds: 0, maxSeconds: 0, resolvedCount: 0 },
  };
}

/**
 * Get alert escalation distribution (L1 through L4).
 */
async function getAlertEscalationBreakdown(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const pipeline = [
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: '$level',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const raw = await AlertEvent.aggregate(pipeline);
  return raw.map((r) => ({
    level: r._id,
    count: r.count,
  }));
}

/**
 * Compute false alarm rate:  resolved-without-rescue / total incidents.
 */
async function getFalseAlarmRate(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const totalIncidents = await RescueIncident.countDocuments({
    createdAt: { $gte: since },
  });
  const totalAlerts = await AlertEvent.countDocuments({
    createdAt: { $gte: since },
  });

  // Resolved incidents (used as proxy for false-alarm detection)
  const resolvedWithin5min = await RescueIncident.countDocuments({
    createdAt: { $gte: since },
    resolvedAt: { $ne: null },
  });

  const falseAlarmRate =
    totalIncidents > 0
      ? Math.round((resolvedWithin5min / totalIncidents) * 10000) / 100
      : 0;

  return {
    totalIncidents,
    totalAlerts,
    resolvedCount: resolvedWithin5min,
    falseAlarmRatePercent: falseAlarmRate,
  };
}

/**
 * Get platform KPIs: total users, active today, monitored (has timer), etc.
 */
async function getPlatformKPIs() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const totalUsers = await User.countDocuments();
  const monitoredUsers = await User.countDocuments({
    timerInterval: { $gt: 0 },
  });

  // Active today = users who checked in today
  const activeToday = await CheckInHistory.distinct('userId', {
    checkinTime: { $gte: todayStart },
  });

  // Total check-ins today
  const checkinsToday = await CheckInHistory.countDocuments({
    checkinTime: { $gte: todayStart },
  });

  // Active incidents
  const activeIncidents = await RescueIncident.countDocuments({
    status: 'ACTIVE',
  });

  // Alerts today
  const alertsToday = await AlertEvent.countDocuments({
    createdAt: { $gte: todayStart },
  });

  return {
    totalUsers,
    monitoredUsers,
    activeUsersToday: activeToday.length,
    checkinsToday,
    activeIncidents,
    alertsToday,
  };
}

/**
 * Get device signal (vitals) summary — average heart rate, SpO2 for the past N hours.
 */
async function getVitalsSummary(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        createdAt: { $gte: since },
        signalType: { $in: ['HEART_RATE', 'SPO2', 'heartRate', 'spo2'] },
      },
    },
    {
      $group: {
        _id: '$signalType',
        avg: { $avg: '$payload.value' },
        min: { $min: '$payload.value' },
        max: { $max: '$payload.value' },
        count: { $sum: 1 },
      },
    },
  ];

  const raw = await DeviceSignal.aggregate(pipeline);
  const map = new Map(raw.map((r) => [r._id, r]));

  const hr = map.get('HEART_RATE') || map.get('heartRate');
  const spo2 = map.get('SPO2') || map.get('spo2');

  return {
    heartRate: hr
      ? {
          avg: Math.round(hr.avg),
          min: hr.min,
          max: hr.max,
          readings: hr.count,
        }
      : null,
    spo2: spo2
      ? {
          avg: Math.round(spo2.avg * 10) / 10,
          min: spo2.min,
          max: spo2.max,
          readings: spo2.count,
        }
      : null,
  };
}

/**
 * Full analytics dashboard data — aggregates all metrics.
 */
async function getFullDashboard(days = 30) {
  const [
    checkinTrend,
    checkinMethods,
    incidentMetrics,
    escalationBreakdown,
    falseAlarmRate,
    platformKPIs,
    vitalsSummary,
  ] = await Promise.all([
    getCheckinTrend(days),
    getCheckinMethodDistribution(days),
    getIncidentMetrics(days),
    getAlertEscalationBreakdown(days),
    getFalseAlarmRate(days),
    getPlatformKPIs(),
    getVitalsSummary(24),
  ]);

  return {
    period: { days, generatedAt: new Date().toISOString() },
    kpis: platformKPIs,
    checkinTrend,
    checkinMethods,
    incidentMetrics,
    escalationBreakdown,
    falseAlarmRate,
    vitalsSummary,
  };
}

module.exports = {
  getCheckinTrend,
  getCheckinMethodDistribution,
  getIncidentMetrics,
  getAlertEscalationBreakdown,
  getFalseAlarmRate,
  getPlatformKPIs,
  getVitalsSummary,
  getFullDashboard,
};
