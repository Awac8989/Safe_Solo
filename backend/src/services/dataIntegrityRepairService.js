const mongoose = require('mongoose');
const RescueIncident = require('../models/RescueIncident');
const User = require('../models/User');
const VolunteerResponse = require('../models/VolunteerResponse');
const SafePointAsset = require('../models/SafePointAsset');
const SafeTag = require('../models/SafeTag');
const EmergencyLog = require('../models/EmergencyLog');
const SystemLog = require('../models/SystemLog');

/**
 * PHÂN HỆ TRUY VẤN DỮ LIỆU & TỰ ĐỘNG VÁ LỖI TOÀN VẸN HỆ THỐNG
 * (Data Diagnostic Querying & Autonomous Integrity Self-Healing Subsystem)
 * 
 * Tác giả: Đoàn Minh Quân — MSSV: 2224801030137
 * Đề tài: SafeSolo — Hệ Sinh Thái An Toàn Cá Nhân & Cứu Hộ Đơn Độc Đa Nền Tảng
 */
class DataIntegrityRepairService {
  constructor() {
    // Phạm vi tọa độ địa lý chuẩn của Việt Nam (Bao gồm đất liền và hải đảo)
    this.VIETNAM_GEO_BOUNDS = {
      minLat: 8.0,
      maxLat: 23.5,
      minLng: 102.0,
      maxLng: 110.0,
    };
  }

  /**
   * Quét và phát hiện toàn bộ các bất thường/lỗi dữ liệu trong cơ sở dữ liệu
   */
  async detectAnomalies() {
    const anomalies = [];
    const now = new Date();
    const staleThresholdMs = 15 * 60 * 1000; // 15 phút không có hoạt động

    // 1. Kiểm tra ca cứu hộ kẹt (Stale / Stuck Incidents)
    const activeIncidents = await RescueIncident.find({
      status: {
        $in: [
          'ACTIVE',
          'TRIGGERED',
          'DISPATCHING_R1',
          'DISPATCHING_R2',
          'ACCEPTED',
          'EN_ROUTE',
          'ON_SCENE',
        ],
      },
    }).lean();

    for (const inc of activeIncidents) {
      const updatedAt = new Date(inc.updatedAt || inc.createdAt);
      const idleTimeMs = now.getTime() - updatedAt.getTime();
      if (idleTimeMs > staleThresholdMs) {
        anomalies.push({
          anomalyType: 'STALE_UNRESOLVED_INCIDENT',
          severity: 'HIGH',
          collection: 'RescueIncident',
          recordId: String(inc._id),
          summary: `Ca cứu hộ ${inc._id} ở trạng thái ${inc.status} bị kẹt không có cập nhật trong ${Math.round(idleTimeMs / 60000)} phút`,
          payload: {
            status: inc.status,
            idleMinutes: Math.round(idleTimeMs / 60000),
            victimId: inc.victimId,
            assignedVolunteerId: inc.assignedVolunteerId,
          },
        });
      }

      // Kiểm tra tọa độ GPS bất thường
      const lat = inc.exactLat;
      const lng = inc.exactLng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        if (
          lat < this.VIETNAM_GEO_BOUNDS.minLat ||
          lat > this.VIETNAM_GEO_BOUNDS.maxLat ||
          lng < this.VIETNAM_GEO_BOUNDS.minLng ||
          lng > this.VIETNAM_GEO_BOUNDS.maxLng
        ) {
          anomalies.push({
            anomalyType: 'INVALID_GPS_COORDINATES',
            severity: 'CRITICAL',
            collection: 'RescueIncident',
            recordId: String(inc._id),
            summary: `Tọa độ ca cứu hộ [${lng}, ${lat}] nằm ngoài phạm vi lãnh thổ Việt Nam hoặc bị đảo ngược kinh/vĩ độ`,
            payload: { lat, lng },
          });
        }
      }
    }

    // 2. Kiểm tra bản ghi phản hồi tình nguyện viên mồ côi (Orphan Volunteer Responses)
    const volunteerResponses = await VolunteerResponse.find().lean();
    if (volunteerResponses.length > 0) {
      const incidentIds = new Set(
        (await RescueIncident.find({}, { _id: 1 }).lean()).map((d) => String(d._id))
      );
      for (const vr of volunteerResponses) {
        if (vr.incidentId && !incidentIds.has(String(vr.incidentId))) {
          anomalies.push({
            anomalyType: 'ORPHAN_VOLUNTEER_RECORD',
            severity: 'MEDIUM',
            collection: 'VolunteerResponse',
            recordId: String(vr._id),
            summary: `Phản hồi hiệp sĩ trỏ tới incidentId '${vr.incidentId}' không tồn tại trong hệ thống`,
            payload: { volunteerId: vr.volunteerId, incidentId: vr.incidentId },
          });
        }
      }
    }

    // 3. Kiểm tra hồ sơ người dùng thiếu sót thông tin danh bạ khẩn cấp
    const users = await User.find({ isActive: { $ne: false } }).lean();
    for (const u of users) {
      const missingFields = [];
      if (!Array.isArray(u.emergencyContacts) || u.emergencyContacts.length === 0) {
        missingFields.push('emergencyContacts');
      }

      if (missingFields.length > 0) {
        anomalies.push({
          anomalyType: 'INCOMPLETE_ICE_PROFILE',
          severity: 'MEDIUM',
          collection: 'User',
          recordId: String(u._id),
          summary: `Hồ sơ I.C.E của người dùng ${u.phoneNumber || u._id} thiếu dữ liệu sống còn: ${missingFields.join(', ')}`,
          payload: { missingFields, phoneNumber: u.phoneNumber },
        });
      }
    }

    // 4. Kiểm tra SafeTag mồ côi (Unindexed / Orphan SafeTag)
    const safetags = await SafeTag.find().lean();
    const userIds = new Set(users.map((u) => String(u._id)));
    for (const tag of safetags) {
      if (tag.userId && !userIds.has(String(tag.userId))) {
        anomalies.push({
          anomalyType: 'UNINDEXED_SAFETAG_ASSET',
          severity: 'LOW',
          collection: 'SafeTag',
          recordId: String(tag._id),
          summary: `SafeTag ${tag.tagUid || tag._id} trỏ tới userId '${tag.userId}' không tồn tại`,
          payload: { tagUid: tag.tagUid, userId: tag.userId },
        });
      }
    }

    return {
      success: true,
      scannedAt: new Date().toISOString(),
      totalAnomalies: anomalies.length,
      anomaliesByCategory: {
        STALE_UNRESOLVED_INCIDENT: anomalies.filter((a) => a.anomalyType === 'STALE_UNRESOLVED_INCIDENT').length,
        INVALID_GPS_COORDINATES: anomalies.filter((a) => a.anomalyType === 'INVALID_GPS_COORDINATES').length,
        ORPHAN_VOLUNTEER_RECORD: anomalies.filter((a) => a.anomalyType === 'ORPHAN_VOLUNTEER_RECORD').length,
        INCOMPLETE_ICE_PROFILE: anomalies.filter((a) => a.anomalyType === 'INCOMPLETE_ICE_PROFILE').length,
        UNINDEXED_SAFETAG_ASSET: anomalies.filter((a) => a.anomalyType === 'UNINDEXED_SAFETAG_ASSET').length,
      },
      anomalies,
    };
  }

  /**
   * Truy vấn chẩn đoán dữ liệu linh hoạt phục vụ giám sát kỹ thuật
   */
  async queryDiagnosticData({
    collection = 'RescueIncident',
    filter = {},
    anomalyType = null,
    limit = 50,
    page = 1,
  }) {
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    let Model;

    switch (collection) {
      case 'RescueIncident':
        Model = RescueIncident;
        break;
      case 'User':
        Model = User;
        break;
      case 'VolunteerResponse':
        Model = VolunteerResponse;
        break;
      case 'SafePointAsset':
        Model = SafePointAsset;
        break;
      case 'SafeTag':
        Model = SafeTag;
        break;
      case 'EmergencyLog':
        Model = EmergencyLog;
        break;
      default:
        throw new Error(`Collection '${collection}' không được hỗ trợ chẩn đoán`);
    }

    const query = { ...filter };
    if (anomalyType === 'STALE_ACTIVE') {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
      query.status = {
        $in: [
          'ACTIVE',
          'TRIGGERED',
          'DISPATCHING_R1',
          'DISPATCHING_R2',
          'ACCEPTED',
          'EN_ROUTE',
          'ON_SCENE',
        ],
      };
      query.createdAt = { $lt: fifteenMinAgo };
    } else if (anomalyType === 'OUT_OF_BOUNDS_COORDINATES') {
      query.$or = [
        { exactLat: { $lt: this.VIETNAM_GEO_BOUNDS.minLat } },
        { exactLat: { $gt: this.VIETNAM_GEO_BOUNDS.maxLat } },
        { exactLng: { $lt: this.VIETNAM_GEO_BOUNDS.minLng } },
        { exactLng: { $gt: this.VIETNAM_GEO_BOUNDS.maxLng } },
      ];
    }

    const total = await Model.countDocuments(query);
    const records = await Model.find(query).sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean();

    return {
      success: true,
      collection,
      queryApplied: query,
      pagination: {
        page: Math.max(1, page),
        limit: Math.max(1, limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      records,
    };
  }

  /**
   * Tự động sửa chữa / vá lỗi các bất thường dữ liệu (Autonomous Self-Healing)
   */
  async executeAutoRepair({
    autoFixTypes = ['STALE_INCIDENTS', 'ORPHAN_RECORDS', 'INVALID_COORDINATES', 'INCOMPLETE_ICE'],
    dryRun = false,
    adminId = 'SYSTEM_AUTONOMOUS_HEALER',
  } = {}) {
    const diagnostic = await this.detectAnomalies();
    const repairLog = [];
    let fixedCount = 0;

    // 1. Sửa ca cứu hộ kẹt (Stale Unresolved Incidents)
    if (autoFixTypes.includes('STALE_INCIDENTS')) {
      const staleAnomalies = diagnostic.anomalies.filter(
        (a) => a.anomalyType === 'STALE_UNRESOLVED_INCIDENT'
      );
      for (const item of staleAnomalies) {
        if (!dryRun) {
          await RescueIncident.findByIdAndUpdate(item.recordId, {
            $set: {
              status: 'RECONCILED_TIMEOUT',
              resolvedAt: new Date(),
            },
            $push: {
              auditTrail: {
                action: 'AUTO_HEAL_STALE_INCIDENT_RESOLVED',
                actorId: adminId,
                timestamp: new Date(),
                details: `Hệ thống tự động giải tỏa ca cứu hộ kẹt idle ${item.payload.idleMinutes} phút chuyển sang RECONCILED_TIMEOUT`,
              },
            },
          });
        }
        fixedCount++;
        repairLog.push({
          action: 'RESOLVE_STALE_INCIDENT',
          targetId: item.recordId,
          status: dryRun ? 'SIMULATED' : 'APPLIED',
          details: `Đã xử lý ca cứu hộ ${item.recordId} kẹt ${item.payload.idleMinutes} phút`,
        });
      }
    }

    // 2. Dọn dẹp bản ghi mồ côi (Orphan Volunteer Records)
    if (autoFixTypes.includes('ORPHAN_RECORDS')) {
      const orphanAnomalies = diagnostic.anomalies.filter(
        (a) => a.anomalyType === 'ORPHAN_VOLUNTEER_RECORD'
      );
      for (const item of orphanAnomalies) {
        if (!dryRun) {
          await VolunteerResponse.findByIdAndDelete(item.recordId);
        }
        fixedCount++;
        repairLog.push({
          action: 'PRUNE_ORPHAN_VOLUNTEER',
          targetId: item.recordId,
          status: dryRun ? 'SIMULATED' : 'APPLIED',
          details: `Đã dọn dẹp bản ghi tình nguyện viên trỏ tới ca cứu hộ không tồn tại (${item.payload.incidentId})`,
        });
      }
    }

    // 3. Chuẩn hóa tọa độ GPS bị lỗi hoặc đảo ngược (Invalid GPS Coordinates)
    if (autoFixTypes.includes('INVALID_COORDINATES')) {
      const coordAnomalies = diagnostic.anomalies.filter(
        (a) => a.anomalyType === 'INVALID_GPS_COORDINATES'
      );
      for (const item of coordAnomalies) {
        const { lat, lng } = item.payload;
        let correctedLng = lng;
        let correctedLat = lat;

        // Xử lý đảo ngược lat/lng kinh điển (Ví dụ: lat=106.7, lng=10.7)
        if (
          lat >= this.VIETNAM_GEO_BOUNDS.minLng &&
          lat <= this.VIETNAM_GEO_BOUNDS.maxLng &&
          lng >= this.VIETNAM_GEO_BOUNDS.minLat &&
          lng <= this.VIETNAM_GEO_BOUNDS.maxLat
        ) {
          correctedLng = lat;
          correctedLat = lng;
        } else {
          // Gắn cờ vị trí trung tâm TP.HCM mặc định nếu hoàn toàn không hợp lệ
          correctedLng = 106.7009;
          correctedLat = 10.7769;
        }

        if (!dryRun) {
          await RescueIncident.findByIdAndUpdate(item.recordId, {
            $set: {
              exactLat: correctedLat,
              exactLng: correctedLng,
              fuzzedLat: correctedLat,
              fuzzedLng: correctedLng,
            },
            $push: {
              auditTrail: {
                action: 'AUTO_HEAL_COORDINATES_NORMALIZED',
                actorId: adminId,
                timestamp: new Date(),
                details: `Đã chuẩn hóa tọa độ từ [${lng}, ${lat}] thành [${correctedLng}, ${correctedLat}]`,
              },
            },
          });
        }
        fixedCount++;
        repairLog.push({
          action: 'NORMALIZE_COORDINATES',
          targetId: item.recordId,
          status: dryRun ? 'SIMULATED' : 'APPLIED',
          details: `Tọa độ gốc [${lng}, ${lat}] -> Tọa độ chuẩn hóa [${correctedLng}, ${correctedLat}]`,
        });
      }
    }

    // 4. Bổ sung danh bạ khẩn cấp 115 mặc định cho hồ sơ I.C.E người dùng thiếu
    if (autoFixTypes.includes('INCOMPLETE_ICE')) {
      const iceAnomalies = diagnostic.anomalies.filter(
        (a) => a.anomalyType === 'INCOMPLETE_ICE_PROFILE'
      );
      for (const item of iceAnomalies) {
        if (!dryRun) {
          await User.findByIdAndUpdate(item.recordId, {
            $addToSet: {
              emergencyContacts: {
                name: 'Tổng Đài Cấp Cứu Quốc Gia 115',
                phone: '115',
                relation: 'Cấp Cứu Y Tế Khẩn Cấp',
              },
            },
          });
        }
        fixedCount++;
        repairLog.push({
          action: 'RECONCILE_USER_ICE',
          targetId: item.recordId,
          status: dryRun ? 'SIMULATED' : 'APPLIED',
          details: `Đã bổ sung danh bạ 115 mặc định cho người dùng ${item.payload.phoneNumber || item.recordId}`,
        });
      }
    }

    // Ghi nhật ký hệ thống kiểm toán (SystemLog) nếu model tồn tại
    if (!dryRun && fixedCount > 0) {
      try {
        if (SystemLog && SystemLog.create) {
          await SystemLog.create({
            actionType: 'DATA_INTEGRITY_SELF_HEAL',
            description: `Hệ thống tự động phát hiện ${diagnostic.totalAnomalies} lỗi và đã vá thành công ${fixedCount} lỗi dữ liệu`,
            metadata: {
              adminId,
              scannedAnomalies: diagnostic.totalAnomalies,
              fixedCount,
              repairSummary: repairLog.map((r) => r.action),
            },
          });
        }
      } catch (logErr) {
        console.warn('[DataIntegrityRepairService] SystemLog write ignored:', logErr.message);
      }
    }

    return {
      success: true,
      dryRun,
      executedAt: new Date().toISOString(),
      scannedTotal: diagnostic.totalAnomalies,
      repairedTotal: fixedCount,
      remainingAnomalies: diagnostic.totalAnomalies - fixedCount,
      repairLog,
    };
  }

  /**
   * Tính toán Bảng điểm Sức khỏe Toàn vẹn Dữ liệu Hệ thống (Database Health Score: 0 - 100%)
   */
  async getDatabaseHealthAudit() {
    const diagnostic = await this.detectAnomalies();
    const incidentCount = await RescueIncident.countDocuments();
    const userCount = await User.countDocuments();
    const volunteerCount = await VolunteerResponse.countDocuments();
    const safePointCount = await SafePointAsset.countDocuments();

    // Trọng số trừ điểm theo mức độ nghiêm trọng
    let penaltyPoints = 0;
    for (const an of diagnostic.anomalies) {
      if (an.severity === 'CRITICAL') penaltyPoints += 15;
      else if (an.severity === 'HIGH') penaltyPoints += 8;
      else if (an.severity === 'MEDIUM') penaltyPoints += 3;
      else penaltyPoints += 1;
    }

    const healthScore = Math.max(0, 100 - penaltyPoints);
    let healthRating = 'EXCELLENT';
    if (healthScore < 60) healthRating = 'CRITICAL_ACTION_REQUIRED';
    else if (healthScore < 80) healthRating = 'NEEDS_ATTENTION';
    else if (healthScore < 95) healthRating = 'GOOD';

    return {
      success: true,
      auditedAt: new Date().toISOString(),
      healthScore,
      healthRating,
      status: healthRating,
      recommendation:
        healthScore >= 80
          ? 'Hệ thống đạt chuẩn an toàn vận hành 24/7'
          : 'Cần kích hoạt Auto-Repair để giải tỏa các bất thường dữ liệu',
      statistics: {
        totalIncidents: incidentCount,
        totalUsers: userCount,
        totalVolunteers: volunteerCount,
        totalSafePoints: safePointCount,
      },
      anomaliesDetected: diagnostic.totalAnomalies,
      anomaliesByCategory: diagnostic.anomaliesByCategory,
      selfHealingReadiness: {
        isSelfHealingActive: true,
        supportedAutoFixes: [
          'STALE_INCIDENTS',
          'ORPHAN_RECORDS',
          'INVALID_COORDINATES',
          'INCOMPLETE_ICE',
        ],
        lastHealingTimestamp: new Date().toISOString(),
      },
    };
  }
}

module.exports = new DataIntegrityRepairService();