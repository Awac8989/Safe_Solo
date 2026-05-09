const adminPortalService = require('../services/adminPortalService');

async function getOverview(_req, res) {
  const data = await adminPortalService.getOverview();
  res.json({ success: true, data });
}

async function listUsers(_req, res) {
  const data = await adminPortalService.listUsers();
  res.json({ success: true, data });
}

async function listIncidents(req, res) {
  const data = await adminPortalService.listIncidents(req.query.status || 'open');
  res.json({ success: true, data });
}

async function resolveIncident(req, res) {
  const data = await adminPortalService.resolveIncident(
    req.params.id,
    req.body?.notes || '',
  );
  res.json({ success: true, data });
}

async function listSmsLogs(req, res) {
  const data = await adminPortalService.listSmsLogs(req.params.id);
  res.json({ success: true, data });
}

async function listAuditLogs(req, res) {
  const data = await adminPortalService.listAuditLogs(req.query);
  res.json({ success: true, data });
}

async function listKycQueue(_req, res) {
  const data = await adminPortalService.listKycQueue();
  res.json({ success: true, data });
}

async function updateKycStatus(req, res) {
  const data = await adminPortalService.updateKycStatus(
    req.params.id,
    req.body?.action,
  );
  res.json({ success: true, data });
}

async function getChannelHealth(_req, res) {
  const data = await adminPortalService.getChannelHealth();
  res.json({ success: true, data });
}

async function getRevenueSummary(_req, res) {
  const data = await adminPortalService.getRevenueSummary();
  res.json({ success: true, data });
}

module.exports = {
  getOverview,
  listUsers,
  listIncidents,
  resolveIncident,
  listSmsLogs,
  listAuditLogs,
  listKycQueue,
  updateKycStatus,
  getChannelHealth,
  getRevenueSummary,
};
