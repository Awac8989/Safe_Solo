const adminPortalService = require('../services/adminPortalService');

async function getOverview(_req, res, next) {
  try {
    const data = await adminPortalService.getOverview();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listUsers(_req, res, next) {
  try {
    const data = await adminPortalService.listUsers();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listIncidents(req, res, next) {
  try {
    const data = await adminPortalService.listIncidents(req.query.status || 'open');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function resolveIncident(req, res, next) {
  try {
    const data = await adminPortalService.resolveIncident(
      req.params.id,
      req.body?.notes || '',
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listSmsLogs(req, res, next) {
  try {
    const data = await adminPortalService.listSmsLogs(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const data = await adminPortalService.listAuditLogs(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listKycQueue(_req, res, next) {
  try {
    const data = await adminPortalService.listKycQueue();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateKycStatus(req, res, next) {
  try {
    const data = await adminPortalService.updateKycStatus(
      req.params.id,
      req.body?.action,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getChannelHealth(_req, res, next) {
  try {
    const data = await adminPortalService.getChannelHealth();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getRevenueSummary(_req, res, next) {
  try {
    const data = await adminPortalService.getRevenueSummary();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function handleHitlAction(req, res, next) {
  try {
    const data = await adminPortalService.handleHitlAction(
      req.params.id,
      req.body || {},
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getHeroRadar(_req, res, next) {
  try {
    const data = await adminPortalService.getHeroRadar();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getSafeHavens(_req, res, next) {
  try {
    const data = await adminPortalService.getSafeHavens();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getThankYouNotes(_req, res, next) {
  try {
    const data = await adminPortalService.getThankYouNotes();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getIncidentDossier(req, res, next) {
  try {
    const data = await adminPortalService.getIncidentDossier(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listHazards(_req, res, next) {
  try {
    const data = await adminPortalService.listHazards();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function verifyHazard(req, res, next) {
  try {
    const data = await adminPortalService.verifyHazard(req.params.id, req.body?.action);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createHazard(req, res, next) {
  try {
    const data = await adminPortalService.createHazard(req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getMultiVictimVitals(_req, res, next) {
  try {
    const data = await adminPortalService.getMultiVictimVitals();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getB2BOverview(_req, res, next) {
  try {
    const data = await adminPortalService.getB2BOverview();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getHeroFleet(_req, res, next) {
  try {
    const data = await adminPortalService.getHeroFleet();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function disburseHeroBounty(req, res, next) {
  try {
    const data = await adminPortalService.disburseHeroBounty(
      req.params.id,
      req.body?.amount,
      req.body?.reason,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getIncidentPlayback(req, res, next) {
  try {
    const data = await adminPortalService.getIncidentPlayback(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listGeofences(_req, res, next) {
  try {
    const data = await adminPortalService.listGeofences();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createGeofence(req, res, next) {
  try {
    const data = await adminPortalService.createGeofence(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function toggleGeofence(req, res, next) {
  try {
    const data = await adminPortalService.toggleGeofence(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function deleteGeofence(req, res, next) {
  try {
    const data = await adminPortalService.deleteGeofence(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function broadcastGeofenceAlert(req, res, next) {
  try {
    const data = await adminPortalService.broadcastGeofenceAlert(req.params.id, req.body?.message);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getAiIncidentBriefing(req, res, next) {
  try {
    const data = await adminPortalService.getAiIncidentBriefing(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function executeSopAction(req, res, next) {
  try {
    const data = await adminPortalService.executeSopAction(
      req.params.id,
      req.body?.actionCode,
      req.body,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listDisasterAlerts(_req, res, next) {
  try {
    const data = await adminPortalService.listDisasterAlerts();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createDisasterAlert(req, res, next) {
  try {
    const data = await adminPortalService.createDisasterAlert(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function resolveDisasterAlert(req, res, next) {
  try {
    const data = await adminPortalService.resolveDisasterAlert(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOverview,
  listUsers,
  listIncidents,
  resolveIncident,
  handleHitlAction,
  listSmsLogs,
  listAuditLogs,
  listKycQueue,
  updateKycStatus,
  getChannelHealth,
  getRevenueSummary,
  getHeroRadar,
  getSafeHavens,
  getThankYouNotes,
  getIncidentDossier,
  listHazards,
  verifyHazard,
  createHazard,
  getMultiVictimVitals,
  getB2BOverview,
  getHeroFleet,
  disburseHeroBounty,
  getIncidentPlayback,
  listGeofences,
  createGeofence,
  toggleGeofence,
  deleteGeofence,
  broadcastGeofenceAlert,
  getAiIncidentBriefing,
  executeSopAction,
  listDisasterAlerts,
  createDisasterAlert,
  resolveDisasterAlert,
};
