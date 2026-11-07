const dataIntegrityRepairService = require('../services/dataIntegrityRepairService');

/**
 * Controller cho Phân hệ Truy vấn Dữ liệu & Tự Động Vá Lỗi Toàn Vẹn Hệ Thống
 */
class DataIntegrityController {
  async getDiagnosticReport(req, res, next) {
    try {
      const report = await dataIntegrityRepairService.detectAnomalies();
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async queryCollectionData(req, res, next) {
    try {
      const { collection, filter, anomalyType, limit, page } = req.body || {};
      const result = await dataIntegrityRepairService.queryDiagnosticData({
        collection,
        filter,
        anomalyType,
        limit: Number(limit) || 50,
        page: Number(page) || 1,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async runAutoRepair(req, res, next) {
    try {
      const { autoFixTypes, dryRun } = req.body || {};
      const adminId = req.user?.id || req.body.adminId || 'SYSTEM_TOC_ADMIN';
      const result = await dataIntegrityRepairService.executeAutoRepair({
        autoFixTypes,
        dryRun: Boolean(dryRun),
        adminId,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getHealthScore(req, res, next) {
    try {
      const audit = await dataIntegrityRepairService.getDatabaseHealthAudit();
      res.status(200).json({ success: true, data: audit });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DataIntegrityController();

