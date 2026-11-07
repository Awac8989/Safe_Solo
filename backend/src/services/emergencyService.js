const User = require('../models/User');
const RescueIncident = require('../models/RescueIncident');
const EmergencyMemo = require('../models/EmergencyMemo');
const EmergencyEvidence = require('../models/EmergencyEvidence');
const radarService = require('./radarService');
const chatService = require('./chatService');
const systemLogService = require('./systemLogService');
const { createAlertEvent } = require('./alertEventService');
const { getIo } = require('../sockets/socketServer');
const { AppError, ensure } = require('../lib/errors');
const { fullName, sanitizeUser, haversineKm } = require('../lib/utils');
const { sendEmergencySms } = require('./smsService');
const { toIso } = require('../lib/mongoCore');
const { decryptEmergencyMemoPayload, encryptEmergencyMemoPayload } = require('../lib/sensitivePayloadCodec');
const { decryptUserSensitivePayload } = require('../lib/userSensitiveCodec');

function mapMemo(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  const sensitive = decryptEmergencyMemoPayload(row);
  return {
    id: row._id,
    incidentId: row.incidentId,
    victimId: row.victimId,
    createdAt: toIso(row.createdAt),
    duration: row.duration,
    victimName: sensitive.victimName,
    lat: row.lat,
    lng: row.lng,
    approxAddress: sensitive.approxAddress,
    contentUrl: sensitive.contentUrl,
    transcript: sensitive.transcript,
    isAnonymous: Boolean(row.isAnonymous),
  };
}

class EmergencyService {
  async createSilentSosIncident(userId) {
    const user = await User.findById(userId);
    ensure(user, 'User not found', 404);

    return radarService.broadcastSOS(
      userId,
      'silent_sos',
      user.lastKnownLocation?.lat ?? 10.7769,
      user.lastKnownLocation?.lng ?? 106.7009,
      {
        severity: 3,
        source: 'SILENT_SOS',
        batteryLevel: user.batteryLevel,
        approxAddress: decryptUserSensitivePayload(user).approxAddress,
      },
    );
  }

  async notifyGuardians(userLike, escalationLevel) {
    const userDoc = await User.findById(userLike._id || userLike.id);
    ensure(userDoc, 'User not found', 404);

    const contacts = decryptUserSensitivePayload(userDoc).emergencyContacts;
    const user = sanitizeUser(userDoc);
    const results = await sendEmergencySms({
      emergencyLogId: null,
      user: {
        _id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phone,
      },
      contacts,
      location: userDoc.lastKnownLocation || null,
    });

    await createAlertEvent({
      userId: user.id,
      level: escalationLevel === 1 ? 'WARNING' : 'SOS',
      status: `DEADMAN_LEVEL_${escalationLevel}`,
      source: 'SYSTEM',
      title: `Deadman escalation L${escalationLevel}`,
      message: `Da thong bao ${contacts.length} guardians`,
      metadata: {
        escalationLevel,
        contacts: contacts.map((item) => item.phone),
        smsResults: results,
      },
    });

    return contacts.map((contact) => ({
      phone: contact.phone,
      name: contact.name,
      guardianId: null,
      level: escalationLevel,
    }));
  }

  async createEmergencyMemo(userId, payload) {
    const user = await User.findById(userId);
    ensure(user, 'User not found', 404);

    let incidentId = payload.incidentId;
    if (incidentId) {
      const incident = await RescueIncident.findById(incidentId);
      ensure(incident, 'Incident not found', 404);
    } else {
      const latestIncident = await RescueIncident.findOne({
        victimId: userId,
        status: 'ACTIVE',
      }).sort({ createdAt: -1 });

      if (!latestIncident) {
        const created = await radarService.broadcastSOS(
          userId,
          'voice_emergency',
          payload.lat,
          payload.lng,
          {
            severity: 3,
            source: 'VOICE_MEMO',
            approxAddress: payload.approxAddress,
            batteryLevel: user.batteryLevel,
          },
        );
        incidentId = created.incident.id;
      } else {
        incidentId = latestIncident._id;
      }
    }

    const memo = await EmergencyMemo.create({
      incidentId,
      victimId: userId,
      duration: payload.duration,
      victimName: '',
      lat: payload.lat,
      lng: payload.lng,
      approxAddress: null,
      contentUrl: null,
      transcript: '',
      encryptedPayload: encryptEmergencyMemoPayload({
        incidentId,
        victimName: fullName(user),
        approxAddress: payload.approxAddress || decryptUserSensitivePayload(user).approxAddress || null,
        contentUrl: payload.contentUrl || null,
        transcript: payload.transcript || '',
      }),
      encryptionVersion: 1,
      isAnonymous: true,
    });

    const room = await chatService.getChatRoomByIncident(incidentId);
    await chatService.createMessage(
      room._id || room.id,
      userId,
      'VOICE_NOTE',
      memo.contentUrl || memo.transcript || 'Emergency memo',
      {
        memoId: memo._id,
        duration: memo.duration,
        lat: memo.lat,
        lng: memo.lng,
        approxAddress: memo.approxAddress,
        transcript: memo.transcript,
      },
    );

    await systemLogService.createLog({
      incidentId,
      actionType: 'EMERGENCY_MEMO_CREATED',
      description: `Emergency memo created by ${userId}`,
      metadata: mapMemo(memo),
    });

    try {
      getIo().emit('EMERGENCY_MEMO_CREATED', mapMemo(memo));
    } catch (_error) {
      // socket optional
    }

    const count = await EmergencyMemo.countDocuments({ incidentId });
    if (count > 50) {
      const oldItems = await EmergencyMemo.find({ incidentId }).sort({ createdAt: -1 }).skip(50).select('_id');
      if (oldItems.length) {
        await EmergencyMemo.deleteMany({ _id: { $in: oldItems.map((item) => item._id) } });
      }
    }

    return mapMemo(memo);
  }

  async listEmergencyMemos({ lat = null, lng = null, radiusKm = 3 } = {}) {
    const memos = await EmergencyMemo.find().sort({ createdAt: -1 }).limit(200).lean();
    let items = memos.map(mapMemo);
    if (lat != null && lng != null) {
      items = items.filter((item) => haversineKm(lat, lng, item.lat, item.lng) <= radiusKm);
    }
    return items;
  }

  async requestCommunityHelp(incidentId, requesterId, note = '') {
    const incident = await radarService.getIncidentDetails(incidentId, requesterId);
    const target = await RescueIncident.findById(incidentId);
    ensure(target, 'Incident not found', 404);
    target.communityRequestedAt = new Date();
    await target.save();

    const event = await createAlertEvent({
      userId: target.victimId,
      level: 'WARNING',
      status: 'COMMUNITY_HELP_REQUESTED',
      source: 'USER',
      title: 'Kich hoat ho tro cong dong',
      message: note || 'Nan nhan da keu goi cong dong trong ban kinh 3km',
      metadata: { incidentId },
    });

    try {
      getIo().emit('COMMUNITY_HELP_REQUESTED', {
        incident: { ...incident, communityRequestedAt: toIso(target.communityRequestedAt) },
        event,
      });
    } catch (_error) {
      // socket optional
    }

    return {
      incident: { ...incident, communityRequestedAt: toIso(target.communityRequestedAt) },
      event,
    };
  }

  async listActiveIncidents() {
    const incidents = await RescueIncident.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
    const victimIds = [...new Set(incidents.map((item) => item.victimId))];
    const victims = victimIds.length ? await User.find({ _id: { $in: victimIds } }).lean() : [];
    const victimMap = new Map(victims.map((item) => [item._id, sanitizeUser(item)]));
    return incidents.map((incident) => ({
      ...incident,
      id: incident._id,
      victim: victimMap.get(incident.victimId) || null,
    }));
  }

  async resolveIncidentFromAdmin(incidentId, notes = '') {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date();
    await incident.save();

    await systemLogService.createLog({
      incidentId,
      actionType: 'ADMIN_RESOLVED_INCIDENT',
      description: notes || 'Incident resolved by admin',
      metadata: { notes },
    });

    await chatService.closeChatRoom(incidentId).catch(() => null);
    return {
      ...incident.toObject(),
      id: incident._id,
    };
  }

  async saveEmergencyEvidence(userId, payload) {
    const user = await User.findById(userId);
    ensure(user, 'User not found', 404);

    let incidentId = payload.incidentId;
    if (!incidentId) {
      const active = await RescueIncident.findOne({ victimId: userId, status: 'ACTIVE' }).sort({ createdAt: -1 });
      incidentId = active ? active._id : null;
    }

    const evidence = await EmergencyEvidence.create({
      userId,
      incidentId,
      triggerSource: payload.triggerSource || 'SOS_BUTTON',
      photoBase64: payload.photoBase64 || null,
      audioBase64: payload.audioBase64 || null,
      lat: payload.lat != null ? Number(payload.lat) : (user.lastKnownLocation?.lat || null),
      lng: payload.lng != null ? Number(payload.lng) : (user.lastKnownLocation?.lng || null),
      metadata: {
        approxAddress: decryptUserSensitivePayload(user).approxAddress,
        batteryLevel: user.batteryLevel,
        capturedAt: new Date().toISOString(),
      },
    });

    const io = getIo();
    if (io) {
      io.emit('emergency:evidence_ready', {
        evidenceId: evidence._id,
        incidentId,
        userId,
        triggerSource: evidence.triggerSource,
        hasPhoto: Boolean(evidence.photoBase64),
        hasAudio: Boolean(evidence.audioBase64),
        createdAt: toIso(evidence.createdAt),
      });
    }

    return {
      id: evidence._id,
      incidentId,
      triggerSource: evidence.triggerSource,
      hasPhoto: Boolean(evidence.photoBase64),
      hasAudio: Boolean(evidence.audioBase64),
      createdAt: toIso(evidence.createdAt),
    };
  }
/**
   * Xử lý tin nhắn SMS cứu nạn ngoại tuyến (Offline Inbound SMS Relay)
   */
  async processSmsInboundRelay(senderPhone, smsBody) {
    ensure(senderPhone, 'senderPhone is required', 400);
    ensure(smsBody, 'smsBody is required', 400);

    const cleanBody = String(smsBody).trim();
    const cleanPhone = String(senderPhone).trim();

    let user = await User.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: cleanPhone.replace(/^\+84/, '0') },
        { phoneNumber: cleanPhone.replace(/^0/, '+84') },
      ],
    });

    let lat = user?.lastKnownLocation?.lat || 10.7769;
    let lng = user?.lastKnownLocation?.lng || 106.7009;
    let incidentType = 'CRITICAL_OFFLINE_SMS_SOS';
    let severity = 1;
    let severityLevel = 'P0_CRITICAL_LIFE_THREAT';

    const coordMatch = cleanBody.match(/(?:LAT[:\s]+)?(-?\d+\.\d+)[\s,]+(?:LNG[:\s]+)?(-?\d+\.\d+)/i);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }

    if (/TIM|CARDIAC|NGUNG TIM/i.test(cleanBody)) {
      incidentType = 'CRITICAL_CARDIAC_ARREST';
    } else if (/MAU|HEMORRHAGE|DUT MACH/i.test(cleanBody)) {
      incidentType = 'CRITICAL_TRAUMA_HEMORRHAGE';
    } else if (/DOT QUY|STROKE/i.test(cleanBody)) {
      incidentType = 'CRITICAL_STROKE_FAST';
    } else if (/TE NGA|FALL/i.test(cleanBody)) {
      incidentType = 'SEVERE_FALL_HEAD_INJURY';
    }

    if (!user) {
      user = await User.create({
        fullName: 'Nạn nhân Ngoại Tuyến (' + cleanPhone.slice(-4) + ')',
        phoneNumber: cleanPhone,
        role: 'user',
        currentStatus: 'SOS',
        lastKnownLocation: { lat, lng, updatedAt: new Date() },
        nextDeadline: new Date(Date.now() + 3600000),
      });
    }

    const broadcastResult = await radarService.broadcastSOS(
      user._id,
      incidentType,
      lat,
      lng,
      {
        severity,
        severityLevel,
        source: 'OFFLINE_SMS_RELAY',
        approxAddress: 'Tin nhắn SMS từ số ' + cleanPhone,
        medicalNotes: user.medicalNotes || 'Chưa có hồ sơ ngoại viện',
      }
    );

    await this.notifyGuardians(user, 'EMERGENCY_SMS_INBOUND');

    return {
      success: true,
      senderPhone: cleanPhone,
      incidentId: broadcastResult.incident.id,
      incidentType,
      coordinates: { lat, lng },
      replyMessage: '[SafeSolo] ĐÃ TIẾP NHẬN BÁO ĐỘNG SOS: Đang điều phối Hiệp sĩ và Tổng đài 115 đến tọa độ (' + lat + ', ' + lng + '). Giữ máy và bật loa ngoài.',
    };
  }

  /**
   * Tính toán và Áp dụng Phân tầng Lâm sàng NEWS2 Chuẩn Quốc Tế
   * (National Early Warning Score 2 - Royal College of Physicians London)
   */
  async applyNews2ClinicalTriage(incidentId, vitals = {}) {
    const {
      respirationRate = 24,
      spo2 = 92,
      airOrOxygen = 'AIR',
      systolicBp = 110,
      heartRate = 120,
      consciousness = 'V',
      temperature = 37.5,
      supervisorName = 'Đoàn Minh Quân (Trưởng ca trực TOC)',
    } = vitals;

    // 1. Điểm Nhịp thở
    let scoreRespiration = 0;
    if (respirationRate <= 8) scoreRespiration = 3;
    else if (respirationRate <= 11) scoreRespiration = 1;
    else if (respirationRate <= 20) scoreRespiration = 0;
    else if (respirationRate <= 24) scoreRespiration = 2;
    else scoreRespiration = 3;

    // 2. Điểm SpO2
    let scoreSpo2 = 0;
    if (spo2 <= 91) scoreSpo2 = 3;
    else if (spo2 <= 93) scoreSpo2 = 2;
    else if (spo2 <= 95) scoreSpo2 = 1;
    else scoreSpo2 = 0;

    // 3. Bổ sung Oxy
    const scoreOxygen = airOrOxygen === 'OXYGEN' ? 2 : 0;

    // 4. Huyết áp tâm thu
    let scoreBp = 0;
    if (systolicBp <= 90) scoreBp = 3;
    else if (systolicBp <= 100) scoreBp = 2;
    else if (systolicBp <= 110) scoreBp = 1;
    else if (systolicBp <= 219) scoreBp = 0;
    else scoreBp = 3;

    // 5. Nhịp tim
    let scorePulse = 0;
    if (heartRate <= 40) scorePulse = 3;
    else if (heartRate <= 50) scorePulse = 1;
    else if (heartRate <= 90) scorePulse = 0;
    else if (heartRate <= 110) scorePulse = 1;
    else if (heartRate <= 130) scorePulse = 2;
    else scorePulse = 3;

    // 6. Ý thức AVPU
    const isAlert = consciousness === 'A' || consciousness === 'ALERT';
    const scoreConsciousness = isAlert ? 0 : 3;

    // 7. Thân nhiệt
    let scoreTemp = 0;
    if (temperature <= 35.0) scoreTemp = 3;
    else if (temperature <= 36.0) scoreTemp = 1;
    else if (temperature <= 38.0) scoreTemp = 0;
    else if (temperature <= 39.0) scoreTemp = 1;
    else scoreTemp = 2;

    const totalNews2Score =
      scoreRespiration +
      scoreSpo2 +
      scoreOxygen +
      scoreBp +
      scorePulse +
      scoreConsciousness +
      scoreTemp;

    const hasExtremeSingleScore =
      scoreRespiration === 3 ||
      scoreSpo2 === 3 ||
      scoreBp === 3 ||
      scorePulse === 3 ||
      scoreConsciousness === 3 ||
      scoreTemp === 3;

    let riskLevel = 'LOW_RISK';
    let urgencyTier = 1;
    let actionRecommendation = 'Theo dõi sinh tồn ngoại viện định kỳ 4-6 giờ.';

    if (totalNews2Score >= 7) {
      riskLevel = 'HIGH_RISK_LIFE_THREAT';
      urgencyTier = 3;
      actionRecommendation =
        'Kích hoạt Báo động Đỏ: Kíp Cấp cứu 115 có Bác sĩ Hồi sức Cấp cứu tiếp cận ngay lập tức (< 8 phút). Điều động 2 Hiệp sĩ mở đường và ép tim CPR/thở oxy.';
    } else if (totalNews2Score >= 5 || hasExtremeSingleScore) {
      riskLevel = 'MEDIUM_RISK_URGENT';
      urgencyTier = 2;
      actionRecommendation =
        'Điều động khẩn Hiệp sĩ PHTLS lân cận (<850m) đo lại huyết áp & SpO2. Kết nối Tele-FirstAid hướng dẫn tư thế hồi sức an toàn.';
    }

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId).catch(() => null);
    if (incident) {
      if (!incident.clinicalAssessment) {
        incident.clinicalAssessment = {};
      }
      incident.clinicalAssessment.news2 = {
        totalScore: totalNews2Score,
        riskLevel,
        urgencyTier,
        parameters: {
          respirationRate,
          spo2,
          airOrOxygen,
          systolicBp,
          heartRate,
          consciousness,
          temperature,
        },
        actionRecommendation,
        evaluatedAt: new Date(),
        evaluator: supervisorName,
      };
      incident.clinicalAssessment.lastEvaluatedAt = new Date();
      incident.markModified('clinicalAssessment');

      incident.auditTrail.push({
        action: 'NEWS2_TRIAGE_EVALUATED',
        timestamp: new Date(),
        details: 'NEWS-2 Score: ' + totalNews2Score + '/20 (' + riskLevel + ') - Tier ' + urgencyTier + ' Triggered',
      });

      if (urgencyTier === 3 && incident.status !== 'RESOLVED') {
        incident.escalationLevel = 3;
      }

      await incident.save();
    }

    return {
      success: true,
      incidentId,
      totalScore: totalNews2Score,
      riskLevel,
      urgencyTier,
      hasExtremeSingleScore,
      componentScores: {
        respiration: scoreRespiration,
        spo2: scoreSpo2,
        oxygen: scoreOxygen,
        bloodPressure: scoreBp,
        pulse: scorePulse,
        consciousness: scoreConsciousness,
        temperature: scoreTemp,
      },
      actionRecommendation,
      evaluatedAt: new Date(),
      evaluator: supervisorName,
    };
  }

  /**
   * Kích hoạt Chế độ Thảm họa Hàng loạt (Mass Casualty Incident - MCI)
   * Phân bổ nguồn lực y tế cấp cứu ngoại viện diện rộng
   */
  async declareMassCasualtyIncident(incidentId, details = {}) {
    const {
      dispatcherName = 'Trực ban Điều hành TOC 115',
      estimatedCasualties = 10,
      incidentNotes = 'Sự cố thảm họa đô thị quy mô lớn',
    } = details;

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    if (!incident.mciProtocol) {
      incident.mciProtocol = {};
    }

    incident.mciProtocol.isMCI = true;
    incident.mciProtocol.mciDeclaredBy = dispatcherName;
    incident.mciProtocol.mciDeclaredAt = new Date();
    incident.severityLevel = 'P0_CRITICAL_LIFE_THREAT';
    incident.escalationLevel = 3;

    incident.auditTrail.push({
      action: 'MCI_DECLARED',
      timestamp: new Date(),
      details: `Kích hoạt Thảm họa Hàng loạt (MCI) bởi ${dispatcherName}. Ước tính ${estimatedCasualties} nạn nhân. ${incidentNotes}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isMCI: true,
      declaredBy: dispatcherName,
      declaredAt: incident.mciProtocol.mciDeclaredAt,
      severityLevel: incident.severityLevel,
      casualtyCounts: incident.mciProtocol.casualtyCounts,
      alertMessage: `[BÁO ĐỘNG ĐỎ MCI] Đã kích hoạt Giao thức Thảm họa Hàng loạt: Ước tính ${estimatedCasualties} nạn nhân. Điều phối toàn bộ mạng lưới xe 115 và trạm SafePoint lân cận!`,
    };
  }

  /**
   * Phân loại Nạn nhân theo Giao thức START Triage (Simple Triage and Rapid Treatment)
   * Chuẩn Quốc tế PHTLS & Bộ Y Tế: RED (Đỏ) - YELLOW (Vàng) - GREEN (Xanh) - BLACK (Đen)
   */
  async applyStartTriageTag(incidentId, heroId, triageData = {}) {
    const {
      canWalk = false,
      respirationRate = 22,
      capillaryRefillSeconds = 2.0,
      mentalStatusFollowsCommands = true,
      victimIdentifier = 'Nạn nhân số 1',
    } = triageData;

    let tag = 'YELLOW';
    let triageCategory = 'DELAYED';
    let rationale = 'Bệnh nhân tổn thương trung bình, có thể chờ vận chuyển bậc 2';

    if (canWalk) {
      tag = 'GREEN';
      triageCategory = 'MINOR';
      rationale = 'Nạn nhân đi lại được (Walking Wounded), ưu tiên tự sơ cứu và hỗ trợ người khác';
    } else if (respirationRate === 0) {
      tag = 'BLACK';
      triageCategory = 'DECEASED_EXPECTANT';
      rationale = 'Ngừng hô hấp sau khi đã mở đường thở, tiên lượng tử vong ngoại viện';
    } else if (respirationRate > 30 || respirationRate < 10) {
      tag = 'RED';
      triageCategory = 'IMMEDIATE';
      rationale = 'Rối loạn hô hấp cấp tính (Nhịp thở ' + respirationRate + '/phút) - Nguy kịch';
    } else if (capillaryRefillSeconds > 2.0) {
      tag = 'RED';
      triageCategory = 'IMMEDIATE';
      rationale = 'Tưới máu mao mạch > 2 giây - Dấu hiệu sốc giảm thể tích / tuần hoàn suy sụp';
    } else if (!mentalStatusFollowsCommands) {
      tag = 'RED';
      triageCategory = 'IMMEDIATE';
      rationale = 'Không làm theo y lệnh đơn giản - Hôn mê / Tổn thương thần kinh sọ não nặng';
    }

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    if (!incident.mciProtocol) {
      incident.mciProtocol = { casualtyCounts: { red: 0, yellow: 0, green: 0, black: 0 } };
    }

    incident.mciProtocol.startTriageTag = tag;
    incident.mciProtocol.triageDetails = {
      canWalk,
      respirationRate,
      capillaryRefillSeconds,
      mentalStatusFollowsCommands,
      tagAssignedAt: new Date(),
      tagAssignedBy: heroId,
    };

    if (tag === 'RED') incident.mciProtocol.casualtyCounts.red += 1;
    else if (tag === 'YELLOW') incident.mciProtocol.casualtyCounts.yellow += 1;
    else if (tag === 'GREEN') incident.mciProtocol.casualtyCounts.green += 1;
    else if (tag === 'BLACK') incident.mciProtocol.casualtyCounts.black += 1;

    incident.auditTrail.push({
      action: 'START_TRIAGE_TAGGED',
      timestamp: new Date(),
      details: `Gán thẻ ${tag} (${triageCategory}) cho ${victimIdentifier} bởi Hiệp sĩ ${heroId}. Lý do: ${rationale}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      victimIdentifier,
      tag,
      triageCategory,
      rationale,
      parameters: {
        canWalk,
        respirationRate,
        capillaryRefillSeconds,
        mentalStatusFollowsCommands,
      },
      casualtyCounts: incident.mciProtocol.casualtyCounts,
      assignedAt: new Date(),
      assignedBy: heroId,
    };
  }

  /**
   * Phòng Chống Hạ Thân Nhiệt & Tam Chứng Tử Vong Trong Chấn Thương Nặng (PHTLS)
   * Trauma Triad of Death: Hypothermia + Acidosis + Coagulopathy
   */
  async recordHypothermiaShockCare(incidentId, heroId, careData = {}) {
    const {
      coreTemperatureCelsius = 35.8,
      isSpaceBlanketApplied = true,
      shockPositionApplied = true,
      fluidWarmingRequired = true,
    } = careData;

    let traumaTriadRisk = 'LOW';
    if (coreTemperatureCelsius < 35.0) {
      traumaTriadRisk = 'CRITICAL_LETHAL';
    } else if (coreTemperatureCelsius < 36.0) {
      traumaTriadRisk = 'MODERATE';
    }

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    if (!incident.clinicalAssessment) {
      incident.clinicalAssessment = {};
    }

    incident.clinicalAssessment.hypothermiaPrevention = {
      coreTemperatureCelsius,
      isSpaceBlanketApplied,
      spaceBlanketAppliedAt: isSpaceBlanketApplied ? new Date() : null,
      shockPositionApplied,
      fluidWarmingRequired,
      traumaTriadRisk,
    };

    incident.clinicalAssessment.lastEvaluatedAt = new Date();
    incident.markModified('clinicalAssessment');

    incident.auditTrail.push({
      action: 'HYPOTHERMIA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Thân nhiệt: ${coreTemperatureCelsius}°C, Chăn giữ nhiệt: ${isSpaceBlanketApplied ? 'ĐÃ ĐẮP' : 'CHƯA'}, Tư thế chống sốc: ${shockPositionApplied ? 'ĐÃ NÂNG CHÂN' : 'CHƯA'}, Nguy cơ Tam chứng tử vong: ${traumaTriadRisk}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      coreTemperatureCelsius,
      isSpaceBlanketApplied,
      shockPositionApplied,
      fluidWarmingRequired,
      traumaTriadRisk,
      clinicalGuidance:
        traumaTriadRisk === 'CRITICAL_LETHAL'
          ? 'CẢNH BÁO NGUY HIỂM: Thân nhiệt < 35°C kích hoạt rối loạn đông máu! Giữ ấm tích cực bằng chăn tráng bạc, không để nạn nhân nằm trên nền đất ẩm, chuẩn bị truyền dịch ấm 39-42°C khi kíp 115 tiếp cận.'
          : 'Tiếp tục duy trì thân nhiệt ổn định >= 36°C, che chắn gió và theo dõi SpO2 liên tục.',
      evaluatedAt: new Date(),
      evaluatedBy: heroId,
    };
  }

  /**
   * Liệu Pháp Thở Oxy Dòng Cao Ngoại Viện (High-Flow Respiratory Oxygen Therapy)
   */
  async recordRespiratoryOxygenCare(incidentId, heroId, careData = {}) {
    const {
      flowRateLpm = 10,
      deliveryMethod = 'NON_REBREATHER_MASK',
      sourceSafePointId = null,
      cylinderPressureBar = 140,
      preSpo2 = 84,
      postSpo2 = 98,
    } = careData;

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    incident.respiratoryCare = {
      oxygenAdministered: true,
      flowRateLpm,
      deliveryMethod,
      sourceSafePointId,
      cylinderPressureBar,
      preSpo2,
      postSpo2,
      startedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('respiratoryCare');

    incident.auditTrail.push({
      action: 'OXYGEN_THERAPY_ADMINISTERED',
      timestamp: new Date(),
      details: `Thở Oxy ${flowRateLpm} L/phút qua ${deliveryMethod}, SpO2 trước: ${preSpo2}% -> sau: ${postSpo2}%, Bình Oxy: ${cylinderPressureBar} bar`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      oxygenAdministered: true,
      flowRateLpm,
      deliveryMethod,
      preSpo2,
      postSpo2,
      spo2Improvement: postSpo2 - preSpo2,
      cylinderPressureBar,
      clinicalSummary: `Đã thiết lập thở Oxy y tế dòng cao ${flowRateLpm} L/phút qua ${deliveryMethod}. Chỉ số SpO2 phục hồi ngoạn mục từ ${preSpo2}% lên ${postSpo2}%.`,
      administeredAt: incident.respiratoryCare.startedAt,
      administeredBy: heroId,
    };
  }

  /**
   * Can Thiệp Cấp Cứu Sốc Phản Vệ Bằng Bút Tiêm Epinephrine/Adrenaline (Anaphylaxis Care)
   */
  async recordAnaphylaxisEpiPenCare(incidentId, heroId, careData = {}) {
    const {
      doseMg = 0.3,
      injectionSite = 'ANTERIOR_LATERAL_THIGH',
      shockPositionApplied = true,
      patientResponse = 'Thở êm hơn, mạch rõ, huyết áp hồi phục sau 3 phút tiêm',
      sourceSafePointId = null,
    } = careData;

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    incident.anaphylaxisCare = {
      adrenalineInjected: true,
      doseMg,
      injectionSite,
      injectedAt: new Date(),
      shockPositionApplied,
      patientResponse,
      sourceSafePointId,
      administeredBy: heroId,
    };
    incident.markModified('anaphylaxisCare');

    incident.auditTrail.push({
      action: 'ANAPHYLAXIS_EPIPEN_INJECTED',
      timestamp: new Date(),
      details: `Tiêm bắp Epinephrine ${doseMg}mg tại ${injectionSite}, Tư thế chống tụt HA: ${shockPositionApplied ? 'ĐÃ NÂNG CHÂN' : 'CHƯA'}, Đáp ứng: ${patientResponse}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      adrenalineInjected: true,
      doseMg,
      injectionSite,
      shockPositionApplied,
      patientResponse,
      clinicalGuidance:
        'CẢNH BÁO Y KHOA: Sau tiêm Epinephrine cần giữ nạn nhân ở tư thế nằm nâng chân 30 độ. TUYỆT ĐỐI KHÔNG cho ngồi dậy đột ngột để tránh hội chứng tim rỗng gây ngừng tuần hoàn cấp. Chuẩn bị liều tiêm thứ hai sau 5-15 phút nếu triệu chứng không thuyên giảm.',
      injectedAt: incident.anaphylaxisCare.injectedAt,
      administeredBy: heroId,
    };
  }

  /**
   * Cấp Cứu Đuối Nước & Ngạt Nước (AHA/ERC Aquatic Life Support)
   * Bắt buộc 5 nhịp thổi ngạt cứu mạng ban đầu (5 Initial Rescue Breaths) trước khi ép tim 30:2
   */
  async recordDrowningRescueCare(incidentId, heroId, careData = {}) {
    const {
      submersionMinutes = 3,
      waterType = 'FRESH_WATER',
      fiveInitialRescueBreathsGiven = true,
    } = careData;

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    if (!fiveInitialRescueBreathsGiven) {
      throw new Error('QUY TRÌNH BẮT BUỘC: Ngừng tuần hoàn do đuối nước là ngừng tuần hoàn do thiếu oxy (Hypoxic Arrest). Phải thổi ngạt 5 nhịp ban đầu trước khi ép tim!');
    }

    incident.drowningCare = {
      isSubmersion: true,
      submersionMinutes,
      waterType,
      fiveInitialRescueBreathsGiven: true,
      breathsGivenAt: new Date(),
      secondaryDrowningMonitoring24h: {
        active: false,
        startedAt: null,
        spo2Checkpoints: [],
        pulmonaryEdemaAlert: false,
      },
      administeredBy: heroId,
    };
    incident.markModified('drowningCare');

    incident.auditTrail.push({
      action: 'DROWNING_RESCUE_PROTOCOLS_EXECUTED',
      timestamp: new Date(),
      details: `Đuối nước ${waterType === 'FRESH_WATER' ? 'nước ngọt' : 'nước mặn'}, Chìm: ${submersionMinutes} phút, Đã thổi ngạt 5 nhịp ban đầu cứu mạng, Chu kỳ CPR: 30 ép tim : 2 thổi ngạt`,
    });

    await incident.save();

    const pathophysiologyGuidance = waterType === 'FRESH_WATER'
      ? 'Đuối nước nước ngọt: Nước nhanh chóng hấp thu vào tuần hoàn gây pha loãng máu, tan máu và tăng kali máu. Theo dõi nhịp tim sát sao.'
      : 'Đuối nước nước mặn: Nước muối ưu trương hút dịch từ lòng mạch vào phế nang gây phù phổi cấp tối cấp. Bắt buộc thở oxy nồng độ cao.';

    return {
      success: true,
      incidentId: incident._id,
      waterType,
      submersionMinutes,
      fiveInitialRescueBreathsGiven: true,
      pathophysiologyGuidance,
      clinicalInstruction: 'TUYỆT ĐỐI KHÔNG dốc ngược nạn nhân hoặc ép bụng tống nước (dễ gây hít sặc dịch dạ dày vào phổi). Tiếp tục chu kỳ 30 ép tim : 2 thổi ngạt cho đến khi kíp 115 có mặt.',
      administeredAt: incident.drowningCare.breathsGivenAt,
      administeredBy: heroId,
    };
  }

  /**
   * Kích Hoạt Giám Sát 24h Đuối Nước Thứ Phát (Secondary Drowning & Late Pulmonary Edema Watchdog)
   */
  async initiateSecondaryDrowningWatchdog(incidentId, heroId) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    if (!incident.drowningCare) {
      incident.drowningCare = { isSubmersion: true };
    }

    incident.drowningCare.secondaryDrowningMonitoring24h = {
      active: true,
      startedAt: new Date(),
      spo2Checkpoints: [
        {
          checkedAt: new Date(),
          spo2Percent: 96,
          respiratoryRateBpm: 18,
          note: 'Mốc T+0h: Nạn nhân tỉnh, phổi thông khí rõ, chưa có ran ẩm',
        },
      ],
      pulmonaryEdemaAlert: false,
    };
    incident.markModified('drowningCare');

    incident.auditTrail.push({
      action: 'SECONDARY_DROWNING_WATCHDOG_ACTIVATED',
      timestamp: new Date(),
      details: 'Kích hoạt giám sát SpO2 & nhịp thở 24h phòng ngừa suy hô hấp muộn do mất chất hoạt diện surfactant',
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      monitoringActive: true,
      initialSpo2: 96,
      message: 'Đã kích hoạt chế độ giám sát 24h chống Đuối Nước Thứ Phát (Secondary Drowning). Cảnh báo SpO2 định kỳ 4 tiếng/lần.',
    };
  }

  /**
   * Cập Nhật Mốc Đo SpO2 & Cảnh Báo Phù Phổi Cấp Muộn (Pulmonary Edema Alert)
   */
  async recordSecondaryDrowningCheckpoint(incidentId, checkpointData = {}) {
    const { spo2Percent = 90, respiratoryRateBpm = 28, note = 'Thở nhanh nông, ho khan có bọt hồng' } = checkpointData;

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const isAlert = spo2Percent < 92 || respiratoryRateBpm > 26;

    if (!incident.drowningCare.secondaryDrowningMonitoring24h.spo2Checkpoints) {
      incident.drowningCare.secondaryDrowningMonitoring24h.spo2Checkpoints = [];
    }

    incident.drowningCare.secondaryDrowningMonitoring24h.spo2Checkpoints.push({
      checkedAt: new Date(),
      spo2Percent,
      respiratoryRateBpm,
      note,
    });

    incident.drowningCare.secondaryDrowningMonitoring24h.pulmonaryEdemaAlert = isAlert;
    incident.markModified('drowningCare');

    if (isAlert) {
      incident.auditTrail.push({
        action: 'PULMONARY_EDEMA_ALERT_TRIGGERED',
        timestamp: new Date(),
        details: `BÁO ĐỘNG ĐỎ ĐUỐI NƯỚC THỨ PHÁT: SpO2 tụt xuống ${spo2Percent}%, nhịp thở ${respiratoryRateBpm} l/p. Nguy cơ phù phổi cấp tiến triển!`,
      });
    }

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      spo2Percent,
      respiratoryRateBpm,
      pulmonaryEdemaAlert: isAlert,
      clinicalAlert: isAlert
        ? 'CẢNH BÁO NGUY CẤP: Dấu hiệu suy hô hấp muộn & phù phổi cấp do nước vào phế nang làm hỏng surfactant! Cần cho thở máy CPAP áp lực dương và chuyển viện cấp cứu tức thì.'
        : 'Chỉ số hô hấp trong giới hạn an toàn. Tiếp tục theo dõi đủ 24 giờ sau tai nạn.',
    };
  }

  /**
   * Phân Loại & Điều Trị Say Nắng, Sốc Nhiệt Đô Thị (Heatstroke Active Cooling Protocol)
   */
  async triageAndTreatHeatstroke(incidentId, heroId, treatmentData = {}) {
    const {
      initialCoreTempCelsius = 40.8,
      currentCoreTempCelsius = 38.3,
      isExertional = true,
      coolingMethods = ['ICE_PACKS_AXILLA_GROIN_NECK', 'EVAPORATIVE_MIST_FAN'],
      electrolytesRehydrated = true,
    } = treatmentData;

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const classification = initialCoreTempCelsius >= 40.0
      ? (isExertional ? 'EXERTIONAL_HEATSTROKE' : 'CLASSIC_HEATSTROKE')
      : 'HEAT_EXHAUSTION';

    const targetTempReached = currentCoreTempCelsius < 38.5;

    incident.heatstrokeCare = {
      isHeatstroke: true,
      initialCoreTempCelsius,
      currentCoreTempCelsius,
      classification,
      activeCoolingMethods: coolingMethods,
      antipyreticsContraindicatedAcknowledged: true,
      targetTempReached,
      electrolytesRehydrated,
      startedAt: new Date(Date.now() - 25 * 60 * 1000),
      cooledAt: targetTempReached ? new Date() : null,
      administeredBy: heroId,
    };
    incident.markModified('heatstrokeCare');

    incident.auditTrail.push({
      action: 'HEATSTROKE_ACTIVE_COOLING_APPLIED',
      timestamp: new Date(),
      details: `Phân loại: ${classification}, Thân nhiệt ban đầu: ${initialCoreTempCelsius}°C -> Hiện tại: ${currentCoreTempCelsius}°C, Hạ nhiệt tích cực: ${coolingMethods.join(', ')}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      classification,
      initialCoreTempCelsius,
      currentCoreTempCelsius,
      temperatureDroppedCelsius: parseFloat((initialCoreTempCelsius - currentCoreTempCelsius).toFixed(1)),
      targetTempReached,
      coolingMethods,
      warningContraindications: 'TUYỆT ĐỐI CHỐNG CHỈ ĐỊNH: Không cho uống Paracetamol hoặc Aspirin vì sốc nhiệt không do chất gây sốt nội sinh Pyrogen; thuốc hạ sốt gây độc gan và làm nặng thêm rối loạn đông máu.',
      clinicalOutcome: targetTempReached
        ? 'Hạ nhiệt thành công trong 30 phút vàng! Thân nhiệt đã giảm dưới 38.5°C, giảm thiểu nguy cơ tổn thương não và hoại tử tế bào gan.'
        : 'Cần tiếp tục chườm đá lạnh tích cực vào các vị trí mạch máu lớn (nách, bẹn, cổ) cho đến khi thân nhiệt < 38.5°C.',
    };
  }

  /**
   * Đánh Giá Lâm Sàng Đột Quỵ Não Cấp & Thang Điểm FAST-ED Tắc Mạch Lớn LVO
   * (Field Assessment Stroke Triage for Emergency Destination)
   */
  async evaluateFastEdStroke(incidentId, heroId, strokeData = {}) {
    const {
      lastKnownWellMinutesAgo = 60,
      facialPalsy = 1, // 0-1
      armWeakness = 2, // 0-2 (0: bình thường, 1: rơi nhẹ, 2: rơi nhanh/liệt hoàn toàn)
      speechChanges = 1, // 0-2 (0: bình thường, 1: nói khó, 2: câm/không hiểu lời)
      eyeDeviation = 1, // 0-2 (0: bình thường, 1: mắt nhìn lệch về 1 bên)
      denialNeglect = 0, // 0-2 (0: bình thường, 1: không nhận ra tay liệt)
    } = strokeData;

    const totalScore = facialPalsy + armWeakness + speechChanges + eyeDeviation + denialNeglect;
    const isLVO = totalScore >= 4; // Ngưỡng chẩn đoán tắc mạch máu lớn độ nhạy/đặc hiệu cao
    const goldenWindowRemainingMinutes = Math.max(0, 270 - lastKnownWellMinutesAgo); // Cửa sổ tiêu sợi huyết 4.5h = 270 phút

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    incident.acuteStrokeCare = {
      isSuspectedStroke: true,
      lastKnownWellAt: new Date(Date.now() - lastKnownWellMinutesAgo * 60 * 1000),
      goldenWindowRemainingMinutes,
      fastEdScore: {
        facialPalsy,
        armWeakness,
        speechChanges,
        eyeDeviation,
        denialNeglect,
        totalScore,
      },
      isLargeVesselOcclusionRisk: isLVO,
      strokeCodeRedActive: isLVO,
      designatedStrokeCenterCode: isLVO ? 'BV_115' : 'BV_DISTRICT_ED',
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('acuteStrokeCare');

    incident.auditTrail.push({
      action: 'FAST_ED_STROKE_EVALUATED',
      timestamp: new Date(),
      details: `FAST-ED Điểm: ${totalScore}/9, Nguy cơ Tắc Mạch Lớn (LVO): ${isLVO ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}, Thời gian vàng còn lại: ${goldenWindowRemainingMinutes} phút`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      fastEdScore: {
        facialPalsy,
        armWeakness,
        speechChanges,
        eyeDeviation,
        denialNeglect,
        totalScore,
      },
      isLargeVesselOcclusionRisk: isLVO,
      strokeCodeRedActive: isLVO,
      goldenWindowRemainingMinutes,
      isWithinIvTpaWindow: goldenWindowRemainingMinutes > 0,
      recommendedDestination: isLVO
        ? 'BẮT BUỘC CHUYỂN BỆNH VIỆN CÓ TRUNG TÂM CAN THIỆP MẠCH NÃO (Comprehensive Stroke Center: BV Nhân Dân 115 / BV Chợ Rẫy) để lấy huyết khối cơ học bằng dụng cụ trong cửa sổ 6-24 giờ.'
        : 'Chuyển Bệnh viện gần nhất có khả năng chụp CT sọ não và truyền thuốc tiêu sợi huyết rtPA.',
    };
  }

  /**
   * Cấp cứu rắn độc cắn & Phân loại Thần kinh vs Huyết học (Phân hệ 25)
   */
  async recordSnakebiteAssessmentAndTriage(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      biteLocation = 'Chi dưới',
      snakeFamily = 'ELAPIDAE_NEUROTOXIC', // ELAPIDAE_NEUROTOXIC (Họ rắn hổ) vs VIPERIDAE_HEMOTOXIC (Họ rắn lục)
      pressureImmobilizationApplied = false,
      tourniquetContraindicatedAcknowledged = true,
      incisionAndSuctionStrictlyProhibited = true,
      systemicSymptoms = {},
    } = payload;

    const isNeurotoxic = snakeFamily === 'ELAPIDAE_NEUROTOXIC';
    const isHemotoxic = snakeFamily === 'VIPERIDAE_HEMOTOXIC';

    // Rắn hổ (thần kinh): BẮT BUỘC băng ép bất động PIT (Pressure Immobilization Technique 40-70 mmHg)
    // Rắn lục (huyết học): CHỐNG CHỈ ĐỊNH băng ép PIT (gây hội chứng khoang & hoại tử cơ), nẹp cố định lỏng ngang tim
    let firstAidGuidance = '';
    let antivenomType = 'POLYVALENT';

    if (isNeurotoxic) {
      antivenomType = 'COBRA_ELAPIDAE';
      firstAidGuidance =
        'ĐỘC TỐ THẦN KINH (RẮN HỔ/CẠP NIA): Bắt buộc băng ép thun bản rộng từ ngọn chi lên gốc chi (áp lực 40-70 mmHg, vừa luồn ngón tay) và nẹp bất động toàn bộ chi. Giám sát sát sao sụp mi mắt và liệt cơ hô hấp!';
    } else if (isHemotoxic) {
      antivenomType = 'VIPER_GREEN_PIT';
      firstAidGuidance =
        'ĐỘC TỐ TẾ BÀO/XUẤT HUYẾT (RẮN LỤC/TRÀM QUẠP): TUYỆT ĐỐI KHÔNG BĂNG ÉP CHẶT HOẶC GARÔ (nguy cơ hoại tử chi và hội chứng khoang). Nẹp cố định chi lỏng, để chi ngang tầm tim, tháo bỏ nhẫn/vòng tay.';
    } else {
      firstAidGuidance = 'RẮN KHÔNG RÕ LOẠI: Nẹp bất động chi, cấm rạch chích rạch nặn nọc hay giác hút, chuyển ngay trung tâm chống độc.';
    }

    incident.snakebiteCare = {
      isSnakebite: true,
      biteLocation,
      snakeFamily,
      pressureImmobilizationApplied: isNeurotoxic ? pressureImmobilizationApplied : false,
      tourniquetContraindicatedAcknowledged,
      incisionAndSuctionStrictlyProhibited,
      systemicSymptoms: {
        ptosisEyes: !!systemicSymptoms.ptosisEyes,
        dysphagia: !!systemicSymptoms.dysphagia,
        dyspnea: !!systemicSymptoms.dyspnea,
        activeBleeding: !!systemicSymptoms.activeBleeding,
        localSwellingSpread: !!systemicSymptoms.localSwellingSpread,
      },
      antivenomHospitalRecommended: isNeurotoxic ? 'BV_CHO_RAY' : 'BV_115',
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('snakebiteCare');

    incident.auditTrail.push({
      action: 'SNAKEBITE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Họ rắn: ${snakeFamily}, Băng ép PIT: ${incident.snakebiteCare.pressureImmobilizationApplied ? 'ĐÃ ÁP DỤNG' : 'CHỐNG CHỈ ĐỊNH'}, Chống chỉ định Garô & Rạch hút nọc: ĐÃ XÁC NHẬN`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      snakeFamily,
      isNeurotoxic,
      isHemotoxic,
      pressureImmobilizationApplied: incident.snakebiteCare.pressureImmobilizationApplied,
      firstAidGuidance,
      antivenomType,
      recommendedDestination: 'Chuyển thẳng Trung tâm Chống độc BV Chợ Rẫy hoặc Khoa Hồi sức Cấp cứu BV Nhân Dân 115 có sẵn Huyết thanh kháng nọc đặc hiệu.',
    };
  }

  /**
   * Sơ cứu bỏng nhiệt, bỏng hóa chất, quy tắc số 9 & Công thức Parkland (Phân hệ 26)
   */
  async triageAndManageBurnInjury(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const burnEtiology = payload.burnType || payload.burnEtiology || 'THERMAL_FLAME';
    const waterIrrigation20MinApplied = payload.coolingWithTapWater20MinDone !== undefined 
      ? Boolean(payload.coolingWithTapWater20MinDone) 
      : Boolean(payload.waterIrrigation20MinApplied ?? true);
    const patientWeightKg = Number(payload.patientWeightKg) || 65;
    const inhalationInjurySuspected = Boolean(payload.hasInhalationBurnSigns || payload.inhalationInjurySuspected);
    const burnDegree = payload.burnDegree || 'SECOND_DEGREE_PARTIAL';
    const sterileCoverApplied = Boolean(payload.sterileCoverApplied ?? true);

    // Tính diện tích bỏng theo Quy tắc số 9 (Wallace Rule of Nines)
    const AREA_NINES_MAP = {
      HEAD_NECK_9: 9,
      CHEST_ABDOMEN_18: 18,
      BACK_18: 18,
      RIGHT_ARM_9: 9,
      LEFT_ARM_9: 9,
      RIGHT_LEG_18: 18,
      LEFT_LEG_18: 18,
      PERINEUM_1: 1,
    };

    let tbsaPercentage = Number(payload.tbsaPercentage) || 0;
    if (Array.isArray(payload.affectedBodyAreas) && payload.affectedBodyAreas.length > 0) {
      tbsaPercentage = payload.affectedBodyAreas.reduce((sum, area) => sum + (AREA_NINES_MAP[area] || 0), 0);
    } else if (!tbsaPercentage) {
      tbsaPercentage = 25;
    }

    // Tính toán phác đồ bù dịch Parkland: 4 mL * Cân nặng (kg) * % TBSA
    // 50% tổng dịch truyền trong 8 giờ đầu tính từ thời điểm bị bỏng
    const totalFluid24hMl = Math.round(4 * patientWeightKg * tbsaPercentage);
    const first8hFluidMl = Math.round(totalFluid24hMl / 2);
    const hourlyRateFirst8hMlPerHour = Math.floor(first8hFluidMl / 8);

    const isSevereBurn = tbsaPercentage >= 20 || burnDegree === 'THIRD_DEGREE_FULL_THICKNESS' || inhalationInjurySuspected;

    incident.burnCare = {
      isBurnInjury: true,
      burnEtiology,
      tbsaPercentage,
      totalBodySurfaceAreaPercent: tbsaPercentage,
      burnDegree,
      waterIrrigation20MinApplied,
      coolingWithTapWater20MinDone: waterIrrigation20MinApplied,
      iceDirectApplicationProhibited: true,
      folkRemediesProhibited: true,
      inhalationInjurySuspected,
      parklandFormula: {
        patientWeightKg,
        totalFluid24hMl,
        total24hFluidMl: totalFluid24hMl,
        first8hFluidMl,
        first8hFluidRateMlPerHour: hourlyRateFirst8hMlPerHour,
        hourlyRateFirst8hMlPerHour,
      },
      sterileCoverApplied,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('burnCare');

    incident.auditTrail.push({
      action: 'BURN_CARE_RECORDED',
      timestamp: new Date(),
      details: `Bỏng: ${burnEtiology}, Diện tích: ${tbsaPercentage}% TBSA, Độ: ${burnDegree}, Parkland 24h: ${totalFluid24hMl}mL (8h đầu: ${hourlyRateFirst8hMlPerHour}mL/h), Bỏng đường thở: ${inhalationInjurySuspected ? 'CẢNH BÁO ĐỎ' : 'BÌNH THƯỜNG'}`,
    });

    await incident.save();

    const directives = [
      '1. Tưới nước sạch mát (15-20°C) liên tục 20 phút. TUYỆT ĐỐI KHÔNG DÙNG NƯỚC ĐÁ (gây co mạch làm sâu thêm độ bỏng).',
      '2. TUYỆT ĐỐI KHÔNG BÔI MỠ TRĂN, KEM ĐÁNH RĂNG, NƯỚC MẮM HAY THUỐC NAM LÊN VẾT BỎNG.',
      '3. Đắp màng bọc thực phẩm sạch / gạc ẩm vô trùng che phủ, giữ ấm toàn thân chống hạ thân nhiệt.',
      inhalationInjurySuspected
        ? '4. CẢNH BÁO NGUY HIỂM: BỎNG ĐƯỜNG HÔ HẤP (lông mũi cháy/đờm than). Chuẩn bị đặt nội khí quản sớm trước khi phù nề thanh quản đóng kín đường thở!'
        : '4. Duy trì truyền dịch Ringer Lactate theo công thức Parkland.',
    ];

    return {
      success: true,
      incidentId: incident._id,
      burnEtiology,
      tbsaPercentage,
      totalBodySurfaceAreaPercent: tbsaPercentage,
      burnDegree,
      isSevereBurn,
      waterIrrigation20MinApplied,
      coolingDone: waterIrrigation20MinApplied,
      inhalationInjurySuspected,
      inhalationInjuryDetected: inhalationInjurySuspected,
      parklandFormula: {
        patientWeightKg,
        totalFluid24hMl,
        total24hFluidMl: totalFluid24hMl,
        first8hFluidMl,
        first8hFluidRateMlPerHour: hourlyRateFirst8hMlPerHour,
        hourlyRateFirst8hMlPerHour,
      },
      clinicalActionDirectives: directives,
      clinicalInstructions: directives.join('\n'),
    };
  }

  /**
   * Cứu hộ sập đổ công trình & Phòng chống Hội chứng Vùi lấp (USAR Crush Syndrome) (Phân hệ 27)
   */
  async manageCrushSyndromeExtrication(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      trappedStructure = 'Dầm bê tông sập đổ',
      trappedMuscleGroup = 'BILATERAL_LOWER_EXTREMITIES',
      compressionDurationMinutes = 150,
      ivHydrationPreExtricationStarted = true,
      ivFluidRateMlPerHour = 1000,
      provisionalTourniquetAppliedBeforeLifting = false,
      urineOutputMonitored = false,
      urineColorTeaOrCola = false,
    } = payload;

    // Đánh giá nguy cơ Tiêu cơ vân & Hội chứng vùi lấp (Crush Syndrome)
    // Thời gian đè ép >= 120 phút (2 giờ) trên nhóm cơ lớn (2 chi dưới / đùi) -> NGUY CƠ RẤT CAO
    let crushSyndromeRisk = 'LOW_UNDER_2_HOURS';
    let rhabdomyolysisRisk = 'LOW';
    if (compressionDurationMinutes >= 120) {
      crushSyndromeRisk = 'HIGH_CRITICAL_RHABDOMYOLYSIS';
      rhabdomyolysisRisk = 'HIGH';
    } else if (compressionDurationMinutes >= 60) {
      crushSyndromeRisk = 'MODERATE';
      rhabdomyolysisRisk = 'MODERATE';
    }

    const myoglobinuriaDetected = Boolean(urineColorTeaOrCola);

    // "Cái chết sau giải phóng vùi lấp" (Smile of Death / Reperfusion Cardiac Arrest)
    // Xảy ra khi nhấc vật nặng mà chưa truyền dịch hoặc chưa đặt garô tạm thời
    const reperfusionCardiacArrestPrevented = Boolean(ivHydrationPreExtricationStarted || provisionalTourniquetAppliedBeforeLifting);

    incident.crushInjuryCare = {
      isCrushInjury: true,
      trappedStructure,
      trappedMuscleGroup,
      compressionDurationMinutes,
      crushSyndromeRisk,
      rhabdomyolysisRisk,
      ivHydrationPreExtricationStarted: Boolean(ivHydrationPreExtricationStarted),
      ivFluidRateMlPerHour,
      provisionalTourniquetAppliedBeforeLifting: Boolean(provisionalTourniquetAppliedBeforeLifting),
      reperfusionCardiacArrestPrevented,
      urineOutputMonitored: Boolean(urineOutputMonitored),
      myoglobinuriaDetected,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('crushInjuryCare');

    incident.auditTrail.push({
      action: 'CRUSH_SYNDROME_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vùi lấp: ${trappedStructure}, Thời gian ép: ${compressionDurationMinutes} phút, Nguy cơ tiêu cơ vân: ${rhabdomyolysisRisk}, Truyền dịch trước nhấc vật: ${ivHydrationPreExtricationStarted ? 'ĐÃ THỰC HIỆN' : 'CHƯA'}, Phòng ngừa ngừng tim tái tưới máu: ${reperfusionCardiacArrestPrevented ? 'ĐẠT' : 'NGUY CƠ CAO'}, Myoglobin niệu: ${myoglobinuriaDetected ? 'CẢNH BÁO' : 'BÌNH THƯỜNG'}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      compressionDurationMinutes,
      crushSyndromeRisk,
      rhabdomyolysisRisk,
      ivHydrationPreExtricationStarted: Boolean(ivHydrationPreExtricationStarted),
      provisionalTourniquetAppliedBeforeLifting: Boolean(provisionalTourniquetAppliedBeforeLifting),
      reperfusionCardiacArrestPrevented,
      urineOutputMonitored: Boolean(urineOutputMonitored),
      myoglobinuriaDetected,
      usarRescueDirective:
        'NGUYÊN TẮC VÀNG VÙI LẤP: Thiết lập đường truyền tĩnh mạch và truyền Normal Saline 1000 mL/h TRƯỚC KHI nâng dầm bê tông giải phóng chi đè ép. Ngăn chặn dòng máu nhiễm axit lactic và Kali ồ ạt dồn về tim gây rung thất ngừng tim tức thì.',
    };
  }

  /**
   * Cấp cứu Tràn khí màng phổi áp lực & Chấn thương ngực hở (Phân hệ 28)
   */
  async manageTensionPneumothoraxAndChestTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      hasSuckingChestWound = false,
      ventedChestSealApplied = false,
      chestSealBurped = false,
      tensionPneumothoraxSuspected = false,
      needleDecompressionPerformed = false,
      needleInsertionSite = '2ND_ICS_MIDCLAVICULAR',
      needleGauge = '14G',
      airHissDecompressionConfirmed = false,
    } = payload;

    const hemodynamicStabilized = Boolean(
      (needleDecompressionPerformed && airHissDecompressionConfirmed) ||
      (ventedChestSealApplied && !tensionPneumothoraxSuspected) ||
      chestSealBurped
    );

    incident.chestTraumaCare = {
      isChestTrauma: true,
      hasSuckingChestWound: Boolean(hasSuckingChestWound),
      ventedChestSealApplied: Boolean(ventedChestSealApplied),
      chestSealBurped: Boolean(chestSealBurped),
      tensionPneumothoraxSuspected: Boolean(tensionPneumothoraxSuspected),
      needleDecompressionPerformed: Boolean(needleDecompressionPerformed),
      needleInsertionSite,
      needleGauge,
      airHissDecompressionConfirmed: Boolean(airHissDecompressionConfirmed),
      hemodynamicStabilized,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('chestTraumaCare');

    incident.auditTrail.push({
      action: 'CHEST_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương ngực: Hở=${hasSuckingChestWound}, Băng van 1 chiều=${ventedChestSealApplied}, Xả van=${chestSealBurped}, Tràn khí áp lực=${tensionPneumothoraxSuspected}, Chọc kim giải áp=${needleDecompressionPerformed} (${needleGauge} tại ${needleInsertionSite}), Tiếng rít xì hơi giải áp=${airHissDecompressionConfirmed ? 'ĐẠT' : 'CHƯA'}`,
    });

    await incident.save();

    const directives = [
      '1. Vết thương ngực hở (Sucking Chest Wound): Dán ngay Băng dán ngực có van thoát khí một chiều (Vented Chest Seal).',
      '2. Kỹ thuật "Burp" (Xả van): Nếu nạn nhân khó thở tăng dần hoặc tụt huyết áp sau khi dán, bóc nhẹ một mép băng để xả khí và máu đọng rồi dán lại.',
      tensionPneumothoraxSuspected
        ? '3. CẢNH BÁO NGUY HIỂM: Tràn khí màng phổi áp lực (Tension Pneumothorax). Khẩn cấp chọc kim giải áp 14G hoặc 10G tại Khoang liên sườn 2 đường trung đòn (ngay trên bờ trên xương sườn 3) hoặc Khoang liên sườn 5 đường nách trước!'
        : '3. Giữ tư thế Fowler nửa nằm nửa ngồi nếu tỉnh táo, thở oxy lưu lượng cao 15 L/phút qua Mask túi.',
    ];

    return {
      success: true,
      incidentId: incident._id,
      hasSuckingChestWound: Boolean(hasSuckingChestWound),
      ventedChestSealApplied: Boolean(ventedChestSealApplied),
      chestSealBurped: Boolean(chestSealBurped),
      tensionPneumothoraxSuspected: Boolean(tensionPneumothoraxSuspected),
      needleDecompressionPerformed: Boolean(needleDecompressionPerformed),
      needleInsertionSite,
      needleGauge,
      airHissDecompressionConfirmed: Boolean(airHissDecompressionConfirmed),
      hemodynamicStabilized,
      clinicalDirectives: directives,
      guidanceMessage: airHissDecompressionConfirmed
        ? 'Đã nghe tiếng xì hơi giải áp thành công (Air Hiss Confirmed). Áp lực khoang màng phổi được giải tỏa, nhịp tim và huyết áp bắt đầu hồi phục.'
        : 'Theo dõi sát dấu hiệu sinh tồn và độ bão hòa oxy SpO2 liên tục trong quá trình chuyển viện khẩn cấp.',
    };
  }

  /**
   * Bất động cột sống cổ ngoại viện & Phân biệt sốc thần kinh vs sốc mất máu (Phân hệ 29)
   */
  async manageSpinalMotionRestrictionAndNeurogenicShock(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      mechanismHighRisk = false,
      patientAge = 35,
      extremityParesthesia = false,
      cervicalCollarApplied = false,
      cervicalCollarSize = 'REGULAR',
      manualInLineStabilizationMaintained = true,
      logRollTechniqueUsed = true,
      vacuumMattressSecured = false,
      systolicBp = 110,
      heartRateBpm = 80,
      skinCondition = 'WARM_DRY_PINK',
    } = payload;

    // Đánh giá tiêu chí Canadian C-Spine Rule
    // Yếu tố nguy cơ cao: Tuổi >= 65, Cơ chế chấn thương nguy hiểm (té ngã > 1m, tai nạn > 60km/h), hoặc tê bì kiến bò tứ chi
    let canadianCSpineRisk = 'NO_SMR_NEEDED';
    if (patientAge >= 65 || mechanismHighRisk || extremityParesthesia) {
      canadianCSpineRisk = 'HIGH_RISK_MANDATORY_COLLAR';
    } else {
      canadianCSpineRisk = 'LOW_RISK_ASSESS_RANGE';
    }

    // Phân biệt Sốc Thần Kinh (Neurogenic Shock) vs Sốc Mất Máu (Hypovolemic Shock)
    // Sốc thần kinh: Huyết áp tụt (SBP < 90) KÈM nhịp tim chậm (HR < 60) và da ấm hồng khô do giãn mạch mất trương lực giao cảm
    // Sốc mất máu: Huyết áp tụt (SBP < 90) KÈM nhịp tim nhanh (HR > 100) và da tái lạnh ẩm ướt
    let shockType = 'NONE';
    let neurogenicShockSuspected = false;
    if (systolicBp < 90 && heartRateBpm < 60 && skinCondition === 'WARM_DRY_PINK') {
      shockType = 'NEUROGENIC_WARM_BRADYCARDIC';
      neurogenicShockSuspected = true;
    } else if (systolicBp < 90 && heartRateBpm > 100) {
      shockType = 'HYPOVOLEMIC_COLD_TACHYCARDIC';
    }

    incident.spinalTraumaCare = {
      isSpinalTrauma: true,
      canadianCSpineRisk,
      mechanismHighRisk: Boolean(mechanismHighRisk),
      extremityParesthesia: Boolean(extremityParesthesia),
      cervicalCollarApplied: Boolean(cervicalCollarApplied),
      cervicalCollarSize,
      manualInLineStabilizationMaintained: Boolean(manualInLineStabilizationMaintained),
      logRollTechniqueUsed: Boolean(logRollTechniqueUsed),
      vacuumMattressSecured: Boolean(vacuumMattressSecured),
      neurogenicShockSuspected,
      shockType,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('spinalTraumaCare');

    incident.auditTrail.push({
      action: 'SPINAL_MOTION_RESTRICTION_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương cột sống: Canadian C-Spine=${canadianCSpineRisk}, Nẹp cổ=${cervicalCollarApplied} (Cỡ ${cervicalCollarSize}), MILS=${manualInLineStabilizationMaintained}, Lăn khúc gỗ=${logRollTechniqueUsed}, Sốc=${shockType} (HA: ${systolicBp}, Mạch: ${heartRateBpm})`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      canadianCSpineRisk,
      cervicalCollarApplied: Boolean(cervicalCollarApplied),
      cervicalCollarSize,
      manualInLineStabilizationMaintained: Boolean(manualInLineStabilizationMaintained),
      logRollTechniqueUsed: Boolean(logRollTechniqueUsed),
      neurogenicShockSuspected,
      shockType,
      smrGuidance:
        canadianCSpineRisk === 'HIGH_RISK_MANDATORY_COLLAR'
          ? 'BẮT BUỘC BẤT ĐỘNG CỘT SỐNG (SMR): Duy trì nẹp cổ cứng cỡ chuẩn kết hợp cố định đầu MILS liên tục. Tuyệt đối không gập, ngửa hoặc xoay đầu nạn nhân.'
          : 'Nguy cơ cột sống thấp, đánh giá tầm vận động cổ chủ động 45 độ.',
      shockDirectives: neurogenicShockSuspected
        ? 'CẢNH BÁO SỐC THẦN KINH: Huyết áp tụt kèm nhịp tim chậm và da ấm. Chuẩn bị truyền dịch dịch tinh thể kiểm soát và thuốc vận mạch Noradrenaline / Dopamine theo chỉ lệnh bác sĩ 115.'
        : shockType === 'HYPOVOLEMIC_COLD_TACHYCARDIC'
        ? 'CẢNH BÁO SỐC MẤT MÁU: Huyết áp tụt kèm nhịp tim nhanh và da tái lạnh. Tìm ngay điểm xuất huyết ngoại và ép chặt garô/băng ép cầm máu.'
        : 'Huyết động hiện tại ổn định.',
    };
  }

  /**
   * Cấp cứu hạ đường huyết nặng & Hôn mê tiểu đường ở người độc thân (Phân hệ 30)
   */
  async triageAndManageDiabeticEmergency(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const bloodGlucoseMmolL = Number(payload.bloodGlucoseMmolL) || (payload.bloodGlucoseMgDl ? Math.round((payload.bloodGlucoseMgDl / 18) * 10) / 10 : 5.5);
    const bloodGlucoseMgDl = Math.round(bloodGlucoseMmolL * 18);
    const isConscious = Boolean(payload.isConscious ?? true);
    const swallowReflexIntact = Boolean(payload.swallowReflexIntact ?? isConscious);

    // Phân loại mức độ hạ đường huyết
    let hypoglycemiaSeverity = 'NORMAL';
    if (bloodGlucoseMmolL < 2.8) {
      hypoglycemiaSeverity = 'SEVERE_COMA_NEUROGLYCOPENIC';
    } else if (bloodGlucoseMmolL < 3.9) {
      hypoglycemiaSeverity = 'MILD_MODERATE';
    }

    // Nghiêm cấm cho uống nước đường nếu lơ mơ / hôn mê / mất phản xạ nuốt (chống sặc phổi tử vong)
    const oralIntakeContraindicated = !isConscious || !swallowReflexIntact;

    let ruleOf15Applied = false;
    let glucagonOrIvDextroseAdministered = false;
    let medicationType = 'NONE';

    if (payload.medicationType) {
      medicationType = payload.medicationType;
    }

    if (hypoglycemiaSeverity === 'SEVERE_COMA_NEUROGLYCOPENIC' || oralIntakeContraindicated) {
      glucagonOrIvDextroseAdministered = Boolean(payload.glucagonOrIvDextroseAdministered ?? true);
      if (medicationType === 'NONE') {
        medicationType = payload.medicationType || 'GLUCAGON_1MG_IM';
      }
    } else if (hypoglycemiaSeverity === 'MILD_MODERATE' && isConscious) {
      ruleOf15Applied = Boolean(payload.ruleOf15Applied ?? true);
      medicationType = 'ORAL_15G_CARBS';
    }

    const postTreatmentGlucoseMmolL = payload.postTreatmentGlucoseMmolL !== undefined
      ? Number(payload.postTreatmentGlucoseMmolL)
      : null;
    const patientConsciousnessRegained = Boolean(postTreatmentGlucoseMmolL && postTreatmentGlucoseMmolL >= 5.0);

    incident.diabeticEmergencyCare = {
      isDiabeticEmergency: true,
      bloodGlucoseMmolL,
      bloodGlucoseMgDl,
      hypoglycemiaSeverity,
      ruleOf15Applied,
      oralIntakeContraindicated,
      glucagonOrIvDextroseAdministered,
      medicationType,
      postTreatmentGlucoseMmolL,
      patientConsciousnessRegained,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('diabeticEmergencyCare');

    incident.auditTrail.push({
      action: 'DIABETIC_EMERGENCY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hạ đường huyết: ${bloodGlucoseMmolL} mmol/L (${bloodGlucoseMgDl} mg/dL) -> ${hypoglycemiaSeverity}, Ý thức: ${isConscious ? 'TỈNH' : 'HÔN MÊ'}, Cấm đường uống: ${oralIntakeContraindicated}, Dùng thuốc: ${medicationType}, Sau cấp cứu: ${postTreatmentGlucoseMmolL || 'Chưa đo'} mmol/L`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      bloodGlucoseMmolL,
      bloodGlucoseMgDl,
      hypoglycemiaSeverity,
      isConscious,
      oralIntakeContraindicated,
      ruleOf15Applied,
      glucagonOrIvDextroseAdministered,
      medicationType,
      postTreatmentGlucoseMmolL,
      patientConsciousnessRegained,
      firstAidDirectives: oralIntakeContraindicated
        ? 'CẢNH BÁO NGUY HIỂM: Nạn nhân hôn mê/lơ mơ, TUYỆT ĐỐI KHÔNG ÉP UỐNG NƯỚC ĐƯỜNG hay nhét thức ăn vào miệng (nguy cơ sặc đường thở gây ngừng thở tức thì). Tiêm bắp Glucagon 1mg hoặc truyền tĩnh mạch Glucose 20% cấp cứu ngay!'
        : 'QUY TẮC 15-15: Cho uống ngay 15g Carbohydrate tác dụng nhanh (1 ly nước cam 150ml hoặc 3-4 gói đường hòa tan). Sau 15 phút đo lại đường huyết mao mạch.',
    };
  }

  /**
   * Cấp cứu Trẻ em Hóc dị vật đường thở & Tắc nghẽn hô hấp cơ học (Phân hệ 31)
   * Chuẩn Quốc tế AHA / ERC Pediatric BLS / FBAO (Foreign Body Airway Obstruction)
   */
  async managePediatricChokingAndFbao(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const patientAgeMonths = Number(payload.patientAgeMonths) || 24;
    const isInfantUnder1Year = patientAgeMonths < 12;
    // Chống chỉ định ép bụng (Heimlich) ở trẻ dưới 1 tuổi do nguy cơ rách gan/vỡ lách
    const abdominalThrustsContraindicatedInfant = isInfantUnder1Year;
    // Tuyệt đối cấm móc họng mù (blind finger sweep) ở mọi đối tượng vì đẩy dị vật sâu hơn
    const blindFingerSweepProhibited = true;

    let backBlowsAndChestThrustsApplied = false;
    let abdominalThrustsHeimlichApplied = false;

    if (isInfantUnder1Year) {
      backBlowsAndChestThrustsApplied = Boolean(payload.backBlowsAndChestThrustsApplied ?? true);
      abdominalThrustsHeimlichApplied = false; // Luôn bị vô hiệu hóa ở nhũ nhi
    } else {
      abdominalThrustsHeimlichApplied = Boolean(payload.abdominalThrustsHeimlichApplied ?? true);
      backBlowsAndChestThrustsApplied = Boolean(payload.backBlowsAndChestThrustsApplied ?? false);
    }

    const foreignBodyExpelled = Boolean(payload.foreignBodyExpelled ?? false);
    const airwayClear = Boolean(payload.airwayClear ?? foreignBodyExpelled);
    const isUnconscious = Boolean(payload.isUnconscious ?? false);

    incident.pediatricChokingCare = {
      isPediatricChoking: true,
      patientAgeMonths,
      isInfantUnder1Year,
      backBlowsAndChestThrustsApplied,
      abdominalThrustsHeimlichApplied,
      abdominalThrustsContraindicatedInfant,
      blindFingerSweepProhibited,
      foreignBodyExpelled,
      airwayClear,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('pediatricChokingCare');

    incident.auditTrail.push({
      action: 'PEDIATRIC_CHOKING_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hóc dị vật trẻ em (${patientAgeMonths} tháng, ${isInfantUnder1Year ? 'Nhũ nhi < 1T' : 'Trẻ em'}): Vỗ lưng ấn ngực=${backBlowsAndChestThrustsApplied}, Heimlich=${abdominalThrustsHeimlichApplied}, Tống xuất dị vật=${foreignBodyExpelled}, Đường thở thông thoáng=${airwayClear}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      patientAgeMonths,
      isInfantUnder1Year,
      abdominalThrustsContraindicatedInfant,
      blindFingerSweepProhibited,
      backBlowsAndChestThrustsApplied,
      abdominalThrustsHeimlichApplied,
      foreignBodyExpelled,
      airwayClear,
      isUnconscious,
      clinicalProtocol: isInfantUnder1Year
        ? 'PHÁC ĐỒ HÓC DỊ VẬT NHŨ NHI (< 1 TUỔI): Đặt trẻ nằm sấp đầu thấp trên cẳng tay, thực hiện 5 VỖ LƯNG dứt khoát giữa 2 xương bả vai. Sau đó lật ngửa trẻ trên cẳng tay kia, thực hiện 5 ẤN NGỰC (ngay dưới đường liên vú). TUYỆT ĐỐI KHÔNG DÙNG THỦ THUẬT HEIMLICH ÉP BỤNG VÌ NGUY CƠ RÁCH GAN/LÁCH.'
        : 'PHÁC ĐỒ HÓC DỊ VẬT TRẺ EM TRÊN 1 TUỔI: Thực hiện thủ thuật Heimlich ép bụng đứng hoặc ngồi phía sau nạn nhân, ôm vòng tay, dùng nắm đấm ép mạnh hướng vào trong và chếch lên trên (inward & upward).',
      safetyWarnings: [
        'TUYỆT ĐỐI CẤM MÓC HỌNG MÙ BẰNG TAY (NO BLIND FINGER SWEEPS): Ngón tay móc mù sẽ đẩy dị vật lọt sâu vào thanh quản, biến tắc bán phần thành tắc hoàn toàn gây ngừng thở tức thì.',
        isUnconscious
          ? 'NẠN NHÂN BẤT TỈNH: Đặt nằm ngửa trên nền cứng và tiến hành ngay CPR hồi sức tim phổi. Mỗi chu kỳ mở miệng quan sát, CHỈ GẮP DỊ VẬT KHI NHÌN THẤY RÕ RÀNG.'
          : 'Quan sát liên tục sắc mặt, tiếng ho và nhịp thở của trẻ.',
      ],
    };
  }

  /**
   * Cấp cứu Động kinh cơn lớn & Trạng thái co giật liên tục (Phân hệ 32)
   * Chuẩn Quốc tế ILAE (International League Against Epilepsy) Pre-Hospital Guidelines
   */
  async manageSeizureAndStatusEpilepticus(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const seizureDurationMinutes = Number(payload.seizureDurationMinutes) || 2;
    // Co giật kéo dài >= 5 phút hoặc nhiều cơn liên tiếp không hồi phục ý thức = Trạng thái co giật liên tục (Status Epilepticus)
    const isStatusEpilepticus = seizureDurationMinutes >= 5;
    // Nghiêm cấm đưa bất kỳ vật gì vào miệng nạn nhân (đũa, thìa, ngón tay, vắt chanh)
    const oralObjectInsertionContraindicated = true;
    // Nghiêm cấm đè chặt, bẻ hoặc gông ép tay chân khi đang co giật mạnh
    const physicalRestraintContraindicated = true;

    const headProtectedWithPadding = Boolean(payload.headProtectedWithPadding ?? true);
    const recoveryPositionPlacedPostIctal = Boolean(payload.recoveryPositionPlacedPostIctal ?? false);
    const midazolamOrDiazepamAdministered = Boolean(payload.midazolamOrDiazepamAdministered ?? isStatusEpilepticus);
    const convulsionCeased = Boolean(payload.convulsionCeased ?? false);

    incident.seizureCare = {
      isSeizureEpisode: true,
      seizureDurationMinutes,
      isStatusEpilepticus,
      oralObjectInsertionContraindicated,
      physicalRestraintContraindicated,
      headProtectedWithPadding,
      recoveryPositionPlacedPostIctal,
      midazolamOrDiazepamAdministered,
      convulsionCeased,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('seizureCare');

    incident.auditTrail.push({
      action: 'SEIZURE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Động kinh (${seizureDurationMinutes} phút): Trạng thái động kinh liên tục=${isStatusEpilepticus}, Bảo vệ đầu=${headProtectedWithPadding}, Cấm chèn miệng=${oralObjectInsertionContraindicated}, Dùng Benzodiazepine=${midazolamOrDiazepamAdministered}, Cắt cơn=${convulsionCeased}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      seizureDurationMinutes,
      isStatusEpilepticus,
      oralObjectInsertionContraindicated,
      physicalRestraintContraindicated,
      headProtectedWithPadding,
      recoveryPositionPlacedPostIctal,
      midazolamOrDiazepamAdministered,
      convulsionCeased,
      statusSeverity: isStatusEpilepticus
        ? 'TRẠNG THÁI CO GIẬT LIÊN TỤC (STATUS EPILEPTICUS - BÁO ĐỘNG ĐỎ): Co giật >= 5 phút đe dọa tổn thương tế bào thần kinh không hồi phục và suy hô hấp toan máu. Yêu cầu 115 tăng tốc và dùng thuốc cắt cơn khẩn cấp!'
        : 'CƠN CO GIẬT ĐƠN THUẦN NGOẠI VIỆN: Đang tự giới hạn dưới 5 phút.',
      rescueInstructions: [
        'KÊ ĐỆM ĐẦU AN TOÀN: Dùng áo khoác hoặc gối mỏng đệm dưới đầu nạn nhân để tránh chấn thương sọ não do va đập nền cứng.',
        'TUYỆT ĐỐI KHÔNG CHÈN ĐŨA, MUỖNG HOẶC DỊ VẬT VÀO MIỆNG: Không có nguy cơ cắn đứt lưỡi tử vong, nhưng việc chèn vật cứng sẽ làm gãy răng, rách niêm mạc họng và gây tắc nghẽn đường thở chí mạng.',
        'TUYỆT ĐỐI KHÔNG GHÌ ĐÈ CƯỠNG CHẾ: Việc đè chặt tay chân khi cơ đang co cứng có thể gây rách cơ, gãy xương và trật khớp vai.',
        'GIAI ĐOẠN SAU CƠN (POST-ICTAL): Khi cơn giật ngừng, lập tức xoay nạn nhân sang TƯ THẾ NẰM NGHIÊNG AN TOÀN (Recovery Position) để đờm dãi và chất nôn tự chảy ra ngoài, giải phóng đường thở.',
      ],
    };
  }

  /**
   * Cấp cứu Điện giật Đô thị & An toàn Hiện trường Cao thế (Phân hệ 33)
   * Chuẩn Quốc tế OSHA / ERC Urban Electrical Injury & Arc Flash Safety
   */
  async manageElectricalInjuryAndSceneSafety(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const voltageCategory = payload.voltageCategory || 'LOW_VOLTAGE_HOUSEHOLD_220V';
    const isHighVoltage = voltageCategory === 'HIGH_VOLTAGE_OVER_1000V';
    const scenePowerCutConfirmed = Boolean(payload.scenePowerCutConfirmed ?? false);

    // Ở hiện trường cao thế: Vùng nguy hiểm tối thiểu 10 mét và phải di chuyển nhảy chụm chân (hop exit) tránh điện thế bước
    const safetyCordonMaintained10Meters = isHighVoltage
      ? Boolean(payload.safetyCordonMaintained10Meters ?? true)
      : true;
    const stepPotentialHopExitUsed = isHighVoltage
      ? Boolean(payload.stepPotentialHopExitUsed ?? true)
      : false;

    const cardiacRhythmAssessed = payload.cardiacRhythmAssessed || (voltageCategory === 'LOW_VOLTAGE_HOUSEHOLD_220V' ? 'VENTRICULAR_FIBRILLATION' : 'UNKNOWN');
    const aedShockDelivered = Boolean(payload.aedShockDelivered ?? (cardiacRhythmAssessed === 'VENTRICULAR_FIBRILLATION'));
    const deepTissueBurnSuspected = Boolean(payload.deepTissueBurnSuspected ?? isHighVoltage);

    incident.electricalInjuryCare = {
      isElectricalInjury: true,
      voltageCategory,
      scenePowerCutConfirmed,
      safetyCordonMaintained10Meters,
      stepPotentialHopExitUsed,
      cardiacRhythmAssessed,
      aedShockDelivered,
      deepTissueBurnSuspected,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('electricalInjuryCare');

    incident.auditTrail.push({
      action: 'ELECTRICAL_INJURY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Điện giật (${voltageCategory}): Cắt nguồn=${scenePowerCutConfirmed}, Vành đai 10m=${safetyCordonMaintained10Meters}, Nhảy chụm chân=${stepPotentialHopExitUsed}, Nhịp tim=${cardiacRhythmAssessed}, Sốc AED=${aedShockDelivered}, Bỏng sâu=${deepTissueBurnSuspected}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      voltageCategory,
      scenePowerCutConfirmed,
      safetyCordonMaintained10Meters,
      stepPotentialHopExitUsed,
      cardiacRhythmAssessed,
      aedShockDelivered,
      deepTissueBurnSuspected,
      sceneSafetyDirectives: !scenePowerCutConfirmed
        ? 'CẢNH BÁO TỬ VONG: NGUỒN ĐIỆN CHƯA ĐƯỢC CẮT! TUYỆT ĐỐI KHÔNG CHẠM VÀO NẠN NHÂN ĐỂ TRÁNH BIẾN NGƯỜI CỨU HỘ THÀNH NẠN NHÂN THỨ HAI. Ngắt cầu dao tổng hoặc gọi ngay Điện lực khẩn cấp.'
        : 'Hiện trường đã cắt nguồn an toàn, cho phép tiếp cận nạn nhân kiểm tra đường thở và tuần hoàn.',
      stepPotentialWarning: isHighVoltage
        ? 'HIỆN TƯỢNG ĐIỆN THẾ BƯỚC (STEP POTENTIAL): Dòng điện cao thế lan truyền trên mặt đất theo hình vòng tròn đồng tâm. Khi di chuyển trong bán kính 10m, BẮT BUỘC NHẢY CHỤM HAI CHÂN (HOP EXIT) HOẶC LẾT CHÂN SÁT NHAU, TUYỆT ĐỐI KHÔNG BƯỚC DÀI CHÂN vì tạo độ chênh điện thế giữa 2 chân phóng điện xuyên qua tim!'
        : 'Điện áp hạ thế sinh hoạt 220V.',
      clinicalDirectives: [
        cardiacRhythmAssessed === 'VENTRICULAR_FIBRILLATION'
          ? 'RUNG THẤT NGOẠI VIỆN (VF) DO ĐIỆN 220V: Tiến hành CPR ngay lập tức và dán máy phá rung tự động AED phát xung khử rung sớm!'
          : 'Theo dõi nhịp tim liên tục phòng ngừa rối loạn nhịp tim thứ phát.',
        deepTissueBurnSuspected
          ? 'NGUY CƠ BỎNG SÂU NỘI TẠNG ("HIỆU ỨNG TẢNG BĂNG TRÔI"): Tổn thương hoại tử cơ nặng và tiêu cơ vân cấp (Rhabdomyolysis), dịch truyền bù thể tích lớn và chuyển gấp trung tâm Bỏng.'
          : 'Sát khuẩn và băng che vết bỏng khô vô trùng.',
      ],
    };
  }

  /**
   * Ngộ độc khí CO & Khói cháy chung cư đô thị (Phân hệ 34)
   * Chuẩn Quốc tế Undersea and Hyperbaric Medical Society (UHMS) & ERC/AHA
   */
  async manageCoAndSmokeInhalation(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const sourceCategory = payload.sourceCategory || 'BUILDING_FIRE_SMOKE';
    const sootInNarisOrOralCavity = Boolean(payload.sootInNarisOrOralCavity ?? false);
    const highFlowOxygen100Applied = Boolean(payload.highFlowOxygen100Applied ?? true);
    const oxygenFlowRateLpm = Number(payload.oxygenFlowRateLpm) || 15;
    const estimatedHbCoPercent = payload.estimatedHbCoPercent !== undefined ? Number(payload.estimatedHbCoPercent) : null;
    const isPregnant = Boolean(payload.isPregnant ?? false);
    const isUnconscious = Boolean(payload.isUnconscious ?? false);

    // Chỉ định Oxy Cao Áp (Hyperbaric Oxygen Therapy - HBOT):
    // 1. Phụ nữ mang thai (HbCO thai nhi cao hơn mẹ)
    // 2. Mất ý thức / Hôn mê / Co giật
    // 3. Nồng độ Carboxyhemoglobin HbCO >= 25% (hoặc >= 15% ở thai phụ)
    // 4. Có tổn thương thiếu máu cục bộ cơ tim (đau ngực, biến đổi ST trên ECG)
    const hyperbaricOxygenIndicated = Boolean(
      payload.hyperbaricOxygenIndicated ??
      (isPregnant || isUnconscious || (estimatedHbCoPercent !== null && estimatedHbCoPercent >= 25))
    );

    // Nghi ngờ ngộ độc Cyanide kết hợp trong khói cháy chung cư:
    // Cháy nhựa mút xốp sofa, dây điện sinh ra khí HCN cực độc. Nếu có bồ hóng đường thở + suy hô hấp/toan kiềm nặng
    let cyanideAntidoteAdministered = false;
    let antidoteType = 'NONE';
    if (payload.cyanideAntidoteAdministered || (sourceCategory === 'BUILDING_FIRE_SMOKE' && sootInNarisOrOralCavity && isUnconscious)) {
      cyanideAntidoteAdministered = true;
      antidoteType = payload.antidoteType || 'HYDROXOCOBALAMIN_CYANOKIT_5G';
    }

    incident.coSmokeInhalationCare = {
      isCoSmokeInhalation: true,
      sourceCategory,
      sootInNarisOrOralCavity,
      highFlowOxygen100Applied,
      oxygenFlowRateLpm,
      estimatedHbCoPercent,
      hyperbaricOxygenIndicated,
      cyanideAntidoteAdministered,
      antidoteType,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('coSmokeInhalationCare');

    incident.auditTrail.push({
      action: 'CO_SMOKE_INHALATION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc CO/Khói cháy (${sourceCategory}): Bồ hóng=${sootInNarisOrOralCavity}, Oxy 100%=${highFlowOxygen100Applied} (${oxygenFlowRateLpm} L/p), HbCO=${estimatedHbCoPercent || 'N/A'}%, HBOT=${hyperbaricOxygenIndicated}, Antidote Cyanide=${antidoteType}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      sourceCategory,
      sootInNarisOrOralCavity,
      highFlowOxygen100Applied,
      oxygenFlowRateLpm,
      estimatedHbCoPercent,
      hyperbaricOxygenIndicated,
      cyanideAntidoteAdministered,
      antidoteType,
      oxygenHalfLifeReduction: highFlowOxygen100Applied
        ? 'Oxy 100% dòng cao (15 L/phút qua Mask có túi dự trữ Non-Rebreather) rút ngắn thời gian bán thải HbCO từ 320 phút (khí trời) xuống còn khoảng 80 phút.'
        : 'Cần lập tức cho thở Oxy 100% dòng cao.',
      hbotAdvice: hyperbaricOxygenIndicated
        ? 'CHỈ ĐỊNH ĐIỀU TRỊ OXY CAO ÁP (HBOT) TỐI KHẨN: Nạn nhân có yếu tố nguy cơ cao (HbCO >= 25%, mang thai hoặc hôn mê mất ý thức). Rút ngắn bán thải HbCO xuống 23 phút ở 3 ATA, ngăn ngừa di chứng thần kinh muộn (DNS). Chuyển ngay Trung tâm Oxy cao áp!'
        : 'Theo dõi sát tri giác và dấu hiệu đau thắt ngực.',
      cyanideDirectives: cyanideAntidoteAdministered
        ? 'XỬ TRÍ NGỘ ĐỘC CYANIDE KẾT HỢP: Đã chỉ định truyền Hydroxocobalamin (Cyanokit) 5g IV trong 15 phút. Hydroxocobalamin gắn kết Cyanide tạo thành Cyanocobalamin (Vitamin B12) vô hại đào thải qua nước tiểu.'
        : 'Quan sát liên tục màu nước tiểu và khí máu động mạch.',
    };
  }

  /**
   * Cấp cứu Chấn thương Mắt & Bỏng Hóa chất Nhãn cầu Ngoại viện (Phân hệ 35)
   * Chuẩn Quốc tế American Academy of Ophthalmology (AAO) & PHTLS
   */
  async manageOcularTraumaAndChemicalBurns(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const injuryCategory = payload.injuryCategory || 'CHEMICAL_ALKALI_BASE';
    const isChemical = injuryCategory === 'CHEMICAL_ALKALI_BASE' || injuryCategory === 'CHEMICAL_ACID';
    const isPenetrating = injuryCategory === 'PENETRATING_GLOBE_FOREIGN_BODY';

    const immediateIrrigationPerformed = Boolean(payload.immediateIrrigationPerformed ?? isChemical);
    const irrigationDurationMinutes = Number(payload.irrigationDurationMinutes) || (isChemical ? 20 : 0);
    const irrigationFluidVolumeMl = Number(payload.irrigationFluidVolumeMl) || (isChemical ? 1500 : 0);
    const measuredConjunctivalPh = payload.measuredConjunctivalPh !== undefined ? Number(payload.measuredConjunctivalPh) : 7.2;
    const targetPhNeutralized = measuredConjunctivalPh >= 7.0 && measuredConjunctivalPh <= 7.4;

    const rigidEyeShieldApplied = Boolean(payload.rigidEyeShieldApplied ?? isPenetrating);
    // Bắt buộc tuyệt đối không đè ép nhãn cầu và không rút dị vật xuyên thủng
    const globePressureProhibited = true;
    const foreignBodyRemovalProhibited = true;

    incident.ocularTraumaCare = {
      isOcularTrauma: true,
      injuryCategory,
      immediateIrrigationPerformed,
      irrigationDurationMinutes,
      irrigationFluidVolumeMl,
      targetPhNeutralized,
      measuredConjunctivalPh,
      rigidEyeShieldApplied,
      globePressureProhibited,
      foreignBodyRemovalProhibited,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('ocularTraumaCare');

    incident.auditTrail.push({
      action: 'OCULAR_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương mắt (${injuryCategory}): Rửa mắt=${immediateIrrigationPerformed} (${irrigationDurationMinutes}p, ${irrigationFluidVolumeMl}mL, pH=${measuredConjunctivalPh}), Khiên che mắt=${rigidEyeShieldApplied}, Cấm đè ép=${globePressureProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      injuryCategory,
      immediateIrrigationPerformed,
      irrigationDurationMinutes,
      irrigationFluidVolumeMl,
      targetPhNeutralized,
      measuredConjunctivalPh,
      rigidEyeShieldApplied,
      globePressureProhibited,
      foreignBodyRemovalProhibited,
      irrigationProtocol: isChemical
        ? (injuryCategory === 'CHEMICAL_ALKALI_BASE'
            ? 'BỎNG BAZƠ/KIỀM NGUY KỊCH (Xút NaOH, Vôi tôi): Kiềm gây hoại tử hóa lỏng (Liquefactive Necrosis) xuyên sâu giác mạc. BẮT BUỘC RỬA MẮT LIÊN TỤC ít nhất 20-30 phút với tối thiểu 1000-2000 mL nước muối sinh lý/nước sạch trước khi vận chuyển. Tiếp tục rửa đến khi pH cùng đồ kết mạc đạt 7.0 - 7.4.'
            : 'BỎNG AXIT: Gây hoại tử đông (Coagulative Necrosis), rửa mắt liên tục ít nhất 15-20 phút với nước muối sinh lý đưa pH về trung tính.')
        : 'Không có chỉ định rửa mắt áp lực cao.',
      penetratingTraumaWarnings: isPenetrating
        ? [
            'TUYỆT ĐỐI KHÔNG ẤN ÉP LÊN NHÃN CẦU (NO PRESSURE ON THE EYE): Lực ép sẽ tống xuất mống mắt, thể thủy tinh và dịch kính ra ngoài gây mù không thể cứu vãn.',
            'TUYỆT ĐỐI KHÔNG TỰ Ý RÚT DỊ VẬT XUYÊN THỦNG: Giữ nguyên dị vật tại chỗ.',
            'ĐẶT KHIÊN CHE MẮT CỨNG (RIGID EYE SHIELD): Đặt khiên cứng tựa lên khung xương hốc mắt (hoặc dùng đáy cốc giấy/cốc nhựa khoét đáy) để bảo vệ mắt khỏi va chạm ngoại cảnh.',
          ]
        : [],
    };
  }

  /**
   * Sơ cứu Đứt lìa Chi & Bảo quản Phần chi đứt rời chuẩn Vi phẫu (Phân hệ 36)
   * Chuẩn Quốc tế American College of Surgeons (ACS) & Bệnh viện CTCH TP.HCM
   */
  async manageAmputationAndPartPreservation(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const amputationType = payload.amputationType || 'COMPLETE_AMPUTATION';
    const anatomicalPart = payload.anatomicalPart || 'DIGIT_FINGER_TOE';
    const isMajorLimb = anatomicalPart === 'FOREARM_ARM' || anatomicalPart === 'HAND_WRIST' || anatomicalPart === 'LEG_LOWER' || anatomicalPart === 'FOOT_ANKLE';

    const stumpHemostasisApplied = Boolean(payload.stumpHemostasisApplied ?? true);
    const hemostasisMethod = payload.hemostasisMethod || (isMajorLimb ? 'COMBAT_APPLICATION_TOURNIQUET' : 'PRESSURE_DRESSING');
    const amputatedPartRetrieved = Boolean(payload.amputatedPartRetrieved ?? true);
    const threeTierPreservationApplied = Boolean(payload.threeTierPreservationApplied ?? amputatedPartRetrieved);
    const directIceContactProhibited = true;
    const directWaterImmersionProhibited = true;

    const ischemiaType = payload.ischemiaType || (threeTierPreservationApplied ? 'COLD_ISCHEMIA_2_TO_4C' : 'WARM_ISCHEMIA_ROOM_TEMP');
    // Thời gian vàng vi phẫu: Chi lớn chứa cơ chỉ chịu được 6h lạnh (4h ấm). Ngón tay/ngón chân chịu được 12-24h lạnh (8h ấm).
    let goldenWindowHours = 12;
    if (isMajorLimb) {
      goldenWindowHours = ischemiaType === 'COLD_ISCHEMIA_2_TO_4C' ? 6 : 4;
    } else {
      goldenWindowHours = ischemiaType === 'COLD_ISCHEMIA_2_TO_4C' ? 24 : 8;
    }

    incident.amputationCare = {
      isAmputation: true,
      amputationType,
      anatomicalPart,
      stumpHemostasisApplied,
      hemostasisMethod,
      amputatedPartRetrieved,
      threeTierPreservationApplied,
      directIceContactProhibited,
      directWaterImmersionProhibited,
      ischemiaType,
      goldenWindowHours,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('amputationCare');

    incident.auditTrail.push({
      action: 'AMPUTATION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Đứt lìa chi (${amputationType} - ${anatomicalPart}): Cầm máu mỏm cụt=${hemostasisMethod}, Thu hồi chi rời=${amputatedPartRetrieved}, Bảo quản 3 lớp gián tiếp=${threeTierPreservationApplied}, Cấm đá trực tiếp=${directIceContactProhibited}, Thiếu máu=${ischemiaType}, Cửa sổ vàng=${goldenWindowHours}h`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      amputationType,
      anatomicalPart,
      stumpHemostasisApplied,
      hemostasisMethod,
      amputatedPartRetrieved,
      threeTierPreservationApplied,
      directIceContactProhibited,
      directWaterImmersionProhibited,
      ischemiaType,
      goldenWindowHours,
      preservationProtocol: threeTierPreservationApplied
        ? 'QUY TẮC 3 LỚP BẢO QUẢN CHI ĐỨT RỜI CHUẨN VI PHẪU (COLD ISCHEMIA 2-4°C): Lớp 1: Bọc kín phần chi bằng gạc vô trùng thấm nước muối sinh lý (vắt ráo ẩm). Lớp 2: Cho vào túi nilon sạch buộc kín miệng (chống nước thấm). Lớp 3: Đặt túi nilon vào thùng chứa hỗn hợp NƯỚC VÀ ĐÁ (tỷ lệ 1:1, duy trì 2-4°C).'
        : 'Cần tìm kiếm và thu hồi phần chi đứt rời để bảo quản vi phẫu.',
      prohibitions: [
        'TUYỆT ĐỐI KHÔNG ĐỂ CHI TIẾP XÚC TRỰC TIẾP VỚI ĐÁ LẠNH: Nhiệt độ 0°C làm bỏng lạnh hoại tử tế bào và đông cứng mạch máu vi phẫu khiến không thể khâu nối vi phẫu.',
        'TUYỆT ĐỐI KHÔNG NGÂM PHẦN CHI TRỰC TIẾP VÀO NƯỚC: Gây phù nề và ly giải tế bào cơ/thần kinh do chênh lệch áp suất thẩm thấu.',
      ],
      surgicalTransportAdvice: `Cửa sổ thời gian vàng khâu nối vi phẫu: ${goldenWindowHours} giờ (${isMajorLimb ? 'Chi lớn có cơ: Tối đa 6 giờ' : 'Ngón tay/ngón chân: Tối đa 24 giờ'}). Vận chuyển khẩn cấp về Trung tâm Vi phẫu Tạo hình (BV CTCH hoặc BV Chợ Rẫy)!`,
    };
  }

  /**
   * Cấp cứu Vỡ Phình ĐM Chủ Bụng & Thoát Vị Tạng Vùng Bụng (Phân hệ 37)
   * Chuẩn Quốc tế PHTLS & ACS Committee on Trauma
   */
  async manageAbdominalTraumaAndEvisceration(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const traumaType = payload.traumaType || 'EVISCERATION_OPEN_BOWEL';
    const isEvisceration = traumaType === 'EVISCERATION_OPEN_BOWEL';
    const isRupturedAaa = traumaType === 'SUSPECTED_RUPTURED_AAA';

    // Tuyệt đối không ấn tạng lòi vào lại ổ bụng (ngừa viêm phúc mạc nhiễm trùng và xoắn nghẹt ruột)
    const organReinsertionProhibited = true;
    const sterileMoistDressingApplied = Boolean(payload.sterileMoistDressingApplied ?? isEvisceration);
    const occlusiveMoistureBarrierApplied = Boolean(payload.occlusiveMoistureBarrierApplied ?? isEvisceration);
    const kneesFlexedPositionMaintained = Boolean(payload.kneesFlexedPositionMaintained ?? isEvisceration);

    const actualSystolicBp = Number(payload.actualSystolicBp) || (isRupturedAaa ? 85 : 110);
    const permissiveHypotensionTargetSbp = 85;
    // Với vỡ phình ĐM chủ bụng: duy trì HA cho phép 80-90 mmHg, tránh bù dịch quá mức làm bung cục máu đông tạm thời
    const excessiveFluidAvoided = Boolean(payload.excessiveFluidAvoided ?? isRupturedAaa);

    incident.abdominalTraumaCare = {
      isAbdominalTrauma: true,
      traumaType,
      organReinsertionProhibited,
      sterileMoistDressingApplied,
      occlusiveMoistureBarrierApplied,
      kneesFlexedPositionMaintained,
      permissiveHypotensionTargetSbp,
      actualSystolicBp,
      excessiveFluidAvoided,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('abdominalTraumaCare');

    incident.auditTrail.push({
      action: 'ABDOMINAL_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương bụng (${traumaType}): Cấm ấn tạng=${organReinsertionProhibited}, Băng gạc ẩm NaCl=${sterileMoistDressingApplied}, Tư thế co gối 45 độ=${kneesFlexedPositionMaintained}, HA tâm thu=${actualSystolicBp} mmHg (Hạ HA cho phép=${excessiveFluidAvoided})`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      traumaType,
      organReinsertionProhibited,
      sterileMoistDressingApplied,
      occlusiveMoistureBarrierApplied,
      kneesFlexedPositionMaintained,
      actualSystolicBp,
      permissiveHypotensionTargetSbp,
      excessiveFluidAvoided,
      eviscerationProtocol: isEvisceration
        ? 'PHÁC ĐỒ XỬ TRÍ THOÁT VỊ TẠNG BỤNG (EVISCERATION): 1. TUYỆT ĐỐI KHÔNG ẤN TẠNG VÀO LẠI Ổ BỤNG (tránh đưa vi khuẩn vào khoang phúc mạc gây viêm phúc mạc toàn thể). 2. Phủ gạc vô trùng tẩm nước muối sinh lý NaCl 0.9% ấm lên quai ruột. 3. Bọc màng giữ ẩm sạch bên ngoài chống mất nhiệt. 4. Đặt nạn nhân nằm ngửa CO HAI ĐẦU GỐI 45 ĐỘ để chùng cơ thành bụng.'
        : 'Không có quai ruột thoát vị ngoài thành bụng.',
      aaaRuptureDirectives: isRupturedAaa
        ? 'CHIẾN LƯỢC HẠ HUYẾT ÁP CHO PHÉP (PERMISSIVE HYPOTENSION 80-90 mmHg): Duy trì SBP 80-90 mmHg vừa đủ tưới máu não và tim. TUYỆT ĐỐI KHÔNG TRUYỀN DỊCH QUÁ NHIỀU ĐẨY HA LÊN CAO, vì áp lực dòng máu mạnh sẽ thổi bung cục máu đông tạm thời tại chỗ vỡ phình ĐM chủ gây xuất huyết tử vong tức thì.'
        : 'Huyết động ổ bụng ổn định.',
    };
  }

  /**
   * Cấp cứu Ngộ độc Thuốc trừ sâu Phospho hữu cơ & Kháng Cholinesterase (Phân hệ 38)
   * Chuẩn Quốc tế World Health Organization (WHO) & Trung tâm Chống Độc BV Bạch Mai / BV Chợ Rẫy
   */
  async manageOrganophosphatePoisoning(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const toxinCategory = payload.toxinCategory || 'ORGANOPHOSPHATE_INSECTICIDE';
    const dermalDecontaminationPerformed = Boolean(payload.dermalDecontaminationPerformed ?? true);
    const clothingSafelyDisposedInBags = Boolean(payload.clothingSafelyDisposedInBags ?? true);
    const pinpointPupilsObserved = Boolean(payload.pinpointPupilsObserved ?? true);
    const bronchorrheaSecretionsSuctioned = Boolean(payload.bronchorrheaSecretionsSuctioned ?? true);
    const atropineAdministeredMg = Number(payload.atropineAdministeredMg) || 2;
    const atropinizationAchieved = Boolean(payload.atropinizationAchieved ?? (atropineAdministeredMg >= 2));
    const pralidoximePamAdministeredGrams = Number(payload.pralidoximePamAdministeredGrams) || 1;

    incident.toxicologyPoisoningCare = {
      isToxicologyPoisoning: true,
      toxinCategory,
      dermalDecontaminationPerformed,
      clothingSafelyDisposedInBags,
      pinpointPupilsObserved,
      bronchorrheaSecretionsSuctioned,
      atropineAdministeredMg,
      atropinizationAchieved,
      pralidoximePamAdministeredGrams,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('toxicologyPoisoningCare');

    incident.auditTrail.push({
      action: 'TOXICOLOGY_POISONING_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc độc chất (${toxinCategory}): Khử nhiễm da=${dermalDecontaminationPerformed}, Đồng tử co nhỏ đinh ghim=${pinpointPupilsObserved}, Hút đờm dãi=${bronchorrheaSecretionsSuctioned}, Atropine=${atropineAdministeredMg}mg (Ngấm Atropine=${atropinizationAchieved}), Pralidoxime 2-PAM=${pralidoximePamAdministeredGrams}g`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      toxinCategory,
      dermalDecontaminationPerformed,
      clothingSafelyDisposedInBags,
      pinpointPupilsObserved,
      bronchorrheaSecretionsSuctioned,
      atropineAdministeredMg,
      atropinizationAchieved,
      pralidoximePamAdministeredGrams,
      toxicologyDirectives: [
        'KHỬ NHIỄM BẢO VỆ NGƯỜI CỨU HỘ: Mang găng tay không thấm và áo choàng; cởi bỏ toàn bộ quần áo dính hóa chất cho vào 2 lớp túi ni-lông buộc kín; rửa da bằng nước và xà phòng.',
        'HỘI CHỨNG CƯỜNG PHÓ GIAO CẢM (DUMBELS): Hút sạch đờm dãi phế quản tránh ngạt thở, thở oxy 100%.',
        atropinizationAchieved
          ? 'ĐẠT TIÊU CHUẨN NGẤM ATROPINE (ATROPINIZATION): Phổi hết rales ẩm, khô dịch đờm phế quản, đồng tử giãn, nhịp tim > 80 bpm.'
          : 'TIẾP TỤC DÙNG ATROPINE: Tiêm nhắc lại 2-4mg mỗi 5-10 phút cho đến khi khô đờm phế quản.',
        pralidoximePamAdministeredGrams > 0
          ? 'TÁI HOẠT HÓA ENZYM BẰNG PRALIDOXIME (2-PAM): Truyền 1-2g tĩnh mạch để phục hồi Cholinesterase trước khi enzym bị biến tính vĩnh viễn (Aging).'
          : 'Cần chỉ định Pralidoxime sớm trong 24 giờ đầu.',
      ],
    };
  }

  /**
   * Cấp cứu Chấn thương Vỡ Khung chậu Nặng & Đai Kẹp Cầm máu Vùng chậu (Phân hệ 39)
   * Chuẩn Quốc tế ATLS / PHTLS Pelvic Circumferential Compression Device (PCCD)
   */
  async managePelvicFractureAndBinderHemostasis(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const fracturePattern = payload.fracturePattern || 'OPEN_BOOK_UNSTABLE';
    // Tuyệt đối cấm lắc kiểm tra khung chậu nhiều lần để tránh phá vỡ cục máu đông sau phúc mạc
    const repeatedPelvicRockingProhibited = true;
    const pelvicBinderApplied = Boolean(payload.pelvicBinderApplied ?? true);
    const pelvicBinderPlacementSite = payload.pelvicBinderPlacementSite || 'GREATER_TROCHANTERS_SYMPHYSIS_PUBIS';
    const isCorrectPlacement = pelvicBinderPlacementSite === 'GREATER_TROCHANTERS_SYMPHYSIS_PUBIS';
    const kneesAndFeetTiedTogether = Boolean(payload.kneesAndFeetTiedTogether ?? true);
    const retroperitonealBleedingRisk = 'MASSIVE_LETHAL_3_TO_5_LITERS';
    const scoopStretcherUsed = Boolean(payload.scoopStretcherUsed ?? true);

    incident.pelvicTraumaCare = {
      isPelvicTrauma: true,
      fracturePattern,
      repeatedPelvicRockingProhibited,
      pelvicBinderApplied,
      pelvicBinderPlacementSite,
      kneesAndFeetTiedTogether,
      retroperitonealBleedingRisk,
      scoopStretcherUsed,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('pelvicTraumaCare');

    incident.auditTrail.push({
      action: 'PELVIC_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ khung chậu (${fracturePattern}): Cấm lắc chậu=${repeatedPelvicRockingProhibited}, Đai kẹp chậu=${pelvicBinderApplied} (Vị trí: ${pelvicBinderPlacementSite}), Buộc chụm chân=${kneesAndFeetTiedTogether}, Nguy cơ xuất huyết sau phúc mạc=${retroperitonealBleedingRisk}, Cáng xúc=${scoopStretcherUsed}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      fracturePattern,
      repeatedPelvicRockingProhibited,
      pelvicBinderApplied,
      pelvicBinderPlacementSite,
      isCorrectPlacement,
      kneesAndFeetTiedTogether,
      retroperitonealBleedingRisk,
      scoopStretcherUsed,
      clinicalGuidance: isCorrectPlacement
        ? 'ĐẶT ĐAI KẸP KHUNG CHẬU CHUẨN XÁC: Đai kẹp SAM Pelvic Sling / Tấm vải ga đặt ngang mức MẤU CHUYỂN LỚN XƯƠNG ĐÙI (Greater Trochanters) và khớp mu. Ép chặt khép vòng chậu tạo hiệu ứng đè ép cầm máu sau phúc mạc (Tamponade).'
        : 'CẢNH BÁO VỊ TRÍ SAI: Đặt đai ngang mào chậu hoặc bụng không có tác dụng khép vòng chậu và có thể làm tổn thương thêm các tạng trong ổ bụng. Phải chuyển đai xuống ngang mấu chuyển lớn xương đùi!',
      criticalDirectives: [
        'TUYỆT ĐỐI CẤM LẮC KHUNG CHẬU NHIỀU LẦN (NO REPEATED PELVIC ROCKING): Động tác lắc kiểm tra sẽ xé rách thêm đám rối tĩnh mạch chậu và thổi bay cục máu đông gây xuất huyết tử vong tức thì.',
        kneesAndFeetTiedTogether
          ? 'BUỘC CHỤM HAI NGÓN CHÂN CÁI VÀ ĐẦU GỐI: Xoay trong hai chi dưới giúp cố định xương chậu ở tư thế đóng.'
          : 'Nên dùng băng vải buộc nhẹ 2 đầu gối và 2 cổ chân xoay vào trong.',
        'VẬN CHUYỂN BẰNG CÁNG XÚC (SCOOP STRETCHER): Không lật nghiêng nạn nhân, xúc trực tiếp đưa lên xe 115 chuyển gấp trung tâm can thiệp nút mạch (Angio-embolization).',
      ],
    };
  }

  /**
   * Cấp cứu Chấn thương Sọ não Nặng & Hội chứng Tụt kẹt Não (Phân hệ 40)
   * Chuẩn Quốc tế Brain Trauma Foundation (BTF) & ATLS Neurotrauma
   */
  async manageTraumaticBrainInjuryAndHerniation(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const gcsScore = Number(payload.gcsScore ?? 7);
    const systolicBloodPressure = Number(payload.systolicBloodPressure ?? 175);
    const heartRateBpm = Number(payload.heartRateBpm ?? 48);
    const respiratoryPattern = payload.respiratoryPattern || 'CHEYNE_STOKES';
    const dilatedPupilDiameterMm = Number(payload.dilatedPupilDiameterMm ?? 5.5);

    // Tam chứng Cushing: Tăng huyết áp kẹp rộng, Nhịp tim chậm sâu (< 55 bpm), Thở không đều Cheyne-Stokes
    const cushingsTriadObserved = Boolean(
      systolicBloodPressure >= 160 && heartRateBpm < 55 && respiratoryPattern !== 'NORMAL'
    );
    // Đồng tử giãn 1 bên mất phản xạ ánh sáng (Blown pupil >= 5mm)
    const anisocoriaPupilDilation = Boolean(dilatedPupilDiameterMm >= 5.0);
    // Tụt kẹt não sắp xảy ra khi có Tam chứng Cushing hoặc giãn đồng tử
    const cerebralHerniationImminent = cushingsTriadObserved || anisocoriaPupilDilation;

    const headElevated30Degrees = Boolean(payload.headElevated30Degrees ?? true);
    // Hướng dẫn BTF: Cấm tăng thông khí dự phòng thường quy; CHỈ tăng thông khí nhẹ có kiểm soát khi có tụt kẹt não
    const prophylacticHyperventilationAvoided = true;
    const controlledHyperventilationApplied = cerebralHerniationImminent && Boolean(payload.controlledHyperventilationApplied ?? true);
    const targetEtCo2MmHg = controlledHyperventilationApplied ? 32 : 38; // 30-35 mmHg khi tụt kẹt

    // Nghiên cứu EPIC: Ngăn ngừa tụt huyết áp (SBP >= 100) và hạ oxy máu (SpO2 >= 95%)
    const hypotensionHypoxiaPrevented = Boolean(payload.hypotensionHypoxiaPrevented ?? true);
    const neurosurgeryTransferInitiated = true;

    incident.traumaticBrainInjuryCare = {
      isSevereTbi: true,
      gcsScore,
      cushingsTriadObserved,
      systolicBloodPressure,
      heartRateBpm,
      respiratoryPattern,
      anisocoriaPupilDilation,
      dilatedPupilDiameterMm,
      headElevated30Degrees,
      controlledHyperventilationApplied,
      targetEtCo2MmHg,
      prophylacticHyperventilationAvoided,
      hypotensionHypoxiaPrevented,
      neurosurgeryTransferInitiated,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.markModified('traumaticBrainInjuryCare');

    incident.auditTrail.push({
      action: 'TRAUMATIC_BRAIN_INJURY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương sọ não (GCS=${gcsScore}): Tam chứng Cushing=${cushingsTriadObserved} (HA=${systolicBloodPressure}, Mạch=${heartRateBpm}, Thở=${respiratoryPattern}), Giãn đồng tử 1 bên=${anisocoriaPupilDilation} (${dilatedPupilDiameterMm}mm), Đầu cao 30°=${headElevated30Degrees}, Tăng thông khí kiểm soát cấp cứu=${controlledHyperventilationApplied} (EtCO2=${targetEtCo2MmHg}), Chống tụt HA & Hypoxia=${hypotensionHypoxiaPrevented}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      gcsScore,
      cushingsTriadObserved,
      anisocoriaPupilDilation,
      cerebralHerniationImminent,
      headElevated30Degrees,
      controlledHyperventilationApplied,
      targetEtCo2MmHg,
      prophylacticHyperventilationAvoided,
      hypotensionHypoxiaPrevented,
      neurosurgeryTransferInitiated,
      clinicalDirectives: [
        'KÊ ĐẦU CAO 30 ĐỘ (HEAD ELEVATION 30°): Giữ thẳng trục đầu cổ, không gập xoay cổ để tạo điều kiện dẫn lưu máu tĩnh mạch cảnh về tim, giảm áp lực nội sọ (ICP) tự nhiên.',
        'NGUYÊN TẮC VÀNG CHỐNG THƯƠNG TỔN NÃO THỨ PHÁT (EPIC GUIDELINES): Giữ huyết áp tâm thu SBP >= 100-110 mmHg và SpO2 >= 95%. Tuyệt đối không để tụt huyết áp làm chết tế bào não vùng tranh tối tranh sáng (Penumbra).',
        cerebralHerniationImminent
          ? 'BÁO ĐỘNG ĐỎ TỤT KẸT NÃO THÂN NÃO (CUSHING TRIAD / HERNIATION): Tăng thông khí tạm thời (20 lần/phút, mục tiêu EtCO2 30-35 mmHg) co mạch não cấp cứu, chuyển thẳng phòng mổ Ngoại Thần Kinh BV Chợ Rẫy mở sọ giải áp!'
          : 'THEO DÕI SÁT TRI GIÁC: GCS <= 8 cần bảo vệ đường thở, không tăng thông khí dự phòng thường quy.',
      ],
    };
  }

  /**
   * Cấp cứu Sản phụ Chấn thương & Hồi sức Ngừng tuần hoàn Thai phụ (Phân hệ 41)
   * Chuẩn Quốc tế AHA Maternal Cardiac Arrest & PHTLS Pregnancy Trauma
   */
  async manageMaternalResuscitationAndTrauma(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const gestationalAgeWeeks = Number(payload.gestationalAgeWeeks ?? 28);
    const uterineFundusAboveUmbilicus = Boolean(payload.uterineFundusAboveUmbilicus ?? (gestationalAgeWeeks >= 20));
    // Thủ thuật đẩy tử cung sang trái bằng tay (Manual Left Uterine Displacement - LUD)
    const manualLeftUterineDisplacementApplied = Boolean(payload.manualLeftUterineDisplacementApplied ?? true);
    // Cấm nghiêng toàn bộ cơ thể vì làm giảm hiệu quả ép tim CPR và trượt cáng
    const tiltWholeBodyProhibited = true;
    const aortocavalCompressionRelieved = manualLeftUterineDisplacementApplied;

    const cardiacArrestDurationMinutes = Number(payload.cardiacArrestDurationMinutes ?? 4);
    // Nếu ngừng tim >= 4 phút chưa có ROSC -> Bắt buộc kích hoạt Mổ bắt con cấp cứu cứu mẹ (PMCD)
    const perimortemCesareanIndicated = Boolean(payload.perimortemCesareanIndicated ?? (cardiacArrestDurationMinutes >= 4));
    const targetDeliveryWithin5Minutes = perimortemCesareanIndicated;
    const maternalFetalSpecialtyHospitalNotified = true;

    incident.maternalResuscitationCare = {
      isMaternalEmergency: true,
      gestationalAgeWeeks,
      uterineFundusAboveUmbilicus,
      manualLeftUterineDisplacementApplied,
      tiltWholeBodyProhibited,
      aortocavalCompressionRelieved,
      cardiacArrestDurationMinutes,
      perimortemCesareanIndicated,
      targetDeliveryWithin5Minutes,
      maternalFetalSpecialtyHospitalNotified,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.maternalResuscitationCare && incident.markModified('maternalResuscitationCare');

    incident.auditTrail.push({
      action: 'MATERNAL_RESUSCITATION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Cấp cứu sản phụ (Tuổi thai=${gestationalAgeWeeks} tuần): Tử cung vượt rốn=${uterineFundusAboveUmbilicus}, Nghiệm pháp LUD đẩy tử cung sang trái=${manualLeftUterineDisplacementApplied}, Cấm nghiêng cả thân=${tiltWholeBodyProhibited}, Thời gian ngừng tim=${cardiacArrestDurationMinutes}p, Chỉ định mổ bắt con cấp cứu PMCD 4-5 phút=${perimortemCesareanIndicated}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      gestationalAgeWeeks,
      uterineFundusAboveUmbilicus,
      manualLeftUterineDisplacementApplied,
      tiltWholeBodyProhibited,
      aortocavalCompressionRelieved,
      cardiacArrestDurationMinutes,
      perimortemCesareanIndicated,
      targetDeliveryWithin5Minutes,
      maternalFetalSpecialtyHospitalNotified,
      clinicalDirectives: [
        'ĐẨY TỬ CUNG SANG TRÁI BẰNG TAY (MANUAL LUD): Dùng 1 hoặc 2 tay đẩy tử cung sang trái nạn nhân để giải phóng hoàn toàn chèn ép tĩnh mạch chủ dưới (IVC) và động mạch chủ bụng, khôi phục 30-40% hồi lưu máu về tim.',
        'GIỮ NẠN NHÂN NẰM NGỬA PHẲNG TRÊN MẶT CỨNG ĐỂ ÉP TIM: Không nghiêng vẹo toàn bộ cơ thể vì sẽ làm giảm 50% lực ép tim CPR.',
        perimortemCesareanIndicated
          ? 'QUY TẮC 4-5 PHÚT VÀNG MỔ BẮT CON CẤP CỨU CỨU MẸ (PMCD / RESUSCITATIVE HYSTEROTOMY): Ngừng tim sau 4 phút không có ROSC, bắt buộc mổ bắt thai ngay tại phút thứ 4-5. Lấy thai ra lập tức giải phóng hoàn toàn chèn ép mạch máu lớn, tăng 80% cơ hội sống sót cho người mẹ và cứu sống thai nhi.'
          : 'TIẾP TỤC HỒI SỨC TIM PHỔI CHUẨN VÀ THEO DÕI TIM THAI.',
      ],
    };
  }

  /**
   * Cấp cứu Tai biến Lặn Biển & Bệnh Giảm Áp Khí Nén Đô Thị (Phân hệ 42)
   * Chuẩn Quốc tế Undersea and Hyperbaric Medical Society (UHMS) & US Navy Diving Manual
   */
  async manageDecompressionSicknessAndCaisson(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const exposureCategory = payload.exposureCategory || 'METRO_TUNNEL_CAISSON_WORKER';
    const symptomType = payload.symptomType || 'TYPE_2_SPINAL_PARALYSIS_CHOKES';
    const highFlowOxygen100Applied = Boolean(payload.highFlowOxygen100Applied ?? true);
    const oxygenFlowRateLpm = Number(payload.oxygenFlowRateLpm ?? 15);
    // Tuyệt đối cấm tự ý đưa nạn nhân xuống nước lặn lại (No In-Water Recompression)
    const inWaterRecompressionStrictlyProhibited = true;
    // Vận chuyển độ cao thấp: giữ cao độ < 300 mét hoặc cabin áp suất chuẩn mực nước biển
    const lowAltitudeEvacuationEnforced = true;
    const maximumFlightAltitudeMeters = Number(payload.maximumFlightAltitudeMeters ?? 300);
    const recompressionChamberIndicated = true;
    const usNavyTable6ProtocolReady = true;

    incident.decompressionSicknessCare = {
      isDecompressionSickness: true,
      exposureCategory,
      symptomType,
      highFlowOxygen100Applied,
      oxygenFlowRateLpm,
      inWaterRecompressionStrictlyProhibited,
      lowAltitudeEvacuationEnforced,
      maximumFlightAltitudeMeters,
      recompressionChamberIndicated,
      usNavyTable6ProtocolReady,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.decompressionSicknessCare && incident.markModified('decompressionSicknessCare');

    incident.auditTrail.push({
      action: 'DECOMPRESSION_SICKNESS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Bệnh giảm áp (${exposureCategory} - ${symptomType}): Oxy 100% NRM=${highFlowOxygen100Applied} (${oxygenFlowRateLpm} L/p), Cấm lặn ép bọt khí dưới nước=${inWaterRecompressionStrictlyProhibited}, Vận chuyển độ cao thấp <${maximumFlightAltitudeMeters}m=${lowAltitudeEvacuationEnforced}, Buồng Oxy Tăng áp Bảng 6 Hải quân=${usNavyTable6ProtocolReady}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      exposureCategory,
      symptomType,
      highFlowOxygen100Applied,
      oxygenFlowRateLpm,
      inWaterRecompressionStrictlyProhibited,
      lowAltitudeEvacuationEnforced,
      maximumFlightAltitudeMeters,
      recompressionChamberIndicated,
      usNavyTable6ProtocolReady,
      clinicalDirectives: [
        'THỞ OXY 100% QUA MASK CÓ TÚI DỰ TRỮ (NRM 15 L/PHÚT): Tạo građien nồng độ khuếch tán Nitơ từ bọt khí ra phế nang, làm co nhỏ kích thước bọt khí và cải thiện oxy hóa tế bào.',
        'NGHIÊM CẤM TỰ Ý ĐƯA NẠN NHÂN LẶN TRỞ LẠI XUỐNG BIỂN (NO IN-WATER RECOMPRESSION): Hành vi ép bọt khí tự phát dưới nước dẫn đến hạ thân nhiệt sâu, đuối nước và tử vong do thiếu thiết bị kiểm soát y tế.',
        'VẬN CHUYỂN BẰNG ĐƯỜNG BỘ HOẶC BAY DƯỚI 300 MÉT (< 1000 FT): Áp suất khí quyển giảm khi lên cao sẽ làm các bọt khí Nitơ giãn nở theo Định luật Boyle gây vỡ mạch và tắc mạch não đột ngột.',
        'CHUYỂN THẲNG TRUNG TÂM BUỒNG TĂNG ÁP OXY CAO ÁP (US NAVY TABLE 6): Điều trị tiêu chuẩn vàng tăng áp suất buồng lên 2.8 ATA để hòa tan hoàn toàn bọt khí Nitơ vào máu.',
      ],
    };
  }

  /**
   * Cấp cứu Sốc Mất Máu Nặng & Hồi Sức Kiểm Soát Tổn Thương (Phân hệ 43)
   * Chuẩn Quốc tế PHTLS, ATLS & Thử nghiệm Lâm sàng CRASH-2 (Axit Tranexamic - TXA)
   */
  async manageHemorrhagicShockAndTxaProtocol(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const estimatedBloodLossMl = Number(payload.estimatedBloodLossMl ?? 1500);
    const systolicBp = Number(payload.systolicBp ?? 80);
    const heartRate = Number(payload.heartRate ?? 125);

    let shockClass = 'CLASS_3_SEVERE';
    if (estimatedBloodLossMl >= 2000 || systolicBp < 70) shockClass = 'CLASS_4_LETHAL';
    else if (estimatedBloodLossMl >= 1500 || systolicBp < 90) shockClass = 'CLASS_3_SEVERE';
    else if (estimatedBloodLossMl >= 750) shockClass = 'CLASS_2_MODERATE';
    else shockClass = 'CLASS_1_MILD';

    const injuryToTxaIntervalMinutes = Number(payload.injuryToTxaIntervalMinutes ?? 45);
    // Chuẩn CRASH-2: TXA 1g tiêm tĩnh mạch trong vòng 3 giờ (180 phút) đầu tiên
    const txaAdministeredWithin3Hours = injuryToTxaIntervalMinutes <= 180;
    const txaContraindicatedAfter3Hours = !txaAdministeredWithin3Hours;
    const txaDoseGrams = txaAdministeredWithin3Hours ? 1.0 : 0.0;

    // Hồi sức kiểm soát tổn thương (DCR): Giới hạn dịch tinh thể < 1000 mL để tránh pha loãng yếu tố đông máu
    const crystalloidLimitedUnder1000Ml = Boolean(payload.crystalloidLimitedUnder1000Ml ?? true);
    // Kích hoạt phác đồ truyền máu khối lượng lớn (MTP 1:1:1)
    const mtpProtocol111Activated = Boolean(payload.mtpProtocol111Activated ?? true);

    incident.hemorrhagicShockDcrCare = {
      isHemorrhagicShock: true,
      shockClass,
      estimatedBloodLossMl,
      systolicBp,
      heartRate,
      injuryToTxaIntervalMinutes,
      txaAdministeredWithin3Hours,
      txaContraindicatedAfter3Hours,
      txaDoseGrams,
      crystalloidLimitedUnder1000Ml,
      mtpProtocol111Activated,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.hemorrhagicShockDcrCare && incident.markModified('hemorrhagicShockDcrCare');

    incident.auditTrail.push({
      action: 'HEMORRHAGIC_SHOCK_DCR_CARE_RECORDED',
      timestamp: new Date(),
      details: `Sốc mất máu (${shockClass}): Mất máu ước tính=${estimatedBloodLossMl}mL, HA=${systolicBp}mmHg, Mạch=${heartRate}bpm, Thời gian từ chấn thương=${injuryToTxaIntervalMinutes}p, TXA 1g IV=${txaAdministeredWithin3Hours ? 'ĐÃ DÙNG TRONG 3H' : 'CHỐNG CHỈ ĐỊNH QUÁ 3H'}, Hạn chế dịch tinh thể <1L=${crystalloidLimitedUnder1000Ml}, Kích hoạt MTP 1:1:1=${mtpProtocol111Activated}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      shockClass,
      estimatedBloodLossMl,
      systolicBp,
      heartRate,
      injuryToTxaIntervalMinutes,
      txaAdministeredWithin3Hours,
      txaContraindicatedAfter3Hours,
      txaDoseGrams,
      crystalloidLimitedUnder1000Ml,
      mtpProtocol111Activated,
      clinicalDirectives: [
        txaAdministeredWithin3Hours
          ? `CHỈ ĐỊNH AXIT TRANEXAMIC (TXA 1G IV TRONG 3 GIỜ ĐẦU - CRASH-2): Tiêm tĩnh mạch chậm trong 10 phút, giảm 30% tử vong do ức chế tiêu sợi huyết.`
          : `CẢNH BÁO CHỐNG CHỈ ĐỊNH TXA QUÁ 3 GIỜ: Thử nghiệm CRASH-2 chứng minh dùng TXA sau 3 giờ (${injuryToTxaIntervalMinutes} phút) làm tăng tỷ lệ tử vong do huyết khối tắc mạch. Không được dùng TXA!`,
        crystalloidLimitedUnder1000Ml
          ? `HỒI SỨC KIỂM SOÁT TỔN THƯƠNG (DCR): Giới hạn dịch tinh thể < 1000 mL để chống pha loãng máu (Hemodilution), hạ thân nhiệt và rối loạn đông máu chấn thương (TIC).`
          : `Cần hạn chế truyền dịch tinh thể ồ ạt.`,
        mtpProtocol111Activated
          ? `KÍCH HOẠT BÁO ĐỘNG ĐỎ TRUYỀN MÁU TỐI KHẨN (MTP 1:1:1): Báo trước Ngân hàng Máu chuẩn bị sẵn Khối hồng cầu : Huyết tương tươi : Tiểu cầu theo tỷ lệ cân bằng 1:1:1.`
          : `Chuẩn bị truyền máu theo phác đồ MTP.`,
      ],
    };
  }

  /**
   * Cấp cứu Hạ Thân Nhiệt Sâu & Kỹ Thuật Làm Ấm Tích Cực (Phân hệ 44)
   * Chuẩn Quốc tế ERC / Wilderness Medical Society (WMS) Accidental Hypothermia
   */
  async manageSevereHypothermiaAndRewarming(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const coreTemperatureCelsius = Number(payload.coreTemperatureCelsius ?? 28.5);

    let hypothermiaStage = 'STAGE_3_SEVERE_24_28';
    if (coreTemperatureCelsius < 24.0) hypothermiaStage = 'STAGE_4_ARREST_UNDER_24';
    else if (coreTemperatureCelsius < 28.0) hypothermiaStage = 'STAGE_3_SEVERE_24_28';
    else if (coreTemperatureCelsius < 32.0) hypothermiaStage = 'STAGE_2_MODERATE_28_32';
    else hypothermiaStage = 'STAGE_1_MILD_32_35';

    // Thao tác cực kỳ nhẹ nhàng (Gentle Handling) tránh kích phát Rung thất (VF)
    const gentleHandlingMaintained = Boolean(payload.gentleHandlingMaintained ?? true);
    // Ủ ấm chủ động vùng lõi (Ngực, nách, bẹn)
    const activeExternalCoreRewarmingApplied = Boolean(payload.activeExternalCoreRewarmingApplied ?? true);
    // Nghiêm cấm sưởi ấm hoặc xoa bóp tứ chi trước (tránh hiện tượng Rewarming Afterdrop)
    const extremityRewarmingProhibitedBeforeCore = true;
    const rewarmingAfterdropPrevented = extremityRewarmingProhibitedBeforeCore;
    // Làm ấm tích cực từ bên trong (Oxy ấm ẩm 42°C và Dịch IV ấm 40°C)
    const activeInternalRewarmingApplied = Boolean(payload.activeInternalRewarmingApplied ?? true);
    // Quy tắc hồi sinh: "Không ai được tuyên bố tử vong cho tới khi được làm ấm"
    const noOneDeadUntilWarmAndDeadRule = true;

    incident.severeHypothermiaCare = {
      isSevereHypothermia: true,
      coreTemperatureCelsius,
      hypothermiaStage,
      gentleHandlingMaintained,
      activeExternalCoreRewarmingApplied,
      extremityRewarmingProhibitedBeforeCore,
      rewarmingAfterdropPrevented,
      activeInternalRewarmingApplied,
      noOneDeadUntilWarmAndDeadRule,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.severeHypothermiaCare && incident.markModified('severeHypothermiaCare');

    incident.auditTrail.push({
      action: 'SEVERE_HYPOTHERMIA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hạ thân nhiệt (${hypothermiaStage} - ${coreTemperatureCelsius}°C): Thao tác nhẹ nhàng=${gentleHandlingMaintained}, Ủ ấm vùng lõi ngực/bẹn/nách=${activeExternalCoreRewarmingApplied}, Cấm sưởi tứ chi trước=${extremityRewarmingProhibitedBeforeCore}, Chống tụt nhiệt Afterdrop=${rewarmingAfterdropPrevented}, Làm ấm trong oxy/dịch 40-42°C=${activeInternalRewarmingApplied}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      coreTemperatureCelsius,
      hypothermiaStage,
      gentleHandlingMaintained,
      activeExternalCoreRewarmingApplied,
      extremityRewarmingProhibitedBeforeCore,
      rewarmingAfterdropPrevented,
      activeInternalRewarmingApplied,
      noOneDeadUntilWarmAndDeadRule,
      clinicalDirectives: [
        'THAO TÁC CỰC KỲ NHẸ NHÀNG (GENTLE HANDLING): Cơ tim hạ thân nhiệt cực kỳ nhạy cảm và dễ kích thích. Tuyệt đối không di chuyển thô bạo hoặc xốc lắc mạnh vì sẽ kích phát Rung Thất (VF) hoặc Vô Tâm Thu ngừng tim.',
        'Ủ ẤM VÙNG LÕI TRƯỚC (ACTIVE CORE REWARMING): Đặt túi chườm ấm 40-42°C tại vùng ngực, nách và hai bẹn.',
        'NGHIÊM CẤM SƯỞI ẤM HOẶC XOA BÓP TỨ CHI TRƯỚC (CHỐNG REWARMING AFTERDROP): Sưởi ấm tay chân trước sẽ làm giãn mạch ngoại vi, đẩy dòng máu lạnh buốt nhiễm toan từ chi dồn về tim, làm nhiệt độ tim tụt sâu thêm gây tử vong tức thì.',
        'LÀM ẤM BÊN TRONG TÍCH CỰC: Cho thở oxy ấm ẩm (40-42°C) và truyền dịch đẳng trương làm ấm 40°C.',
        'QUY TẮC VÀNG HỒI SINH: "Không ai được tuyên bố tử vong cho tới khi được làm ấm và vẫn chết" (No one is dead until warm and dead - thân nhiệt lõi >= 32-35°C).',
      ],
    };
  }

  /**
   * Cấp cứu Cơn Bão Giáp Trạng & Hôn Mê Suy Giáp (Phân hệ 45)
   * Chuẩn Quốc tế American Thyroid Association (ATA) & Endocrine Society
   */
  async manageEndocrineCrisesThyroidStorm(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const crisisType = payload.crisisType || 'THYROID_STORM';
    const burchWartofskyScore = Number(payload.burchWartofskyScore ?? 55); // BWPS >= 45 is Thyroid Storm
    const coreTemperatureCelsius = Number(payload.coreTemperatureCelsius ?? 40.5);
    const heartRateBpm = Number(payload.heartRateBpm ?? 155);

    // CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối cấm dùng Aspirin / Salicylat trong Cơn bão giáp
    // (Aspirin cạnh tranh vị trí gắn kết TBG làm nồng độ T3/T4 tự do trong máu tăng vọt)
    const aspirinStrictlyProhibited = true;
    const safeCoolingMethod = 'PARACETAMOL_AND_ICE_PACKS';
    const betaBlockerAdministered = Boolean(payload.betaBlockerAdministered ?? true); // Propranolol
    const levothyroxineHydrocortisoneReady = crisisType === 'MYXEDEMA_COMA';

    incident.endocrineCrisesCare = {
      isEndocrineCrisis: true,
      crisisType,
      burchWartofskyScore,
      coreTemperatureCelsius,
      heartRateBpm,
      aspirinStrictlyProhibited,
      safeCoolingMethod,
      betaBlockerAdministered,
      levothyroxineHydrocortisoneReady,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.endocrineCrisesCare && incident.markModified('endocrineCrisesCare');

    incident.auditTrail.push({
      action: 'ENDOCRINE_CRISIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Cấp cứu nội tiết (${crisisType}): Thang điểm BWPS=${burchWartofskyScore}, Thân nhiệt=${coreTemperatureCelsius}°C, Mạch=${heartRateBpm}bpm, Tuyệt đối cấm Aspirin=${aspirinStrictlyProhibited}, Hạ nhiệt an toàn=${safeCoolingMethod}, Thuốc chẹn beta=${betaBlockerAdministered}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      crisisType,
      burchWartofskyScore,
      coreTemperatureCelsius,
      heartRateBpm,
      aspirinStrictlyProhibited,
      safeCoolingMethod,
      betaBlockerAdministered,
      levothyroxineHydrocortisoneReady,
      clinicalDirectives: [
        'CẢNH BÁO TỬ VONG: NGHIÊM CẤM TUYỆT ĐỐI DÙNG ASPIRIN / NSAID ĐỂ HẠ SỐT TRONG BÃO GIÁP: Aspirin đẩy hormone T3/T4 ra khỏi protein gắn kết (TBG), làm nồng độ hormone tự do trong máu tăng vọt gây trụy tim mạch tử vong tức thì!',
        'HẠ SỐT AN TOÀN BẰNG PARACETAMOL KẾT HỢP CHƯỜM MÁT: Chỉ dùng Paracetamol liều chuẩn kết hợp túi chườm mát và quạt gió hạ nhiệt.',
        'KIỂM SOÁT NHỊP TIM BẰNG THUỐC CHẸN BETA (PROPRANOLOL): Giảm nhanh nhịp tim cuồng động và ức chế men chuyển đổi T4 thành T3 ở mô ngoại vi.',
        'CHUYỂN THẲNG TRUNG TÂM HỒI SỨC NỘI TIẾT (ICU BV 115 / BV CHỢ RẪY): Chuẩn bị sẵn Propylthiouracil (PTU), dung dịch Lugol (Iod vô cơ) và Hydrocortisone tĩnh mạch.',
      ],
    };
  }

  /**
   * Cấp cứu Ngộ Độc Khí Độc Công Nghiệp & Đô Thị (H2S Knockdown & Clo Cl2) (Phân hệ 46)
   * Chuẩn Quốc tế OSHA / NIOSH & ATSDR Toxicological Profiles
   */
  async manageIndustrialGasPoisoning(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const gasType = payload.gasType || 'HYDROGEN_SULFIDE_H2S';
    const scbaEntryRequired = true;
    const rescuerEntryBlockedWithoutScba = Boolean(payload.rescuerHasScba ? false : true);
    const olfactoryFatigueWarningIssued = true;
    const highFlowOxygen100Administered = Boolean(payload.highFlowOxygen100Administered ?? true);

    let antidoteAdministered = 'NONE';
    if (gasType === 'HYDROGEN_SULFIDE_H2S') {
      antidoteAdministered = payload.antidoteAdministered || 'SODIUM_NITRITE_300MG';
    } else if (gasType === 'CHLORINE_CL2') {
      antidoteAdministered = payload.antidoteAdministered || 'NEBULIZED_SODIUM_BICARBONATE';
    }

    const upwindEvacuationMaintained = Boolean(payload.upwindEvacuationMaintained ?? true);

    incident.industrialGasPoisoningCare = {
      isIndustrialGasPoisoning: true,
      gasType,
      scbaEntryRequired,
      rescuerEntryBlockedWithoutScba,
      olfactoryFatigueWarningIssued,
      highFlowOxygen100Administered,
      antidoteAdministered,
      upwindEvacuationMaintained,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.industrialGasPoisoningCare && incident.markModified('industrialGasPoisoningCare');

    incident.auditTrail.push({
      action: 'INDUSTRIAL_GAS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc khí độc (${gasType}): Cần SCBA=${scbaEntryRequired}, Chặn cứu hộ không SCBA=${rescuerEntryBlockedWithoutScba}, Cảnh báo liệt khứu giác=${olfactoryFatigueWarningIssued}, Thở Oxy 100%=${highFlowOxygen100Administered}, Giải độc=${antidoteAdministered}, Sơ tán đầu gió=${upwindEvacuationMaintained}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      gasType,
      scbaEntryRequired,
      rescuerEntryBlockedWithoutScba,
      olfactoryFatigueWarningIssued,
      highFlowOxygen100Administered,
      antidoteAdministered,
      upwindEvacuationMaintained,
      clinicalDirectives: [
        'CẢNH BÁO TỬ VONG ĐỒNG THỜI: NGHIÊM CẤM LAO VÀO CỐNG NGẦM / BỂ PHỐT KHI CHƯA CÓ BÌNH KHÍ TỰ THỞ SCBA (Cơ chế Multiple Rescuer Casualty): H2S nồng độ cao gây gục ngã tức thì (H2S Knockdown) khiến toàn bộ người vào sau tử vong theo.',
        'CẢNH BÁO LIỆT KHỨU GIÁC (OLFACTORY FATIGUE): Khí H2S làm tê liệt thần kinh khứu giác chỉ sau vài nhịp thở. Không còn ngửi thấy mùi trứng thối KHÔNG CÓ NGHĨA là an toàn mà nồng độ khí độc đang ở mức chết người!',
        'SƠ TÁN ĐẦU GIÓ (UPWIND) & THỞ OXY 100% NRM 15 L/PHÚT: Đưa nạn nhân lên vùng thoáng gió ngược chiều gió, lập tức thở oxy dòng cao cạnh tranh liên kết Cytochrome C Oxidase.',
        gasType === 'HYDROGEN_SULFIDE_H2S'
          ? 'THUỐC GIẢI ĐỘC ĐẶC HIỆU H2S: Dùng Sodium Nitrite 300mg IV tạo Methemoglobin bẫy gốc Sulfide, hoặc Hydroxocobalamin 5g IV.'
          : 'KHÍ DUNG NATRI BICARBONAT 3.75-4.2%: Trung hòa axit HCl tại niêm mạc phế quản chống bỏng hóa chất đường thở.',
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Tim Cấp & Phù Phổi Cấp Huyết Động (Phân hệ 47)
   * Chuẩn Quốc tế AHA / European Society of Cardiology (ESC) Acute Heart Failure
   */
  async manageCardiogenicShockAndPulmonaryEdema(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const killipClass = payload.killipClass || 'KILLIP_3_PULMONARY_EDEMA';
    const systolicBp = Number(payload.systolicBp ?? 160);

    const patientPositioning = 'HIGH_FOWLER_LEGS_DANGLING';
    const cpapBiPapPositivePressureApplied = Boolean(payload.cpapBiPapPositivePressureApplied ?? true);
    const cpapPressureCmH2O = Number(payload.cpapPressureCmH2O ?? 10);

    const pde5InhibitorOrRvInfarctionScreened = Boolean(payload.pde5InhibitorOrRvInfarctionScreened ?? true);
    let nitroglycerinContraindicated = systolicBp < 90 || !pde5InhibitorOrRvInfarctionScreened;
    let nitroglycerinAdministered = !nitroglycerinContraindicated && Boolean(payload.nitroglycerinAdministered ?? true);

    incident.cardiogenicShockPulmonaryEdemaCare = {
      isCardiogenicEmergency: true,
      killipClass,
      patientPositioning,
      cpapBiPapPositivePressureApplied,
      cpapPressureCmH2O,
      systolicBp,
      nitroglycerinAdministered,
      nitroglycerinContraindicated,
      pde5InhibitorOrRvInfarctionScreened,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.cardiogenicShockPulmonaryEdemaCare && incident.markModified('cardiogenicShockPulmonaryEdemaCare');

    incident.auditTrail.push({
      action: 'CARDIOGENIC_PULMONARY_EDEMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Phù phổi cấp / Sốc tim (${killipClass}): Tư thế=${patientPositioning}, Thở CPAP=${cpapBiPapPositivePressureApplied} (${cpapPressureCmH2O} cmH2O), HA tâm thu=${systolicBp}mmHg, Dùng Nitroglycerin=${nitroglycerinAdministered}, Chống chỉ định Nitro=${nitroglycerinContraindicated}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      killipClass,
      patientPositioning,
      cpapBiPapPositivePressureApplied,
      cpapPressureCmH2O,
      systolicBp,
      nitroglycerinAdministered,
      nitroglycerinContraindicated,
      pde5InhibitorOrRvInfarctionScreened,
      clinicalDirectives: [
        'TƯ THẾ NGỒI CAO BUÔNG THÕNG HAI CHÂN (HIGH FOWLER LEGS DANGLING): Tuyệt đối không để nạn nhân nằm phẳng (nằm ngửa sẽ làm máu ùa về phổi gây ngạt thở tử vong tức thì trong vài phút).',
        'THÔNG KHÍ ÁP LỰC DƯƠNG LIÊN TỤC CPAP 8-10 CMH2O: Tạo áp lực dương tống ngược dịch phù từ lòng phế nang vào mô kẽ, giảm công thở và giảm tiền gánh/hậu gánh thất trái.',
        nitroglycerinAdministered
          ? 'XỊT HOẶC NGẬM DƯỚI LƯỠI NITROGLYCERIN 0.4MG: Giãn tĩnh mạch làm giảm tiền gánh tức thì, hạ áp động mạch phổi.'
          : 'CẢNH BÁO CHỐNG CHỈ ĐỊNH NITROGLYCERIN: Huyết áp tụt < 90mmHg, Nhồi máu cơ tim thất phải hoặc có sử dụng thuốc ức chế PDE-5 (Viagra/Cialis) trong 24-48 giờ qua sẽ gây trụy tim tử vong!',
        'CHUYỂN THẲNG TRUNG TÂM TIM MẠCH CAN THIỆP 24/7 (BV NHÂN DÂN 115 / BV TIM TP.HCM): Sẵn sàng phòng thông tim can thiệp mạch vành và bóng đối xung nội động mạch chủ IABP / ECMO.',
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Nhiễm Khuẩn & Gói Giờ Vàng Sepsis (Phân hệ 48)
   * Chuẩn Quốc tế Surviving Sepsis Campaign (SSC) Hour-1 Bundle & Thang điểm qSOFA
   */
  async manageSepticShockAndSepsisHour1Bundle(incidentId, heroId, payload = {}) {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const respiratoryRatePerMin = Number(payload.respiratoryRatePerMin ?? 28);
    const systolicBp = Number(payload.systolicBp ?? 85);
    const gcsScore = Number(payload.gcsScore ?? 13);

    let qSofaScore = 0;
    if (respiratoryRatePerMin >= 22) qSofaScore += 1;
    if (systolicBp <= 100) qSofaScore += 1;
    if (gcsScore < 15) qSofaScore += 1;

    const crystalloidBolusMlPerKg = Number(payload.crystalloidBolusMlPerKg ?? 30);
    const patientWeightKg = Number(payload.patientWeightKg ?? 60);
    const totalCrystalloidInfusedMl = Math.round(crystalloidBolusMlPerKg * patientWeightKg);

    const lactateMmolL = Number(payload.lactateMmolL ?? 4.2);
    const vasopressorNoradrenalineStarted = Boolean(payload.vasopressorNoradrenalineStarted ?? (systolicBp < 90));
    const targetMeanArterialPressureMmHg = 65;

    incident.septicShockSepsisBundleCare = {
      isSepticShock: true,
      qSofaScore,
      respiratoryRatePerMin,
      systolicBp,
      gcsScore,
      crystalloidBolusMlPerKg,
      totalCrystalloidInfusedMl,
      lactateMmolL,
      vasopressorNoradrenalineStarted,
      targetMeanArterialPressureMmHg,
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.septicShockSepsisBundleCare && incident.markModified('septicShockSepsisBundleCare');

    incident.auditTrail.push({
      action: 'SEPTIC_SHOCK_SEPSIS_BUNDLE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Sốc nhiễm khuẩn (qSOFA=${qSofaScore}): Thở=${respiratoryRatePerMin}l/p, HA=${systolicBp}mmHg, GCS=${gcsScore}, Dịch bù=${totalCrystalloidInfusedMl}mL (${crystalloidBolusMlPerKg}mL/kg), Lactate=${lactateMmolL}mmol/L, Vận mạch Noradrenaline=${vasopressorNoradrenalineStarted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      qSofaScore,
      respiratoryRatePerMin,
      systolicBp,
      gcsScore,
      crystalloidBolusMlPerKg,
      totalCrystalloidInfusedMl,
      lactateMmolL,
      vasopressorNoradrenalineStarted,
      targetMeanArterialPressureMmHg,
      clinicalDirectives: [
        `ĐÁNH GIÁ THANG ĐIỂM QSOFA = ${qSofaScore}/3 ĐIỂM: Xác định nguy cơ Sốc Nhiễm Khuẩn (Septic Shock) tối khẩn cấp, nguy cơ tử vong tăng gấp 14 lần.`,
        `GÓI GIỜ VÀNG SURVIVING SEPSIS CAMPAIGN: Bù dịch tinh thể Ringer Lactate chuẩn 30 mL/kg (Tổng liều: ${totalCrystalloidInfusedMl} mL) trong vòng 3 giờ đầu.`,
        `ĐO NỒNG ĐỘ LACTATE MÁU MAO MẠCH: Nồng độ Lactate = ${lactateMmolL} mmol/L (> 4 mmol/L chỉ điểm giảm tưới máu mô sâu và toan chuyển hóa nặng).`,
        `KHỞI ĐỘNG THUỐC VẬN MẠCH NORADRENALINE: Duy trì Huyết áp Động mạch Trung bình MAP >= ${targetMeanArterialPressureMmHg} mmHg khi truyền dịch chưa nâng được huyết áp.`,
        'CHUYỂN THẲNG TRUNG TÂM HỒI SỨC NHIỄM KHUẨN (ICU BV BỆNH NHIỆT ĐỚI / BV CHỢ RẪY): Cấy máu 2 vị trí và dùng kháng sinh phổ rộng đường tĩnh mạch trong vòng 1 giờ đầu tiên (Golden Hour).',
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Mạch Máu Chi Nặng & Garô Giáp Ranh Kèm Hội Chứng Khoang (Phân hệ 49)
   */
  async manageJunctionalVascularTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      injuryLocation = 'GROIN_FEMORAL',
      hemostaticWoundPackingApplied = true,
      junctionalTourniquetApplied = true,
      directPressureDurationMinutes = 3,
      ischemiaTimeMinutes = 45,
      compartmentSyndromeSuspected = true,
      passiveStretchPainPresent = true,
      elevationProhibitedIfCompartment = true,
    } = payload || {};

    incident.junctionalVascularTraumaCare = {
      isVascularTrauma: true,
      injuryLocation,
      hemostaticWoundPackingApplied: Boolean(hemostaticWoundPackingApplied),
      junctionalTourniquetApplied: Boolean(junctionalTourniquetApplied),
      directPressureDurationMinutes: Number(directPressureDurationMinutes) || 3,
      ischemiaTimeMinutes: Number(ischemiaTimeMinutes) || 45,
      compartmentSyndromeSuspected: Boolean(compartmentSyndromeSuspected),
      passiveStretchPainPresent: Boolean(passiveStretchPainPresent),
      elevationProhibitedIfCompartment: Boolean(elevationProhibitedIfCompartment),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.junctionalVascularTraumaCare && incident.markModified('junctionalVascularTraumaCare');

    incident.auditTrail.push({
      action: 'JUNCTIONAL_VASCULAR_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương mạch máu giáp ranh (${injuryLocation}): Packing=${hemostaticWoundPackingApplied}, Junctional Tourniquet=${junctionalTourniquetApplied}, Ép trực tiếp=${directPressureDurationMinutes} phút, Thời gian thiếu máu=${ischemiaTimeMinutes} phút, Hội chứng khoang=${compartmentSyndromeSuspected}, Đau kéo căng thụ động=${passiveStretchPainPresent}, Cấm kê cao chi=${elevationProhibitedIfCompartment}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      injuryLocation,
      hemostaticWoundPackingApplied: Boolean(hemostaticWoundPackingApplied),
      junctionalTourniquetApplied: Boolean(junctionalTourniquetApplied),
      directPressureDurationMinutes: Number(directPressureDurationMinutes) || 3,
      ischemiaTimeMinutes: Number(ischemiaTimeMinutes) || 45,
      compartmentSyndromeSuspected: Boolean(compartmentSyndromeSuspected),
      passiveStretchPainPresent: Boolean(passiveStretchPainPresent),
      elevationProhibitedIfCompartment: Boolean(elevationProhibitedIfCompartment),
      clinicalDirectives: [
        `VẾT THƯƠNG VÙNG GIÁP RANH (${injuryLocation}): Không thể siết garô chi tiêu chuẩn C-A-T. Chèn gạc cầm máu tẩm Chitosan/Kaolin (Hemostatic Wound Packing) sâu vào đáy vết thương kèm đè ép trực tiếp tối thiểu ${directPressureDurationMinutes} phút hoặc đặt Garô Giáp ranh (Junctional Tourniquet - SAM Junctional).`,
        `THEO DÕI THỜI GIAN THIẾU MÁU CỤC BỘ CHI (ISCHEMIA TIME): Hiện tại = ${ischemiaTimeMinutes} phút. Garô quá 2 giờ làm tăng nguy cơ hoại tử chi và tổn thương thần kinh không hồi phục.`,
        `CẢNH BÁO NGUY HIỂM HỘI CHỨNG KHOANG CẤP (COMPARTMENT SYNDROME): Dấu hiệu đau tăng dữ dội khi kéo căng thụ động cơ (Passive Stretch Pain). NGHIÊM CẤM KÊ CAO CHI (Elevation Prohibited) vì làm tụt áp lực tưới máu mao mạch (${elevationProhibitedIfCompartment ? 'TUÂN THỦ TUYỆT ĐỐI' : 'CẢNH BÁO VI PHẠM'}).`,
        'CHUYỂN VIỆN KHẨN CẤP TRUNG TÂM CAN THIỆP MẠCH MÁU (BV CHỢ RẪY / BV BÌNH DÂN / BV 115): Sẵn sàng phẫu thuật mở bao cân giải áp (Fasciotomy) và ghép/tái thông mạch máu trong vòng 6 giờ vàng.',
      ],
    };
  }

  /**
   * Cấp Cứu Tăng Thân Nhiệt Ác Tính & Hội Chứng Serotonin Ngoại Viện (Phân hệ 50)
   */
  async manageHyperthermiaAndSerotoninSyndrome(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      syndromeType = 'SEROTONIN_SYNDROME',
      hunterCriteriaClonusPresent = true,
      leadPipeRigidityPresent = true,
      coreTemperatureCelsius = 41.2,
      antidoteAdministered = 'CYPROHEPTADINE_12MG',
      physicalRestraintsProhibited = true,
      activeExternalCoolingApplied = true,
    } = payload || {};

    incident.hyperthermiaSerotoninSyndromeCare = {
      isHyperthermicSyndrome: true,
      syndromeType,
      hunterCriteriaClonusPresent: Boolean(hunterCriteriaClonusPresent),
      leadPipeRigidityPresent: Boolean(leadPipeRigidityPresent),
      coreTemperatureCelsius: Number(coreTemperatureCelsius) || 41.2,
      antidoteAdministered,
      physicalRestraintsProhibited: Boolean(physicalRestraintsProhibited),
      activeExternalCoolingApplied: Boolean(activeExternalCoolingApplied),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.hyperthermiaSerotoninSyndromeCare && incident.markModified('hyperthermiaSerotoninSyndromeCare');

    incident.auditTrail.push({
      action: 'HYPERTHERMIA_SEROTONIN_SYNDROME_CARE_RECORDED',
      timestamp: new Date(),
      details: `Tăng thân nhiệt ác tính/Serotonin (${syndromeType}): Nhiệt độ=${coreTemperatureCelsius}°C, Giật rung Clonus=${hunterCriteriaClonusPresent}, Co cứng ống chì=${leadPipeRigidityPresent}, Thuốc đặc hiệu=${antidoteAdministered}, Cấm dây trói cưỡng chế=${physicalRestraintsProhibited}, Hạ thân nhiệt ngoại sinh=${activeExternalCoolingApplied}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      syndromeType,
      hunterCriteriaClonusPresent: Boolean(hunterCriteriaClonusPresent),
      leadPipeRigidityPresent: Boolean(leadPipeRigidityPresent),
      coreTemperatureCelsius: Number(coreTemperatureCelsius) || 41.2,
      antidoteAdministered,
      physicalRestraintsProhibited: Boolean(physicalRestraintsProhibited),
      activeExternalCoolingApplied: Boolean(activeExternalCoolingApplied),
      clinicalDirectives: [
        `TIÊU CHUẨN HUNTER CHẨN ĐOÁN HỘI CHỨNG SEROTONIN: Xuất hiện giật rung cơ tự phát hoặc kích thích (Spontaneous/Inducible Clonus) kèm sốt cao ác tính ${coreTemperatureCelsius} °C.`,
        `NGHIÊM CẤM DÙNG BIỆN PHÁP CƯỠNG CHẾ VẬT LÝ (PHYSICAL RESTRAINTS PROHIBITED): Chống chỉ định tuyệt đối dây trói cố định vì co cứng cơ đẳng trường kích hoạt tiêu cơ vân cấp (Rhabdomyolysis), toan chuyển hóa và suy thận cấp tử vong (${physicalRestraintsProhibited ? 'TUÂN THỦ' : 'CẢNH BÁO'}).`,
        `HẠ THÂN NHIỆT NGOẠI SINH TÍCH CỰC & THUỐC ĐẶC HIỆU (${antidoteAdministered}): Phun sương quạt mát, chườm lạnh nách/bẹn. Dùng Dantrolene 2.5 mg/kg IV (Tăng thân nhiệt ác tính do thuốc mê) hoặc Cyproheptadine 12 mg PO/NG (Hội chứng Serotonin kháng Benzodiazepine).`,
        'CHUYỂN THẲNG TRUNG TÂM HỒI SỨC CHỐNG ĐỘC (ICU CHỐNG ĐỘC BV CHỢ RẪY): Bù dịch tinh thể kiềm hóa nước tiểu phòng ngừa tắc ống thận do Myoglobin và thở máy an thần sâu.',
      ],
    };
  }

  /**
   * Giao Thức Hồi Sinh Tim Phổi Ngoài Cơ Thể Tiền Viện ECPR (Phân hệ 51)
   */
  async manageEcprRefractoryCardiacArrest(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      witnessedArrest = true,
      bystanderCprStartedWithin5Min = true,
      initialRhythmShockable = true,
      refractoryShocksCount = 3,
      mechanicalCprDeviceActive = true,
      estimatedTimeToCannulationMinutes = 42,
      ecprPreAlertAcknowledged = true,
    } = payload || {};

    incident.ecprRefractoryArrestCare = {
      isEcprCandidate: true,
      witnessedArrest: Boolean(witnessedArrest),
      bystanderCprStartedWithin5Min: Boolean(bystanderCprStartedWithin5Min),
      initialRhythmShockable: Boolean(initialRhythmShockable),
      refractoryShocksCount: Number(refractoryShocksCount) || 3,
      mechanicalCprDeviceActive: Boolean(mechanicalCprDeviceActive),
      estimatedTimeToCannulationMinutes: Number(estimatedTimeToCannulationMinutes) || 42,
      ecprPreAlertAcknowledged: Boolean(ecprPreAlertAcknowledged),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.ecprRefractoryArrestCare && incident.markModified('ecprRefractoryArrestCare');

    incident.auditTrail.push({
      action: 'ECPR_REFRACTORY_ARREST_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hồi sinh tim phổi ngoài cơ thể ECPR: Chứng kiến=${witnessedArrest}, CPR <5p=${bystanderCprStartedWithin5Min}, Nhịp sốc được=${initialRhythmShockable}, Sốc điện kháng trị=${refractoryShocksCount} lần, Thiết bị ép tim cơ học=${mechanicalCprDeviceActive}, Thời gian luồn Cannula=${estimatedTimeToCannulationMinutes} phút, Báo động kíp ECPR=${ecprPreAlertAcknowledged}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      witnessedArrest: Boolean(witnessedArrest),
      bystanderCprStartedWithin5Min: Boolean(bystanderCprStartedWithin5Min),
      initialRhythmShockable: Boolean(initialRhythmShockable),
      refractoryShocksCount: Number(refractoryShocksCount) || 3,
      mechanicalCprDeviceActive: Boolean(mechanicalCprDeviceActive),
      estimatedTimeToCannulationMinutes: Number(estimatedTimeToCannulationMinutes) || 42,
      ecprPreAlertAcknowledged: Boolean(ecprPreAlertAcknowledged),
      clinicalDirectives: [
        `TIÊU CHUẨN TIẾP CẬN ECPR NGOẠI VIỆN: Ngưng tim có người chứng kiến, CPR chất lượng cao trong 5 phút đầu, nhịp ban đầu có thể sốc điện kháng trị sau ${refractoryShocksCount} lần sốc điện (${witnessedArrest && bystanderCprStartedWithin5Min && initialRhythmShockable ? 'ĐẠT TIÊU CHUẨN VÀNG' : 'CÂN NHẮC HỘI CHẨN'}).`,
        `HỒI SINH TIM PHỔI BẰNG THIẾT BỊ CƠ HỌC (LUCAS / AUTOPULSE): Duy trì ép tim liên tục không gián đoạn trong suốt quá trình vận chuyển (${mechanicalCprDeviceActive ? 'THIẾT BỊ ĐANG HOẠT ĐỘNG TỐT' : 'YÊU CẦU LẮP THIẾT BỊ'}).`,
        `THỜI GIAN VÀNG TIẾP CẬN VÀ LUỒN CANNULA ĐỘNG/TĨNH MẠCH ĐÙI < 60 PHÚT: Ước tính thời gian tiếp cận = ${estimatedTimeToCannulationMinutes} phút (Đạt mốc vàng bảo tồn tưới máu não).`,
        'KÍCH HOẠT TIỀN BÁO ĐỘI ECPR TRUNG TÂM ECMO (BV CHỢ RẪY / BV NHÂN DÂN 115): Sẵn sàng kíp can thiệp tim mạch, máy ECMO và buồng Cath Lab mở cửa đón trực tiếp tại sảnh cấp cứu.',
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Cột Sống Ngực - Thắt Lưng & Liệt Tủy Cấp (Phân hệ 52)
   */
  async manageThoracolumbarSpineTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      asiaImpairmentScale = 'ASIA_A_COMPLETE',
      logRoll4PersonTechniqueApplied = true,
      vacuumMattressApplied = true,
      rigidSpineBoardRemovedWithin30Min = true,
      priapismOrSphincterLossDetected = false,
      spinalShockWatchdogActive = true,
    } = payload || {};

    incident.thoracolumbarSpinalTraumaCare = {
      isSpinalTrauma: true,
      asiaImpairmentScale,
      logRoll4PersonTechniqueApplied: Boolean(logRoll4PersonTechniqueApplied),
      vacuumMattressApplied: Boolean(vacuumMattressApplied),
      rigidSpineBoardRemovedWithin30Min: Boolean(rigidSpineBoardRemovedWithin30Min),
      priapismOrSphincterLossDetected: Boolean(priapismOrSphincterLossDetected),
      spinalShockWatchdogActive: Boolean(spinalShockWatchdogActive),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.thoracolumbarSpinalTraumaCare && incident.markModified('thoracolumbarSpinalTraumaCare');

    incident.auditTrail.push({
      action: 'THORACOLUMBAR_SPINAL_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương cột sống ngực-thắt lưng (ASIA=${asiaImpairmentScale}): Log-roll 4 người=${logRoll4PersonTechniqueApplied}, Đệm chân không=${vacuumMattressApplied}, Rút ván cứng <30p=${rigidSpineBoardRemovedWithin30Min}, Mất cơ thắt/Cương dương=${priapismOrSphincterLossDetected}, Watchdog sốc tủy=${spinalShockWatchdogActive}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      asiaImpairmentScale,
      logRoll4PersonTechniqueApplied: Boolean(logRoll4PersonTechniqueApplied),
      vacuumMattressApplied: Boolean(vacuumMattressApplied),
      rigidSpineBoardRemovedWithin30Min: Boolean(rigidSpineBoardRemovedWithin30Min),
      priapismOrSphincterLossDetected: Boolean(priapismOrSphincterLossDetected),
      spinalShockWatchdogActive: Boolean(spinalShockWatchdogActive),
      clinicalDirectives: [
        `PHÂN ĐỘ TỔN THƯƠNG TỦY THANG ĐIỂM ASIA = ${asiaImpairmentScale}: Đánh giá mức độ liệt vận động và cảm giác dưới khoanh tủy ngực/thắt lưng.`,
        `KỸ THUẬT LĂN XOAY KHÚC GỖ (LOG-ROLL 4 PERSONS) & CỐ ĐỊNH TRỤC: Duy trì đầu-cổ-ngực-thắt lưng trên một đường thẳng tuyệt đối (${logRoll4PersonTechniqueApplied ? 'TUÂN THỦ' : 'CẢNH BÁO'}). Nghiêm cấm vặn xoắn thân mình.`,
        `QUY TẮC RÚT VÁN CỨNG (LONG SPINE BOARD) DƯỚI 30 PHÚT: Chuyển nạn nhân sang Đệm hút chân không (Vacuum Mattress) càng sớm càng tốt (${rigidSpineBoardRemovedWithin30Min ? 'ĐẠT CHUẨN PHTLS' : 'NGUY CƠ LOÉT TÌ ĐÈ'}). Nằm ván cứng quá 30 phút gây thiếu máu mô cùng cụt.`,
        'CHUYỂN VIỆN KHẨN CẤP TRUNG TÂM PHẪU THUẬT CỘT SỐNG (BV CHẤN THƯƠNG CHỈNH HÌNH / BV 115 / BV CHỢ RẪY): Chụp CT/MRI khẩn cấp và phẫu thuật làm vững cột sống giải ép tủy.',
      ],
    };
  }

  /**
   * Cấp Cứu Phù Não & Phù Phổi Độ Cao / Thiếu Khí (Phân hệ 53)
   */
  async manageHighAltitudeCerebralAndPulmonaryEdema(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      altitudeMeters = 3143,
      lakeLouiseScore = 5,
      immediateDescentStarted = true,
      descentAltitudeMeters = 1000,
      gamowHyperbaricBagApplied = true,
      dexamethasoneAdministered = true,
      nifedipineAdministered = true,
      highFlowOxygenApplied = true,
    } = payload || {};

    incident.highAltitudeCerebralPulmonaryEdemaCare = {
      isAltitudeIllness: true,
      altitudeMeters: Number(altitudeMeters) || 3143,
      lakeLouiseScore: Number(lakeLouiseScore) || 5,
      immediateDescentStarted: Boolean(immediateDescentStarted),
      descentAltitudeMeters: Number(descentAltitudeMeters) || 1000,
      gamowHyperbaricBagApplied: Boolean(gamowHyperbaricBagApplied),
      dexamethasoneAdministered: Boolean(dexamethasoneAdministered),
      nifedipineAdministered: Boolean(nifedipineAdministered),
      highFlowOxygenApplied: Boolean(highFlowOxygenApplied),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.highAltitudeCerebralPulmonaryEdemaCare && incident.markModified('highAltitudeCerebralPulmonaryEdemaCare');

    incident.auditTrail.push({
      action: 'HIGH_ALTITUDE_EDEMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Phù não/phù phổi độ cao (Độ cao=${altitudeMeters}m, Lake Louise=${lakeLouiseScore}): Hạ độ cao khẩn cấp=${immediateDescentStarted} (-${descentAltitudeMeters}m), Túi tăng áp Gamow=${gamowHyperbaricBagApplied}, Dexamethasone=${dexamethasoneAdministered}, Nifedipine=${nifedipineAdministered}, Oxy cao=${highFlowOxygenApplied}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      altitudeMeters: Number(altitudeMeters) || 3143,
      lakeLouiseScore: Number(lakeLouiseScore) || 5,
      immediateDescentStarted: Boolean(immediateDescentStarted),
      descentAltitudeMeters: Number(descentAltitudeMeters) || 1000,
      gamowHyperbaricBagApplied: Boolean(gamowHyperbaricBagApplied),
      dexamethasoneAdministered: Boolean(dexamethasoneAdministered),
      nifedipineAdministered: Boolean(nifedipineAdministered),
      highFlowOxygenApplied: Boolean(highFlowOxygenApplied),
      clinicalDirectives: [
        `ĐÁNH GIÁ THANG ĐIỂM LAKE LOUISE = ${lakeLouiseScore} ĐIỂM TẠI ĐỘ CAO ${altitudeMeters}M: Xác định Hội chứng Phù não độ cao (HACE) hoặc Phù phổi độ cao (HAPE) đe dọa tính mạng.`,
        `NGUYÊN TẮC SỐNG CÒN SỐ 1: HẠ ĐỘ CAO KHẨN CẤP (IMMEDIATE DESCENT): Hạ độ cao ngay lập tức tối thiểu ${descentAltitudeMeters}m (${immediateDescentStarted ? 'ĐANG TIẾN HÀNH' : 'CẦN BẮT ĐẦU NGAY'}). Không loại thuốc nào thay thế được việc hạ độ cao.`,
        `TÚI TĂNG ÁP DI ĐỘNG GAMOW BAG & OXY 100%: Duy trì áp lực buồng tương đương hạ thấp 1500m kết hợp thở oxy dòng cao (${gamowHyperbaricBagApplied ? 'ĐANG HOẠT ĐỘNG' : 'SẴN SÀNG'}).`,
        'PHÁC ĐỒ DƯỢC LÝ ĐẶC HIỆU: Dexamethasone 8mg PO/IV liều đầu cho phù não HACE; Nifedipine phóng thích kéo dài 20-30mg làm hạ áp lực động mạch phổi cho HAPE; chuyển tuyến điều trị Oxy Cao Áp.',
      ],
    };
  }

  /**
   * Sơ Cứu Bỏng Lạnh Đô Thị & Tổn Thương Do Khí Hóa Lỏng Nitơ/CO2 (Phân hệ 54)
   */
  async manageCryogenicFrostbiteInjury(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      frostbiteDegree = 'GRADE_2_CLEAR_BLISTER',
      rapidRewarmingWaterTempCelsius = 38.5,
      frictionRubbingStrictlyProhibited = true,
      refreezingRiskPrevented = true,
      thromboxaneInhibitorIbuprofenGiven = true,
      aloeVeraSterileDressingApplied = true,
    } = payload || {};

    incident.cryogenicFrostbiteCare = {
      isCryogenicInjury: true,
      frostbiteDegree,
      rapidRewarmingWaterTempCelsius: Number(rapidRewarmingWaterTempCelsius) || 38.5,
      frictionRubbingStrictlyProhibited: Boolean(frictionRubbingStrictlyProhibited),
      refreezingRiskPrevented: Boolean(refreezingRiskPrevented),
      thromboxaneInhibitorIbuprofenGiven: Boolean(thromboxaneInhibitorIbuprofenGiven),
      aloeVeraSterileDressingApplied: Boolean(aloeVeraSterileDressingApplied),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.cryogenicFrostbiteCare && incident.markModified('cryogenicFrostbiteCare');

    incident.auditTrail.push({
      action: 'CRYOGENIC_FROSTBITE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Bỏng lạnh/Khí hóa lỏng (${frostbiteDegree}): Ngâm nước ấm=${rapidRewarmingWaterTempCelsius}°C, Cấm chà xát xoa bóp=${frictionRubbingStrictlyProhibited}, Chống tái đóng băng=${refreezingRiskPrevented}, Kháng Thromboxane Ibuprofen=${thromboxaneInhibitorIbuprofenGiven}, Băng Aloe Vera=${aloeVeraSterileDressingApplied}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      frostbiteDegree,
      rapidRewarmingWaterTempCelsius: Number(rapidRewarmingWaterTempCelsius) || 38.5,
      frictionRubbingStrictlyProhibited: Boolean(frictionRubbingStrictlyProhibited),
      refreezingRiskPrevented: Boolean(refreezingRiskPrevented),
      thromboxaneInhibitorIbuprofenGiven: Boolean(thromboxaneInhibitorIbuprofenGiven),
      aloeVeraSterileDressingApplied: Boolean(aloeVeraSterileDressingApplied),
      clinicalDirectives: [
        `PHÂN ĐỘ BỎNG LẠNH HENNEPIN = ${frostbiteDegree}: Đánh giá mức độ tổn thương mô do nhiệt độ cực âm đông kết tế bào và tắc mạch vi tuần hoàn.`,
        `KỸ THUẬT LÀM ẤM LẠI NHANH (RAPID REWARMING): Ngâm phần chi bị tổn thương trong bồn nước ấm ${rapidRewarmingWaterTempCelsius} °C (chuẩn 37-39 °C) trong 15-30 phút cho đến khi da mềm và hồng hào trở lại.`,
        `NGHIÊM CẤM MA SÁT XOA BÓP & CẤM RÃ ĐÔNG NẾU CÓ NGUY CƠ TÁI ĐÓNG BĂNG: Tuyệt đối không chà xát tuyết/đá lên vết thương vì tinh thể băng sẽ cứa đứt tế bào (${frictionRubbingStrictlyProhibited ? 'TUÂN THỦ' : 'CẢNH BÁO'}). CẤM rã đông nếu trên đường chuyển viện chi có thể bị đông đá trở lại (Refreezing injury gây hoại tử 100%).`,
        'THUỐC ỨC CHẾ THROMBOXANE & BẢO TỒN CHI: Dùng Ibuprofen 12 mg/kg/ngày ức chế Thromboxane A2 chống co mạch hoại tử, băng gạc vô khuẩn tẩm Aloe Vera lỏng tay và chuyển Trung tâm Bỏng & Vi phẫu (BV Chợ Rẫy / BV Chấn Thương Chỉnh Hình).',
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Độc Tố Vi Khuẩn & Viêm Cân Mạc Hoại Tử (Phân hệ 55)
   */
  async manageNecrotizingFasciitisAndTss(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      lrinecScore = 6,
      painOutOfProportion = true,
      subcutaneousCrepitusPresent = false,
      clindamycinToxinInhibitionGiven = true,
      emergencySurgicalDebridementAlerted = true,
    } = payload || {};

    incident.necrotizingFasciitisCare = {
      isNecrotizingFasciitis: true,
      lrinecScore: Number(lrinecScore) || 6,
      painOutOfProportion: Boolean(painOutOfProportion),
      subcutaneousCrepitusPresent: Boolean(subcutaneousCrepitusPresent),
      clindamycinToxinInhibitionGiven: Boolean(clindamycinToxinInhibitionGiven),
      emergencySurgicalDebridementAlerted: Boolean(emergencySurgicalDebridementAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.necrotizingFasciitisCare && incident.markModified('necrotizingFasciitisCare');

    incident.auditTrail.push({
      action: 'NECROTIZING_FASCIITIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Viêm cân mạc hoại tử/TSS (LRINEC=${lrinecScore}): Đau vượt tỷ lệ=${painOutOfProportion}, Lạo xạo dưới da=${subcutaneousCrepitusPresent}, Kháng sinh Clindamycin=${clindamycinToxinInhibitionGiven}, Báo động phẫu thuật cắt lọc=${emergencySurgicalDebridementAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      lrinecScore: Number(lrinecScore) || 6,
      painOutOfProportion: Boolean(painOutOfProportion),
      subcutaneousCrepitusPresent: Boolean(subcutaneousCrepitusPresent),
      clindamycinToxinInhibitionGiven: Boolean(clindamycinToxinInhibitionGiven),
      emergencySurgicalDebridementAlerted: Boolean(emergencySurgicalDebridementAlerted),
      clinicalDirectives: [
        `ĐÁNH GIÁ THANG ĐIỂM LRINEC = ${lrinecScore} ĐIỂM: Xác định nguy cơ cao Viêm cân mạc hoại tử (Necrotizing Fasciitis do Group A Strep hoặc vi khuẩn kỵ khí sinh hơi).`,
        `DẤU HIỆU CẢNH BÁO ĐỎ LÂM SÀNG: Đau đớn dữ dội vượt xa tổn thương bề mặt (${painOutOfProportion ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), dấu lạo xạo dưới da do sinh khí (${subcutaneousCrepitusPresent ? 'CÓ' : 'CHƯA PHÁT HIỆN'}). Phù nề tiến triển nhanh theo từng giờ.`,
        `KHÁNG SINH ĐẶC HIỆU ỨC CHẾ ĐỘC TỐ (CLINDAMYCIN IV): Dùng Clindamycin 600-900mg IV để ức chế trực tiếp ribosome vi khuẩn ngừng sinh ngoại độc tố (${clindamycinToxinInhibitionGiven ? 'ĐÃ DÙNG' : 'CẦN CHỈ ĐỊNH'}) kết hợp kháng sinh phổ rộng và hồi sức dịch 30 mL/kg.`,
        'BÁO ĐỘNG ĐỎ PHẪU THUẬT CẤP CỨU (EMERGENCY SURGICAL DEBRIDEMENT): Rạch bao cân cắt lọc mô hoại tử khẩn cấp trong vòng <6 giờ tại Trung tâm Phẫu thuật Cấp cứu (BV Chợ Rẫy / BV Bệnh Nhiệt Đới / BV 115). "Phẫu thuật là cứu mạng".',
      ],
    };
  }

  /**
   * Cấp Cứu Khối Máu Tụ Sau Nhãn Cầu & Mở Góc Mắt Giải Áp Ngoại Viện (Phân hệ 56)
   */
  async manageRetrobulbarHematomaAndCanthotomy(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      rockHardProptosis = true,
      relativeAfferentPupillaryDefect = true,
      intraocularPressureMmHg = 45,
      ischemiaTimeMinutes = 35,
      lateralCanthotomyCantholysisPrepared = true,
    } = payload || {};

    incident.retrobulbarHematomaCare = {
      isRetrobulbarHematoma: true,
      rockHardProptosis: Boolean(rockHardProptosis),
      relativeAfferentPupillaryDefect: Boolean(relativeAfferentPupillaryDefect),
      intraocularPressureMmHg: Number(intraocularPressureMmHg) || 45,
      ischemiaTimeMinutes: Number(ischemiaTimeMinutes) || 35,
      lateralCanthotomyCantholysisPrepared: Boolean(lateralCanthotomyCantholysisPrepared),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.retrobulbarHematomaCare && incident.markModified('retrobulbarHematomaCare');

    incident.auditTrail.push({
      action: 'RETROBULBAR_HEMATOMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Khối máu tụ sau nhãn cầu (IOP=${intraocularPressureMmHg}mmHg, Thiếu máu=${ischemiaTimeMinutes}p): Lồi mắt cứng=${rockHardProptosis}, RAPD=${relativeAfferentPupillaryDefect}, Sẵn sàng mở góc mắt Lateral Canthotomy=${lateralCanthotomyCantholysisPrepared}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      rockHardProptosis: Boolean(rockHardProptosis),
      relativeAfferentPupillaryDefect: Boolean(relativeAfferentPupillaryDefect),
      intraocularPressureMmHg: Number(intraocularPressureMmHg) || 45,
      ischemiaTimeMinutes: Number(ischemiaTimeMinutes) || 35,
      lateralCanthotomyCantholysisPrepared: Boolean(lateralCanthotomyCantholysisPrepared),
      clinicalDirectives: [
        `HỘI CHỨNG KHOANG HỐC MẮT (ORBITAL COMPARTMENT SYNDROME): Nhãn áp tăng vọt IOP = ${intraocularPressureMmHg} mmHg (ngưỡng nguy kịch >40 mmHg), nhãn cầu căng cứng như đá (${rockHardProptosis ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}).`,
        `THỜI GIAN VÀNG CỨU THỊ LỰC: Thời gian thiếu máu thần kinh thị giác hiện tại = ${ischemiaTimeMinutes} phút. Vạch đỏ 60-90 phút trước khi hoại tử teo dây thần kinh thị giác số II vĩnh viễn!`,
        `KỸ THUẬT MỞ GÓC MẮT NGOÀI & CẮT DÂY CHẰNG MI DƯỚI (LATERAL CANTHOTOMY & INFERIOR CANTHOLYSIS): Giải áp khẩn cấp khoang hốc mắt (${lateralCanthotomyCantholysisPrepared ? 'SẴN SÀNG/TIẾN HÀNH' : 'CHỈ ĐỊNH KHẨN'}). Thủ thuật duy nhất hạ nhãn áp tức thì cứu thị lực.`,
        'ĐIỀU PHỐI KHẨN CẤP TRUNG TÂM MẮT CHUYÊN SÂU: Chuyển ngay về Bệnh viện Mắt TP.HCM hoặc Khoa Chấn thương Mắt & Hàm Mặt BV Chợ Rẫy.',
      ],
    };
  }

  /**
   * Cấp Cứu Ngộ Độc Thuốc Tê Cục Bộ Toàn Thân (Phân hệ 57)
   */
  async manageLastToxicityAndLipidRescue(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      localAnestheticAgent = 'BUPIVACAINE',
      perioralNumbnessMetallicTaste = true,
      seizuresOrRefractoryArrhythmia = true,
      lipidEmulsion20PercentBolusGiven = true,
      lipidInfusionRateMlKgMin = 0.25,
      vasopressinAndCalciumBlockersProhibited = true,
    } = payload || {};

    incident.lastToxicityLipidCare = {
      isLastToxicity: true,
      localAnestheticAgent,
      perioralNumbnessMetallicTaste: Boolean(perioralNumbnessMetallicTaste),
      seizuresOrRefractoryArrhythmia: Boolean(seizuresOrRefractoryArrhythmia),
      lipidEmulsion20PercentBolusGiven: Boolean(lipidEmulsion20PercentBolusGiven),
      lipidInfusionRateMlKgMin: Number(lipidInfusionRateMlKgMin) || 0.25,
      vasopressinAndCalciumBlockersProhibited: Boolean(vasopressinAndCalciumBlockersProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.lastToxicityLipidCare && incident.markModified('lastToxicityLipidCare');

    incident.auditTrail.push({
      action: 'LAST_TOXICITY_LIPID_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc thuốc tê toàn thân LAST (${localAnestheticAgent}): Tê quanh miệng/vị kim loại=${perioralNumbnessMetallicTaste}, Co giật/loạn nhịp=${seizuresOrRefractoryArrhythmia}, Bolus Lipid 20%=${lipidEmulsion20PercentBolusGiven}, Duy trì Lipid=${lipidInfusionRateMlKgMin} mL/kg/phút, Cấm Vasopressin/Chẹn kênh Ca=${vasopressinAndCalciumBlockersProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      localAnestheticAgent,
      perioralNumbnessMetallicTaste: Boolean(perioralNumbnessMetallicTaste),
      seizuresOrRefractoryArrhythmia: Boolean(seizuresOrRefractoryArrhythmia),
      lipidEmulsion20PercentBolusGiven: Boolean(lipidEmulsion20PercentBolusGiven),
      lipidInfusionRateMlKgMin: Number(lipidInfusionRateMlKgMin) || 0.25,
      vasopressinAndCalciumBlockersProhibited: Boolean(vasopressinAndCalciumBlockersProhibited),
      clinicalDirectives: [
        `NGỘ ĐỘC THUỐC TÊ TOÀN THÂN (LAST) DO ${localAnestheticAgent}: Xuất hiện triệu chứng thần kinh sớm (tê quanh miệng, vị kim loại, kích thích) tiến triển sang co giật và loạn nhịp tim thất nguy kịch.`,
        `GIẢI ĐỘC ĐẶC HIỆU BẰNG NHŨ DỊCH LIPID 20% (INTRALIPID 20%): Bolus ngay 1.5 mL/kg trong 2-3 phút (${lipidEmulsion20PercentBolusGiven ? 'ĐÃ BOLUS' : 'CẦN BOLUS NGAY'}), sau đó truyền duy trì ${lipidInfusionRateMlKgMin} mL/kg/phút theo cơ chế "Bồn rửa Lipid" (Lipid Sink).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối NGHIÊM CẤM dùng Vasopressin, thuốc chẹn thụ thể beta và chẹn kênh calci (${vasopressinAndCalciumBlockersProhibited ? 'TUÂN THỦ CHẶT CHẼ' : 'CẢNH BÁO'}). Giảm liều Adrenaline/Epinephrine <1 mcg/kg.`,
        'CHUYỂN VIỆN HỒI SỨC CẤP CỨU ĐẶC BIỆT: Báo động Trung tâm Chống Độc & Can thiệp Tim mạch (BV Chợ Rẫy / BV 115) chuẩn bị ECMO hỗ trợ nếu ngừng tuần hoàn kéo dài.',
      ],
    };
  }

  /**
   * Cấp Cứu Thuyên Tắc Phổi Diện Rộng & Tắc Mạch Ối (Phân hệ 58)
   */
  async manageMassivePulmonaryEmbolismAndAfe(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      wellsScore = 6,
      isAmnioticFluidEmbolism = false,
      acuteRightHeartStrainSigns = true,
      systemicThrombolysisIndicated = true,
      cautiousFluidsUnder500Ml = true,
    } = payload || {};

    incident.massivePulmonaryEmbolismCare = {
      isMassivePulmonaryEmbolism: true,
      wellsScore: Number(wellsScore) || 6,
      isAmnioticFluidEmbolism: Boolean(isAmnioticFluidEmbolism),
      acuteRightHeartStrainSigns: Boolean(acuteRightHeartStrainSigns),
      systemicThrombolysisIndicated: Boolean(systemicThrombolysisIndicated),
      cautiousFluidsUnder500Ml: Boolean(cautiousFluidsUnder500Ml),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.massivePulmonaryEmbolismCare && incident.markModified('massivePulmonaryEmbolismCare');

    incident.auditTrail.push({
      action: 'MASSIVE_PE_AFE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Thuyên tắc phổi/Tắc mạch ối (Wells=${wellsScore}, AFE=${isAmnioticFluidEmbolism}): Dấu suy tim phải=${acuteRightHeartStrainSigns}, Chỉ định tiêu sợi huyết tPA=${systemicThrombolysisIndicated}, Bù dịch thận trọng <500mL=${cautiousFluidsUnder500Ml}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isMassivePulmonaryEmbolism: true,
      wellsScore: Number(wellsScore) || 6,
      isAmnioticFluidEmbolism: Boolean(isAmnioticFluidEmbolism),
      acuteRightHeartStrainSigns: Boolean(acuteRightHeartStrainSigns),
      systemicThrombolysisIndicated: Boolean(systemicThrombolysisIndicated),
      cautiousFluidsUnder500Ml: Boolean(cautiousFluidsUnder500Ml),
      clinicalDirectives: [
        `ĐÁNH GIÁ THANG ĐIỂM WELLS PE = ${wellsScore} ĐIỂM / TẮC MẠCH ỐI (AFE): Xác định nguy cơ cao Thuyên tắc phổi diện rộng hoặc Thuyên tắc ối gây tắc nghẽn cấp thân động mạch phổi.`,
        `HỘI CHỨNG SUY THẤT PHẢI CẤP & TỤT HUYẾT ÁP: Áp lực thất phải tăng vọt (${acuteRightHeartStrainSigns ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}). Tĩnh mạch cổ nổi, SpO2 tụt sâu, huyết áp kẹp.`,
        `HỒI SỨC DỊCH THẬN TRỌNG & VẬN MẠCH SỚM: Bắt buộc giới hạn dịch truyền tinh thể <= 500 mL (${cautiousFluidsUnder500Ml ? 'TUÂN THỦ' : 'CẢNH BÁO'}). Nghiêm cấm bù dịch ồ ạt vì gây quá tải làm buồng thất phải giãn to đè sập thất trái; dùng Noradrenaline nâng huyết áp.`,
        'CHỈ ĐỊNH TIÊU SỢI HUYẾT TOÀN THÂN (ALTEPLASE tPA) & V-A ECMO: Kích hoạt Đội Phản ứng Nhanh Tim mạch Can thiệp BV Chợ Rẫy / BV 115 / BV Từ Dũ sẵn sàng tiêu sợi huyết cấp cứu hoặc đặt ECMO hỗ trợ tuần hoàn.',
      ],
    };
  }

  /**
   * Cấp Cứu Vỡ Thực Quản Do Áp Lực & Tràn Khí Trung Thất (Phân hệ 59)
   */
  async manageEsophagealRuptureAndMediastinitis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      macklerTriadPresent = true,
      hammanSignCrunchPresent = false,
      strictNpoProhibitedOralIntake = true,
      blindNasogastricTubeProhibited = true,
      broadSpectrumAntibioticsGiven = true,
    } = payload || {};

    incident.esophagealRuptureCare = {
      isEsophagealRupture: true,
      macklerTriadPresent: Boolean(macklerTriadPresent),
      hammanSignCrunchPresent: Boolean(hammanSignCrunchPresent),
      strictNpoProhibitedOralIntake: Boolean(strictNpoProhibitedOralIntake),
      blindNasogastricTubeProhibited: Boolean(blindNasogastricTubeProhibited),
      broadSpectrumAntibioticsGiven: Boolean(broadSpectrumAntibioticsGiven),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.esophagealRuptureCare && incident.markModified('esophagealRuptureCare');

    incident.auditTrail.push({
      action: 'ESOPHAGEAL_RUPTURE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ thực quản Boerhaave: Tam chứng Mackler=${macklerTriadPresent}, Tiếng lạo xạo Hamman=${hammanSignCrunchPresent}, Cấm ăn uống NPO=${strictNpoProhibitedOralIntake}, Cấm sonde dạ dày mù=${blindNasogastricTubeProhibited}, Kháng sinh=${broadSpectrumAntibioticsGiven}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isEsophagealRupture: true,
      macklerTriadPresent: Boolean(macklerTriadPresent),
      hammanSignCrunchPresent: Boolean(hammanSignCrunchPresent),
      strictNpoProhibitedOralIntake: Boolean(strictNpoProhibitedOralIntake),
      blindNasogastricTubeProhibited: Boolean(blindNasogastricTubeProhibited),
      broadSpectrumAntibioticsGiven: Boolean(broadSpectrumAntibioticsGiven),
      clinicalDirectives: [
        `TAM CHỨNG MACKLER TRONG HỘI CHỨNG BOERHAAVE: Nhận diện (1) Nôn ói dữ dội, (2) Đau ngực đột ngột dữ dội xuyên lưng, (3) Tràn khí dưới da vùng cổ (${macklerTriadPresent ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}). Dấu hiệu Hamman (${hammanSignCrunchPresent ? 'CÓ' : 'CHƯA'}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG SỐ 1: TUYỆT ĐỐI CẤM ĂN UỐNG (STRICT NPO): Nghiêm cấm cho bệnh nhân ăn hoặc uống bất cứ thứ gì (${strictNpoProhibitedOralIntake ? 'TUÂN THỦ' : 'CẢNH BÁO'}). Thức ăn và nước uống sẽ tràn thẳng vào khoang trung thất gây sốc nhiễm trùng tử vong.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG SỐ 2: NGHIÊM CẤM ĐẶT ỐNG THÔNG DẠ DÀY MÙ (BLIND NGT PROHIBITED): Tuyệt đối không đặt sonde dạ dày mò mẫm (${blindNasogastricTubeProhibited ? 'TUÂN THỦ' : 'CẢNH BÁO'}) vì ống sẽ đâm xuyên qua vết rách thực quản vào màng phổi.`,
        'BÁO ĐỘNG ĐỎ NGOẠI LỒNG NGỰC CẤP CỨU: Dùng kháng sinh phổ rộng IV phủ vi khuẩn kỵ khí và chuyển hỏa tốc Trung tâm Phẫu thuật Lồng ngực (BV Chợ Rẫy / BV 115 / BV Bình Dân) khâu vết rách thực quản trong vòng 12-24 giờ vàng.',
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Vỡ Bàng Quang & Đứt Niệu Đạo Phức Tạp (Phân hệ 60)
   */
  async manageBladderAndUrethralTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      bloodAtUrethralMeatus = true,
      butterflyPerinealHematoma = true,
      blindFoleyCatheterizationStrictlyProhibited = true,
      retrogradeUrethrographyIndicated = true,
      suprapubicCystostomyPrepared = true,
    } = payload || {};

    incident.bladderUrethralTraumaCare = {
      isBladderUrethralTrauma: true,
      bloodAtUrethralMeatus: Boolean(bloodAtUrethralMeatus),
      butterflyPerinealHematoma: Boolean(butterflyPerinealHematoma),
      blindFoleyCatheterizationStrictlyProhibited: Boolean(blindFoleyCatheterizationStrictlyProhibited),
      retrogradeUrethrographyIndicated: Boolean(retrogradeUrethrographyIndicated),
      suprapubicCystostomyPrepared: Boolean(suprapubicCystostomyPrepared),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.bladderUrethralTraumaCare && incident.markModified('bladderUrethralTraumaCare');

    incident.auditTrail.push({
      action: 'BLADDER_URETHRAL_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ bàng quang/đứt niệu đạo: Máu miệng sáo=${bloodAtUrethralMeatus}, Tụ máu cánh bướm=${butterflyPerinealHematoma}, CẤM sonde Foley mù=${blindFoleyCatheterizationStrictlyProhibited}, Chụp RUG=${retrogradeUrethrographyIndicated}, Dẫn lưu trên mu=${suprapubicCystostomyPrepared}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isBladderUrethralTrauma: true,
      bloodAtUrethralMeatus: Boolean(bloodAtUrethralMeatus),
      butterflyPerinealHematoma: Boolean(butterflyPerinealHematoma),
      blindFoleyCatheterizationStrictlyProhibited: Boolean(blindFoleyCatheterizationStrictlyProhibited),
      retrogradeUrethrographyIndicated: Boolean(retrogradeUrethrographyIndicated),
      suprapubicCystostomyPrepared: Boolean(suprapubicCystostomyPrepared),
      clinicalDirectives: [
        `TAM CHỨNG CHẤN THƯƠNG NIỆU ĐẠO PHỨC TẠP: Giọt máu tươi ở miệng sáo (${bloodAtUrethralMeatus ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), Tụ máu hình cánh bướm tầng sinh môn (${butterflyPerinealHematoma ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), và Bí tiểu cấp cầu bàng quang căng to.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG NGOẠI NIỆU: TUYỆT ĐỐI NGHIÊM CẤM ĐẶT ỐNG THÔNG TIỂU FOLEY MÙ: Tuyệt đối không được cố đẩy ống thông tiểu (${blindFoleyCatheterizationStrictlyProhibited ? 'TUÂN THỦ' : 'CẢNH BÁO'}). Hành vi này biến đứt niệu đạo bán phần thành đứt hoàn toàn và tạo đường rò giả nhiễm trùng ổ chậu.`,
        `CHỈ ĐỊNH CHỤP NIỆU ĐẠO NGƯỢC DÒNG (RETROGRADE URETHROGRAPHY - RUG): Bắt buộc bơm thuốc cản quang qua miệng sáo chụp X-quang kiểm tra tính toàn vẹn niệu đạo trước khi can thiệp (${retrogradeUrethrographyIndicated ? 'CHỈ ĐỊNH' : 'CHỜ'}).`,
        'DẪN LƯU BÀNG QUANG TRÊN XƯƠNG MU & CHUYỂN TUYẾN CHUYÊN KHOA: Sẵn sàng chọc dẫn lưu trên xương mu (Suprapubic Cystostomy) giải áp khi bàng quang quá căng đe dọa vỡ phúc mạc, chuyển khẩn cấp Trung tâm Tiết Niệu (BV Bình Dân / BV Chợ Rẫy / BV 115).',
      ],
    };
  }

  /**
   * Cấp Cứu Xuất Huyết Não Dưới Nhện Cấp (aSAH & Thunderclap Headache) (Phân hệ 61)
   */
  async manageSubarachnoidHemorrhage(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      thunderclapHeadacheOnset = true,
      huntHessGrade = 2,
      meningealSignsKernigBrudzinski = true,
      targetSystolicBloodPressureStrictUnder140 = true,
      nimodipineVasospasmProphylaxisIndicated = true,
      headOfBedElevated30Degrees = true,
    } = payload || {};

    incident.subarachnoidHemorrhageCare = {
      isSubarachnoidHemorrhage: true,
      thunderclapHeadacheOnset: Boolean(thunderclapHeadacheOnset),
      huntHessGrade: Number(huntHessGrade),
      meningealSignsKernigBrudzinski: Boolean(meningealSignsKernigBrudzinski),
      targetSystolicBloodPressureStrictUnder140: Boolean(targetSystolicBloodPressureStrictUnder140),
      nimodipineVasospasmProphylaxisIndicated: Boolean(nimodipineVasospasmProphylaxisIndicated),
      headOfBedElevated30Degrees: Boolean(headOfBedElevated30Degrees),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.subarachnoidHemorrhageCare && incident.markModified('subarachnoidHemorrhageCare');

    incident.auditTrail.push({
      action: 'SUBARACHNOID_HEMORRHAGE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Xuất huyết dưới nhện aSAH: Đau sét đánh=${thunderclapHeadacheOnset}, Hunt-Hess=${huntHessGrade}, Màng não=${meningealSignsKernigBrudzinski}, Huyết áp tâm thu < 140=${targetSystolicBloodPressureStrictUnder140}, Nimodipine=${nimodipineVasospasmProphylaxisIndicated}, Đầu cao 30 độ=${headOfBedElevated30Degrees}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isSubarachnoidHemorrhage: true,
      thunderclapHeadacheOnset: Boolean(thunderclapHeadacheOnset),
      huntHessGrade: Number(huntHessGrade),
      meningealSignsKernigBrudzinski: Boolean(meningealSignsKernigBrudzinski),
      targetSystolicBloodPressureStrictUnder140: Boolean(targetSystolicBloodPressureStrictUnder140),
      nimodipineVasospasmProphylaxisIndicated: Boolean(nimodipineVasospasmProphylaxisIndicated),
      headOfBedElevated30Degrees: Boolean(headOfBedElevated30Degrees),
      clinicalDirectives: [
        `CƠN ĐAU ĐẦU SÉT ĐÁNH & PHÂN ĐỘ HUNT & HESS: Cơn đau đầu dữ dội tột cùng đạt đỉnh chỉ trong < 1 phút (${thunderclapHeadacheOnset ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), dấu màng não Kernig/Brudzinski/Cứng gáy (${meningealSignsKernigBrudzinski ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), Thang điểm Hunt & Hess Độ ${huntHessGrade} - cảnh báo vỡ phình mạch não đe dọa tính mạng.`,
        `MỤC TIÊU HUYẾT ÁP TÂM THU NGHIÊM NGẶT SBP < 140 mmHg: Kiểm soát huyết áp tâm thu nghiêm ngặt dưới 140 mmHg (${targetSystolicBloodPressureStrictUnder140 ? 'ĐẠT CHUẨN' : 'CẢNH BÁO CAO'}) bằng Nicardipine/Labetalol truyền tĩnh mạch chỉnh liều, chống biến chứng tái vỡ túi phình (Rebleeding tử vong > 70%).`,
        `DỰ PHÒNG CO THẮT MẠCH NÃO MUỘN BẰNG NIMODIPINE: Khởi động sớm Nimodipine 60mg đường uống/sonde mỗi 4 giờ (${nimodipineVasospasmProphylaxisIndicated ? 'CHỈ ĐỊNH' : 'CHỜ'}) để ngăn ngừa nhồi máu não muộn DCI trong 14 ngày tới.`,
        `HẠ ÁP LỰC NỘI SỌ & CHUYỂN TUYẾN CAN THIỆP MẠCH NÃO: Nâng đầu giường 30 độ (${headOfBedElevated30Degrees ? 'ĐÃ THỰC HIỆN' : 'CHƯA'}) giúp lưu thông tĩnh mạch não hạ ICP; chuyển khẩn cấp Trung tâm Can thiệp Đột quỵ & Mạch não DSA Tuyến cuối (BV 115 / BV Chợ Rẫy) để nút coil phình mạch khẩn cấp.`,
      ],
    };
  }

  /**
   * Cấp Cứu Vết Thương Xuyên Thấu Tim & Vết Thương Hở Lồng Ngực (Penetrating Cardiac Injury & EDT) (Phân hệ 62)
   */
  async managePenetratingCardiacTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      becksTriadPresent = true,
      cardiacTamponadeDiagnosed = true,
      impaledObjectNeverRemoved = true,
      threeSidedOcclusiveDressingApplied = true,
      resuscitativeThoracotomyPrepared = true,
    } = payload || {};

    incident.penetratingCardiacTraumaCare = {
      isPenetratingCardiacTrauma: true,
      becksTriadPresent: Boolean(becksTriadPresent),
      cardiacTamponadeDiagnosed: Boolean(cardiacTamponadeDiagnosed),
      impaledObjectNeverRemoved: Boolean(impaledObjectNeverRemoved),
      threeSidedOcclusiveDressingApplied: Boolean(threeSidedOcclusiveDressingApplied),
      resuscitativeThoracotomyPrepared: Boolean(resuscitativeThoracotomyPrepared),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.penetratingCardiacTraumaCare && incident.markModified('penetratingCardiacTraumaCare');

    incident.auditTrail.push({
      action: 'PENETRATING_CARDIAC_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vết thương tim lồng ngực: Tam chứng Beck=${becksTriadPresent}, Chèn ép tim cấp=${cardiacTamponadeDiagnosed}, CẤM rút dị vật=${impaledObjectNeverRemoved}, Băng 3 góc=${threeSidedOcclusiveDressingApplied}, Mở ngực EDT=${resuscitativeThoracotomyPrepared}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isPenetratingCardiacTrauma: true,
      becksTriadPresent: Boolean(becksTriadPresent),
      cardiacTamponadeDiagnosed: Boolean(cardiacTamponadeDiagnosed),
      impaledObjectNeverRemoved: Boolean(impaledObjectNeverRemoved),
      threeSidedOcclusiveDressingApplied: Boolean(threeSidedOcclusiveDressingApplied),
      resuscitativeThoracotomyPrepared: Boolean(resuscitativeThoracotomyPrepared),
      clinicalDirectives: [
        `TAM CHỨNG BECK & HỘI CHỨNG CHÈN ÉP TIM CẤP (CARDIAC TAMPONADE): Tam chứng Beck kinh điển (${becksTriadPresent ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}): Tụt huyết áp + Tĩnh mạch cổ nổi căng + Tiếng tim mờ xa xăm. Máu chèn ép khoang màng ngoài tim làm tê liệt đổ đầy thất phải (${cardiacTamponadeDiagnosed ? 'NGUY HIỂM KỊCH PHÁT' : 'THEO DÕI'}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG TIỀN VIỆN: TUYỆT ĐỐI CẤM ĐƯỢC RÚT DỊ VẬT GĂM LỒNG NGỰC/TIM: Dị vật đóng vai trò nút chặn cầm máu tạm thời (${impaledObjectNeverRemoved ? 'TUÂN THỦ' : 'CẢNH BÁO NGUY HIỂM'}). Rút dị vật tại hiện trường gây mất máu xối xả ngừng tim trong 60 giây! Phải dùng gạc cuộn chèn cố định chân dị vật.`,
        `BĂNG KÍN 3 GÓC VAN 1 CHIỀU CHO VẾT THƯƠNG NGỰC HỞ: Băng dán kín 3 góc để khí và máu thoát ra khi thở ra nhưng ngăn không khí tràn vào khi hít vào (${threeSidedOcclusiveDressingApplied ? 'ĐÃ DÁN' : 'CHƯA DÁN'}), ngăn ngừa sốc tràn khí màng phổi áp lực.`,
        `PHÁC ĐỒ PHẪU THUẬT MỞ NGỰC HỒI SỨC CẤP CỨU (RESUSCITATIVE EDT): Sẵn sàng chỉ định mở ngực cấp cứu tại phòng cấp cứu (${resuscitativeThoracotomyPrepared ? 'SẴN SÀNG' : 'CHỜ'}) rạch mở khoang liên sườn 4-5 trái, rạch màng tim giải áp, luồn ống thông Foley bít lỗ thủng tim và kẹp động mạch chủ ngực; báo động đỏ Phẫu thuật Tim Mạch (BV Chợ Rẫy / BV 115 / Viện Tim).`,
      ],
    };
  }

  /**
   * Cấp Cứu Hội Chứng Chùm Đuôi Ngựa Cấp (Cauda Equina Syndrome - CES Red Flags) (Phân hệ 63)
   */
  async manageCaudaEquinaSyndrome(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      saddleAnesthesiaPresent = true,
      bladderSphincterDysfunctionRetention = true,
      lossOfAnalSphincterTone = true,
      cesStage = 'CES_I',
      urgentSurgicalDecompressionWindowUnder48h = true,
    } = payload || {};

    incident.caudaEquinaSyndromeCare = {
      isCaudaEquinaSyndrome: true,
      saddleAnesthesiaPresent: Boolean(saddleAnesthesiaPresent),
      bladderSphincterDysfunctionRetention: Boolean(bladderSphincterDysfunctionRetention),
      lossOfAnalSphincterTone: Boolean(lossOfAnalSphincterTone),
      cesStage: String(cesStage),
      urgentSurgicalDecompressionWindowUnder48h: Boolean(urgentSurgicalDecompressionWindowUnder48h),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.caudaEquinaSyndromeCare && incident.markModified('caudaEquinaSyndromeCare');

    incident.auditTrail.push({
      action: 'CAUDA_EQUINA_SYNDROME_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hội chứng chùm đuôi ngựa CES: Mất cảm giác yên ngựa=${saddleAnesthesiaPresent}, Rối loạn bàng quang=${bladderSphincterDysfunctionRetention}, Mất trương lực cơ thắt=${lossOfAnalSphincterTone}, Giai đoạn=${cesStage}, Cửa sổ mổ < 48h=${urgentSurgicalDecompressionWindowUnder48h}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isCaudaEquinaSyndrome: true,
      saddleAnesthesiaPresent: Boolean(saddleAnesthesiaPresent),
      bladderSphincterDysfunctionRetention: Boolean(bladderSphincterDysfunctionRetention),
      lossOfAnalSphincterTone: Boolean(lossOfAnalSphincterTone),
      cesStage: String(cesStage),
      urgentSurgicalDecompressionWindowUnder48h: Boolean(urgentSurgicalDecompressionWindowUnder48h),
      clinicalDirectives: [
        `TỨ CHỨNG CỜ ĐỎ CHÙM ĐUÔI NGỰA (CES RED FLAGS): Mất cảm giác vùng yên ngựa quanh hậu môn/sinh dục rễ S2-S5 (${saddleAnesthesiaPresent ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), Bí tiểu cấp hoặc tiểu tiện tràn không tự chủ (${bladderSphincterDysfunctionRetention ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), và Mất hoàn toàn trương lực cơ thắt hậu môn kèm mất phản xạ hậu môn (${lossOfAnalSphincterTone ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}).`,
        `PHÂN ĐỘ LÂM SÀNG GIAI ĐOẠN CES: Bệnh nhân thuộc thể ${cesStage === 'CES_I' ? 'CES-I (Incomplete - Giai đoạn chưa hoàn toàn, CẤP BÁCH NHẤT để mổ bảo tồn phục hồi chức năng 100%)' : 'CES-R (Retention - Đã bí tiểu hoàn toàn, nguy cơ di chứng cao)'}.`,
        'BẤT ĐỘNG CỘT SỐNG & CHỤP CỘNG HƯỞNG TỪ MRI KHẨN: Giữ cột sống thắt lưng phẳng tuyệt đối trên nẹp đệm cứng, không cho ngồi dậy hoặc xoay vặn thân mình; chỉ định chụp MRI cột sống thắt lưng khẩn cấp loại trừ tụ máu ngoài màng cứng hoặc thoát vị đĩa đệm thể khối lớn chèn ép chùm đuôi ngựa.',
        `CỬA SỔ VÀNG PHẪU THUẬT GIẢI ÉP THẦN KINH < 24 - 48 GIỜ: Phải thực hiện phẫu thuật mở cung sau giải ép chèn ép thần kinh trong vòng < 24-48 giờ (${urgentSurgicalDecompressionWindowUnder48h ? 'TRONG CỬA SỔ VÀNG' : 'QUÁ GIỜ VÀNG - NGUY CƠ TÀN PHẾ'}). Quá 48h sẽ để lại di chứng tàn phế vĩnh viễn (liệt 2 chân, mang sonde tiểu suốt đời, mất kiểm soát phân và liệt dương); chuyển tuyến khẩn cấp BV Chấn Thương Chỉnh Hình / BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Thuyên Tắc Khí Tĩnh Mạch & Thuyên Tắc Mỡ Sau Gãy Xương Dài (FES & VAE) (Phân hệ 64)
   */
  async manageFatAndAirEmbolism(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      gurdsMajorCriteriaMet = true,
      petechialRashAxillaNeckConjunctiva = true,
      durantsPositionLeftLateralTrendelenburg = true,
      highFlowNormobaricOxygen100 = true,
      longBoneFractureImmobilizedEarly = true,
    } = payload || {};

    incident.fatAirEmbolismCare = {
      isFatAirEmbolism: true,
      gurdsMajorCriteriaMet: Boolean(gurdsMajorCriteriaMet),
      petechialRashAxillaNeckConjunctiva: Boolean(petechialRashAxillaNeckConjunctiva),
      durantsPositionLeftLateralTrendelenburg: Boolean(durantsPositionLeftLateralTrendelenburg),
      highFlowNormobaricOxygen100: Boolean(highFlowNormobaricOxygen100),
      longBoneFractureImmobilizedEarly: Boolean(longBoneFractureImmobilizedEarly),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.fatAirEmbolismCare && incident.markModified('fatAirEmbolismCare');

    incident.auditTrail.push({
      action: 'FAT_AIR_EMBOLISM_CARE_RECORDED',
      timestamp: new Date(),
      details: `Thuyên tắc khí/mỡ: Tiêu chuẩn Gurd=${gurdsMajorCriteriaMet}, Ban đốm xuất huyết=${petechialRashAxillaNeckConjunctiva}, Tư thế Durant=${durantsPositionLeftLateralTrendelenburg}, Oxy 100% NRM=${highFlowNormobaricOxygen100}, Cố định nẹp sớm=${longBoneFractureImmobilizedEarly}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isFatAirEmbolism: true,
      gurdsMajorCriteriaMet: Boolean(gurdsMajorCriteriaMet),
      petechialRashAxillaNeckConjunctiva: Boolean(petechialRashAxillaNeckConjunctiva),
      durantsPositionLeftLateralTrendelenburg: Boolean(durantsPositionLeftLateralTrendelenburg),
      highFlowNormobaricOxygen100: Boolean(highFlowNormobaricOxygen100),
      longBoneFractureImmobilizedEarly: Boolean(longBoneFractureImmobilizedEarly),
      clinicalDirectives: [
        `TAM CHỨNG GURD KINH ĐIỂN TRONG THUYÊN TẮC MỠ (FES): Sau gãy xương dài/khung chậu, xuất hiện Suy hô hấp cấp PaO2 < 60 mmHg + Rối loạn tri giác lú lẫn co giật + Ban đốm xuất huyết đặc trưng ở nách, cổ và kết mạc mắt (${petechialRashAxillaNeckConjunctiva ? 'DƯƠNG TÍNH' : 'THEO DÕI'}). Tiêu chuẩn chính Gurd (${gurdsMajorCriteriaMet ? 'ĐẠT TIÊU CHUẨN' : 'CHƯA ĐỦ'}).`,
        `TƯ THẾ CỨU MẠNG DURANT (DURANT'S MANEUVER) TRONG THUYÊN TẮC KHÍ: Đặt nạn nhân nằm nghiêng sang bên trái và đầu thấp Trendelenburg (${durantsPositionLeftLateralTrendelenburg ? 'ĐÃ THỰC HIỆN' : 'CHƯA THỰC HIỆN'}) nhằm bẫy bọt khí ở đỉnh tâm thất phải, giải tỏa bít tắc đường tống máu (Air Lock Relief).`,
        `OXY LIỀU CAO 100% NRM & BẤT ĐỘNG XƯƠNG GÃY SỚM: Thở oxy 100% qua mặt nạ có túi dự trữ (${highFlowNormobaricOxygen100 ? 'ĐÃ KHỞI ĐỘNG' : 'CHƯA'}) giúp khuếch tán loại bỏ Nitơ trong bọt khí; nẹp bất động xương đùi/xương chày gãy sớm (${longBoneFractureImmobilizedEarly ? 'ĐÃ CỐ ĐỊNH' : 'CẦN NẸP NGAY'}) ngăn tủy xương tiếp tục phóng thích hạt mỡ vào tuần hoàn.`,
        'ĐIỀU PHỐI HỒI SỨC ĐA CHẤN THƯƠNG & CHẤN THƯƠNG CHỈNH HÌNH TUYẾN CUỐI: Chuyển khẩn cấp Trung tâm Hồi sức Chấn thương BV Chợ Rẫy / BV Chấn Thương Chỉnh Hình / BV 115 sẵn sàng thở máy bảo vệ phổi ARDS và phẫu thuật kết hợp xương sớm.',
      ],
    };
  }

  /**
   * Cấp Cứu Cơn Tăng Huyết Áp Ác Tính Kèm Tổn Thương Cơ Quan Đích Cấp (Hypertensive Emergency & TOD) (Phân hệ 65)
   */
  async manageHypertensiveEmergency(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      systolicBpOver180OrDiastolicOver120 = true,
      acuteTargetOrganDamageIdentified = true,
      mapReductionLimitedTo20To25PercentFirstHour = true,
      sublingualNifedipineStrictlyProhibited = true,
      titratableIvAntihypertensiveNicardipineLabetalol = true,
    } = payload || {};

    incident.hypertensiveEmergencyCare = {
      isHypertensiveEmergency: true,
      systolicBpOver180OrDiastolicOver120: Boolean(systolicBpOver180OrDiastolicOver120),
      acuteTargetOrganDamageIdentified: Boolean(acuteTargetOrganDamageIdentified),
      mapReductionLimitedTo20To25PercentFirstHour: Boolean(mapReductionLimitedTo20To25PercentFirstHour),
      sublingualNifedipineStrictlyProhibited: Boolean(sublingualNifedipineStrictlyProhibited),
      titratableIvAntihypertensiveNicardipineLabetalol: Boolean(titratableIvAntihypertensiveNicardipineLabetalol),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.hypertensiveEmergencyCare && incident.markModified('hypertensiveEmergencyCare');

    incident.auditTrail.push({
      action: 'HYPERTENSIVE_EMERGENCY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Cơn tăng huyết áp cấp cứu: HA >= 180/120=${systolicBpOver180OrDiastolicOver120}, Tổn thương cơ quan đích=${acuteTargetOrganDamageIdentified}, Giới hạn hạ MAP 20-25% 1h đầu=${mapReductionLimitedTo20To25PercentFirstHour}, CẤM Nifedipine ngậm=${sublingualNifedipineStrictlyProhibited}, Thuốc IV chỉnh liều=${titratableIvAntihypertensiveNicardipineLabetalol}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isHypertensiveEmergency: true,
      systolicBpOver180OrDiastolicOver120: Boolean(systolicBpOver180OrDiastolicOver120),
      acuteTargetOrganDamageIdentified: Boolean(acuteTargetOrganDamageIdentified),
      mapReductionLimitedTo20To25PercentFirstHour: Boolean(mapReductionLimitedTo20To25PercentFirstHour),
      sublingualNifedipineStrictlyProhibited: Boolean(sublingualNifedipineStrictlyProhibited),
      titratableIvAntihypertensiveNicardipineLabetalol: Boolean(titratableIvAntihypertensiveNicardipineLabetalol),
      clinicalDirectives: [
        `PHÂN BIỆT TĂNG HUYẾT ÁP CẤP CỨU (HYPERTENSIVE EMERGENCY): Huyết áp kịch trần >= 180/120 mmHg (${systolicBpOver180OrDiastolicOver120 ? 'DƯƠNG TÍNH' : 'BÌNH THƯỜNG'}) kèm Bằng chứng tổn thương cơ quan đích cấp tính (${acuteTargetOrganDamageIdentified ? 'CÓ TỔN THƯƠNG: Bệnh não, phù phổi cấp, suy tim, bóc tách ĐM chủ' : 'CHƯA CÓ'}).`,
        `QUY TẮC VÀNG HẠ ÁP AHA/ACC: GIỚI HẠN GIẢM MAP 20 - 25% TRONG 1 GIỜ ĐẦU: Tuyệt đối không được hạ huyết áp về mức bình thường ngay lập tức (${mapReductionLimitedTo20To25PercentFirstHour ? 'TUÂN THỦ' : 'CẢNH BÁO'}). Hạ áp quá nhanh làm tụt áp lực tưới máu não và thận gây nhồi máu não và hoại tử ống thận cấp! Đưa DBP về 100-110 mmHg trong 1h, sau đó về 160/100 mmHg trong 2-6h.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG NGOẠI VIỆN: TUYỆT ĐỐI CẤM DÙNG NIFEDIPINE NGẬM DƯỚI LƯỠI: Cấm bóp viên nang mềm nhỏ giọt Nifedipine dưới lưỡi (${sublingualNifedipineStrictlyProhibited ? 'ĐÃ KHÓA CẢNH BÁO' : 'NGUY HIỂM'}). Thuốc hấp thu mất kiểm soát gây tụt huyết áp kịch phát dẫn đến đột quỵ nhồi máu não và ngừng tim!`,
        `THUỐC HẠ ÁP TRUYỀN TĨNH MẠCH CHỈNH LIỀU & CHUYỂN TUYẾN: Sử dụng Nicardipine (5-15 mg/h) hoặc Labetalol truyền tĩnh mạch chỉnh liều từng bước (${titratableIvAntihypertensiveNicardipineLabetalol ? 'CHỈ ĐỊNH' : 'CHỜ'}); chuyển khẩn cấp Khoa Hồi sức Cấp cứu Tim Mạch BV Nhân Dân 115 / BV Chợ Rẫy.`,
      ],
    };
  }

  /**
   * Cấp Cứu Cơn Bão Catecholamine Khối U Tủy Thượng Thận (Pheochromocytoma Hypertensive Crisis) (Phân hệ 66)
   */
  async managePheochromocytomaCrisis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      paroxysmalTriadHeadacheSweatingTachycardia = true,
      alphaBlockadeBeforeBetaBlockadeEnforced = true,
      phentolamineOrPhenoxybenzamineAdministered = true,
      betaBlockerStrictlyProhibitedWithoutAlpha = true,
    } = payload || {};

    incident.pheochromocytomaCrisisCare = {
      isPheochromocytomaCrisis: true,
      paroxysmalTriadHeadacheSweatingTachycardia: Boolean(paroxysmalTriadHeadacheSweatingTachycardia),
      alphaBlockadeBeforeBetaBlockadeEnforced: Boolean(alphaBlockadeBeforeBetaBlockadeEnforced),
      phentolamineOrPhenoxybenzamineAdministered: Boolean(phentolamineOrPhenoxybenzamineAdministered),
      betaBlockerStrictlyProhibitedWithoutAlpha: Boolean(betaBlockerStrictlyProhibitedWithoutAlpha),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.pheochromocytomaCrisisCare && incident.markModified('pheochromocytomaCrisisCare');

    incident.auditTrail.push({
      action: 'PHEOCHROMOCYTOMA_CRISIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `U tủy thượng thận bão Catecholamine: Tam chứng kịch phát=${paroxysmalTriadHeadacheSweatingTachycardia}, Bắt buộc chẹn Alpha trước Beta=${alphaBlockadeBeforeBetaBlockadeEnforced}, Phentolamine/Phenoxybenzamine=${phentolamineOrPhenoxybenzamineAdministered}, CẤM chẹn Beta đơn độc=${betaBlockerStrictlyProhibitedWithoutAlpha}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isPheochromocytomaCrisis: true,
      paroxysmalTriadHeadacheSweatingTachycardia: Boolean(paroxysmalTriadHeadacheSweatingTachycardia),
      alphaBlockadeBeforeBetaBlockadeEnforced: Boolean(alphaBlockadeBeforeBetaBlockadeEnforced),
      phentolamineOrPhenoxybenzamineAdministered: Boolean(phentolamineOrPhenoxybenzamineAdministered),
      betaBlockerStrictlyProhibitedWithoutAlpha: Boolean(betaBlockerStrictlyProhibitedWithoutAlpha),
      clinicalDirectives: [
        `TAM CHỨNG KỊCH PHÁT PHEOCHROMOCYTOMA: Nhức đầu dữ dội theo nhịp đập + Vã mồ hôi đầm đìa + Đánh trống ngực nhịp tim nhanh kịch phát (> 130-160 bpm) kèm cơn tăng huyết áp vọt > 200-250 mmHg (${paroxysmalTriadHeadacheSweatingTachycardia ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}) do khối u tủy thượng thận phóng thích bão Catecholamine.`,
        `NGUYÊN TẮC SỐNG CÒN SỐ 1: BẮT BUỘC CHẸN ALPHA TRƯỚC - CHẸN BETA SAU (ALPHA-BLOCKADE BEFORE BETA-BLOCKADE): Tuyệt đối tuân thủ quy tắc (${alphaBlockadeBeforeBetaBlockadeEnforced ? 'ĐÃ THIẾT LẬP BẢO VỆ' : 'CẢNH BÁO NGUY HIỂM'}). Nếu dùng thuốc chẹn Beta trước, thụ thể Beta-2 giãn mạch bị ức chế trong khi Alpha-1 co mạch không đối kháng (Unopposed Alpha-stimulation) làm co thắt toàn thể mạch máu ngoại biên đẩy HA lên > 300 mmHg vỡ mạch não phù phổi cấp tử vong tức khắc!`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM DÙNG THUỐC CHẸN BETA ĐƠN ĐỘC: Khóa cảnh báo chống chỉ định dùng Propranolol, Metoprolol, Atenolol (${betaBlockerStrictlyProhibitedWithoutAlpha ? 'TUÂN THỦ TUYỆT ĐỐI' : 'VI PHẠM NGUY HIỂM'}). Chỉ được dùng chẹn Beta sau khi đã ức chế thụ thể Alpha đầy đủ 24-48 giờ.`,
        `PHÁC ĐỒ GIÃN MẠCH BẰNG THUỐC CHẸN ALPHA: Sử dụng Phentolamine tiêm tĩnh mạch bolus 5mg (nhắc lại mỗi 5 phút đến khi hạ áp) hoặc truyền tĩnh mạch liên tục (${phentolamineOrPhenoxybenzamineAdministered ? 'ĐÃ DÙNG PHENTOLAMINE' : 'CHUẨN BỊ THUỐC'}); bù dịch tĩnh mạch chống tụt huyết áp tư thế và chuyển Trung tâm Hồi sức Nội tiết & Tim mạch Tuyến cuối BV Chợ Rẫy / BV Nhân Dân 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Xuất Huyết Não Trong Nhu Mô & Kiểm Soát Thể Tích Khối Máu Tụ (ICH & Hematoma Expansion) (Phân hệ 67)
   */
  async manageIntracerebralHemorrhage(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      ichScore = 2,
      hematomaVolumeMl = 35,
      spotSignPositiveOnCta = true,
      urgentAnticoagulantReversalApplied = true,
      targetSbpControlled140To180 = true,
      cerebellarHematomaSurgicalDecompressionIndicated = false,
    } = payload || {};

    incident.intracerebralHemorrhageCare = {
      isIntracerebralHemorrhage: true,
      ichScore: Number(ichScore),
      hematomaVolumeMl: Number(hematomaVolumeMl),
      spotSignPositiveOnCta: Boolean(spotSignPositiveOnCta),
      urgentAnticoagulantReversalApplied: Boolean(urgentAnticoagulantReversalApplied),
      targetSbpControlled140To180: Boolean(targetSbpControlled140To180),
      cerebellarHematomaSurgicalDecompressionIndicated: Boolean(cerebellarHematomaSurgicalDecompressionIndicated),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.intracerebralHemorrhageCare && incident.markModified('intracerebralHemorrhageCare');

    incident.auditTrail.push({
      action: 'INTRACEREBRAL_HEMORRHAGE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Xuất huyết não nhu mô: Thang điểm ICH=${ichScore}, Thể tích=${hematomaVolumeMl}ml, Spot Sign CTA=${spotSignPositiveOnCta}, Đảo ngược chống đông=${urgentAnticoagulantReversalApplied}, Kiểm soát SBP 140-180=${targetSbpControlled140To180}, Mổ giải áp tiểu não=${cerebellarHematomaSurgicalDecompressionIndicated}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isIntracerebralHemorrhage: true,
      ichScore: Number(ichScore),
      hematomaVolumeMl: Number(hematomaVolumeMl),
      spotSignPositiveOnCta: Boolean(spotSignPositiveOnCta),
      urgentAnticoagulantReversalApplied: Boolean(urgentAnticoagulantReversalApplied),
      targetSbpControlled140To180: Boolean(targetSbpControlled140To180),
      cerebellarHematomaSurgicalDecompressionIndicated: Boolean(cerebellarHematomaSurgicalDecompressionIndicated),
      clinicalDirectives: [
        `TIÊN LƯỢNG THANG ĐIỂM ICH SCORE & THỂ TÍCH MÁU TỤ ABC/2: Điểm ICH Score = ${ichScore}/6 (Dự báo nguy cơ tử vong 30 ngày: ${ichScore >= 3 ? 'RẤT CAO > 72%' : 'TRUNG BÌNH 13-26%'}). Thể tích khối máu tụ ${hematomaVolumeMl} mL (${hematomaVolumeMl >= 30 ? 'NGUY KỊCH >= 30mL' : 'DƯỚI 30mL'}).`,
        `DẤU HIỆU SPOT SIGN TRÊN CTA & PHÒNG NGỪA MỞ RỘNG MÁU TỤ (HEMATOMA EXPANSION): Hình ảnh rò rỉ thuốc cản quang vào khối máu tụ (${spotSignPositiveOnCta ? 'DƯƠNG TÍNH - NGUY CƠ BÙNG NỔ THỂ TÍCH MÁU TỤ TRONG 3H ĐẦU' : 'ÂM TÍNH'}). Cần tối ưu hóa đông máu và kiểm soát huyết áp khẩn cấp để ngăn chặn máu tụ lan rộng gây tụt não!`,
        `ĐẢO NGƯỢC THUỐC CHỐNG ĐÔNG MÁU KHẨN CẤP (ANTICOAGULANT REVERSAL): Nếu bệnh nhân đang dùng Warfarin, chỉ định tiêm 4-Factor PCC (25-50 IU/kg) + Vitamin K 10mg IV (${urgentAnticoagulantReversalApplied ? 'ĐÃ TIẾN HÀNH' : 'CHỜ Y LỆNH'}). Nếu dùng Dabigatran, chỉ định Idarucizumab 5g IV. Nếu dùng thuốc ức chế Xa (Rivaroxaban/Apixaban), chỉ định Andexanet alfa hoặc PCC.`,
        `KIỂM SOÁT HUYẾT ÁP VÀNG AHA/ASA: Đích duy trì SBP trong khoảng 130 - 140 mmHg (${targetSbpControlled140To180 ? 'ĐẠT TIÊU CHUẨN' : 'CẦN CHỈNH LIỀU'}), tránh để SBP < 130 mmHg gây giảm tưới máu vùng tranh tối tranh sáng (Penumbra). Dùng Nicardipine hoặc Labetalol tĩnh mạch.`,
        `CHỈ ĐỊNH PHẪU THUẬT MỞ SỌ GIẢI ÁP & ĐIỀU PHỐI TUYẾN CUỐI: Chỉ định phẫu thuật mở sọ giải áp (${cerebellarHematomaSurgicalDecompressionIndicated ? 'BẮT BUỘC KHẨN CẤP: Khối máu tụ tiểu não >= 3cm chèn ép thân não' : 'THEO DÕI NỘI KHOA HỒI SỨC THẦN KINH'}). Điều phối Trung tâm Đột quỵ & Ngoại Thần kinh Tuyến cuối BV Nhân Dân 115 / BV Chợ Rẫy.`,
      ],
    };
  }

  /**
   * Cấp Cứu Tràn Máu Màng Ngoài Tim Do Bóc Tách Động Mạch Chủ Ngực Stanford Type A (Acute Stanford A Aortic Dissection) (Phân hệ 68)
   */
  async manageAcuteAorticDissection(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      stanfordType = 'STANFORD_A_ASCENDING',
      tearingChestBackPainOnset = true,
      bloodPressureDifferentialArmsOver20 = true,
      hemopericardiumTamponadePresent = true,
      routinePericardiocentesisStrictlyProhibited = true,
      antiImpulseTherapyTargetHeartRateUnder60 = true,
    } = payload || {};

    incident.acuteAorticDissectionCare = {
      isAcuteAorticDissection: true,
      stanfordType: String(stanfordType),
      tearingChestBackPainOnset: Boolean(tearingChestBackPainOnset),
      bloodPressureDifferentialArmsOver20: Boolean(bloodPressureDifferentialArmsOver20),
      hemopericardiumTamponadePresent: Boolean(hemopericardiumTamponadePresent),
      routinePericardiocentesisStrictlyProhibited: Boolean(routinePericardiocentesisStrictlyProhibited),
      antiImpulseTherapyTargetHeartRateUnder60: Boolean(antiImpulseTherapyTargetHeartRateUnder60),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.acuteAorticDissectionCare && incident.markModified('acuteAorticDissectionCare');

    incident.auditTrail.push({
      action: 'ACUTE_AORTIC_DISSECTION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Bóc tách ĐMC Stanford=${stanfordType}, Cơn đau xé rách ngực/lưng=${tearingChestBackPainOnset}, Chênh lệch HA 2 tay > 20mmHg=${bloodPressureDifferentialArmsOver20}, Tràn máu màng tim Tamponade=${hemopericardiumTamponadePresent}, CẤM chọc màng tim bừa bãi=${routinePericardiocentesisStrictlyProhibited}, Anti-impulse HR < 60=${antiImpulseTherapyTargetHeartRateUnder60}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAcuteAorticDissection: true,
      stanfordType: String(stanfordType),
      tearingChestBackPainOnset: Boolean(tearingChestBackPainOnset),
      bloodPressureDifferentialArmsOver20: Boolean(bloodPressureDifferentialArmsOver20),
      hemopericardiumTamponadePresent: Boolean(hemopericardiumTamponadePresent),
      routinePericardiocentesisStrictlyProhibited: Boolean(routinePericardiocentesisStrictlyProhibited),
      antiImpulseTherapyTargetHeartRateUnder60: Boolean(antiImpulseTherapyTargetHeartRateUnder60),
      clinicalDirectives: [
        `NHẬN DIỆN BÓC TÁCH ĐỘNG MẠCH CHỦ CẤP TÍNH (STANFORD TYPE A): Khởi phát đột ngột cơn đau ngực dữ dội kiểu xé rách xuyên ra sau lưng (${tearingChestBackPainOnset ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), kèm chênh lệch huyết áp giữa 2 tay > 20 mmHg (${bloodPressureDifferentialArmsOver20 ? 'DƯƠNG TÍNH' : 'KHÔNG CÓ'}). Bóc tách lan vào quai động mạch chủ lên (Stanford Type A) đe dọa vỡ mạch tử vong 1-2% mỗi giờ!`,
        `BIẾN CHỨNG TRÀN MÁU MÀNG NGOÀI TIM & CHÈN ÉP TIM CẤP (HEMOPERICARDIUM TAMPONADE): Tràn máu màng tim thứ phát do rách vỡ gốc động mạch chủ (${hemopericardiumTamponadePresent ? 'XÁC NHẬN CHÈN ÉP TIM CẤP' : 'CHƯA PHÁT HIỆN'}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM CHỌC HÚT MÀNG NGOÀI TIM BỪA BÃI (PERICARDIOCENTESIS CONTRAINDICATION): Khóa cảnh báo chống chỉ định chọc hút dịch màng tim (${routinePericardiocentesisStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'CỰC KỲ NGUY HIỂM'}). Áp lực máu trong khoang màng tim đang tạo hiệu ứng tự cầm máu (Tamponade effect) bít lỗ rách thành ĐMC. Chọc hút thể tích lớn sẽ làm toác rộng vết rách và máu ĐMC phun xối xả làm nạn nhân tử vong tức khắc! Chỉ được chọc giải áp một lượng cực nhỏ 10-20 mL duy nhất khi nạn nhân ngừng tuần hoàn/suy sụp huyết động chuẩn bị tử vong để duy trì tưới máu tối thiểu trước khi rạch mổ ngực.`,
        `LIỆU PHÁP GIẢM LỰC XÉ 20 PHÚT VÀNG (ANTI-IMPULSE THERAPY): Khởi động sớm thuốc chẹn beta tĩnh mạch (Esmolol truyền liên tục hoặc Labetalol) (${antiImpulseTherapyTargetHeartRateUnder60 ? 'ĐÃ KHỞI ĐỘNG' : 'CHỜ XỬ TRÍ'}) nhằm đưa nhịp tim xuống < 60 bpm và SBP xuống 100-120 mmHg trong vòng 20 phút để giảm thiểu dP/dt (lực xé thành động mạch chủ). Tuyệt đối cấm dùng thuốc giãn mạch đơn thuần trước khi chẹn beta!`,
        `BÁO ĐỘNG ĐỎ PHẪU THUẬT LỒNG NGỰC - TIM MẠCH TUYẾN CUỐI: Kích hoạt quy trình Báo động đỏ (Code Red) chuẩn bị phòng mổ tim mở và máy tim phổi nhân tạo (CEC) khẩn cấp tại Bệnh viện Chợ Rẫy / Bệnh viện Nhân Dân 115 / Viện Tim TP.HCM.`,
      ],
    };
  }

  /**
   * Cấp Cứu Hôn Mê Tăng Áp Lực Thẩm Thấu Do Đái Tháo Đường (Hyperosmolar Hyperglycemic State - HHS) (Phân hệ 69)
   */
  async manageHyperosmolarHyperglycemicState(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      serumGlucoseOver600MgDl = true,
      effectiveSerumOsmolalityOver320 = true,
      severeOsmoticDehydrationLitersLost = 10,
      fluidResuscitationBeforeInsulinStrictlyEnforced = true,
      potassiumLevelVerifiedAbove3Point3 = true,
    } = payload || {};

    incident.hyperosmolarHyperglycemicStateCare = {
      isHyperosmolarHyperglycemicState: true,
      serumGlucoseOver600MgDl: Boolean(serumGlucoseOver600MgDl),
      effectiveSerumOsmolalityOver320: Boolean(effectiveSerumOsmolalityOver320),
      severeOsmoticDehydrationLitersLost: Number(severeOsmoticDehydrationLitersLost),
      fluidResuscitationBeforeInsulinStrictlyEnforced: Boolean(fluidResuscitationBeforeInsulinStrictlyEnforced),
      potassiumLevelVerifiedAbove3Point3: Boolean(potassiumLevelVerifiedAbove3Point3),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.hyperosmolarHyperglycemicStateCare && incident.markModified('hyperosmolarHyperglycemicStateCare');

    incident.auditTrail.push({
      action: 'HHS_DEHYDRATION_CARE_RECORDED',
      timestamp: new Date(),
      details: `HHS đái tháo đường: Glucose >= 600mg/dL=${serumGlucoseOver600MgDl}, Áp lực thẩm thấu > 320mOsm/kg=${effectiveSerumOsmolalityOver320}, Mất nước=${severeOsmoticDehydrationLitersLost}L, Bù dịch trước Insulin=${fluidResuscitationBeforeInsulinStrictlyEnforced}, Kali >= 3.3mEq/L=${potassiumLevelVerifiedAbove3Point3}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isHyperosmolarHyperglycemicState: true,
      serumGlucoseOver600MgDl: Boolean(serumGlucoseOver600MgDl),
      effectiveSerumOsmolalityOver320: Boolean(effectiveSerumOsmolalityOver320),
      severeOsmoticDehydrationLitersLost: Number(severeOsmoticDehydrationLitersLost),
      fluidResuscitationBeforeInsulinStrictlyEnforced: Boolean(fluidResuscitationBeforeInsulinStrictlyEnforced),
      potassiumLevelVerifiedAbove3Point3: Boolean(potassiumLevelVerifiedAbove3Point3),
      clinicalDirectives: [
        `TIÊU CHUẨN VÀNG CHẨN ĐOÁN HÔN MÊ TĂNG ÁP LỰC THẨM THẤU (HHS): Đường huyết tăng vọt cực độ >= 600 mg/dL (${serumGlucoseOver600MgDl ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}), Áp lực thẩm thấu máu hiệu dụng > 320 mOsm/kg (${effectiveSerumOsmolalityOver320 ? 'DƯƠNG TÍNH' : 'BÌNH THƯỜNG'}) và thiếu hụt thể tích nước nghiêm trọng ước tính ${severeOsmoticDehydrationLitersLost} Lít (mất 10-15% trọng lượng cơ thể).`,
        `NGUYÊN TẮC SỐNG CÒN SỐ 1: BÙ DỊCH TINH THỂ ĐẲNG TRƯƠNG TRƯỚC - TUYỆT ĐỐI CẤM TIÊM INSULIN KHI CHƯA HỒI PHỤC THỂ TÍCH TUẦN HOÀN: Quy tắc an toàn bắt buộc (${fluidResuscitationBeforeInsulinStrictlyEnforced ? 'ĐÃ THIẾT LẬP BẢO VỆ' : 'CẢNH BÁO NGUY HIỂM'}). Nếu tiêm Insulin ngay lập tức khi chưa bù dịch, glucose và nước sẽ bị kéo ồ ạt từ lòng mạch vào nội bào làm trụy mạch tuần hoàn (Circulatory Collapse) tử vong! Truyền ngay NaCl 0.9% 1000 - 1500 mL trong 1 giờ đầu tiên.`,
        `NGUYÊN TẮC KALI SỐNG CÒN TRƯỚC KHI DÙNG INSULIN: Kiểm tra nồng độ Kali máu (${potassiumLevelVerifiedAbove3Point3 ? 'ĐÃ ĐẠT >= 3.3 mEq/L' : 'CHƯA ĐẠT'}). NẾU KALI MÁU < 3.3 mEq/L, BẮT BUỘC HOÃN INSULIN VÀ BÙ KALI TRƯỚC để phòng ngừa biến chứng hạ Kali máu kịch phát gây rung thất ngừng tim do Insulin chuyển Kali vào nội bào!`,
        `KIỂM SOÁT HẠ ĐƯỜNG HUYẾT TỪNG BƯỚC & ĐIỀU PHỐI ICU NỘI TIẾT: Hạ glucose máu với tốc độ an toàn 50 - 75 mg/dL/giờ. Khi glucose giảm xuống 300 mg/dL, bổ sung Dextrose 5% vào dịch truyền để ngăn ngừa phù não thẩm thấu; chuyển khẩn cấp Khoa Hồi sức Tích cực (ICU) Nội tiết Bệnh viện Nhân Dân 115 / Bệnh viện Chợ Rẫy.`,
      ],
    };
  }

  /**
   * Cấp Cứu Cơn Hen Phế Quản Ác Tính & Lồng Ngực Im Lặng (Near-Fatal Asthma & Silent Chest) (Phân hệ 70)
   */
  async manageAcuteSevereAsthma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      silentChestObserved = true,
      pulsusParadoxusOver20 = true,
      nebulizedSabaSamaContinuous = true,
      ivMagnesiumSulfate2gAdministered = true,
      imEpinephrineAdministeredIfExhausted = true,
      sedativesContraindicatedAvoided = true,
    } = payload || {};

    incident.acuteSevereAsthmaCare = {
      isAcuteSevereAsthma: true,
      silentChestObserved: Boolean(silentChestObserved),
      pulsusParadoxusOver20: Boolean(pulsusParadoxusOver20),
      nebulizedSabaSamaContinuous: Boolean(nebulizedSabaSamaContinuous),
      ivMagnesiumSulfate2gAdministered: Boolean(ivMagnesiumSulfate2gAdministered),
      imEpinephrineAdministeredIfExhausted: Boolean(imEpinephrineAdministeredIfExhausted),
      sedativesContraindicatedAvoided: Boolean(sedativesContraindicatedAvoided),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.acuteSevereAsthmaCare && incident.markModified('acuteSevereAsthmaCare');

    incident.auditTrail.push({
      action: 'ACUTE_SEVERE_ASTHMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Cơn hen ác tính: Lồng ngực im lặng=${silentChestObserved}, Mạch nghịch thường=${pulsusParadoxusOver20}, Khí dung liên tục=${nebulizedSabaSamaContinuous}, Magnesi Sulfat 2g IV=${ivMagnesiumSulfate2gAdministered}, Epinephrine IM=${imEpinephrineAdministeredIfExhausted}, CẤM an thần=${sedativesContraindicatedAvoided}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAcuteSevereAsthma: true,
      silentChestObserved: Boolean(silentChestObserved),
      pulsusParadoxusOver20: Boolean(pulsusParadoxusOver20),
      nebulizedSabaSamaContinuous: Boolean(nebulizedSabaSamaContinuous),
      ivMagnesiumSulfate2gAdministered: Boolean(ivMagnesiumSulfate2gAdministered),
      imEpinephrineAdministeredIfExhausted: Boolean(imEpinephrineAdministeredIfExhausted),
      sedativesContraindicatedAvoided: Boolean(sedativesContraindicatedAvoided),
      clinicalDirectives: [
        `DẤU HIỆU LỒNG NGỰC IM LẶNG (SILENT CHEST) ĐE DỌA TỬ VONG: Mất hoàn toàn tiếng ran rít khi nghe phổi (${silentChestObserved ? 'DƯƠNG TÍNH - DẤU HIỆU CẢNH BÁO TỬ VONG CỰC KỲ NGUY HIỂM' : 'CÒN TIẾNG RAN'}). Đây không phải là hen giảm mà là lưu lượng khí qua phế quản quá thấp không đủ tạo âm thanh, bệnh nhân sắp kiệt cơ ngừng thở! Kèm mạch nghịch thường > 20 mmHg (${pulsusParadoxusOver20 ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}).`,
        `PHÁC ĐỒ KHÍ DUNG LIÊN TỤC & MAGNESIUM SULFATE TĨNH MẠCH: Khí dung liên tục SABA Salbutamol 5mg phối hợp SAMA Ipratropium Bromide 0.5mg bằng oxy liều cao (${nebulizedSabaSamaContinuous ? 'ĐÃ KHỞI ĐỘNG' : 'CHƯA'}). Truyền tĩnh mạch chậm Magnesium Sulfate 2g trong 20 phút (${ivMagnesiumSulfate2gAdministered ? 'ĐÃ TRUYỀN' : 'CHỜ'}) giúp giãn cơ trơn phế quản độc lập qua kênh calci.`,
        `TIÊM BẮP EPINEPHRINE KHẨN CẤP KHI KIỆT SỨC: Chỉ định tiêm bắp Epinephrine 0.3 - 0.5 mg (1:1000) mặt trước ngoài đùi (${imEpinephrineAdministeredIfExhausted ? 'ĐÃ TIÊM' : 'CHƯA'}) nếu bệnh nhân kiệt sức, không hít được khí dung hoặc bắt đầu rối loạn tri giác.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM THUỐC AN THẦN: Khóa cảnh báo cấm hoàn toàn Benzodiazepine, Morphine (${sedativesContraindicatedAvoided ? 'ĐÃ KHÓA AN TOÀN' : 'CỰC KỲ NGUY HIỂM'}). Thuốc an thần ức chế trung tâm hô hấp gây ngừng thở tức khắc! Hạn chế đặt nội khí quản tối đa; chuyển khẩn cấp Trung tâm Hồi sức Hô hấp Tuyến cuối BV Phạm Ngọc Thạch / BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Thuyên Tắc Động Mạch Chi Cấp Tính & Hội Chứng 6P (Acute Limb Ischemia & 6P's) (Phân hệ 71)
   */
  async manageAcuteLimbIschemia(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      sixPsSignsPresent = true,
      rutherfordClassification = 'RUTHERFORD_IIB',
      goldenWindowUnder6h = true,
      heatApplicationStrictlyProhibited = true,
      limbElevationStrictlyProhibited = true,
      ivUnfractionatedHeparinBolusAdministered = true,
    } = payload || {};

    incident.acuteLimbIschemiaCare = {
      isAcuteLimbIschemia: true,
      sixPsSignsPresent: Boolean(sixPsSignsPresent),
      rutherfordClassification: String(rutherfordClassification),
      goldenWindowUnder6h: Boolean(goldenWindowUnder6h),
      heatApplicationStrictlyProhibited: Boolean(heatApplicationStrictlyProhibited),
      limbElevationStrictlyProhibited: Boolean(limbElevationStrictlyProhibited),
      ivUnfractionatedHeparinBolusAdministered: Boolean(ivUnfractionatedHeparinBolusAdministered),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.acuteLimbIschemiaCare && incident.markModified('acuteLimbIschemiaCare');

    incident.auditTrail.push({
      action: 'ACUTE_LIMB_ISCHEMIA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Thiếu máu chi cấp tính: Hội chứng 6P=${sixPsSignsPresent}, Rutherford=${rutherfordClassification}, Cửa sổ vàng 6h=${goldenWindowUnder6h}, CẤM chườm nóng=${heatApplicationStrictlyProhibited}, CẤM kê cao chi=${limbElevationStrictlyProhibited}, Heparin IV bolus=${ivUnfractionatedHeparinBolusAdministered}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAcuteLimbIschemia: true,
      sixPsSignsPresent: Boolean(sixPsSignsPresent),
      rutherfordClassification: String(rutherfordClassification),
      goldenWindowUnder6h: Boolean(goldenWindowUnder6h),
      heatApplicationStrictlyProhibited: Boolean(heatApplicationStrictlyProhibited),
      limbElevationStrictlyProhibited: Boolean(limbElevationStrictlyProhibited),
      ivUnfractionatedHeparinBolusAdministered: Boolean(ivUnfractionatedHeparinBolusAdministered),
      clinicalDirectives: [
        `HỘI CHỨNG 6P KINH ĐIỂN TRONG THIẾU MÁU CHI CẤP (ALI): Nhận diện đầy đủ 6 dấu hiệu lâm sàng: Pain (Đau dữ dội), Pallor (Tái nhợt/vân đá), Pulselessness (Mất mạch ngoại biên), Poikilothermia (Lạnh buốt), Paresthesia (Dị cảm/tê bì), Paralysis (Liệt vận động) (${sixPsSignsPresent ? 'XÁC NHẬN ĐỦ 6P' : 'THEO DÕI'}). Phân loại Rutherford: ${rutherfordClassification} (${rutherfordClassification === 'RUTHERFORD_IIB' ? 'Đe dọa chi ngay lập tức, cần can thiệp khẩn' : 'Theo dõi sát'}).`,
        `CỬA SỔ VÀNG THIẾU MÁU NUÔI 6 GIỜ: Thời gian thiếu máu cục bộ trong vòng 6 giờ (${goldenWindowUnder6h ? 'CÒN TRONG CỬA SỔ VÀNG' : 'NGUY CƠ HOẠI TỬ KHÔNG HỒI PHỤC'}). Sau 6 giờ, mô cơ vân bắt đầu hoại tử không hồi phục dẫn đến nguy cơ cắt cụt chi hoặc sốc nhiễm độc tái tưới máu giải phóng Myoglobin và Kali gây suy thận cấp ngừng tim!`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG NGOẠI VIỆN: TUYỆT ĐỐI CẤM CHƯỜM NÓNG VÀ CẤM KÊ CAO CHI: Khóa cảnh báo cấm chườm nóng / sưởi đèn hồng ngoại (${heatApplicationStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'NGUY HIỂM'}). Nhiệt độ cao làm tăng chuyển hóa tế bào đang thiếu máu, thúc đẩy hoại tử nhanh gấp 3 lần và gây bỏng nặng do da mất cảm giác! Cấm kê cao chi (${limbElevationStrictlyProhibited ? 'TUÂN THỦ' : 'CẢNH BÁO'}), chi cần được để phẳng hoặc dốc nhẹ xuôi theo trọng lực để tối ưu tưới máu động mạch.`,
        `CHỐNG ĐÔNG HEPARIN KHẨN CẤP & PHẪU THUẬT MẠCH MÁU TUYẾN CUỐI: Tiêm tĩnh mạch Heparin không phân đoạn 80 IU/kg bolus (${ivUnfractionatedHeparinBolusAdministered ? 'ĐÃ TIÊM' : 'CHỜ Y LỆNH'}) để ngăn huyết khối lan rộng; bọc bông gòn khô giữ ấm tự nhiên và chuyển khẩn cấp Khoa Phẫu thuật Lồng ngực - Mạch máu BV Chợ Rẫy / BV Bình Dân / BV 115 chuẩn bị lấy huyết khối bằng ống thông Fogarty hoặc can thiệp nội mạch.`,
      ],
    };
  }

  /**
   * Cấp Cứu Nhiễm Trùng Đường Mật Cấp & Ngũ Chứng Reynolds (Acute Cholangitis & Reynolds' Pentad) (Phân hệ 72)
   */
  async manageAcuteCholangitis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      charcotTriadPresent = true,
      reynoldsPentadPresent = true,
      urgentBiliaryDecompressionIndicated = true,
      earlyBroadSpectrumAntibioticsAdministered = true,
    } = payload || {};

    incident.acuteCholangitisCare = {
      isAcuteCholangitis: true,
      charcotTriadPresent: Boolean(charcotTriadPresent),
      reynoldsPentadPresent: Boolean(reynoldsPentadPresent),
      urgentBiliaryDecompressionIndicated: Boolean(urgentBiliaryDecompressionIndicated),
      earlyBroadSpectrumAntibioticsAdministered: Boolean(earlyBroadSpectrumAntibioticsAdministered),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.acuteCholangitisCare && incident.markModified('acuteCholangitisCare');

    incident.auditTrail.push({
      action: 'ACUTE_CHOLANGITIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Nhiễm trùng đường mật: Tam chứng Charcot=${charcotTriadPresent}, Ngũ chứng Reynolds=${reynoldsPentadPresent}, Dẫn lưu giải áp ERCP khẩn=${urgentBiliaryDecompressionIndicated}, Kháng sinh phổ rộng sớm=${earlyBroadSpectrumAntibioticsAdministered}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAcuteCholangitis: true,
      charcotTriadPresent: Boolean(charcotTriadPresent),
      reynoldsPentadPresent: Boolean(reynoldsPentadPresent),
      urgentBiliaryDecompressionIndicated: Boolean(urgentBiliaryDecompressionIndicated),
      earlyBroadSpectrumAntibioticsAdministered: Boolean(earlyBroadSpectrumAntibioticsAdministered),
      clinicalDirectives: [
        `TAM CHỨNG CHARCOT & NGŨ CHỨNG REYNOLDS (TOKYO GUIDELINES TG18): Nhận diện Tam chứng Charcot kinh điển: Đau hạ sườn phải + Sốt cao rét run + Vàng da kết mạc mắt (${charcotTriadPresent ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}). Xuất hiện thêm Tụt huyết áp sốc nhiễm khuẩn (SBP < 90 mmHg) + Rối loạn tri giác lú lẫn hôn mê tạo thành NGŨ CHỨNG REYNOLDS (REYNOLDS' PENTAD) (${reynoldsPentadPresent ? 'DƯƠNG TÍNH - NGUY CƠ TỬ VONG TỐI CẤP 50%' : 'CHƯA CÓ'}).`,
        `HỒI SỨC SỐC NHIỄM KHUẨN ĐƯỜNG MẬT GIỜ VÀNG: Bù dịch tinh thể Ringer Lactate 30 mL/kg trong 3 giờ đầu kết hợp sử dụng Noradrenaline sớm nếu không duy trì được MAP >= 65 mmHg; theo dõi sát lượng nước tiểu qua sonde bàng quang.`,
        `KHÁNG SINH PHỔ RỘNG TĨNH MẠCH TRONG 1 GIỜ ĐẦU: Khởi động ngay Ceftriaxone 2g IV + Metronidazole 500mg IV (${earlyBroadSpectrumAntibioticsAdministered ? 'ĐÃ TRUYỀN' : 'CHỜ'}) bao phủ vi khuẩn đường ruột Gram âm (E. coli, Klebsiella) và kỵ khí; lưu ý kháng sinh đơn thuần không thể giải quyết triệt để ứ trệ áp lực đường mật.`,
        `NGUYÊN TẮC SỐNG CÒN: BẮT BUỘC DẪN LƯU GIẢI ÁP ĐƯỜNG MẬT CẤP CỨU (< 12 - 24 GIỜ): Chỉ định dẫn lưu đường mật giải áp khẩn cấp (${urgentBiliaryDecompressionIndicated ? 'BẮT BUỘC CẤP BÁCH' : 'THEO DÕI'}). Chuyển thẳng Trung tâm Nội soi Can thiệp Mật Tụy BV Chợ Rẫy / BV Bình Dân / BV 115 để đặt stent giải áp đường mật qua nội soi ERCP hoặc dẫn lưu xuyên gan qua da PTCD, cứu sống bệnh nhân trước khi sốc đa cơ quan không hồi phục.`,
      ],
    };
  }

  /**
   * Cấp Cứu Tràn Khí Màng Ngoài Tim Áp Lực & Rò Khí Trung Thất (Tension Pneumopericardium) (Phân hệ 73)
   */
  async manageTensionPneumopericardium(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      waterWheelSoundBruitDeMoulinPresent = true,
      hammanSignCrunchPresent = true,
      subxiphoidNeedleDecompressionPerformed = true,
      highPpvVentilationStrictlyProhibited = true,
    } = payload || {};

    incident.tensionPneumopericardiumCare = {
      isTensionPneumopericardium: true,
      waterWheelSoundBruitDeMoulinPresent: Boolean(waterWheelSoundBruitDeMoulinPresent),
      hammanSignCrunchPresent: Boolean(hammanSignCrunchPresent),
      subxiphoidNeedleDecompressionPerformed: Boolean(subxiphoidNeedleDecompressionPerformed),
      highPpvVentilationStrictlyProhibited: Boolean(highPpvVentilationStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.tensionPneumopericardiumCare && incident.markModified('tensionPneumopericardiumCare');

    incident.auditTrail.push({
      action: 'TENSION_PNEUMOPERICARDIUM_CARE_RECORDED',
      timestamp: new Date(),
      details: `Tràn khí màng tim áp lực: Tiếng bánh xe nước Bruit de Moulin=${waterWheelSoundBruitDeMoulinPresent}, Dấu hiệu Hamman=${hammanSignCrunchPresent}, Chọc kim giải áp dưới mũi kiếm=${subxiphoidNeedleDecompressionPerformed}, CẤM bóp bóng áp lực cao=${highPpvVentilationStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isTensionPneumopericardium: true,
      waterWheelSoundBruitDeMoulinPresent: Boolean(waterWheelSoundBruitDeMoulinPresent),
      hammanSignCrunchPresent: Boolean(hammanSignCrunchPresent),
      subxiphoidNeedleDecompressionPerformed: Boolean(subxiphoidNeedleDecompressionPerformed),
      highPpvVentilationStrictlyProhibited: Boolean(highPpvVentilationStrictlyProhibited),
      clinicalDirectives: [
        `DẤU HIỆU THÍNH CHẨN KINH ĐIỂN: TIẾNG BÁNH XE NƯỚC (BRUIT DE MOULIN) & DẤU HIỆU HAMMAN: Nghe tim phát hiện tiếng lạo xạo óc ách như guồng bánh xe nước cọ xát (${waterWheelSoundBruitDeMoulinPresent ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}) và tiếng lạo xạo bọt khí trung thất đồng thì với nhịp đập của tim (${hammanSignCrunchPresent ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}). Áp lực khí trong khoang màng ngoài tim ép chặt tâm thất gây trụy tim mạch tụt huyết áp phân ly điện cơ PEA!`,
        `CHỌC KIM GIẢI ÁP MÀNG NGOÀI TIM DƯỚI MŨI KIẾM CỨU MẠNG: Dùng kim 16-18G chọc góc 45 độ hướng về vai trái dưới mũi kiếm xương ức (${subxiphoidNeedleDecompressionPerformed ? 'ĐÃ THỰC HIỆN GIẢI ÁP' : 'CẦN CHỌC NGAY'}) để hút xả bọt khí giải tỏa chèn ép tim cấp tức thì.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM THÔNG KHÍ ÁP LỰC DƯƠNG CAO (PPV) KHI CHƯA GIẢI ÁP: Khóa cảnh báo cấm bóp bóng áp lực cao (${highPpvVentilationStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'CỰC KỲ NGUY HIỂM'}). Bóp bóng quá mạnh ép khí từ phế nang rách tràn ồ ạt vào màng tim và trung thất gây nghẽn tắc tuần hoàn tử vong tại chỗ!`,
        `ĐIỀU PHỐI PHẪU THUẬT LỒNG NGỰC - TIM MẠCH TUYẾN CUỐI: Chuyển khẩn cấp Khoa Phẫu thuật Lồng ngực - Mạch máu BV Chợ Rẫy / BV Nhân Dân 115 / Viện Tim TP.HCM để dẫn lưu màng ngoài tim và khâu vết rách khí phế quản.`,
      ],
    };
  }

  /**
   * Cấp Cứu Ngộ Độc Cồn Công Nghiệp Methanol & Mù Võng Mạc Bão Tuyết (Acute Methanol Toxicity) (Phân hệ 74)
   */
  async manageAcuteMethanolToxicity(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      snowstormVisionDefectPresent = true,
      severeAnionGapAcidosisPhUnder7 = true,
      fomepizoleOrEthanolAdministered = true,
      folicAcidLeucovorinGiven = true,
      urgentHemodialysisIndicatedUnder6h = true,
    } = payload || {};

    incident.acuteMethanolToxicityCare = {
      isAcuteMethanolToxicity: true,
      snowstormVisionDefectPresent: Boolean(snowstormVisionDefectPresent),
      severeAnionGapAcidosisPhUnder7: Boolean(severeAnionGapAcidosisPhUnder7),
      fomepizoleOrEthanolAdministered: Boolean(fomepizoleOrEthanolAdministered),
      folicAcidLeucovorinGiven: Boolean(folicAcidLeucovorinGiven),
      urgentHemodialysisIndicatedUnder6h: Boolean(urgentHemodialysisIndicatedUnder6h),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.acuteMethanolToxicityCare && incident.markModified('acuteMethanolToxicityCare');

    incident.auditTrail.push({
      action: 'METHANOL_TOXICITY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc Methanol: Thị giác bão tuyết=${snowstormVisionDefectPresent}, Toan Anion Gap pH<7.0=${severeAnionGapAcidosisPhUnder7}, Fomepizole/Ethanol 40 độ=${fomepizoleOrEthanolAdministered}, Axit Folic=${folicAcidLeucovorinGiven}, Lọc máu ngắt quãng khẩn=${urgentHemodialysisIndicatedUnder6h}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAcuteMethanolToxicity: true,
      snowstormVisionDefectPresent: Boolean(snowstormVisionDefectPresent),
      severeAnionGapAcidosisPhUnder7: Boolean(severeAnionGapAcidosisPhUnder7),
      fomepizoleOrEthanolAdministered: Boolean(fomepizoleOrEthanolAdministered),
      folicAcidLeucovorinGiven: Boolean(folicAcidLeucovorinGiven),
      urgentHemodialysisIndicatedUnder6h: Boolean(urgentHemodialysisIndicatedUnder6h),
      clinicalDirectives: [
        `HỘI CHỨNG THỊ GIÁC BÃO TUYẾT (SNOWSTORM VISION) & TOAN MÁU ANION GAP NẶNG: Nạn nhân nhìn mờ mịt thấy các đốm trắng như đứng giữa bão tuyết (${snowstormVisionDefectPresent ? 'DƯƠNG TÍNH - NGUY CƠ MÙ LÒA VĨNH VIỄN' : 'BÌNH THƯỜNG'}) do Acid Formic ức chế hô hấp tế bào phá hủy dây thần kinh thị giác. Kèm toan chuyển hóa tăng khoảng trống Anion Gap cực nặng pH < 7.0 (${severeAnionGapAcidosisPhUnder7 ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}).`,
        `ĐỐI KHÁNG CẠNH TRANH ENZYM ADH BẰNG FOMEPIZOLE / ETHANOL: Khởi động sớm Fomepizole tiêm tĩnh mạch (hoặc Ethanol uống 40 độ liều 1 mL/kg) (${fomepizoleOrEthanolAdministered ? 'ĐÃ KHỞI ĐỘNG' : 'CHỜ'}) để cạnh tranh enzym Alcohol Dehydrogenase, ngăn cản chuyển hóa Methanol thành Acid Formic kịch độc.`,
        `THÚC ĐẨY THOÁI HÓA ACID FORMIC BẰNG ACID FOLIC: Tiêm tĩnh mạch Acid Folic / Leucovorin 50mg mỗi 4 giờ (${folicAcidLeucovorinGiven ? 'ĐÃ TRUYỀN' : 'CHỜ'}) giúp chuyển hóa Acid Formic thành CO2 và nước vô hại; truyền Natri Bicarbonate 8.4% chống toan máu.`,
        `NGUYÊN TẮC SỐNG CÒN: CHỈ ĐỊNH LỌC MÁU NGẮT QUÃNG CẤP CỨU (< 6 GIỜ): Chỉ định lọc máu chạy thận nhân tạo cấp cứu (${urgentHemodialysisIndicatedUnder6h ? 'BẮT BUỘC KHẨN CẤP' : 'THEO DÕI'}). Chuyển thẳng Khoa Hồi sức Chống Độc Bệnh viện Chợ Rẫy / BV 115 để chạy thận lọc sạch Methanol và Acid Formic trước khi hoại tử nhân bèo não và mù mắt vĩnh viễn.`,
      ],
    };
  }

  /**
   * Cấp Cứu Hội Chứng Chèn Ép Khoang Bụng Cấp & Tăng Áp Lực Ổ Bụng Nặng (Abdominal Compartment Syndrome - ACS & IAH) (Phân hệ 75)
   */
  async manageAbdominalCompartmentSyndrome(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      bladderPressureIapOver20MmHg = true,
      oliguriaAndPeakAirwayPressureSpike = true,
      excessiveFluidOverloadStrictlyProhibited = true,
      decompressiveLaparotomyIndicated = true,
      gastricAndRectalDecompressionApplied = true,
    } = payload || {};

    incident.abdominalCompartmentSyndromeCare = {
      isAbdominalCompartmentSyndrome: true,
      bladderPressureIapOver20MmHg: Boolean(bladderPressureIapOver20MmHg),
      oliguriaAndPeakAirwayPressureSpike: Boolean(oliguriaAndPeakAirwayPressureSpike),
      excessiveFluidOverloadStrictlyProhibited: Boolean(excessiveFluidOverloadStrictlyProhibited),
      decompressiveLaparotomyIndicated: Boolean(decompressiveLaparotomyIndicated),
      gastricAndRectalDecompressionApplied: Boolean(gastricAndRectalDecompressionApplied),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.abdominalCompartmentSyndromeCare && incident.markModified('abdominalCompartmentSyndromeCare');

    incident.auditTrail.push({
      action: 'ABDOMINAL_COMPARTMENT_SYNDROME_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hội chứng chèn ép khoang bụng: Áp lực bàng quang IAP>20mmHg=${bladderPressureIapOver20MmHg}, Thiểu niệu/Áp lực đỉnh thở vọt=${oliguriaAndPeakAirwayPressureSpike}, CẤM bù dịch quá tải=${excessiveFluidOverloadStrictlyProhibited}, Mở bụng giải áp=${decompressiveLaparotomyIndicated}, Sonde dạ dày/hậu môn=${gastricAndRectalDecompressionApplied}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAbdominalCompartmentSyndrome: true,
      bladderPressureIapOver20MmHg: Boolean(bladderPressureIapOver20MmHg),
      oliguriaAndPeakAirwayPressureSpike: Boolean(oliguriaAndPeakAirwayPressureSpike),
      excessiveFluidOverloadStrictlyProhibited: Boolean(excessiveFluidOverloadStrictlyProhibited),
      decompressiveLaparotomyIndicated: Boolean(decompressiveLaparotomyIndicated),
      gastricAndRectalDecompressionApplied: Boolean(gastricAndRectalDecompressionApplied),
      clinicalDirectives: [
        `TAM CHỨNG CHÈN ÉP KHOANG BỤNG CẤP (ACS WSACS GUIDELINES): Áp lực bàng quang IAP đo được > 20 mmHg (${bladderPressureIapOver20MmHg ? 'XÁC NHẬN IAH ĐỘ IV' : 'BÌNH THƯỜNG'}) đi kèm Tam chứng suy tạng: Bụng căng cứng như gỗ + Vô niệu do chèn ép mạch thận + Áp lực đỉnh đường thở tăng vọt > 40 cmH2O do cơ hoành bị đẩy lên cao (${oliguriaAndPeakAirwayPressureSpike ? 'XÁC NHẬN SUY TẠNG ĐA CƠ QUAN' : 'CHƯA SUY TẠNG'}).`,
        `GIẢI ÁP NỘI KHOA BAN ĐẦU: Đặt ống thông dạ dày hút ngắt quãng và ống thông trực tràng xả khí ruột (${gastricAndRectalDecompressionApplied ? 'ĐÃ ĐẶT GIẢI ÁP' : 'CHỜ THỰC HIỆN'}), đặt tư thế nằm đầu phẳng tránh gập bụng; an thần sâu và giãn cơ để giảm trương lực thành bụng.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM BÙ DỊCH QUÁ TẢI (FLUID OVERLOAD CONTRAINDICATION): Khóa cảnh báo cấm bù dịch ồ ạt (${excessiveFluidOverloadStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'CỰC KỲ NGUY HIỂM'}). Bù dịch tinh thể quá mức làm các quai ruột phù nề gấp 3 lần đẩy IAP vọt lên > 30-35 mmHg gây ngừng tuần hoàn do tắc nghẽn tĩnh mạch chủ dưới!`,
        `PHẪU THUẬT MỞ BỤNG GIẢI ÁP CẤP CỨU (DECOMPRESSIVE LAPAROTOMY): Chỉ định mổ mở toang ổ bụng khẩn cấp (${decompressiveLaparotomyIndicated ? 'BẮT BUỘC KHẨN CẤP' : 'THEO DÕI NỘI KHOA'}), sử dụng túi Bogota hoặc hút áp lực âm Vac-Pack. Chuyển thẳng Phòng mổ Cấp cứu Ngoại Tiêu hóa BV Chợ Rẫy / BV Bình Dân / BV 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Nhãn Cầu Thủng & Vỡ Nhãn Cầu Mở (Open Globe Injury - OGI & Seidel Test) (Phân hệ 76)
   */
  async manageOpenGlobeInjury(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      seidelTestPositive = true,
      teardropPupilPresent = true,
      rigidEyeShieldAppliedNoPressure = true,
      pressureAndEyeRubbingStrictlyProhibited = true,
      succinylcholineStrictlyProhibited = true,
    } = payload || {};

    incident.openGlobeInjuryCare = {
      isOpenGlobeInjury: true,
      seidelTestPositive: Boolean(seidelTestPositive),
      teardropPupilPresent: Boolean(teardropPupilPresent),
      rigidEyeShieldAppliedNoPressure: Boolean(rigidEyeShieldAppliedNoPressure),
      pressureAndEyeRubbingStrictlyProhibited: Boolean(pressureAndEyeRubbingStrictlyProhibited),
      succinylcholineStrictlyProhibited: Boolean(succinylcholineStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.openGlobeInjuryCare && incident.markModified('openGlobeInjuryCare');

    incident.auditTrail.push({
      action: 'OPEN_GLOBE_INJURY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương vỡ nhãn cầu mở: Seidel test=${seidelTestPositive}, Đồng tử giọt nước=${teardropPupilPresent}, Khiên cứng không tỳ đè=${rigidEyeShieldAppliedNoPressure}, CẤM đè ép/dụi mắt=${pressureAndEyeRubbingStrictlyProhibited}, CẤM Succinylcholine=${succinylcholineStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isOpenGlobeInjury: true,
      seidelTestPositive: Boolean(seidelTestPositive),
      teardropPupilPresent: Boolean(teardropPupilPresent),
      rigidEyeShieldAppliedNoPressure: Boolean(rigidEyeShieldAppliedNoPressure),
      pressureAndEyeRubbingStrictlyProhibited: Boolean(pressureAndEyeRubbingStrictlyProhibited),
      succinylcholineStrictlyProhibited: Boolean(succinylcholineStrictlyProhibited),
      clinicalDirectives: [
        `NGHIỆM PHÁP SEIDEL DƯƠNG TÍNH & ĐỒNG TỬ GIỌT NƯỚC (TEARDROP PUPIL): Nhỏ Fluorescein phát hiện dòng thủy dịch trong suốt pha loãng dòng màu (${seidelTestPositive ? 'SEIDEL DƯƠNG TÍNH - XÁC NHẬN THỦNG NHÃN CẦU' : 'ÂM TÍNH'}). Đồng tử méo hình giọt nước (${teardropPupilPresent ? 'DƯƠNG TÍNH - ĐỈNH HƯỚNG VỀ VẾT RÁCH' : 'BÌNH THƯỜNG'}) do mống mắt bị áp lực hút kẹt vào lỗ rách giác củng mạc.`,
        `KHIÊN CỨNG BẢO VỆ MẮT TỰA BỜ XƯƠNG (RIGID EYE SHIELD): Dán khiên che mắt cứng bằng kim loại/nhựa có lỗ tựa lên bờ xương ổ mắt (${rigidEyeShieldAppliedNoPressure ? 'ĐÃ CỐ ĐỊNH KHIÊN CỨNG' : 'CHƯA ĐẶT'}), tuyệt đối không để khiên tiếp xúc hoặc tỳ đè lên nhãn cầu.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG NGOẠI VIỆN: TUYỆT ĐỐI CẤM ĐÈ ÉP, DỤI MẮT, BĂNG ÉP HOẶC RÚT DỊ VẬT: Khóa cảnh báo cấm đè ép (${pressureAndEyeRubbingStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'CỰC KỲ NGUY HIỂM'}). Mọi lực tỳ đè sẽ tống toàn bộ dịch kính, thể thủy tinh và võng mạc phòi ra ngoài gây mù vĩnh viễn không thể cứu vãn! Cấm nhỏ thuốc mỡ, cấm nhỏ thuốc giãn đồng tử.`,
        `KHÓA CẢNH BÁO TỐN THUỐC ĐẶT NỘI KHÍ QUẢN: TUYỆT ĐỐI CẤM SUCCINYLCHOLINE: Cấm dùng thuốc giãn cơ khử cực Succinylcholine (${succinylcholineStrictlyProhibited ? 'ĐÃ KHÓA CẤM' : 'NGUY CƠ PHÒI NỘI NHÃN'}) vì làm co thắt cơ ngoại nhãn tăng vọt áp lực nội nhãn tống xuất nhãn cầu; bắt buộc dùng Rocuronium 1.2 mg/kg. Chuyển khẩn cấp Bệnh viện Mắt TP.HCM / Khoa Mắt BV Chợ Rẫy phẫu thuật khâu bảo tồn nhãn cầu < 12-24h.`,
      ],
    };
  }

  /**
   * Cấp Cứu Trụy Tuần Hoàn Do Ngộ Độc Kháng Đông Mới (Direct Oral Anticoagulants - DOACs Bleeding Crisis) (Phân hệ 77)
   */
  async manageDoacBleedingCrisis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      doacAgent = 'DABIGATRAN_IIA',
      specificAntidoteAdministered = true,
      ffpAloneStrictlyProhibited = true,
      vitaminKProhibitedForDoacs = true,
    } = payload || {};

    incident.doacBleedingCrisisCare = {
      isDoacBleedingCrisis: true,
      doacAgent: String(doacAgent),
      specificAntidoteAdministered: Boolean(specificAntidoteAdministered),
      ffpAloneStrictlyProhibited: Boolean(ffpAloneStrictlyProhibited),
      vitaminKProhibitedForDoacs: Boolean(vitaminKProhibitedForDoacs),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.doacBleedingCrisisCare && incident.markModified('doacBleedingCrisisCare');

    incident.auditTrail.push({
      action: 'DOAC_BLEEDING_CRISIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Xuất huyết do kháng đông mới: Thuốc=${doacAgent}, Thuốc đối kháng đặc hiệu=${specificAntidoteAdministered}, CẤM FFP đơn thuần=${ffpAloneStrictlyProhibited}, Khóa Vitamin K=${vitaminKProhibitedForDoacs}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isDoacBleedingCrisis: true,
      doacAgent: String(doacAgent),
      specificAntidoteAdministered: Boolean(specificAntidoteAdministered),
      ffpAloneStrictlyProhibited: Boolean(ffpAloneStrictlyProhibited),
      vitaminKProhibitedForDoacs: Boolean(vitaminKProhibitedForDoacs),
      clinicalDirectives: [
        `PHÂN ĐỊNH THUỐC CHỐNG ĐÔNG THẾ HỆ MỚI (DOACs/NOACs): Nạn nhân đang sử dụng nhóm kháng trực tiếp Thrombin IIa (${doacAgent === 'DABIGATRAN_IIA' ? 'DABIGATRAN' : 'KHÔNG PHẢI DABIGATRAN'}) hoặc kháng chọn lọc Factor Xa (${['RIVAROXABAN_XA', 'APIXABAN_XA', 'EDOXABAN_XA'].includes(doacAgent) ? doacAgent : 'KHÁC'}). Đang xuất huyết ồ ạt đe dọa tính mạng tụt huyết áp.`,
        `ĐỐI KHÁNG ĐẶC HIỆU KHẨN CẤP (SPECIFIC REVERSAL AGENTS): Đối kháng Dabigatran bằng kháng thể đơn dòng Idarucizumab (Praxbind) 5g IV tiêm tĩnh mạch; đối kháng Rivaroxaban/Apixaban bằng Andexanet Alfa hoặc Phức hợp Prothrombin cô đặc 4 yếu tố (4-Factor PCC / Beriplex) liều 50 IU/kg IV bolus (${specificAntidoteAdministered ? 'ĐÃ KHỞI ĐỘNG ĐỐI KHÁNG' : 'CHỜ THUỐC'}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM TRUYỀN HUYẾT TƯƠNG ĐÔNG LẠNH (FFP) ĐƠN THUẦN: Khóa cảnh báo cấm truyền FFP đơn thuần (${ffpAloneStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'NGUY HIỂM'}). FFP không đủ nồng độ yếu tố đông máu để trung hòa DOACs, truyền nhiều lít dịch FFP sẽ gây quá tải tuần hoàn cấp (TACO), phù phổi cấp và tử vong trước khi đông máu được phục hồi!`,
        `KHÓA CẢNH BÁO VITAMIN K HOÀN TOÀN VÔ HIỆU: Cảnh báo Vitamin K (${vitaminKProhibitedForDoacs ? 'ĐÃ KHÓA CẢNH BÁO' : 'LƯU Ý'}) chỉ có tác dụng đối kháng Warfarin/Coumarin, hoàn toàn KHÔNG CÓ TÁC DỤNG trên DOACs. Chuyển khẩn cấp Trung tâm Huyết học - Đột quỵ BV Chợ Rẫy / BV 115 có sẵn dự trữ Idarucizumab và 4-Factor PCC.`,
      ],
    };
  }

  /**
   * Cấp Cứu Vỡ Tim Do Chấn Thương Ngực Kín & Dập Cơ Tim (Blunt Cardiac Rupture & Myocardial Contusion) (Phân hệ 78)
   */
  async manageBluntCardiacRupture(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      swirlingHemopericardiumAfiEfast = true,
      newCardiacMurmurOrArrhythmia = true,
      thrombolyticsStrictlyProhibited = true,
      excessiveFluidOverloadRvProhibited = true,
      emergentCardiopulmonaryBypassCecIndicated = true,
    } = payload || {};

    incident.bluntCardiacRuptureCare = {
      isBluntCardiacRupture: true,
      swirlingHemopericardiumAfiEfast: Boolean(swirlingHemopericardiumAfiEfast),
      newCardiacMurmurOrArrhythmia: Boolean(newCardiacMurmurOrArrhythmia),
      thrombolyticsStrictlyProhibited: Boolean(thrombolyticsStrictlyProhibited),
      excessiveFluidOverloadRvProhibited: Boolean(excessiveFluidOverloadRvProhibited),
      emergentCardiopulmonaryBypassCecIndicated: Boolean(emergentCardiopulmonaryBypassCecIndicated),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.bluntCardiacRuptureCare && incident.markModified('bluntCardiacRuptureCare');

    incident.auditTrail.push({
      action: 'BLUNT_CARDIAC_RUPTURE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ tim do đụng dập ngực kín: E-FAST tràn máu màng tim=${swirlingHemopericardiumAfiEfast}, Tiếng thổi/loạn nhịp mới=${newCardiacMurmurOrArrhythmia}, CẤM tiêu sợi huyết=${thrombolyticsStrictlyProhibited}, Hạn chế quá tải dịch thất phải=${excessiveFluidOverloadRvProhibited}, Mổ tim hở CEC=${emergentCardiopulmonaryBypassCecIndicated}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isBluntCardiacRupture: true,
      swirlingHemopericardiumAfiEfast: Boolean(swirlingHemopericardiumAfiEfast),
      newCardiacMurmurOrArrhythmia: Boolean(newCardiacMurmurOrArrhythmia),
      thrombolyticsStrictlyProhibited: Boolean(thrombolyticsStrictlyProhibited),
      excessiveFluidOverloadRvProhibited: Boolean(excessiveFluidOverloadRvProhibited),
      emergentCardiopulmonaryBypassCecIndicated: Boolean(emergentCardiopulmonaryBypassCecIndicated),
      clinicalDirectives: [
        `E-FAST SIÊU ÂM TẠI GIƯỜNG & CHẤN THƯƠNG TIM KÍN (BLUNT CARDIAC INJURY): Hình ảnh màng ngoài tim đầy dịch máu xoáy cuộn kèm cục máu đông (${swirlingHemopericardiumAfiEfast ? 'DƯƠNG TÍNH - NGUY CƠ RÁCH VỠ TÂM THẤT/TÂM NHĨ' : 'ÂM TÍNH'}). Xuất hiện tiếng thổi tim mới hoặc loạn nhịp thất chết người VT/VF (${newCardiacMurmurOrArrhythmia ? 'DƯƠNG TÍNH - TỔN THƯƠNG CƠ TIM CẤP' : 'BÌNH THƯỜNG'}) do đứt cơ nhú van tim hoặc thủng vách liên thất VSD.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM DÙNG THUỐC TIÊU SỢI HUYẾT (THROMBOLYTICS PROHIBITED): Khóa cảnh báo cấm tPA/Streptokinase (${thrombolyticsStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'CỰC KỲ NGUY HIỂM'}). Lầm tưởng ST chênh do dập cơ tim là nhồi máu cơ tim rồi tiêm tiêu sợi huyết sẽ làm tan cục máu đông tự cầm máu, khiến vết rách cơ tim toác toang phun máu tử vong trong 30 giây!`,
        `HẠN CHẾ QUÁ TẢI DỊCH TRONG DẬP THẤT PHẢI CẤP (RV CONTUSION): Cảnh báo kiểm soát dịch truyền chặt chẽ (${excessiveFluidOverloadRvProhibited ? 'ĐÃ HẠN CHẾ' : 'CẨN TRỌNG'}), bù dịch ồ ạt làm thất phải bị dập giãn to ép vách liên thất cong sang trái gây cản trở tống máu thất trái làm trụy mạch nặng nề hơn.`,
        `PHẪU THUẬT TIM HỞ CHẠY MÁY TIM PHỔI NHÂN TẠO KHẨN CẤP (EMERGENT CPB/CEC): Chỉ định mổ hở ngực khẩn cấp vá thành cơ tim (${emergentCardiopulmonaryBypassCecIndicated ? 'BẮT BUỘC KHẨN CẤP' : 'THEO DÕI'}). Kích hoạt Báo động đỏ điều phối chuyển thẳng Bệnh viện Chợ Rẫy / Bệnh viện Nhân Dân 115 / Viện Tim TP.HCM kíp phẫu thuật tim mạch lồng ngực và máy CEC sẵn sàng.`,
      ],
    };
  }

  /**
   * Cấp Cứu Thuyên Tắc Khí Áp Lực Hệ Tĩnh Mạch Trung Tâm & Tư Thế Durant (Venous Air Embolism & Durant Maneuver) (Phân hệ 79)
   */
  async manageVenousAirEmbolism(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      durantManeuverAppliedLeftLateralTrendelenburg = true,
      highFlowOxygen100NitrogenWashout = true,
      uprightSittingPositionStrictlyProhibited = true,
      highPeepVentilationStrictlyProhibited = true,
    } = payload || {};

    incident.venousAirEmbolismCare = {
      isVenousAirEmbolism: true,
      durantManeuverAppliedLeftLateralTrendelenburg: Boolean(durantManeuverAppliedLeftLateralTrendelenburg),
      highFlowOxygen100NitrogenWashout: Boolean(highFlowOxygen100NitrogenWashout),
      uprightSittingPositionStrictlyProhibited: Boolean(uprightSittingPositionStrictlyProhibited),
      highPeepVentilationStrictlyProhibited: Boolean(highPeepVentilationStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.venousAirEmbolismCare && incident.markModified('venousAirEmbolismCare');

    incident.auditTrail.push({
      action: 'VENOUS_AIR_EMBOLISM_CARE_RECORDED',
      timestamp: new Date(),
      details: `Thuyên tắc khí tĩnh mạch trung tâm: Tư thế Durant=${durantManeuverAppliedLeftLateralTrendelenburg}, Oxy 100% rửa Nitơ=${highFlowOxygen100NitrogenWashout}, CẤM ngồi dậy=${uprightSittingPositionStrictlyProhibited}, CẤM PEEP cao=${highPeepVentilationStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isVenousAirEmbolism: true,
      durantManeuverAppliedLeftLateralTrendelenburg: Boolean(durantManeuverAppliedLeftLateralTrendelenburg),
      highFlowOxygen100NitrogenWashout: Boolean(highFlowOxygen100NitrogenWashout),
      uprightSittingPositionStrictlyProhibited: Boolean(uprightSittingPositionStrictlyProhibited),
      highPeepVentilationStrictlyProhibited: Boolean(highPeepVentilationStrictlyProhibited),
      clinicalDirectives: [
        `TƯ THẾ DURANT CỨU MẠNG (DURANT'S MANEUVER): Đặt nạn nhân nằm nghiêng hoàn toàn sang bên trái kết hợp đầu dốc Trendelenburg 15-30 độ (${durantManeuverAppliedLeftLateralTrendelenburg ? 'ĐÃ ĐẶT TƯ THẾ DURANT' : 'CHỜ THỰC HIỆN'}). Bọt khí nhẹ hơn máu sẽ bẫy lại ở đỉnh tâm nhĩ phải và mỏm thất phải, giải tỏa nút bít khí Air Lock ở đường ra thất phải và van động mạch phổi để dòng máu tiếp tục lên phổi.`,
        `RỬA TRÔI KHÍ NITƠ BẰNG OXY 100% NRM (NITROGEN WASHOUT): Thở oxy 100% qua mặt nạ túi dự trữ 15 L/phút (${highFlowOxygen100NitrogenWashout ? 'ĐANG THỞ OXY 100%' : 'CHƯA ĐẶT'}). Rửa sạch khí Nitơ trong phế nang tạo gradient chênh lệch áp suất lớn để Nitơ trong bọt khí nhanh chóng khuếch tán vào máu hòa tan tiêu biến.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM ĐỂ NẠN NHÂN NGỒI HOẶC ĐỨNG DẬY: Khóa cảnh báo cấm ngồi (${uprightSittingPositionStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'CỰC KỲ NGUY HIỂM'}). Tư thế ngồi đứng sẽ làm bọt khí bốc thẳng lên tĩnh mạch cảnh vào não gây nhồi máu não diện rộng và nghẽn van phổi tử vong tức thì!`,
        `CHỐNG CHỈ ĐỊNH THÔNG KHÍ PEEP CAO: Khóa cảnh báo cấm PEEP cao (${highPeepVentilationStrictlyProhibited ? 'ĐÃ KHÓA CẤM' : 'NGUY HIỂM'}) tránh áp lực buồng tim phải tăng cao đẩy bọt khí qua lỗ bầu dục mở PFO sang tim trái gây thuyên tắc nghịch thường tắc mạch vành và não. Chuyển khẩn cấp BV Chợ Rẫy / BV 115 kíp can thiệp tim mạch hút khí Catheter hoặc buồng oxy cao áp HBOT.`,
      ],
    };
  }

  /**
   * Cấp Cứu Cơn Tăng Áp Lực Tĩnh Mạch Cửa & Xuất Huyết Giãn Vỡ Tĩnh Mạch Thực Quản (Esophageal Variceal Bleeding) (Phân hệ 80)
   */
  async manageEsophagealVaricealBleeding(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      massiveHematemesisCirrhosisPresent = true,
      vasoactiveTerlipressinOrOctreotideGiven = true,
      restrictiveTransfusionEnforced = true,
      excessiveFluidResuscitationStrictlyProhibited = true,
      sengstakenBlakemoreTubeAvailable = true,
    } = payload || {};

    incident.esophagealVaricealBleedingCare = {
      isEsophagealVaricealBleeding: true,
      massiveHematemesisCirrhosisPresent: Boolean(massiveHematemesisCirrhosisPresent),
      vasoactiveTerlipressinOrOctreotideGiven: Boolean(vasoactiveTerlipressinOrOctreotideGiven),
      restrictiveTransfusionEnforced: Boolean(restrictiveTransfusionEnforced),
      excessiveFluidResuscitationStrictlyProhibited: Boolean(excessiveFluidResuscitationStrictlyProhibited),
      sengstakenBlakemoreTubeAvailable: Boolean(sengstakenBlakemoreTubeAvailable),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.esophagealVaricealBleedingCare && incident.markModified('esophagealVaricealBleedingCare');

    incident.auditTrail.push({
      action: 'VARICEAL_BLEEDING_CARE_RECORDED',
      timestamp: new Date(),
      details: `Xuất huyết vỡ giãn tĩnh mạch thực quản: Nôn máu xơ gan=${massiveHematemesisCirrhosisPresent}, Terlipressin/Octreotide=${vasoactiveTerlipressinOrOctreotideGiven}, Truyền máu hạn chế Hb 7-8=${restrictiveTransfusionEnforced}, CẤM bù dịch quá mức=${excessiveFluidResuscitationStrictlyProhibited}, Sonde Sengstaken=${sengstakenBlakemoreTubeAvailable}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isEsophagealVaricealBleeding: true,
      massiveHematemesisCirrhosisPresent: Boolean(massiveHematemesisCirrhosisPresent),
      vasoactiveTerlipressinOrOctreotideGiven: Boolean(vasoactiveTerlipressinOrOctreotideGiven),
      restrictiveTransfusionEnforced: Boolean(restrictiveTransfusionEnforced),
      excessiveFluidResuscitationStrictlyProhibited: Boolean(excessiveFluidResuscitationStrictlyProhibited),
      sengstakenBlakemoreTubeAvailable: Boolean(sengstakenBlakemoreTubeAvailable),
      clinicalDirectives: [
        `XUẤT HUYẾT TIÊU HÓA TRÊN TỐI CẤP DO TĂNG ÁP CỬA (PORTAL HYPERTENSION): Nôn ra máu đỏ tươi ồ ạt kèm máu cục ở bệnh nhân xơ gan (${massiveHematemesisCirrhosisPresent ? 'XÁC NHẬN VỠ GIÃN TĨNH MẠCH THỰC QUẢN' : 'NGHI NGỜ'}) đe dọa sốc mất máu tụt huyết áp kịch phát.`,
        `KHỞI ĐỘNG THUỐC CO MẠCH TẠNG HẠ ÁP CỬA SỚM: Tiêm tĩnh mạch Terlipressin 2mg IV bolus (hoặc Octreotide 50 mcg IV bolus rồi duy trì 50 mcg/h) (${vasoactiveTerlipressinOrOctreotideGiven ? 'ĐÃ TIÊM CO MẠCH TẠNG' : 'CHỜ THUỐC'}) để làm co động mạch mạc treo tạng, giảm lượng máu và giảm áp lực dòng chảy vào tĩnh mạch cửa; kèm Ceftriaxone 1g IV phòng ngừa viêm phúc mạc nhiễm khuẩn nguyên phát.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CHIẾN LƯỢC HỒI SỨC HẠN CHẾ (RESTRICTIVE RESUSCITATION STRATEGY): Khóa cảnh báo cấm bù dịch tinh thể hoặc máu quá mức (${excessiveFluidResuscitationStrictlyProhibited ? 'ĐÃ KHÓA AN TOÀN' : 'CỰC KỲ NGUY HIỂM'}). Bù dịch quá nhiều nâng HA > 100-110 mmHg làm áp lực tĩnh mạch cửa tăng vọt dội ngược phá toác cục máu đông bít chỗ rách, gây xuất huyết tái phát ồ ạt tử vong! Mục tiêu duy trì Hemoglobin chỉ 7-8 g/dL và SBP 90-100 mmHg (${restrictiveTransfusionEnforced ? 'CHIẾN LƯỢC HẠN CHẾ ĐƯỢC THI HÀNH' : 'CẦN CHỈNH LIỀU'}).`,
        `SẴN SÀNG BÓNG CHÈN SENGSTAKEN-BLAKEMORE & CHUYỂN NỘI SOI CẤP CỨU: Sẵn sàng đặt sonde bóng chèn Sengstaken-Blakemore bơm 250 mL bóng dạ dày chèn cơ học nếu máu phun không cầm được (${sengstakenBlakemoreTubeAvailable ? 'ĐÃ SẴN SÀNG' : 'CHƯA CÓ'}). Chuyển thẳng Trung tâm Nội soi Tiêu hóa BV Chợ Rẫy / BV Bình Dân / BV 115 thắt vòng cao su EVL khẩn cấp.`,
      ],
    };
  }

  /**
   * Cấp Cứu Ngạt Khí Do Hít Khói Đám Cháy & Ngộ Độc Khí Cyanide / Phỏng Đường Thở (Phân hệ 81)
   */
  async manageSmokeInhalationCyanide(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      carbonaceousSputumAndFacialBurns = true,
      severeLacticAcidosisOver8 = true,
      hydroxocobalaminCyanokitAdministered = true,
      nitritesContraindicatedForCoStrictlyEnforced = true,
      prophylacticEarlyIntubationIndicated = true,
    } = payload || {};

    incident.smokeInhalationCyanideCare = {
      isSmokeInhalationCyanide: true,
      carbonaceousSputumAndFacialBurns: Boolean(carbonaceousSputumAndFacialBurns),
      severeLacticAcidosisOver8: Boolean(severeLacticAcidosisOver8),
      hydroxocobalaminCyanokitAdministered: Boolean(hydroxocobalaminCyanokitAdministered),
      nitritesContraindicatedForCoStrictlyEnforced: Boolean(nitritesContraindicatedForCoStrictlyEnforced),
      prophylacticEarlyIntubationIndicated: Boolean(prophylacticEarlyIntubationIndicated),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.smokeInhalationCyanideCare && incident.markModified('smokeInhalationCyanideCare');

    incident.auditTrail.push({
      action: 'SMOKE_CYANIDE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngạt khói đám cháy & Cyanide: Đờm bồ hóng/Bỏng mặt=${carbonaceousSputumAndFacialBurns}, Toan Lactic >8=${severeLacticAcidosisOver8}, Hydroxocobalamin Cyanokit=${hydroxocobalaminCyanokitAdministered}, CẤM Nitrite khi có CO=${nitritesContraindicatedForCoStrictlyEnforced}, Đặt NKQ dự phòng=${prophylacticEarlyIntubationIndicated}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isSmokeInhalationCyanide: true,
      carbonaceousSputumAndFacialBurns: Boolean(carbonaceousSputumAndFacialBurns),
      severeLacticAcidosisOver8: Boolean(severeLacticAcidosisOver8),
      hydroxocobalaminCyanokitAdministered: Boolean(hydroxocobalaminCyanokitAdministered),
      nitritesContraindicatedForCoStrictlyEnforced: Boolean(nitritesContraindicatedForCoStrictlyEnforced),
      prophylacticEarlyIntubationIndicated: Boolean(prophylacticEarlyIntubationIndicated),
      clinicalDirectives: [
        `DẤU HIỆU BỎNG HÔ HẤP & TOAN LACTIC NẶNG DO CYANIDE: Nạn nhân khói cháy kín có đờm muội than đen, cháy sém lông mũi lông mi, khàn tiếng thở rít (${carbonaceousSputumAndFacialBurns ? 'DƯƠNG TÍNH - PHỎNG HÔ HẤP' : 'BÌNH THƯỜNG'}). Kèm toan chuyển hóa Lactic nặng > 8 mmol/L (${severeLacticAcidosisOver8 ? 'DƯƠNG TÍNH' : 'ÂM TÍNH'}) do Cyanide gắn vào Cytochrome a3 ức chế hô hấp tế bào yếm khí.`,
        `THUỐC GIẢI ĐỘC ĐẶC HIỆU CYANIDE HÀNG ĐẦU (CYANOKIT): Truyền tĩnh mạch Hydroxocobalamin (Cyanokit) 5g IV trong 15 phút (${hydroxocobalaminCyanokitAdministered ? 'ĐÃ TRUYỀN CYANOKIT' : 'CHỜ THUỐC'}). Hydroxocobalamin gắn kết ái lực cao với Cyanide biến thành Cyanocobalamin (Vitamin B12) vô hại đào thải qua nước tiểu. Thở oxy 100% NRM hỗ trợ.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM DÙNG SODIUM NITRITE / AMYL NITRITE KHI CÓ CO: Khóa cảnh báo cấm nhóm Nitrite (${nitritesContraindicatedForCoStrictlyEnforced ? 'ĐÃ KHÓA CẤM' : 'CỰC KỲ NGUY HIỂM'}). Trong khói cháy nạn nhân luôn hít phải cả CO lẫn Cyanide; CO đã chiếm Hemoglobin, nếu dùng Nitrite tạo Methemoglobin sẽ triệt tiêu hoàn toàn khả năng vận chuyển oxy làm nạn nhân ngạt thở tử vong ngay lập tức!`,
        `ĐẶT NỘI KHÍ QUẢN BẢO VỆ ĐƯỜNG THỞ DỰ PHÒNG SỚM: Chỉ định đặt ống nội khí quản sớm trước khi thanh môn phù nề tắc nghẽn (${prophylacticEarlyIntubationIndicated ? 'BẮT BUỘC ĐẶT SỚM' : 'THEO DÕI'}). Chuyển khẩn cấp Trung tâm Hồi sức Chống độc & Bỏng BV Chợ Rẫy / Viện Bỏng Lê Hữu Trác / BV 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Phản Vệ Pha Hai & Kháng Adrenaline Do Thuốc Chẹn Beta (Phân hệ 82)
   */
  async manageBiphasicAnaphylaxis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      biphasicRecurrenceAfterInitialStabilization = true,
      concurrentBetaBlockerTherapy = true,
      glucagonIvAdministeredSlow5Min = true,
      prematureDischargeStrictlyProhibited = true,
      rapidGlucagonBolusStrictlyProhibited = true,
    } = payload || {};

    incident.biphasicAnaphylaxisCare = {
      isBiphasicAnaphylaxis: true,
      biphasicRecurrenceAfterInitialStabilization: Boolean(biphasicRecurrenceAfterInitialStabilization),
      concurrentBetaBlockerTherapy: Boolean(concurrentBetaBlockerTherapy),
      glucagonIvAdministeredSlow5Min: Boolean(glucagonIvAdministeredSlow5Min),
      prematureDischargeStrictlyProhibited: Boolean(prematureDischargeStrictlyProhibited),
      rapidGlucagonBolusStrictlyProhibited: Boolean(rapidGlucagonBolusStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.biphasicAnaphylaxisCare && incident.markModified('biphasicAnaphylaxisCare');

    incident.auditTrail.push({
      action: 'BIPHASIC_ANAPHYLAXIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Sốc phản vệ pha hai / Kháng Adrenaline: Tái phát pha hai=${biphasicRecurrenceAfterInitialStabilization}, Đang dùng chẹn Beta=${concurrentBetaBlockerTherapy}, Glucagon IV chậm 5p=${glucagonIvAdministeredSlow5Min}, CẤM về sớm=${prematureDischargeStrictlyProhibited}, CẤM bolus Glucagon nhanh=${rapidGlucagonBolusStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isBiphasicAnaphylaxis: true,
      biphasicRecurrenceAfterInitialStabilization: Boolean(biphasicRecurrenceAfterInitialStabilization),
      concurrentBetaBlockerTherapy: Boolean(concurrentBetaBlockerTherapy),
      glucagonIvAdministeredSlow5Min: Boolean(glucagonIvAdministeredSlow5Min),
      prematureDischargeStrictlyProhibited: Boolean(prematureDischargeStrictlyProhibited),
      rapidGlucagonBolusStrictlyProhibited: Boolean(rapidGlucagonBolusStrictlyProhibited),
      clinicalDirectives: [
        `CẢNH BÁO SỐC PHẢN VỆ PHA HAI (BIPHASIC ANAPHYLAXIS): Nạn nhân có triệu chứng phản vệ tái bùng phát dữ dội (${biphasicRecurrenceAfterInitialStabilization ? "XÁC NHẬN TÁI PHÁT PHA HAI" : "CHỜ THEO DÕI"}) từ 1-72 giờ sau khi đã cắt cơn ban đầu mà không có tiếp xúc lại dị nguyên.`,
        `XỬ TRÍ KHÁNG TRỊ ADRENALINE DO THUỐC CHẸN BETA (BETA-BLOCKER RESISTANT): Bệnh nhân đang dùng thuốc chẹn Beta (${concurrentBetaBlockerTherapy ? "DƯƠNG TÍNH - KHÁNG ADRENALINE" : "KHÔNG"}). Tiêm tĩnh mạch Glucagon 1 - 5 mg IV tiêm chậm tối thiểu trong 5 phút (${glucagonIvAdministeredSlow5Min ? "ĐÃ TIÊM GLUCAGON CHẬM" : "CHỜ THUỐC"}) rồi duy trì 1-5 mg/h; Glucagon kích hoạt trực tiếp Adenylate Cyclase độc lập với thụ thể Beta để khôi phục sức co bóp cơ tim và giãn phế quản.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM CHO NẠN NHÂN XUẤT VIỆN SỚM: Khóa cảnh báo cấm xuất viện (${prematureDischargeStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}). Bắt buộc lưu viện theo dõi liên tục tối thiểu 12 - 24 giờ sau khi dứt cơn đợt đầu để phát hiện và xử trí kịp thời pha hai.`,
        `CHỐNG CHỈ ĐỊNH TIÊM NHANH BOLUS GLUCAGON: Khóa cảnh báo cấm tiêm nhanh (${rapidGlucagonBolusStrictlyProhibited ? "ĐÃ KHÓA CẤM TIÊM NHANH" : "NGUY HIỂM"}). Tiêm bolus Glucagon nhanh gây nôn mửa dữ dội dẫn tới hít sặc tắc đường thở tử vong tức thì; bắt buộc tiêm tĩnh mạch thật chậm >= 5 phút kèm thuốc chống nôn Ondansetron.`,
      ],
    };
  }

  /**
   * Cấp Cứu Cơn Xoắn Đỉnh Do Thuốc Kéo Dài Khoảng QT (Drug-Induced Torsades de Pointes) (Phân hệ 83)
   */
  async manageTorsadesDePointes(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      prolongedQtcIntervalOver500ms = true,
      magnesiumSulfateIvAdministered1to2g = true,
      classIaAndIiiAntiarrhythmicsStrictlyProhibited = true,
      synchronizedCardioversionProhibitedInTdp = true,
      unsynchronizedDefibrillationReadyForVf = true,
    } = payload || {};

    incident.torsadesDePointesCare = {
      isTorsadesDePointes: true,
      prolongedQtcIntervalOver500ms: Boolean(prolongedQtcIntervalOver500ms),
      magnesiumSulfateIvAdministered1to2g: Boolean(magnesiumSulfateIvAdministered1to2g),
      classIaAndIiiAntiarrhythmicsStrictlyProhibited: Boolean(classIaAndIiiAntiarrhythmicsStrictlyProhibited),
      synchronizedCardioversionProhibitedInTdp: Boolean(synchronizedCardioversionProhibitedInTdp),
      unsynchronizedDefibrillationReadyForVf: Boolean(unsynchronizedDefibrillationReadyForVf),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.torsadesDePointesCare && incident.markModified('torsadesDePointesCare');

    incident.auditTrail.push({
      action: 'TORSADES_DE_POINTES_CARE_RECORDED',
      timestamp: new Date(),
      details: `Xoắn đỉnh TdP do thuốc: QTc > 500ms=${prolongedQtcIntervalOver500ms}, Magnesium Sulfate 2g IV=${magnesiumSulfateIvAdministered1to2g}, CẤM nhóm Ia/III Amiodarone=${classIaAndIiiAntiarrhythmicsStrictlyProhibited}, CẤM sốc điện đồng bộ=${synchronizedCardioversionProhibitedInTdp}, Sẵn sàng khử rung không đồng bộ=${unsynchronizedDefibrillationReadyForVf}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isTorsadesDePointes: true,
      prolongedQtcIntervalOver500ms: Boolean(prolongedQtcIntervalOver500ms),
      magnesiumSulfateIvAdministered1to2g: Boolean(magnesiumSulfateIvAdministered1to2g),
      classIaAndIiiAntiarrhythmicsStrictlyProhibited: Boolean(classIaAndIiiAntiarrhythmicsStrictlyProhibited),
      synchronizedCardioversionProhibitedInTdp: Boolean(synchronizedCardioversionProhibitedInTdp),
      unsynchronizedDefibrillationReadyForVf: Boolean(unsynchronizedDefibrillationReadyForVf),
      clinicalDirectives: [
        `NHẬN DIỆN XOẮN ĐỈNH DO KÉO DÀI KHOẢNG QTC > 500MS: Monitor ECG phát hiện nhịp nhanh thất đa hình thái đỉnh nhịp xoắn vặn quanh đường đẳng điện (${prolongedQtcIntervalOver500ms ? "QTc > 500ms DƯƠNG TÍNH" : "THEO DÕI"}) thường khởi phát sau nhịp ngoại tâm thu nhát thất rơi đúng đỉnh sóng T (R-on-T).`,
        `THUỐC ĐIỀU TRỊ LỰA CHỌN ĐẦU TAY (MAGNESIUM SULFATE): Tiêm tĩnh mạch Magnesium Sulfate 2 g IV pha trong 50-100 mL Dextrose 5% truyền nhanh trong 1 - 2 phút (${magnesiumSulfateIvAdministered1to2g ? "ĐÃ TIÊM MAGNESIUM SULFATE" : "CHỜ THUỐC"}), lặp lại sau 5-15 phút nếu cơn tái phát; Magie ức chế dòng Calci vào sớm giúp dập tắt hiện tượng khử cực sớm sau (EAD).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM THUỐC CHỐNG LOẠN NHỊP NHÓM IA VÀ NHÓM III (AMIODARONE): Khóa cảnh báo cấm Amiodarone/Procainamide/Sotalol (${classIaAndIiiAntiarrhythmicsStrictlyProhibited ? "ĐÃ KHÓA CẤM" : "CỰC KỲ NGUY HIỂM"}). Lầm tưởng nhịp nhanh thất thông thường rồi tiêm Amiodarone sẽ làm khoảng QT càng dài thêm thảm họa, biến TdP thành Rung thất trơ tử vong trong 60 giây!`,
        `CẤM SỐC ĐIỆN ĐỒNG BỘ & SẴN SÀNG KHỬ RUNG KHÔNG ĐỒNG BỘ: Khóa cấm sốc điện đồng bộ (${synchronizedCardioversionProhibitedInTdp ? "ĐÃ KHÓA" : "NGUY HIỂM"}) do sóng R đa hình máy không bắt được nhịp đồng bộ; nếu bệnh nhân trụy tuần hoàn mất mạch thoái triển thành Rung thất (VF), lập tức sốc điện khử rung không đồng bộ (Defibrillation) 200J (${unsynchronizedDefibrillationReadyForVf ? "MÁY PHÁ RUNG SẴN SÀNG" : "CHỜ MÁY"}). Chuyển khẩn BV Chợ Rẫy / BV 115 đặt máy tạo nhịp tạm thời vượt tần số (Overdrive Pacing).`,
      ],
    };
  }

  /**
   * Cấp Cứu Tràn Máu Màng Phổi Lượng Lớn Do Chấn Thương Ngực (Massive Hemothorax) (Phân hệ 84)
   */
  async manageMassiveHemothorax(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      initialChestDrainageOver1500mlOr200mlPerHour = true,
      largeBoreChestTubeInserted28to32Fr = true,
      clampingChestTubeStrictlyProhibited = true,
      smallNeedleAspirationStrictlyProhibited = true,
      emergentThoracotomyIndicated = true,
    } = payload || {};

    incident.massiveHemothoraxCare = {
      isMassiveHemothorax: true,
      initialChestDrainageOver1500mlOr200mlPerHour: Boolean(initialChestDrainageOver1500mlOr200mlPerHour),
      largeBoreChestTubeInserted28to32Fr: Boolean(largeBoreChestTubeInserted28to32Fr),
      clampingChestTubeStrictlyProhibited: Boolean(clampingChestTubeStrictlyProhibited),
      smallNeedleAspirationStrictlyProhibited: Boolean(smallNeedleAspirationStrictlyProhibited),
      emergentThoracotomyIndicated: Boolean(emergentThoracotomyIndicated),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.massiveHemothoraxCare && incident.markModified('massiveHemothoraxCare');

    incident.auditTrail.push({
      action: 'MASSIVE_HEMOTHORAX_CARE_RECORDED',
      timestamp: new Date(),
      details: `Tràn máu màng phổi lượng lớn: Lượng máu ban đầu >=1500ml=${initialChestDrainageOver1500mlOr200mlPerHour}, Đặt ống ngực lớn 28-32Fr=${largeBoreChestTubeInserted28to32Fr}, CẤM kẹp ống dẫn lưu=${clampingChestTubeStrictlyProhibited}, CẤM chọc kim nhỏ=${smallNeedleAspirationStrictlyProhibited}, Chỉ định mở ngực khẩn=${emergentThoracotomyIndicated}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isMassiveHemothorax: true,
      initialChestDrainageOver1500mlOr200mlPerHour: Boolean(initialChestDrainageOver1500mlOr200mlPerHour),
      largeBoreChestTubeInserted28to32Fr: Boolean(largeBoreChestTubeInserted28to32Fr),
      clampingChestTubeStrictlyProhibited: Boolean(clampingChestTubeStrictlyProhibited),
      smallNeedleAspirationStrictlyProhibited: Boolean(smallNeedleAspirationStrictlyProhibited),
      emergentThoracotomyIndicated: Boolean(emergentThoracotomyIndicated),
      clinicalDirectives: [
        `TRÀN MÁU MÀNG PHỔI LƯỢNG LỚN TỐI CẤP (MASSIVE HEMOTHORAX): Đứt rách động mạch gian sườn hoặc động mạch vú trong gây tích tụ máu trong khoang màng phổi (${initialChestDrainageOver1500mlOr200mlPerHour ? "XÁC NHẬN MÁU DẪN LƯU >= 1,500 mL HOẶC > 200 mL/h" : "THEO DÕI"}), gây xẹp phổi và sốc mất máu giảm thể tích.`,
        `ĐẶT ỐNG DẪN LƯU MÀNG PHỔI KÍCH THƯỚC LỚN (28-32 FR): Đặt ống dẫn lưu ngực lớn 28-32 Fr tại khoang liên sườn 5 đường nách giữa (${largeBoreChestTubeInserted28to32Fr ? "ĐÃ ĐẶT ỐNG DẪN LƯU LỚN" : "CHỜ ĐẶT"}) kết nối bình hút áp lực âm liên tục -15 cmH2O để giải áp phổi và gom máu vào bình hoàn hồi máu tự thân (Autotransfusion).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM KẸP ỐNG DẪN LƯU KHI MÁU ĐANG CHẢY: Khóa cảnh báo cấm kẹp ống (${clampingChestTubeStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}). Lầm tưởng kẹp ống để "cầm máu" sẽ làm máu tích tụ biến thành Tràn máu màng phổi áp lực (Tension Hemothorax), ép nghẹt tĩnh mạch chủ và tim gây ngừng tim PEA tử vong trong 2 phút! Khóa cấm chọc hút kim nhỏ (${smallNeedleAspirationStrictlyProhibited ? "CẤM KIM NHỎ" : "NGUY HIỂM"}) do máu đông bít tắc kim.`,
        `CHỈ ĐỊNH MỞ NGỰC CẤP CỨU KHẨN CẤP (EMERGENT THORACOTOMY): Kích hoạt báo động đỏ chuyển thẳng phòng mổ (${emergentThoracotomyIndicated ? "BÁO ĐỘNG ĐỎ PHÒNG MỔ" : "THEO DÕI"}) khi máu ra ban đầu >= 1,500 mL hoặc liên tục > 200 mL/h trong 3 giờ; kíp phẫu thuật lồng ngực BV Chợ Rẫy / BV 115 / BV Bình Dân mở ngực khâu cột động mạch cầm máu.`,
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Mất Máu Sản Khoa & Băng Huyết Sau Sinh Nguy Kịch (Phân hệ 85)
   */
  async managePostpartumHemorrhage(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      estimatedBloodLossOver1000mlOrShock = true,
      oxytocinAndBimanualUterineMassageDone = true,
      tranexamicAcid1gIvWithin3HoursGiven = true,
      methylergometrineStrictlyProhibitedInHypertension = true,
      bakriBalloonTamponadePrepared = true,
    } = payload || {};

    incident.postpartumHemorrhageCare = {
      isPostpartumHemorrhage: true,
      estimatedBloodLossOver1000mlOrShock: Boolean(estimatedBloodLossOver1000mlOrShock),
      oxytocinAndBimanualUterineMassageDone: Boolean(oxytocinAndBimanualUterineMassageDone),
      tranexamicAcid1gIvWithin3HoursGiven: Boolean(tranexamicAcid1gIvWithin3HoursGiven),
      methylergometrineStrictlyProhibitedInHypertension: Boolean(methylergometrineStrictlyProhibitedInHypertension),
      bakriBalloonTamponadePrepared: Boolean(bakriBalloonTamponadePrepared),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.postpartumHemorrhageCare && incident.markModified('postpartumHemorrhageCare');

    incident.auditTrail.push({
      action: 'POSTPARTUM_HEMORRHAGE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Băng huyết sau sinh: Máu mất >=1000ml=${estimatedBloodLossOver1000mlOrShock}, Xoa đáy tử cung/Oxytocin=${oxytocinAndBimanualUterineMassageDone}, TXA 1g IV trong 3h=${tranexamicAcid1gIvWithin3HoursGiven}, CẤM Methergine khi tăng HA=${methylergometrineStrictlyProhibitedInHypertension}, Bóng Bakri=${bakriBalloonTamponadePrepared}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isPostpartumHemorrhage: true,
      estimatedBloodLossOver1000mlOrShock: Boolean(estimatedBloodLossOver1000mlOrShock),
      oxytocinAndBimanualUterineMassageDone: Boolean(oxytocinAndBimanualUterineMassageDone),
      tranexamicAcid1gIvWithin3HoursGiven: Boolean(tranexamicAcid1gIvWithin3HoursGiven),
      methylergometrineStrictlyProhibitedInHypertension: Boolean(methylergometrineStrictlyProhibitedInHypertension),
      bakriBalloonTamponadePrepared: Boolean(bakriBalloonTamponadePrepared),
      clinicalDirectives: [
        `NHẬN DIỆN BĂNG HUYẾT SAU SINH NGUY KỊCH (POSTPARTUM HEMORRHAGE): Lượng máu mất >= 1,000 mL hoặc có dấu hiệu sốc mất máu tụt huyết áp (${estimatedBloodLossOver1000mlOrShock ? "XÁC NHẬN BĂNG HUYẾT NẶNG" : "THEO DÕI"}), tiến hành xoa đáy tử cung bằng hai tay liên tục và tiêm bắp Oxytocin 10 IU kết hợp truyền tĩnh mạch 20-40 IU/L Ringer Lactate.`,
        `TIÊM TĨNH MẠCH TRANEXAMIC ACID (TXA) TRONG VÒNG 3 GIỜ ĐẦU: Tiêm tĩnh mạch Tranexamic Acid 1 g IV trong 10-20 phút (${tranexamicAcid1gIvWithin3HoursGiven ? "ĐÃ TIÊM TXA 1G IV" : "CHỜ THUỐC"}) theo chuẩn thử nghiệm quốc tế WOMAN Trial để ức chế tiêu sợi huyết bảo tồn yếu tố đông máu, giảm 30% tử vong do băng huyết.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM METHYLERGOMETRINE (METHERGINE) Ở SẢN PHỤ TĂNG HA / TIỀN SẢN GIẬT: Khóa cảnh báo cấm Methylergometrine (${methylergometrineStrictlyProhibitedInHypertension ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}). Thuốc gây co thắt mạch toàn thân làm bùng phát cơn tăng huyết áp ác tính, xuất huyết não và co giật sản giật tử vong ngay tại chỗ! Dùng thay thế bằng Misoprostol 800 mcg đặt hậu môn.`,
        `ĐẶT BÓNG CHÈN BAKRI LÒNG TỬ CUNG & BÁO ĐỘNG ĐỎ SẢN KHOA: Sẵn sàng đặt ống thông bóng chèn Bakri (Bakri Balloon Tamponade) bơm 300-500 mL nước muối ấm ép cơ học cầm máu (${bakriBalloonTamponadePrepared ? "ĐÃ SẴN SÀNG BÓNG BAKRI" : "CHỜ THIẾT BỊ"}). Điều phối khẩn cấp Trung tâm Sản - Phụ khoa BV Từ Dũ / BV Hùng Vương / BV Chợ Rẫy kích hoạt quy trình truyền máu khối lượng lớn MTP 1:1:1.`,
      ],
    };
  }

  /**
   * Cấp Cứu Thuyên Tắc Động Mạch Phổi Diện Rộng Nguy Cơ Tử Vong Cao (Phân hệ 86)
   */
  async manageMassivePulmonaryEmbolism(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      hemodynamicInstabilitySbpUnder90 = true,
      mcconnellSignOrRvStrainEchoDetected = true,
      bedsideSystemicThrombolysisIndicated = true,
      aggressiveFluidOverloadStrictlyProhibited = true,
      vaEcmoSupportReadyForRefractoryShock = true,
    } = payload || {};

    incident.massivePulmonaryEmbolismCare = {
      isMassivePulmonaryEmbolism: true,
      hemodynamicInstabilitySbpUnder90: Boolean(hemodynamicInstabilitySbpUnder90),
      mcconnellSignOrRvStrainEchoDetected: Boolean(mcconnellSignOrRvStrainEchoDetected),
      bedsideSystemicThrombolysisIndicated: Boolean(bedsideSystemicThrombolysisIndicated),
      aggressiveFluidOverloadStrictlyProhibited: Boolean(aggressiveFluidOverloadStrictlyProhibited),
      vaEcmoSupportReadyForRefractoryShock: Boolean(vaEcmoSupportReadyForRefractoryShock),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.massivePulmonaryEmbolismCare && incident.markModified('massivePulmonaryEmbolismCare');

    incident.auditTrail.push({
      action: 'MASSIVE_PE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Thuyên tắc phổi diện rộng: Tụt HA SBP<90=${hemodynamicInstabilitySbpUnder90}, Dấu McConnell/Dãn thất phải=${mcconnellSignOrRvStrainEchoDetected}, Tiêu sợi huyết rtPA=${bedsideSystemicThrombolysisIndicated}, CẤM bù dịch quá tải=${aggressiveFluidOverloadStrictlyProhibited}, VA-ECMO=${vaEcmoSupportReadyForRefractoryShock}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isMassivePulmonaryEmbolism: true,
      hemodynamicInstabilitySbpUnder90: Boolean(hemodynamicInstabilitySbpUnder90),
      mcconnellSignOrRvStrainEchoDetected: Boolean(mcconnellSignOrRvStrainEchoDetected),
      bedsideSystemicThrombolysisIndicated: Boolean(bedsideSystemicThrombolysisIndicated),
      aggressiveFluidOverloadStrictlyProhibited: Boolean(aggressiveFluidOverloadStrictlyProhibited),
      vaEcmoSupportReadyForRefractoryShock: Boolean(vaEcmoSupportReadyForRefractoryShock),
      clinicalDirectives: [
        `NHẬN DIỆN THUYÊN TẮC PHỔI NGUY CƠ TỬ VONG CAO (HIGH-RISK MASSIVE PE): Huyết động không ổn định SBP < 90 mmHg hoặc tụt > 40 mmHg kéo dài (${hemodynamicInstabilitySbpUnder90 ? "TỤT HUYẾT ÁP TỐI CẤP" : "ỔN ĐỊNH"}), siêu âm tim tại giường phát hiện dấu hiệu McConnell (giảm động thành tự do thất phải, mỏm co bóp) và buồng thất phải dãn to RV/LV > 1.0 (${mcconnellSignOrRvStrainEchoDetected ? "DẤU HIỆU DÃN THẤT PHẢI CẤP" : "BÌNH THƯỜNG"}).`,
        `TIÊU SỢI HUYẾT ĐƯỜNG TĨNH MẠCH CẤP CỨU (SYSTEMIC THROMBOLYSIS): Chỉ định truyền Alteplase (rt-PA) 50-100 mg IV trong 2 giờ (${bedsideSystemicThrombolysisIndicated ? "CHỈ ĐỊNH TIÊU SỢI HUYẾT" : "CHỜ ĐÁNH GIÁ"}) (hoặc bolus 50 mg trong 15 phút nếu ngừng tuần hoàn PEA nghi do thuyên tắc phổi) để làm tan khối huyết khối làm tắc thân chung động mạch phổi.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM BÙ DỊCH QUÁ TẢI (FLUID OVERLOAD STRICTLY PROHIBITED): Khóa cảnh báo cấm truyền dịch quá 500 mL (${aggressiveFluidOverloadStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}). Thất phải đang dãn to căng phồng do tăng gánh áp lực; bù nhiều dịch tinh thể sẽ ép bẹp vách liên thất sang trái làm triệt tiêu hoàn toàn thể tích tống máu thất trái gây ngừng tim vô mạch tử vong ngay! Khởi động sớm Norepinephrine/Dobutamine nâng huyết áp.`,
        `SẴN SÀNG VA-ECMO CHO SỐC TRƠ & ĐIỀU PHỐI TUYẾN CUỐI: Kíp VA-ECMO bảo vệ tuần hoàn sẵn sàng can thiệp nếu sốc không cải thiện sau tiêu sợi huyết (${vaEcmoSupportReadyForRefractoryShock ? "KÍP ECMO SẴN SÀNG" : "CHƯA CÓ"}). Điều phối khẩn cấp Trung tâm Tim mạch - Hồi sức BV Chợ Rẫy / BV 115 / Viện Tim TP.HCM.`,
      ],
    };
  }

  /**
   * Cấp Cứu Viêm Nắp Thanh Quản Cấp Ở Trẻ Em (Pediatric Acute Epiglottitis) (Phân hệ 87)
   */
  async managePediatricEpiglottitis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      tripodSniffingPositionAndDrooling = true,
      calmHumidifiedOxygenSupport = true,
      tongueDepressorOralExamStrictlyProhibited = true,
      supinePositionStrictlyProhibited = true,
      emergencyEntAirwayTeamAlerted = true,
    } = payload || {};

    incident.pediatricEpiglottitisCare = {
      isPediatricEpiglottitis: true,
      tripodSniffingPositionAndDrooling: Boolean(tripodSniffingPositionAndDrooling),
      calmHumidifiedOxygenSupport: Boolean(calmHumidifiedOxygenSupport),
      tongueDepressorOralExamStrictlyProhibited: Boolean(tongueDepressorOralExamStrictlyProhibited),
      supinePositionStrictlyProhibited: Boolean(supinePositionStrictlyProhibited),
      emergencyEntAirwayTeamAlerted: Boolean(emergencyEntAirwayTeamAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.pediatricEpiglottitisCare && incident.markModified('pediatricEpiglottitisCare');

    incident.auditTrail.push({
      action: 'PEDIATRIC_EPIGLOTTITIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Viêm nắp thanh quản cấp trẻ em: Dấu hiệu Sniffing/Chảy dãi=${tripodSniffingPositionAndDrooling}, Oxy ẩm nhẹ nhàng=${calmHumidifiedOxygenSupport}, CẤM đè lưỡi=${tongueDepressorOralExamStrictlyProhibited}, CẤM nằm ngửa=${supinePositionStrictlyProhibited}, Báo động kíp ENT mở màng nhẫn giáp=${emergencyEntAirwayTeamAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isPediatricEpiglottitis: true,
      tripodSniffingPositionAndDrooling: Boolean(tripodSniffingPositionAndDrooling),
      calmHumidifiedOxygenSupport: Boolean(calmHumidifiedOxygenSupport),
      tongueDepressorOralExamStrictlyProhibited: Boolean(tongueDepressorOralExamStrictlyProhibited),
      supinePositionStrictlyProhibited: Boolean(supinePositionStrictlyProhibited),
      emergencyEntAirwayTeamAlerted: Boolean(emergencyEntAirwayTeamAlerted),
      clinicalDirectives: [
        `TAM CHỨNG VIÊM NẮP THANH QUẢN CẤP ĐE DỌA NGHẸT THỞ (ACUTE EPIGLOTTITIS): Trẻ sốt cao, nuốt khó chảy nước dãi (Drooling), thở rít thì hít vào (Stridor) và ngồi chồm người ra trước cổ ngửa cằm nhô (Sniffing/Tripod Position) (${tripodSniffingPositionAndDrooling ? "DẤU HIỆU ĐIỂN HÌNH NẮP THANH QUẢN SƯNG ĐỎ MỌNG" : "THEO DÕI"}).`,
        `GIỮ TRẺ BÌNH TĨNH TỐI ĐA & THỞ OXY ẨM NHẸ NHÀNG: Để trẻ ngồi tự nhiên trong lòng cha mẹ (${calmHumidifiedOxygenSupport ? "TRẺ ĐANG ĐƯỢC GIỮ YÊN TĨNH" : "CẦN GIẢM KÍCH ĐỘNG"}), hỗ trợ thở oxy ẩm phun sương nhẹ nhàng cách mặt trẻ vài cm; tránh tiêm chích hoặc lấy ven gây hoảng loạn khóc thét làm tăng phù nề thanh môn.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM DÙNG QUE ĐÈ LƯỠI KHÁM HỌNG (NEVER USE A TONGUE DEPRESSOR): Khóa cảnh báo cấm que đè lưỡi (${tongueDepressorOralExamStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}). Đè lưỡi kích hoạt phản xạ co thắt thanh quản kịch phát (Laryngospasm), nắp thanh quản sưng nề sẽ bít chặt hoàn toàn thanh môn gây ngừng thở tử vong ngay tại chỗ! Khóa cấm bắt trẻ nằm ngửa (${supinePositionStrictlyProhibited ? "CẤM NẰM NGỬA" : "NGUY HIỂM"}) do trọng lực làm nắp thanh quản đổ sụp ra sau che kín lỗ khí đạo.`,
        `BÁO ĐỘNG ĐỎ KÍP PHẪU THUẬT TAI MŨI HỌNG & MỞ MÀNG NHẪN GIÁP: Báo động phòng mổ sẵn sàng (${emergencyEntAirwayTeamAlerted ? "KÍP TAI MŨI HỌNG SẴN SÀNG" : "CHỜ BÁO ĐỘNG"}), chuẩn bị ống nội khí quản nhỏ hơn tuổi 1 số và bộ mở màng nhẫn giáp vi phẫu (Needle Cricothyroidotomy); chuyển khẩn cấp Bệnh viện Nhi Đồng 1 / Bệnh viện Nhi Đồng 2.`,
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Tủy & Mất Phản Xạ Thần Kinh Giao Cảm Trong Chấn Thương Tủy Sống Cao (Phân hệ 88)
   */
  async manageNeurogenicShock(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      bradycardiaAndHypotensionT6Above = true,
      vasopressorMap85to90Maintained = true,
      fluidOverloadStrictlyProhibited = true,
      phenylephrineAloneStrictlyProhibited = true,
    } = payload || {};

    incident.neurogenicShockCare = {
      isNeurogenicShock: true,
      bradycardiaAndHypotensionT6Above: Boolean(bradycardiaAndHypotensionT6Above),
      vasopressorMap85to90Maintained: Boolean(vasopressorMap85to90Maintained),
      fluidOverloadStrictlyProhibited: Boolean(fluidOverloadStrictlyProhibited),
      phenylephrineAloneStrictlyProhibited: Boolean(phenylephrineAloneStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.neurogenicShockCare && incident.markModified('neurogenicShockCare');

    incident.auditTrail.push({
      action: 'NEUROGENIC_SHOCK_CARE_RECORDED',
      timestamp: new Date(),
      details: `Sốc tủy sống: Nhịp chậm & Tụt HA T6+=${bradycardiaAndHypotensionT6Above}, Duy trì MAP 85-90=${vasopressorMap85to90Maintained}, CẤM bù dịch quá tải=${fluidOverloadStrictlyProhibited}, CẤM Phenylephrine đơn thuần=${phenylephrineAloneStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isNeurogenicShock: true,
      bradycardiaAndHypotensionT6Above: Boolean(bradycardiaAndHypotensionT6Above),
      vasopressorMap85to90Maintained: Boolean(vasopressorMap85to90Maintained),
      fluidOverloadStrictlyProhibited: Boolean(fluidOverloadStrictlyProhibited),
      phenylephrineAloneStrictlyProhibited: Boolean(phenylephrineAloneStrictlyProhibited),
      clinicalDirectives: [
        `TAM CHỨNG SỐC TỦY DO TỔN THƯƠNG TỦY CỔ / NGỰC CAO (>= T6): Mất trương lực giao cảm vận mạch gây tụt huyết áp SBP < 90 mmHg (MAP < 65 mmHg) kèm nhịp tim chậm nghịch thường (Paradoxical Bradycardia < 60 bpm) và giãn mạch ngoại vi da ấm khô (${bradycardiaAndHypotensionT6Above ? "TAM CHỨNG SỐC TỦY ĐIỂN HÌNH" : "THEO DÕI"}).`,
        `MỤC TIÊU VẬN MẠCH DUY TRÌ MAP >= 85-90 MMHG CHUẨN AANS/CNS: Khởi động sớm vận mạch Norepinephrine (hoặc Dopamine) kết hợp tác dụng alpha1 co mạch và beta1 tăng co bóp cơ tim (${vasopressorMap85to90Maintained ? "ĐANG DUY TRÌ MAP >= 85-90 MMHG" : "CẦN TĂNG LIỀU VẬN MẠCH"}), duy trì liên tục trong 7 ngày đầu để bảo tồn áp lực tưới máu tủy sống, chống hoại tử thiếu máu tủy thứ phát.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM BÙ DỊCH QUÁ TẢI & CẤM PHENYLEPHRINE ĐƠN THUẦN: Khóa cảnh báo cấm truyền dịch quá mức (> 2,000 mL) (${fluidOverloadStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}), vì lòng mạch bị giãn liệt chứ không thiếu thể tích, bù nhiều dịch sẽ gây phù phổi cấp chết đuối trên cạn và tăng phù tủy hoại tử; khóa cảnh báo cấm Phenylephrine đơn thuần (${phenylephrineAloneStrictlyProhibited ? "ĐÃ KHÓA CẤM PHENYLEPHRINE" : "NGUY HIỂM"}) do kích thích alpha1 gây co mạch làm nhịp chậm phản xạ ngừng tim vô tâm thu.`,
        `BÁO ĐỘNG ĐỎ TRUNG TÂM HỒI SỨC CỘT SỐNG & PHẪU THUẬT THẦN KINH: Chuyển viện khẩn cấp đến Trung tâm Cột sống BV Chợ Rẫy / BV 115 / BV Chấn thương Chỉnh hình để cố định cột sống cổ vững chắc và phẫu thuật giải áp tủy cấp.`,
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Xuyên Thấu Vùng Cổ & Hội Chứng Máu Tụ Chèn Ép Khí Quản Cấp (Phân hệ 89)
   */
  async managePenetratingNeckTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      expandingPulsatileHematomaOrStridor = true,
      directManualPressureAppliedNoCircumferentialBandage = true,
      circumferentialNeckBandageStrictlyProhibited = true,
      blindClampingStrictlyProhibited = true,
      emergencyAirwayOrCricothyroidotomyReady = true,
    } = payload || {};

    incident.penetratingNeckTraumaCare = {
      isPenetratingNeckTrauma: true,
      expandingPulsatileHematomaOrStridor: Boolean(expandingPulsatileHematomaOrStridor),
      directManualPressureAppliedNoCircumferentialBandage: Boolean(directManualPressureAppliedNoCircumferentialBandage),
      circumferentialNeckBandageStrictlyProhibited: Boolean(circumferentialNeckBandageStrictlyProhibited),
      blindClampingStrictlyProhibited: Boolean(blindClampingStrictlyProhibited),
      emergencyAirwayOrCricothyroidotomyReady: Boolean(emergencyAirwayOrCricothyroidotomyReady),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.penetratingNeckTraumaCare && incident.markModified('penetratingNeckTraumaCare');

    incident.auditTrail.push({
      action: 'PENETRATING_NECK_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chấn thương xuyên thấu cổ: Máu tụ lan nhanh/Thở rít Stridor=${expandingPulsatileHematomaOrStridor}, Ấn tay trực tiếp=${directManualPressureAppliedNoCircumferentialBandage}, CẤM băng vòng qua cổ=${circumferentialNeckBandageStrictlyProhibited}, CẤM kẹp Hemostat mò=${blindClampingStrictlyProhibited}, Mở màng nhẫn giáp sẵn sàng=${emergencyAirwayOrCricothyroidotomyReady}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isPenetratingNeckTrauma: true,
      expandingPulsatileHematomaOrStridor: Boolean(expandingPulsatileHematomaOrStridor),
      directManualPressureAppliedNoCircumferentialBandage: Boolean(directManualPressureAppliedNoCircumferentialBandage),
      circumferentialNeckBandageStrictlyProhibited: Boolean(circumferentialNeckBandageStrictlyProhibited),
      blindClampingStrictlyProhibited: Boolean(blindClampingStrictlyProhibited),
      emergencyAirwayOrCricothyroidotomyReady: Boolean(emergencyAirwayOrCricothyroidotomyReady),
      clinicalDirectives: [
        `DẤU HIỆU TỔN THƯƠNG MẠCH MÁU CỨNG & MÁU TỤ CHÈN ÉP KHÍ QUẢN (HARD SIGNS): Vết thương cổ thấu rách mạch cảnh tạo khối máu tụ đập theo nhịp lan nhanh (Expanding Pulsatile Hematoma), kèm thở rít thanh quản Stridor, khàn tiếng kịch phát đe dọa nghẹt thở cơ học trong vài phút (${expandingPulsatileHematomaOrStridor ? "DẤU HIỆU CỨNG TỔN THƯƠNG MẠCH MÁU CỔ" : "THEO DÕI"}).`,
        `KỸ THUẬT CẦM MÁU: ẤN ĐÈ TRỰC TIẾP BẰNG TAY (DIRECT MANUAL PRESSURE): Dùng ngón tay ép gạc vô trùng trực tiếp và liên tục vào vị trí rách mạch máu (${directManualPressureAppliedNoCircumferentialBandage ? "ĐANG ÉP TAY TRỰC TIẾP" : "CẦN THỰC HIỆN NGAY"}), không bao giờ buông tay cho đến khi vào thẳng phòng mổ; giữ thẳng trục cột sống cổ.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM BĂNG ÉP VÒNG QUANH CỔ & CẤM KẸP HEMOSTAT MÒ: Khóa cảnh báo cấm quấn băng ép vòng tròn quanh cổ (${circumferentialNeckBandageStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}), băng vòng sẽ siết nghẹt khí quản và chẹn cả 2 động mạch cảnh gây thiếu máu não ngừng thở tử vong trong 60 giây; khóa cảnh báo cấm kẹp Hemostat mò trong vết thương (${blindClampingStrictlyProhibited ? "CẤM KẸP MÒ" : "NGUY HIỂM"}) tránh kẹp đứt bó mạch cảnh hoặc đứt dây thần kinh X / quặt ngược thanh quản gây liệt dây thanh vĩnh viễn.`,
        `ĐƯỜNG THỞ KHÓ & MỞ MÀNG NHẪN GIÁP VI PHẪU KHẨN CẤP: Chuẩn bị kíp đặt nội khí quản qua Video Laryngoscope hoặc mở màng nhẫn giáp vi phẫu khẩn (${emergencyAirwayOrCricothyroidotomyReady ? "KÍP ĐƯỜNG THỞ SẴN SÀNG" : "CHỜ CHUẨN BỊ"}); chuyển khẩn cấp BV Chợ Rẫy / BV Bình Dân / BV 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Ngộ Độc Rượu Cực Đoan & Hội Chứng Cai Rượu Mê Sảng Nặng (Phân hệ 90)
   */
  async manageDeliriumTremens(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      ciwaArScoreOver15AutonomicStorm = true,
      highDoseDiazepamIvTitrated = true,
      thiamineGivenBeforeDextroseEnforced = true,
      haloperidolAloneStrictlyProhibited = true,
    } = payload || {};

    incident.deliriumTremensCare = {
      isDeliriumTremens: true,
      ciwaArScoreOver15AutonomicStorm: Boolean(ciwaArScoreOver15AutonomicStorm),
      highDoseDiazepamIvTitrated: Boolean(highDoseDiazepamIvTitrated),
      thiamineGivenBeforeDextroseEnforced: Boolean(thiamineGivenBeforeDextroseEnforced),
      haloperidolAloneStrictlyProhibited: Boolean(haloperidolAloneStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.deliriumTremensCare && incident.markModified('deliriumTremensCare');

    incident.auditTrail.push({
      action: 'DELIRIUM_TREMENS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hội chứng cai rượu mê sảng nặng: CIWA-Ar>=15/Bão giao cảm=${ciwaArScoreOver15AutonomicStorm}, Diazepam IV liều cao=${highDoseDiazepamIvTitrated}, Thiamine trước Dextrose=${thiamineGivenBeforeDextroseEnforced}, CẤM Haloperidol đơn độc=${haloperidolAloneStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isDeliriumTremens: true,
      ciwaArScoreOver15AutonomicStorm: Boolean(ciwaArScoreOver15AutonomicStorm),
      highDoseDiazepamIvTitrated: Boolean(highDoseDiazepamIvTitrated),
      thiamineGivenBeforeDextroseEnforced: Boolean(thiamineGivenBeforeDextroseEnforced),
      haloperidolAloneStrictlyProhibited: Boolean(haloperidolAloneStrictlyProhibited),
      clinicalDirectives: [
        `CƠN BÃO GIAO CẢM CAI RƯỢU TỐI CẤP (SEVERE DELIRIUM TREMENS - DT): Điểm CIWA-Ar >= 15-20 xuất hiện sau 48-96h ngưng rượu kèm sốt cao > 38.5C, mạch nhanh > 120 bpm, tăng HA dữ dội, ảo giác thị giác ghê rợn và kích động mê sảng toàn thể (${ciwaArScoreOver15AutonomicStorm ? "CƠN BÃO GIAO CẢM NGUY KỊCH TỬ VONG CAO" : "THEO DÕI"}).`,
        `PHÁC ĐỒ AN THẦN BENZODIAZEPINE LIỀU CAO: Tiêm tĩnh mạch chậm Diazepam 10-20 mg IV mỗi 5-15 phút (${highDoseDiazepamIvTitrated ? "ĐANG CHUẨN ĐỘ DIAZEPAM IV" : "CẦN KHỞI ĐỘNG LIỀU TẢI"}) chuẩn độ theo thang điểm CIWA-Ar đến khi bệnh nhân yên tĩnh, tiếp xúc nhẹ nhàng nhưng không ức chế hô hấp.`,
        `QUY TẮC SỐNG CÒN: BẮT BUỘC TIÊM THIAMINE (VITAMIN B1) 100-500 MG IV TRƯỚC GLUCOSE: Khóa an toàn bắt buộc tiêm Thiamine IV trước hoặc cùng lúc với dịch truyền đường (${thiamineGivenBeforeDextroseEnforced ? "ĐÃ TIÊM THIAMINE TRƯỚC DEXTROSE" : "CỰC KỲ NGUY HIỂM"}). Truyền đường khi thiếu B1 sẽ đốt cháy cạn kiệt Thiamine dự trữ gây khởi phát cấp tính Hội chứng não Wernicke hoại tử thể vú não vĩnh viễn và tử vong!`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM DÙNG HALOPERIDOL ĐƠN ĐỘC KHÔNG KÈM BENZODIAZEPINE: Khóa cảnh báo cấm dùng Haloperidol đơn thuần (${haloperidolAloneStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}), thuốc kháng loạn thần làm hạ thấp ngưỡng co giật kích hoạt cơn co giật trạng thái trơ và kéo dài khoảng QT gây xoắn đỉnh TdP tử vong nhanh chóng. Chuyển khẩn cấp ICU Chống độc BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Xuyên Thấu Tim Có Dị Vật Găm Lồng Ngực (Phân hệ 91)
   */
  async manageImpaledThoracicTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      impaledObjectInSituStabilizedWithBulkyDressing = true,
      removalOfImpaledObjectStrictlyProhibited = true,
      directPressureOnObjectStrictlyProhibited = true,
      becksTriadTamponadeMonitored = true,
    } = payload || {};

    incident.impaledThoracicTraumaCare = {
      isImpaledThoracicTrauma: true,
      impaledObjectInSituStabilizedWithBulkyDressing: Boolean(impaledObjectInSituStabilizedWithBulkyDressing),
      removalOfImpaledObjectStrictlyProhibited: Boolean(removalOfImpaledObjectStrictlyProhibited),
      directPressureOnObjectStrictlyProhibited: Boolean(directPressureOnObjectStrictlyProhibited),
      becksTriadTamponadeMonitored: Boolean(becksTriadTamponadeMonitored),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.impaledThoracicTraumaCare && incident.markModified('impaledThoracicTraumaCare');

    incident.auditTrail.push({
      action: 'IMPALED_THORACIC_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Dị vật găm lồng ngực: Bất động tại chỗ gạc donut=${impaledObjectInSituStabilizedWithBulkyDressing}, CẤM rút dị vật=${removalOfImpaledObjectStrictlyProhibited}, CẤM đè ép dị vật=${directPressureOnObjectStrictlyProhibited}, Giám sát Tam chứng Beck=${becksTriadTamponadeMonitored}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isImpaledThoracicTrauma: true,
      impaledObjectInSituStabilizedWithBulkyDressing: Boolean(impaledObjectInSituStabilizedWithBulkyDressing),
      removalOfImpaledObjectStrictlyProhibited: Boolean(removalOfImpaledObjectStrictlyProhibited),
      directPressureOnObjectStrictlyProhibited: Boolean(directPressureOnObjectStrictlyProhibited),
      becksTriadTamponadeMonitored: Boolean(becksTriadTamponadeMonitored),
      clinicalDirectives: [
        `BẤT ĐỘNG DỊ VẬT GĂM LỒNG NGỰC TẠI CHỖ (STABILIZE IMPALED OBJECT IN SITU): Dị vật đang đóng vai trò nút bít cơ học tạm thời ngăn máu buồng tim phụt xối xả (${impaledObjectInSituStabilizedWithBulkyDressing ? "ĐÃ BẤT ĐỘNG GẠC DONUT CHẶT CHẼ" : "CẦN BẤT ĐỘNG NGAY"}), dùng cuộn gạc hình bánh donut chèn quanh gốc và băng cố định vào thành ngực, chống xê dịch theo nhịp thở và nhịp co bóp tim.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG SỐ 1: TUYỆT ĐỐI CẤM RÚT DỊ VẬT NGOẠI VIỆN (NEVER REMOVE IMPALED OBJECT): Khóa cảnh báo cấm rút dị vật (${removalOfImpaledObjectStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}), rút dị vật tại hiện trường hoặc trên xe cấp cứu sẽ làm mất nút bít cơ học, máu buồng tim phụt xối xả như vòi rồng khiến nạn nhân ngừng tuần hoàn mất máu tử vong trong 30-60 giây! Chỉ được rút trong phòng mổ mở ngực có máy CEC dự phòng.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG SỐ 2: TUYỆT ĐỐI CẤM ĐÈ ÉP TRỰC TIẾP LÊN DỊ VẬT: Khóa cảnh báo cấm đè ép (${directPressureOnObjectStrictlyProhibited ? "CẤM ĐÈ ÉP DỊ VẬT" : "NGUY HIỂM"}) tránh đẩy dị vật cắm sâu xé toác buồng thất hoặc cắt đứt động mạch vành; đồng thời giám sát chặt chẽ Tam chứng Beck (tụt HA, TM cổ nổi, tiếng tim mờ) phát hiện sớm tràn máu màng tim cấp (${becksTriadTamponadeMonitored ? "ĐANG THEO DÕI BECK" : "CẦN THEO DÕI"}).`,
        `ĐIỀU PHỐI KHẨN CẤP PHÒNG MỔ PHẪU THUẬT TIM MẠCH: Kích hoạt báo động đỏ phòng mổ phẫu thuật tim mạch BV Chợ Rẫy / BV 115 / Viện Tim TP.HCM sẵn sàng mở ngực khẩn cấp.`,
      ],
    };
  }

  /**
   * Cấp Cứu Sốt Rét Ác Tính Thể Não & Thiếu Máu Tan Máu Tối Cấp (Phân hệ 92)
   */
  async manageSevereCerebralMalaria(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      comaAndPlasmodiumFalciparumHighParasitemia = true,
      intravenousArtesunate2Point4MgPerKgAdministered = true,
      corticosteroidsStrictlyProhibitedInCerebralMalaria = true,
      fluidOverloadStrictlyProhibitedInMalaria = true,
    } = payload || {};

    incident.severeCerebralMalariaCare = {
      isSevereCerebralMalaria: true,
      comaAndPlasmodiumFalciparumHighParasitemia: Boolean(comaAndPlasmodiumFalciparumHighParasitemia),
      intravenousArtesunate2Point4MgPerKgAdministered: Boolean(intravenousArtesunate2Point4MgPerKgAdministered),
      corticosteroidsStrictlyProhibitedInCerebralMalaria: Boolean(corticosteroidsStrictlyProhibitedInCerebralMalaria),
      fluidOverloadStrictlyProhibitedInMalaria: Boolean(fluidOverloadStrictlyProhibitedInMalaria),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.severeCerebralMalariaCare && incident.markModified('severeCerebralMalariaCare');

    incident.auditTrail.push({
      action: 'SEVERE_CEREBRAL_MALARIA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Sốt rét ác tính thể não: Hôn mê/P.falciparum cao=${comaAndPlasmodiumFalciparumHighParasitemia}, Artesunate IV 2.4mg/kg=${intravenousArtesunate2Point4MgPerKgAdministered}, CẤM Corticosteroid=${corticosteroidsStrictlyProhibitedInCerebralMalaria}, CẤM bù dịch quá tải=${fluidOverloadStrictlyProhibitedInMalaria}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isSevereCerebralMalaria: true,
      comaAndPlasmodiumFalciparumHighParasitemia: Boolean(comaAndPlasmodiumFalciparumHighParasitemia),
      intravenousArtesunate2Point4MgPerKgAdministered: Boolean(intravenousArtesunate2Point4MgPerKgAdministered),
      corticosteroidsStrictlyProhibitedInCerebralMalaria: Boolean(corticosteroidsStrictlyProhibitedInCerebralMalaria),
      fluidOverloadStrictlyProhibitedInMalaria: Boolean(fluidOverloadStrictlyProhibitedInMalaria),
      clinicalDirectives: [
        `NHẬN DIỆN SỐT RÉT ÁC TÍNH THỂ NÃO (SEVERE FALCIPARUM CEREBRAL MALARIA): Hôn mê sâu, co giật liên tục, toan lactic nặng và tan máu ồ ạt do Plasmodium falciparum làm tắc nghẽn vi mạch não và phù não cấp tính (${comaAndPlasmodiumFalciparumHighParasitemia ? "DẤU HIỆU SỐT RÉT THỂ NÃO NGUY KỊCH" : "THEO DÕI"}).`,
        `PHÁC ĐỒ ARTESUNATE TIÊM TĨNH MẠCH CHUẨN WHO: Bắt buộc tiêm tĩnh mạch Artesunate 2.4 mg/kg IV chậm tại các mốc 0 giờ, 12 giờ, 24 giờ (${intravenousArtesunate2Point4MgPerKgAdministered ? "ĐANG DÙNG ARTESUNATE IV" : "CẦN TIÊM NGAY"}) (sau đó mỗi ngày 1 lần) để tiêu diệt nhanh ký sinh trùng và giải tỏa vi mạch máu não.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM DÙNG CORTICOSTEROID (DEXAMETHASONE / METHYLPREDNISOLONE): Khóa cảnh báo cấm Corticosteroid (${corticosteroidsStrictlyProhibitedInCerebralMalaria ? "ĐÃ KHÓA CẤM DEXAMETHASONE" : "CỰC KỲ NGUY HIỂM"}), thử nghiệm RCTs của WHO chứng minh Dexamethasone làm kéo dài thời gian hôn mê, tăng biến chứng xuất huyết dạ dày và làm tăng tỷ lệ tử vong!`,
        `KHÓA CẢNH BÁO CẤM TRUYỀN DỊCH QUÁ TẢI (FLUID OVERLOAD STRICTLY PROHIBITED): Khóa cảnh báo cấm truyền dịch quá mức (${fluidOverloadStrictlyProhibitedInMalaria ? "ĐÃ KHÓA AN TOÀN" : "NGUY HIỂM"}), phế nang rất dễ tổn thương; truyền nhiều dịch sẽ gây phù phổi cấp ARDS chết đuối trên cạn. Chuyển khẩn cấp ICU Bệnh viện Bệnh Nhiệt Đới TP.HCM / BV Chợ Rẫy.`,
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Xé Toác Cuống Mạch Thận & Vỡ Thận Độ V (Phân hệ 93)
   */
  async manageGradeVRenalAvulsion(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      flankHematomaAndHematuriaWithShock = true,
      permissiveHypotensionSbp80to90Maintained = true,
      aggressiveFlankPalpationStrictlyProhibited = true,
      aggressiveNormalSalineOverloadStrictlyProhibited = true,
      emergencyAngioembolizationOrSurgeryAlerted = true,
    } = payload || {};

    incident.gradeVRenalAvulsionCare = {
      isGradeVRenalAvulsion: true,
      flankHematomaAndHematuriaWithShock: Boolean(flankHematomaAndHematuriaWithShock),
      permissiveHypotensionSbp80to90Maintained: Boolean(permissiveHypotensionSbp80to90Maintained),
      aggressiveFlankPalpationStrictlyProhibited: Boolean(aggressiveFlankPalpationStrictlyProhibited),
      aggressiveNormalSalineOverloadStrictlyProhibited: Boolean(aggressiveNormalSalineOverloadStrictlyProhibited),
      emergencyAngioembolizationOrSurgeryAlerted: Boolean(emergencyAngioembolizationOrSurgeryAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.gradeVRenalAvulsionCare && incident.markModified('gradeVRenalAvulsionCare');

    incident.auditTrail.push({
      action: 'GRADE_V_RENAL_AVULSION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ thận độ V đứt cuống mạch: Máu tụ hông lưng/Đái máu=${flankHematomaAndHematuriaWithShock}, DCR SBP 80-90=${permissiveHypotensionSbp80to90Maintained}, CẤM nắn ép hông lưng=${aggressiveFlankPalpationStrictlyProhibited}, CẤM dịch tinh thể quá mức=${aggressiveNormalSalineOverloadStrictlyProhibited}, Báo động DSA nút mạch=${emergencyAngioembolizationOrSurgeryAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isGradeVRenalAvulsion: true,
      flankHematomaAndHematuriaWithShock: Boolean(flankHematomaAndHematuriaWithShock),
      permissiveHypotensionSbp80to90Maintained: Boolean(permissiveHypotensionSbp80to90Maintained),
      aggressiveFlankPalpationStrictlyProhibited: Boolean(aggressiveFlankPalpationStrictlyProhibited),
      aggressiveNormalSalineOverloadStrictlyProhibited: Boolean(aggressiveNormalSalineOverloadStrictlyProhibited),
      emergencyAngioembolizationOrSurgeryAlerted: Boolean(emergencyAngioembolizationOrSurgeryAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN VỠ THẬN ĐỘ V & ĐỨT TOẠC CUỐNG MẠCH THẬN (GRADE V RENAL AVULSION): Khối máu tụ hông lưng lan nhanh (Grey Turner Sign), đái máu đại thể hoặc vô niệu một bên, tụt HA do máu từ động mạch chủ bụng xối vào khoang sau phúc mạc > 1,000 mL/phút (${flankHematomaAndHematuriaWithShock ? "VỠ THẬN ĐỘ V NGUY KỊCH MẤT MÁU" : "THEO DÕI"}).`,
        `HỒI SỨC KIỂM SOÁT TỔN THƯƠNG (DCR) & HUYẾT ÁP THẤP CHẤP NHẬN ĐƯỢC: Duy trì huyết áp tâm thu permissive hypotension SBP 80-90 mmHg (${permissiveHypotensionSbp80to90Maintained ? "ĐANG DUY TRÌ SBP 80-90 MMHG" : "CẦN KIỂM SOÁT DCR"}) và kích hoạt quy trình truyền máu khối lượng lớn MTP 1:1:1 bảo tồn cục máu đông sau phúc mạc.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM NẮN ÉP MẠNH HÔNG LƯNG & CẤM BÙ DỊCH QUÁ MỨC: Khóa cảnh báo cấm nắn ép hông lưng (${aggressiveFlankPalpationStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}), nắn bóp sâu vùng hông lưng sẽ làm rách toác mạc Gerota (vốn đang đóng vai trò chèn ép tự nhiên Tamponade sau phúc mạc) khiến máu tràn ồ ạt vào ổ bụng ngừng tim tử vong ngay lập tức! Khóa cấm nâng HA bình thường bằng dịch tinh thể (${aggressiveNormalSalineOverloadStrictlyProhibited ? "CẤM DỊCH TINH THỂ QUÁ MỨC" : "NGUY HIỂM"}) làm loãng máu bục toác cuống mạch.`,
        `BÁO ĐỘNG ĐỎ PHÒNG CAN THIỆP MẠCH DSA & MỔ CẤP CỨU: Nút mạch can thiệp DSA cấp cứu (Angioembolization) hoặc thắt cuống mạch thận tại BV Bình Dân / BV Chợ Rẫy / BV 115 (${emergencyAngioembolizationOrSurgeryAlerted ? "KÍP CAN THIỆP MẠCH SẴN SÀNG" : "CHỜ BÁO ĐỘNG"}).`,
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Nhiệt Ác Tính Khi Gắng Sức & Ngâm Nước Đá Lạnh CWI 30 Phút Vàng (Phân hệ 94)
   */
  async manageExertionalHeatStroke(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      coreTemperatureC = 40.8,
      coldWaterImmersionInitiated = true,
      targetCoreTemp38Point8CReached = true,
      antipyreticsStrictlyProhibited = true,
      transportBeforeCoolingStrictlyProhibited = true,
      attemptedAntipyretic = false,
      attemptedPrematureTransport = false,
    } = payload || {};

    if (attemptedAntipyretic) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng thuốc hạ sốt Paracetamol / Acetaminophen hoặc Aspirin / NSAIDs trong sốc nhiệt! Điểm đặt điều nhiệt dưới đồi không đổi; Paracetamol gây hoại tử tế bào gan cấp bùng phát (Fulminant Hepatic Failure) và NSAIDs gây loét xuất huyết/suy thận cấp.',
      );
    }

    if (attemptedPrematureTransport) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM di chuyển nạn nhân lên xe cấp cứu khi chưa hạ thân nhiệt lõi xuống dưới 39.0°C! Tuân thủ nghiêm ngặt quy tắc sống còn "COOL FIRST, TRANSPORT SECOND" để cứu vãn tế bào não và đa tạng khỏi bị tổn thương nhiệt không hồi phục.',
      );
    }

    incident.exertionalHeatStrokeCare = {
      isExertionalHeatStroke: true,
      coreTemperatureC: Number(coreTemperatureC),
      coldWaterImmersionInitiated: Boolean(coldWaterImmersionInitiated),
      targetCoreTemp38Point8CReached: Boolean(targetCoreTemp38Point8CReached),
      antipyreticsStrictlyProhibited: Boolean(antipyreticsStrictlyProhibited),
      transportBeforeCoolingStrictlyProhibited: Boolean(transportBeforeCoolingStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.exertionalHeatStrokeCare && incident.markModified('exertionalHeatStrokeCare');

    incident.auditTrail.push({
      action: 'EXERTIONAL_HEAT_STROKE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Sốc nhiệt gắng sức: Thân nhiệt lõi=${coreTemperatureC}°C, Ngâm đá CWI=${coldWaterImmersionInitiated}, Đạt đích <39°C=${targetCoreTemp38Point8CReached}, CẤM hạ sốt Paracetamol=${antipyreticsStrictlyProhibited}, CẤM vận chuyển sớm=${transportBeforeCoolingStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isExertionalHeatStroke: true,
      coreTemperatureC: Number(coreTemperatureC),
      coldWaterImmersionInitiated: Boolean(coldWaterImmersionInitiated),
      targetCoreTemp38Point8CReached: Boolean(targetCoreTemp38Point8CReached),
      antipyreticsStrictlyProhibited: Boolean(antipyreticsStrictlyProhibited),
      transportBeforeCoolingStrictlyProhibited: Boolean(transportBeforeCoolingStrictlyProhibited),
      clinicalDirectives: [
        `NHẬN DIỆN SỐC NHIỆT ÁC TÍNH KHI GẮNG SỨC (EXERTIONAL HEAT STROKE - EHS): Thân nhiệt lõi đo trực tràng vọt lên ${coreTemperatureC}°C kèm rối loạn chức năng thần kinh trung ương (kích động, mê sảng, co giật, hôn mê) sau vận động cường độ cao.`,
        `TIÊU CHUẨN VÀNG: NGÂM NƯỚC ĐÁ LẠNH TOÀN THÂN (CWI 1.5 - 15°C): Ngâm ngập toàn thân từ cổ trở xuống trong bể nước đá (${coldWaterImmersionInitiated ? "ĐANG TIẾN HÀNH CWI LIÊN TỤC" : "CẦN KHỞI ĐỘNG NGAY"}), khuấy nước liên tục hạ nhiệt lõi với tốc độ > 0.15°C/phút, đưa nhiệt độ về mức an toàn 38.6 - 38.8°C (${targetCoreTemp38Point8CReached ? "ĐẠT MỤC TIÊU 38.8°C TRONG 30 PHÚT VÀNG" : "ĐANG HẠ NHIỆT"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM THUỐC HẠ SỐT & CẤM VẬN CHUYỂN SỚM: Khóa cấm dùng Paracetamol/Aspirin (${antipyreticsStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}), Paracetamol không hạ được sốc nhiệt và gây hoại tử tế bào gan cấp bùng phát. Khóa nghiêm ngặt quy tắc sống còn "COOL FIRST, TRANSPORT SECOND" (${transportBeforeCoolingStrictlyProhibited ? "ĐÃ KHÓA TUÂN THỦ" : "CẤM DI CHUYỂN TRƯỚC HẠ NHIỆT"}).`,
        `ĐIỀU PHỐI ICU HỒI SỨC SỐC NHIỆT TUYẾN CUỐI: Chuyển ICU BV Chợ Rẫy / BV 115 / BV Nhân Dân Gia Định để giám sát biến chứng tiêu cơ vân cấp (Rhabdomyolysis), toan lactic và lọc máu CRRT dự phòng suy thận cấp.`,
      ],
    };
  }

  /**
   * Cấp Cứu Bỏng Hóa Chất Công Nghiệp Diện Rộng & Dung Dịch Lưỡng Tính Diphoterine (Phân hệ 95)
   */
  async manageSevereChemicalBurns(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      chemicalAgentType = 'CONCENTRATED_ACID_OR_ALKALI',
      copiousDecontaminationSolutionUsed = true,
      neutralizingAgentsStrictlyProhibited = true,
      highPressureWaterStrictlyProhibited = true,
      ocularIrrigationTargetPHReached = true,
      attemptedChemicalNeutralization = false,
      attemptedHighPressureWater = false,
    } = payload || {};

    if (attemptedChemicalNeutralization) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng hóa chất đối kháng để trung hòa (đổ axit vào kiềm hoặc đổ dung dịch kiềm/bazơ vào axit)! Phản ứng trung hòa sinh nhiệt hóa học ngoại vi cực lớn (Exothermic Reaction) biến vết bỏng hóa chất thành bỏng nhiệt độ cao cấp tính, làm cháy đen thiêu đốt toàn bộ tế bào sống và sốc tử vong!',
      );
    }

    if (attemptedHighPressureWater) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng vòi nước áp lực cao (áp lực mạnh)! Áp lực mạnh sẽ xé toạc các lớp biểu bì da non trợt loét, đồng thời ép hóa chất ngấm sâu hơn vào lớp mô mỡ và mạch máu dưới da.',
      );
    }

    incident.severeChemicalBurnsCare = {
      isSevereChemicalBurns: true,
      chemicalAgentType: String(chemicalAgentType),
      copiousDecontaminationSolutionUsed: Boolean(copiousDecontaminationSolutionUsed),
      neutralizingAgentsStrictlyProhibited: Boolean(neutralizingAgentsStrictlyProhibited),
      highPressureWaterStrictlyProhibited: Boolean(highPressureWaterStrictlyProhibited),
      ocularIrrigationTargetPHReached: Boolean(ocularIrrigationTargetPHReached),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.severeChemicalBurnsCare && incident.markModified('severeChemicalBurnsCare');

    incident.auditTrail.push({
      action: 'SEVERE_CHEMICAL_BURNS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Bỏng hóa chất công nghiệp: Loại hóa chất=${chemicalAgentType}, Tưới rửa liên tục 30-60p=${copiousDecontaminationSolutionUsed}, CẤM hóa chất trung hòa=${neutralizingAgentsStrictlyProhibited}, CẤM nước áp lực cao=${highPressureWaterStrictlyProhibited}, pH mắt đạt 7.0-7.4=${ocularIrrigationTargetPHReached}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isSevereChemicalBurns: true,
      chemicalAgentType: String(chemicalAgentType),
      copiousDecontaminationSolutionUsed: Boolean(copiousDecontaminationSolutionUsed),
      neutralizingAgentsStrictlyProhibited: Boolean(neutralizingAgentsStrictlyProhibited),
      highPressureWaterStrictlyProhibited: Boolean(highPressureWaterStrictlyProhibited),
      ocularIrrigationTargetPHReached: Boolean(ocularIrrigationTargetPHReached),
      clinicalDirectives: [
        `PHÂN ĐỊNH CƠ CHẾ TỔN THƯƠNG HÓA CHẤT (${chemicalAgentType}): Axit gây hoại tử đông (Coagulation Necrosis) tạo vảy protein kết tủa; Kiềm mạnh gây hoại tử hóa lỏng (Liquefaction Necrosis) xà phòng hóa mỡ ăn sâu phá hủy mô không ngừng.`,
        `QUY TRÌNH TƯỚI RỬA KHỬ NHIỄM LIÊN TỤC 30 - 60 PHÚT: Cởi bỏ ngay y phục nhiễm độc, tưới rửa bằng lượng nước ấm dồi dào áp lực nhẹ hoặc dung dịch lưỡng tính Diphoterine (${copiousDecontaminationSolutionUsed ? "ĐANG TƯỚI RỬA KHỬ NHIỄM LIÊN TỤC" : "CẦN TƯỚI RỬA NGAY"}). Nếu dính mắt: Xối rửa từ góc trong ra ngoài ít nhất 30 phút, pH mục tiêu 7.0 - 7.4 (${ocularIrrigationTargetPHReached ? "pH MẮT ĐẠT CHUẨN 7.2" : "TIẾP TỤC RỬA MẮT"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM TRUNG HÒA HÓA HỌC & CẤM NƯỚC ÁP LỰC MẠNH: Khóa cảnh báo cấm dùng chất trung hòa (${neutralizingAgentsStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}), phản ứng tỏa nhiệt thiêu cháy mô sống! Khóa cấm xịt nước áp lực mạnh (${highPressureWaterStrictlyProhibited ? "ĐÃ KHÓA NƯỚC ÁP LỰC NHẸ" : "NGUY HIỂM XÉ RÁCH DA"}).`,
        `ĐIỀU PHỐI TRUNG TÂM BỎNG & PHẪU THUẬT TẠO HÌNH TUYẾN CUỐI: Chuyển Trung tâm Bỏng BV Chợ Rẫy / BV Nhi Đồng 1 tiếp tục hồi sức dịch phỏng (Parkland), phòng vô trùng và ghép da vi phẫu khẩn cấp.`,
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Vỡ Gan Độ V & Nghiệm Pháp Pringle / Chèn Gạc Quanh Gan (Phân hệ 96)
   */
  async manageGradeVHepaticTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      massiveHemoperitoneumWithShock = true,
      damageControlPringleManeuverClamped = true,
      perihepaticPackingApplied = true,
      earlyUnpackingStrictlyProhibited = true,
      blindRetrohepaticSutureStrictlyProhibited = true,
      attemptedEarlyUnpacking = false,
      attemptedBlindRetrohepaticSuture = false,
    } = payload || {};

    if (attemptedEarlyUnpacking) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM lấy bỏ gạc chèn (unpacking) sớm trước 48 - 72 giờ! Khi các yếu tố đông máu chưa hồi phục và cục máu đông chưa trưởng thành, dỡ gạc sớm sẽ bục toác tái xuất huyết dữ dội không thể cầm (Catastrophic Rebleeding), khiến bệnh nhân tử vong ngay lập tức trên bàn mổ!',
      );
    }

    if (attemptedBlindRetrohepaticSuture) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM cố tình khâu mò tĩnh mạch sau gan hoặc bóc tách cắt gan lớn trong giai đoạn đầu sốc mất máu! Phẫu thuật kéo dài làm xé rách thêm tĩnh mạch gan và đưa bệnh nhân vào Tam chứng tử vong (Hạ thân nhiệt, Toan chuyển hóa, Rối loạn đông máu) ngừng tim không hồi phục.',
      );
    }

    incident.gradeVHepaticTraumaCare = {
      isGradeVHepaticTrauma: true,
      massiveHemoperitoneumWithShock: Boolean(massiveHemoperitoneumWithShock),
      damageControlPringleManeuverClamped: Boolean(damageControlPringleManeuverClamped),
      perihepaticPackingApplied: Boolean(perihepaticPackingApplied),
      earlyUnpackingStrictlyProhibited: Boolean(earlyUnpackingStrictlyProhibited),
      blindRetrohepaticSutureStrictlyProhibited: Boolean(blindRetrohepaticSutureStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.gradeVHepaticTraumaCare && incident.markModified('gradeVHepaticTraumaCare');

    incident.auditTrail.push({
      action: 'GRADE_V_HEPATIC_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ gan độ V: Mất máu nặng/Sốc=${massiveHemoperitoneumWithShock}, Kẹp Pringle=${damageControlPringleManeuverClamped}, Chèn gạc quanh gan=${perihepaticPackingApplied}, CẤM rút gạc sớm <48-72h=${earlyUnpackingStrictlyProhibited}, CẤM khâu mò tĩnh mạch sau gan=${blindRetrohepaticSutureStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isGradeVHepaticTrauma: true,
      massiveHemoperitoneumWithShock: Boolean(massiveHemoperitoneumWithShock),
      damageControlPringleManeuverClamped: Boolean(damageControlPringleManeuverClamped),
      perihepaticPackingApplied: Boolean(perihepaticPackingApplied),
      earlyUnpackingStrictlyProhibited: Boolean(earlyUnpackingStrictlyProhibited),
      blindRetrohepaticSutureStrictlyProhibited: Boolean(blindRetrohepaticSutureStrictlyProhibited),
      clinicalDirectives: [
        `NHẬN DIỆN CHẤN THƯƠNG VỠ GAN ĐỘ V (AAST GRADE V HEPATIC LACERATION): Nhu mô gan vỡ nát > 75% thùy gan hoặc tổn thương tĩnh mạch sau gan/tĩnh mạch chủ, tràn máu ổ bụng > 1,500 mL gây sốc mất máu nặng (${massiveHemoperitoneumWithShock ? "VỠ GAN ĐỘ V NGUY KỊCH MẤT MÁU" : "THEO DÕI"}).`,
        `PHẪU THUẬT KIỂM SOÁT TỔN THƯƠNG (DCS) - NGHIỆM PHÁP PRINGLE & CHÈN GẠC QUANH GAN: Kẹp cuống gan Pringle Maneuver tối đa 15-20 phút (${damageControlPringleManeuverClamped ? "ĐÃ KẸP PRINGLE CẦM MÁU CUỐNG GAN" : "CẦN THỰC HIỆN PRINGLE"}) và chèn 6-10 miếng gạc lớn ép chặt quanh gan (${perihepaticPackingApplied ? "ĐÃ CHÈN ÉP GẠC QUANH GAN" : "CẦN CHÈN GẠC PACKING"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM RÚT GẠC SỚM < 48-72H & CẤM KHÂU MÒ TĨNH MẠCH SAU GAN: Khóa cảnh báo cấm dỡ gạc sớm (${earlyUnpackingStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÊN 48-72H" : "CỰC KỲ NGUY HIỂM BỤC MÁU"}), rút gạc sớm gây tái xuất huyết xối xả tử vong ngay tại chỗ! Khóa cấm khâu mò tĩnh mạch sau gan (${blindRetrohepaticSutureStrictlyProhibited ? "ĐÃ KHÓA TRÁNH TAM CHỨNG TỬ VONG" : "NGUY HIỂM"}).`,
        `ĐIỀU PHỐI TRUNG TÂM PHẪU THUẬT GAN MẬT TỤY ĐẦU NGÀNH: Báo động kíp mổ Gan Mật Tụy và Hồi sức can thiệp BV Chợ Rẫy / BV Bình Dân / BV 115 chuẩn bị MTP 1:1:1, hạ thân nhiệt kiểm soát và kế hoạch mở bụng thì hai sau 48-72 giờ.`,
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Vỡ Lách Độ V Mất Máu Ồ Ạt & Cắt Lách Cấp Cứu / Nút Mạch Can Thiệp DSA (Phân hệ 97)
   */
  async manageGradeVSplenicRupture(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      shatteredSpleenOrVascularAvulsion = true,
      permissiveHypotensionSbp80to90Maintained = true,
      aggressiveFluidOverloadStrictlyProhibited = true,
      ctScanDelayInUnstableShockStrictlyProhibited = true,
      postSplenectomyOpsivaccineAlerted = true,
      attemptedAggressiveFluids = false,
      attemptedCtScanDelay = false,
    } = payload || {};

    if (attemptedAggressiveFluids) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM nâng huyết áp về mức bình thường (> 110-120 mmHg) bằng dịch tinh thể! Bù dịch muối/đường ồ ạt gây loãng máu làm tan cục máu đông tự nhiên, hạ thân nhiệt và xé toạc cuống mạch lách, khiến máu tràn xối xả vào ổ bụng ngừng tim tử vong ngay lập tức!',
      );
    }

    if (attemptedCtScanDelay) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM trì hoãn đưa bệnh nhân sốc mất máu không ổn định vào phòng chụp CT Scan ("Donut of Death")! Bệnh nhân đang tụt HA sâu sẽ ngừng tim trong buồng chụp trước khi hoàn thành lát cắt; bắt buộc phải mở bụng khẩn cấp ngay tại phòng mổ hoặc phòng hồi sức.',
      );
    }

    incident.gradeVSplenicRuptureCare = {
      isGradeVSplenicRupture: true,
      shatteredSpleenOrVascularAvulsion: Boolean(shatteredSpleenOrVascularAvulsion),
      permissiveHypotensionSbp80to90Maintained: Boolean(permissiveHypotensionSbp80to90Maintained),
      aggressiveFluidOverloadStrictlyProhibited: Boolean(aggressiveFluidOverloadStrictlyProhibited),
      ctScanDelayInUnstableShockStrictlyProhibited: Boolean(ctScanDelayInUnstableShockStrictlyProhibited),
      postSplenectomyOpsivaccineAlerted: Boolean(postSplenectomyOpsivaccineAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.gradeVSplenicRuptureCare && incident.markModified('gradeVSplenicRuptureCare');

    incident.auditTrail.push({
      action: 'GRADE_V_SPLENIC_RUPTURE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ lách độ V: Dập nát/Đứt cuống=${shatteredSpleenOrVascularAvulsion}, DCR SBP 80-90=${permissiveHypotensionSbp80to90Maintained}, CẤM dịch tinh thể=${aggressiveFluidOverloadStrictlyProhibited}, CẤM chờ CT=${ctScanDelayInUnstableShockStrictlyProhibited}, Vắc xin OPSI=${postSplenectomyOpsivaccineAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isGradeVSplenicRupture: true,
      shatteredSpleenOrVascularAvulsion: Boolean(shatteredSpleenOrVascularAvulsion),
      permissiveHypotensionSbp80to90Maintained: Boolean(permissiveHypotensionSbp80to90Maintained),
      aggressiveFluidOverloadStrictlyProhibited: Boolean(aggressiveFluidOverloadStrictlyProhibited),
      ctScanDelayInUnstableShockStrictlyProhibited: Boolean(ctScanDelayInUnstableShockStrictlyProhibited),
      postSplenectomyOpsivaccineAlerted: Boolean(postSplenectomyOpsivaccineAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN VỠ LÁCH ĐỘ V (AAST GRADE V SPLEEN INJURY): Nhu mô lách dập nát hoàn toàn hoặc đứt toạc cuống động - tĩnh mạch lách, tràn máu ổ bụng > 1,500 mL, đau nhói hạ sườn trái lan lên vai trái (Dấu hiệu Kehr) (${shatteredSpleenOrVascularAvulsion ? "VỠ LÁCH ĐỘ V NGUY KỊCH MẤT MÁU" : "THEO DÕI"}).`,
        `HỒI SỨC KIỂM SOÁT TỔN THƯƠNG (DCR) & HUYẾT ÁP THẤP CHẤP NHẬN ĐƯỢC: Duy trì huyết áp tâm thu permissive hypotension SBP 80-90 mmHg (${permissiveHypotensionSbp80to90Maintained ? "ĐANG DUY TRÌ SBP 80-90 MMHG" : "CẦN KIỂM SOÁT DCR"}), tiêm Tranexamic Acid (TXA) 1g IV trong 3h đầu và kích hoạt quy trình truyền máu khối lượng lớn MTP 1:1:1.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM BÙ DỊCH QUÁ MỨC & CẤM CHỜ ĐỢI CHỤP CT: Khóa cấm dịch tinh thể quá mức (${aggressiveFluidOverloadStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM"}), dịch tinh thể làm bục toác cuống mạch lách! Khóa cấm trì hoãn chụp CT ở bệnh nhân sốc không ổn định (${ctScanDelayInUnstableShockStrictlyProhibited ? "ĐÃ KHÓA MỔ MỞ CẤP CỨU NGAY" : "CẤM ĐƯA VÀO PHÒNG CT"}).`,
        `ĐIỀU PHỐI NGOẠI TIÊU HÓA - CAN THIỆP MẠCH TUYẾN CUỐI & DỰ PHÒNG OPSI: Báo động phòng mổ cắt lách hoặc phòng can thiệp mạch DSA nút động mạch lách (SAE) BV Chợ Rẫy / BV 115 / BV Bình Dân; lên lịch tiêm vắc xin phòng vi khuẩn có vỏ (Phế cầu, Não mô cầu, Hib) (${postSplenectomyOpsivaccineAlerted ? "ĐÃ LÊN LỊCH VẮC XIN OPSI" : "CHỜ BÁO ĐỘNG"}).`,
      ],
    };
  }

  /**
   * Cấp Cứu Ngộ Độc Cấp Thuốc Trừ Sâu Nhóm Nhôm Photphua / Phosphine (Phân hệ 98)
   */
  async manageAluminiumPhosphidePoisoning(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      garlicFishyOdorAndShock = true,
      coconutOilOrParaffinAdministered = true,
      sodiumBicarbonateGastricLavage5Percent = true,
      plainWaterGastricLavageStrictlyProhibited = true,
      unventilatedRescuerExposureStrictlyProhibited = true,
      cardiacArrestEcmoAlerted = true,
      attemptedPlainWaterLavage = false,
      attemptedUnventilatedExposure = false,
    } = payload || {};

    if (attemptedPlainWaterLavage) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM rửa dạ dày bằng nước lã thông thường hoặc nước ấm không có chất kiềm hóa! Nhôm Phosphua phản ứng mãnh liệt với nước lã giải phóng lượng khí độc Phosphine (PH3) khổng lồ xối xả vào tuần hoàn, gây ức chế hô hấp tế bào hoại tử cơ tim cấp khiến nạn nhân co giật ngừng tim tử vong ngay lập tức!',
      );
    }

    if (attemptedUnventilatedExposure) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM nhân viên y tế và hiệp sĩ sơ cứu tiếp xúc nạn nhân trong không gian kín không thông gió! Hơi thở và dịch nôn bốc khí Phosphine đậm đặc gây ngộ độc hít phải cho người cấp cứu; bắt buộc phải mở toàn bộ cửa sổ hoặc thực hiện ở khu vực thông khí cưỡng bức.',
      );
    }

    incident.aluminiumPhosphidePoisoningCare = {
      isAluminiumPhosphidePoisoning: true,
      garlicFishyOdorAndShock: Boolean(garlicFishyOdorAndShock),
      coconutOilOrParaffinAdministered: Boolean(coconutOilOrParaffinAdministered),
      sodiumBicarbonateGastricLavage5Percent: Boolean(sodiumBicarbonateGastricLavage5Percent),
      plainWaterGastricLavageStrictlyProhibited: Boolean(plainWaterGastricLavageStrictlyProhibited),
      unventilatedRescuerExposureStrictlyProhibited: Boolean(unventilatedRescuerExposureStrictlyProhibited),
      cardiacArrestEcmoAlerted: Boolean(cardiacArrestEcmoAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.aluminiumPhosphidePoisoningCare && incident.markModified('aluminiumPhosphidePoisoningCare');

    incident.auditTrail.push({
      action: 'ALUMINIUM_PHOSPHIDE_POISONING_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc Nhôm Photphua: Mùi tỏi/Sốc=${garlicFishyOdorAndShock}, Uống dầu dừa=${coconutOilOrParaffinAdministered}, Rửa dạ dày NaHCO3 5%=${sodiumBicarbonateGastricLavage5Percent}, CẤM nước lã=${plainWaterGastricLavageStrictlyProhibited}, CẤM phòng kín=${unventilatedRescuerExposureStrictlyProhibited}, Báo động ECMO=${cardiacArrestEcmoAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAluminiumPhosphidePoisoning: true,
      garlicFishyOdorAndShock: Boolean(garlicFishyOdorAndShock),
      coconutOilOrParaffinAdministered: Boolean(coconutOilOrParaffinAdministered),
      sodiumBicarbonateGastricLavage5Percent: Boolean(sodiumBicarbonateGastricLavage5Percent),
      plainWaterGastricLavageStrictlyProhibited: Boolean(plainWaterGastricLavageStrictlyProhibited),
      unventilatedRescuerExposureStrictlyProhibited: Boolean(unventilatedRescuerExposureStrictlyProhibited),
      cardiacArrestEcmoAlerted: Boolean(cardiacArrestEcmoAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN NGỘ ĐỘC CẤP NHÔM PHOTPHUA (ALUMINIUM PHOSPHIDE - QUICKPHOS): Hơi thở mùi cá ươn hoặc tỏi thối nồng nặc của khí Phosphine (PH3), ức chế chuỗi hô hấp tế bào ty thể Cytochrome c Oxidase gây toan lactic nặng và suy tim cấp tụt HA kháng vận mạch (${garlicFishyOdorAndShock ? "NGỘ ĐỘC PHOSPHINE NGUY KỊCH TỬ VONG" : "THEO DÕI"}).`,
        `PHÁC ĐỒ DẦU DỪA & RỬA DẠ DÀY KIỀM HÓA NAHCO3 5%: Cho uống ngay 100-200 mL dầu dừa tinh khiết (${coconutOilOrParaffinAdministered ? "ĐÃ CHO UỐNG DẦU DỪA TẠO MÀNG BỌC LIPID" : "CẦN UỐNG DẦU DỪA NGAY"}) ngăn AlP tiếp xúc dịch vị axit; rửa dạ dày bằng dung dịch Sodium Bicarbonate 5% (${sodiumBicarbonateGastricLavage5Percent ? "ĐANG RỬA DẠ DÀY KIỀM HÓA NAHCO3" : "CẦN KIỀM HÓA DẠ DÀY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM RỬA BẰNG NƯỚC LÃ & CẤM PHÒNG KÍN: Khóa cấm rửa bằng nước lã (${plainWaterGastricLavageStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN" : "CỰC KỲ NGUY HIỂM BÙNG NỔ KHÍ PH3"}), nước lã kích hoạt sinh khí PH3 ồ ạt! Khóa cấm phòng kín không thông gió (${unventilatedRescuerExposureStrictlyProhibited ? "KHU VỰC THÔNG GIÓ BẢO VỆ HIỆP SĨ" : "NGUY HIỂM NGỘ ĐỘC KHÍ ĐỘC"}).`,
        `ĐIỀU PHỐI TRUNG TÂM HỒI SỨC CHỐNG ĐỘC & VA-ECMO TUYẾN CUỐI: Chuyển ICU Chống độc BV Chợ Rẫy / BV 115 chuẩn bị can thiệp hỗ trợ tuần hoàn ngoài cơ thể VA-ECMO và lọc máu hấp phụ than hoạt hemoperfusion (${cardiacArrestEcmoAlerted ? "KÍP VA-ECMO CHỐNG ĐỘC SẴN SÀNG" : "CHỜ BÁO ĐỘNG"}).`,
      ],
    };
  }

  /**
   * Cấp Cứu Tràn Khí Màng Phổi Do Hở Thành Ngực & Băng Van 3 Cạnh (Phân hệ 99)
   */
  async manageOpenSuckingChestWound(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      suckingChestHissingSoundWithFlutter = true,
      threeSidedFlutterValveDressingApplied = true,
      fourSidedOcclusiveDressingStrictlyProhibited = true,
      woundPackingStrictlyProhibited = true,
      chestTubeUnderwaterSealAlerted = true,
      attemptedFourSidedDressing = false,
      attemptedWoundPacking = false,
    } = payload || {};

    if (attemptedFourSidedDressing) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM băng bịt kín cả 4 cạnh của miếng dán vết thương ngực! Không khí từ nhu mô phổi rách sẽ tiếp tục tích tụ trong khoang màng phổi không có đường thoát, biến vết thương ngực hở thành TRÀN KHÍ MÀNG PHỔI ÁP LỰC CAO (Tension Pneumothorax) đè bẹp tim và trung thất gây ngừng tuần hoàn tử vong chỉ trong vài phút!',
      );
    }

    if (attemptedWoundPacking) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM nhét gạc chèn sâu vào lỗ thủng vết thương ngực! Nhét gạc sẽ làm rách thêm nhu mô phổi bên dưới và tạo dị vật gây viêm mủ trung thất cấp hoại tử.',
      );
    }

    incident.openSuckingChestWoundCare = {
      isOpenSuckingChestWound: true,
      suckingChestHissingSoundWithFlutter: Boolean(suckingChestHissingSoundWithFlutter),
      threeSidedFlutterValveDressingApplied: Boolean(threeSidedFlutterValveDressingApplied),
      fourSidedOcclusiveDressingStrictlyProhibited: Boolean(fourSidedOcclusiveDressingStrictlyProhibited),
      woundPackingStrictlyProhibited: Boolean(woundPackingStrictlyProhibited),
      chestTubeUnderwaterSealAlerted: Boolean(chestTubeUnderwaterSealAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.openSuckingChestWoundCare && incident.markModified('openSuckingChestWoundCare');

    incident.auditTrail.push({
      action: 'OPEN_SUCKING_CHEST_WOUND_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vết thương ngực hở: Rít gió/Lắc trung thất=${suckingChestHissingSoundWithFlutter}, Băng van 3 cạnh=${threeSidedFlutterValveDressingApplied}, CẤM băng kín 4 cạnh=${fourSidedOcclusiveDressingStrictlyProhibited}, CẤM nhét gạc=${woundPackingStrictlyProhibited}, Ống dẫn lưu ngực=${chestTubeUnderwaterSealAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isOpenSuckingChestWound: true,
      suckingChestHissingSoundWithFlutter: Boolean(suckingChestHissingSoundWithFlutter),
      threeSidedFlutterValveDressingApplied: Boolean(threeSidedFlutterValveDressingApplied),
      fourSidedOcclusiveDressingStrictlyProhibited: Boolean(fourSidedOcclusiveDressingStrictlyProhibited),
      woundPackingStrictlyProhibited: Boolean(woundPackingStrictlyProhibited),
      chestTubeUnderwaterSealAlerted: Boolean(chestTubeUnderwaterSealAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN VẾT THƯƠNG NGỰC HỞ PHÌ PHÒ (OPEN SUCKING CHEST WOUND): Lỗ thủng thành ngực đường kính > 2/3 khí quản, không khí rít phì phò theo nhịp thở làm xẹp phổi và lắc lư trung thất cản trở máu tĩnh mạch trở về tim (${suckingChestHissingSoundWithFlutter ? "VẾT THƯƠNG NGỰC HỞ NGUY KỊCH HÔ HẤP" : "THEO DÕI"}).`,
        `KỸ THUẬT BĂNG VAN 3 CẠNH (THREE-SIDED FLUTTER VALVE DRESSING): Dùng miếng dán không thấm khí dán kín 3 CẠNH, chừa 1 CẠNH TỰ DO phía dưới (${threeSidedFlutterValveDressingApplied ? "ĐÃ DÁN BĂNG VAN 3 CẠNH CHUẨN PHTLS" : "CẦN DÁN BĂNG VAN 3 CẠNH NGAY"}). Cơ chế van 1 chiều: Hít vào áp lực âm ép cạnh dính chặn khí vào; thở ra áp lực dương đẩy cạnh mở giải phóng khí và máu ra ngoài.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM BĂNG KÍN 4 CẠNH & CẤM NHÉT GẠC VÀO LÒNG VẾT THƯƠNG: Khóa cấm dán kín 4 cạnh (${fourSidedOcclusiveDressingStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH TRÀN KHÍ ÁP LỰC CAO" : "CỰC KỲ NGUY HIỂM TẮC TRUNG THẤT"}), dán kín 4 cạnh biến thành tràn khí áp lực cao tử vong trong vài phút! Khóa cấm nhét gạc (${woundPackingStrictlyProhibited ? "ĐÃ KHÓA CẤM NHÉT GẠC" : "NGUY HIỂM RÁCH PHỔI"}).`,
        `ĐIỀU PHỐI TRUNG TÂM PHẪU THUẬT LỒNG NGỰC TUYẾN CUỐI: Chuyển Khoa Cấp cứu & Ngoại Lồng ngực BV Chợ Rẫy / BV 115 / BV Bình Dân chuẩn bị đặt ống dẫn lưu khoang màng phổi kín (Chest Tube 28-32 Fr có bình hút nước Underwater Seal) (${chestTubeUnderwaterSealAlerted ? "KÍP ĐẶT ỐNG DẪN LƯU NGỰC SẴN SÀNG" : "CHỜ BÁO ĐỘNG"}).`,
      ],
    };
  }

  /**
   * Cấp Cứu Đợt Bùng Phát Nhược Cơ Nặng & Cơn Bão Nhược Cơ Suy Hô Hấp Cấp (Phân hệ 100)
   */
  async manageMyasthenicCrisis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      vitalCapacityBelow15mLKgWithParalysis = true,
      emergencyIntubationOrBiPapInitiated = true,
      plasmaExchangeOrIvigAlerted = true,
      contraindicatedDrugsStrictlyProhibited = true,
      unprotectedSedativesStrictlyProhibited = true,
      attemptedContraindicatedDrugs = false,
      attemptedUnprotectedSedatives = false,
    } = payload || {};

    if (attemptedContraindicatedDrugs) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM sử dụng các nhóm thuốc làm trầm trọng thêm liệt dẫn truyền thần kinh - cơ! Bao gồm kháng sinh Aminoglycoside (Gentamicin, Amikacin, Tobramycin), Macrolide, Fluoroquinolone (Ciprofloxacin), thuốc chẹn Beta, chẹn Canxi và Magnesium Sulfate; các thuốc này ức chế giải phóng Acetylcholine gây liệt hoàn toàn cơ hoành và cơ hô hấp ngừng thở tử vong ngay lập tức!',
      );
    }

    if (attemptedUnprotectedSedatives) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng thuốc an thần Morphine hoặc Benzodiazepine cho bệnh nhân nhược cơ khi chưa đặt nội khí quản thở máy! Thuốc ức chế trung tâm hô hấp làm mất hoàn toàn nỗ lực tự thở còn sót lại gây ngừng thở tử vong.',
      );
    }

    incident.myasthenicCrisisRespiratoryFailureCare = {
      isMyasthenicCrisis: true,
      vitalCapacityBelow15mLKgWithParalysis: Boolean(vitalCapacityBelow15mLKgWithParalysis),
      emergencyIntubationOrBiPapInitiated: Boolean(emergencyIntubationOrBiPapInitiated),
      plasmaExchangeOrIvigAlerted: Boolean(plasmaExchangeOrIvigAlerted),
      contraindicatedDrugsStrictlyProhibited: Boolean(contraindicatedDrugsStrictlyProhibited),
      unprotectedSedativesStrictlyProhibited: Boolean(unprotectedSedativesStrictlyProhibited),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.myasthenicCrisisRespiratoryFailureCare && incident.markModified('myasthenicCrisisRespiratoryFailureCare');

    incident.auditTrail.push({
      action: 'MYASTHENIC_CRISIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Cơn bão nhược cơ: VC <15 mL/kg=${vitalCapacityBelow15mLKgWithParalysis}, Đặt NKQ/BiPAP=${emergencyIntubationOrBiPapInitiated}, Thay huyết tương PLEX/IVIG=${plasmaExchangeOrIvigAlerted}, CẤM Aminoglycoside/chẹn Beta/Magnesium=${contraindicatedDrugsStrictlyProhibited}, CẤM an thần=${unprotectedSedativesStrictlyProhibited}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isMyasthenicCrisis: true,
      vitalCapacityBelow15mLKgWithParalysis: Boolean(vitalCapacityBelow15mLKgWithParalysis),
      emergencyIntubationOrBiPapInitiated: Boolean(emergencyIntubationOrBiPapInitiated),
      plasmaExchangeOrIvigAlerted: Boolean(plasmaExchangeOrIvigAlerted),
      contraindicatedDrugsStrictlyProhibited: Boolean(contraindicatedDrugsStrictlyProhibited),
      unprotectedSedativesStrictlyProhibited: Boolean(unprotectedSedativesStrictlyProhibited),
      clinicalDirectives: [
        `NHẬN DIỆN CƠN BÃO NHƯỢC CƠ BÙNG PHÁT (MYASTHENIC CRISIS): Kháng thể kháng thụ thể AChR gây liệt cơ mềm tiến triển nhanh, suy kiệt cơ hoành và cơ liên sườn với dung tích sống VC < 15 mL/kg hoặc NIF < -20 cmH2O (Quy tắc 20/30/40 Rule) (${vitalCapacityBelow15mLKgWithParalysis ? "CƠN BÃO NHƯỢC CƠ LIỆT HÔ HẤP NGUY KỊCH" : "THEO DÕI"}).`,
        `BẢO VỆ ĐƯỜNG THỞ SỚM & LIỆU PHÁP THAY HUYẾT TƯƠNG PLEX / IVIG: Đặt nội khí quản thở máy xâm nhập sớm bảo vệ đường thở (${emergencyIntubationOrBiPapInitiated ? "ĐÃ KIỂM SOÁT ĐƯỜNG THỞ & THỞ MÁY SỚM" : "CẦN ĐẶT NỘI KHÍ QUẢN NGAY"}); khởi động thay huyết tương cấp cứu PLEX 5-6 chu kỳ hoặc Globulin miễn dịch IVIG 2 g/kg (${plasmaExchangeOrIvigAlerted ? "PHÁC ĐỒ PLEX / IVIG ĐÃ KÍCH HOẠT" : "CẦN KHỞI ĐỘNG PLEX/IVIG"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM THUỐC ỨC CHẾ DẪN TRUYỀN THẦN KINH - CƠ & CẤM AN THẦN ĐƠN ĐỘC: Khóa cấm kháng sinh Aminoglycoside (Gentamicin, Amikacin), Macrolide, Quinolone, chẹn Beta, chẹn Canxi, Magnesium Sulfate (${contraindicatedDrugsStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TUYỆT ĐỐI" : "CỰC KỲ NGUY HIỂM LIỆT CƠ HÔ HẤP TỨC THÌ"}). Khóa cấm an thần khi chưa kiểm soát thở máy (${unprotectedSedativesStrictlyProhibited ? "ĐÃ KHÓA CẤM AN THẦN" : "NGUY HIỂM NGỪNG THỞ"}).`,
        `ĐIỀU PHỐI TRUNG TÂM HỒI SỨC THẦN KINH (NEURO-ICU) TUYẾN CUỐI: Chuyển ICU Thần kinh BV Chợ Rẫy / BV 115 / BV Đại học Y Dược TP.HCM chuẩn bị hệ thống PLEX, lọc máu loại bỏ tự kháng thể và theo dõi biến chứng nhiễm trùng cơ hội.`,
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Mất Máu Do Vỡ Búi Giãn Tĩnh Mạch Phình Vị Dạ Dày & Tiêm Keo Sinh Học Histoacryl / TIPS (Phân hệ 101)
   */
  async manageGastricVaricealBleeding(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      sarinClassification = 'IGV1_ISOLATED_GASTRIC_VARICES_1',
      cyanoacrylateGlueInjectionLipiodolRatio1to1 = true,
      vasoactiveTerlipressinAndCeftriaxoneAdministered = true,
      bandLigationStrictlyProhibited = true,
      pureGlueWithoutLipiodolStrictlyProhibited = true,
      permissiveHypotensionTargetSbp90to100 = true,
      attemptedBandLigation = false,
      attemptedPureGlueWithoutLipiodol = false,
    } = payload || {};

    if (attemptedBandLigation) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM thắt vòng cao su (Band Ligation - EVL) trên búi giãn tĩnh mạch phình vị dạ dày to (Sarin IGV1/GOV2)! Búi phình vị khổng lồ với thành mỏng sẽ bị vòng cao su cắt cứa toác rộng, gây xuất huyết phun trào xối xả không thể cầm, khiến bệnh nhân tử vong ngay trên bàn nội soi!',
      );
    }

    if (attemptedPureGlueWithoutLipiodol) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM tiêm keo sinh học Histoacryl nguyên chất không pha loãng với dầu Lipiodol (tỷ lệ chuẩn 1:1) hoặc tiêm với lưu lượng quá lớn không kiểm soát! Keo nguyên chất sẽ đông cứng tức thì làm tắc nghẽn kim soi và trôi tự do vào tuần hoàn tĩnh mạch cửa/tĩnh mạch phổi gây thuyên tắc phổi (Pulmonary Embolism) và thuyên tắc mạch não tối cấp tử vong!',
      );
    }

    incident.gastricVaricealBleedingCare = {
      isGastricVaricealBleeding: true,
      sarinClassification,
      cyanoacrylateGlueInjectionLipiodolRatio1to1: Boolean(cyanoacrylateGlueInjectionLipiodolRatio1to1),
      vasoactiveTerlipressinAndCeftriaxoneAdministered: Boolean(vasoactiveTerlipressinAndCeftriaxoneAdministered),
      bandLigationStrictlyProhibited: Boolean(bandLigationStrictlyProhibited),
      pureGlueWithoutLipiodolStrictlyProhibited: Boolean(pureGlueWithoutLipiodolStrictlyProhibited),
      permissiveHypotensionTargetSbp90to100: Boolean(permissiveHypotensionTargetSbp90to100),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.gastricVaricealBleedingCare && incident.markModified('gastricVaricealBleedingCare');

    incident.auditTrail.push({
      action: 'GASTRIC_VARICEAL_BLEEDING_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ tĩnh mạch phình vị: Phân loại Sarin=${sarinClassification}, Tiêm keo Histoacryl pha Lipiodol 1:1=${cyanoacrylateGlueInjectionLipiodolRatio1to1}, Terlipressin + Ceftriaxone=${vasoactiveTerlipressinAndCeftriaxoneAdministered}, CẤM thắt vòng cao su=${bandLigationStrictlyProhibited}, CẤM keo nguyên chất=${pureGlueWithoutLipiodolStrictlyProhibited}, Huyết áp đích SBP 90-100 mmHg=${permissiveHypotensionTargetSbp90to100}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isGastricVaricealBleeding: true,
      sarinClassification,
      cyanoacrylateGlueInjectionLipiodolRatio1to1: Boolean(cyanoacrylateGlueInjectionLipiodolRatio1to1),
      vasoactiveTerlipressinAndCeftriaxoneAdministered: Boolean(vasoactiveTerlipressinAndCeftriaxoneAdministered),
      bandLigationStrictlyProhibited: Boolean(bandLigationStrictlyProhibited),
      pureGlueWithoutLipiodolStrictlyProhibited: Boolean(pureGlueWithoutLipiodolStrictlyProhibited),
      permissiveHypotensionTargetSbp90to100: Boolean(permissiveHypotensionTargetSbp90to100),
      clinicalDirectives: [
        `NHẬN DIỆN VỠ TĨNH MẠCH PHÌNH VỊ DẠ DÀY (GASTRIC VARICEAL BLEEDING): Búi giãn tĩnh mạch phình vị phân loại Sarin ${sarinClassification} chảy máu dữ dội, áp lực lòng mạch lớn đe dọa trụy tuần hoàn nhanh hơn xuất huyết thực quản thông thường.`,
        `TIÊU CHUẨN VÀNG TIÊM KEO HISTOACRYL PHA LIPIODOL 1:1 & THUỐC CO MẠCH TẠNG: Tiêm nội soi keo sinh học N-butyl-2-cyanoacrylate pha Lipiodol tỷ lệ 1:1 làm tắc búi phình vị (${cyanoacrylateGlueInjectionLipiodolRatio1to1 ? "ĐÃ CHUẨN BỊ KEO HISTOACRYL/LIPIODOL 1:1 HOẶC TIPS/BRTO" : "CẦN CHUẨN BỊ KEO HISTOACRYL"}); dùng ngay Terlipressin 2mg IV bolus mỗi 4h và Ceftriaxone 1g/ngày tĩnh mạch (${vasoactiveTerlipressinAndCeftriaxoneAdministered ? "ĐÃ DÙNG TERLIPRESSIN & CEFTRIAXONE" : "CẦN TIÊM CO MẠCH TẠNG SỚM"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM THẮT VÒNG CAO SU (EVL) & CẤM TIÊM KEO NGUYÊN CHẤT: Khóa cấm thắt vòng cao su trên búi phình vị to (${bandLigationStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BỤC TOÁC BÚI PHÌNH VỊ" : "CỰC KỲ NGUY HIỂM CHẢY MÁU TỬ VONG"}), thắt vòng cao su cắt toác búi phình vị tử vong ngay lập tức! Khóa cấm tiêm keo nguyên chất (${pureGlueWithoutLipiodolStrictlyProhibited ? "ĐÃ KHÓA CẤM KEO NGUYÊN CHẤT TRÁNH THUYÊN TẮC PHỔI" : "NGUY HIỂM THUYÊN TẮC NÃO VÀ PHỔI"}).`,
        `HỒI SỨC HUYẾT ÁP THẤP CHẤP NHẬN ĐƯỢC: Chỉ duy trì SBP 90-100 mmHg và Hb 7-8 g/dL (${permissiveHypotensionTargetSbp90to100 ? "SBP ĐÍCH 90-100 MMHG ĐÃ ĐẠT" : "CẨN TRỌNG TRÁNH TĂNG ÁP CỬA TÁI XUẤT HUYẾT"}); chuyển Trung tâm Nội soi Tiêu hóa BV Chợ Rẫy / BV 115 / BV Bình Dân sẵn sàng can thiệp TIPS hoặc BRTO cứu hộ khi thất bại với tiêm xơ.`,
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Đụng Dập Rách Khí Phế Quản Lớn & Tràn Khí Dưới Da Khổng Lồ (Phân hệ 102)
   */
  async manageTracheobronchialRupture(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      massiveSubcutaneousEmphysemaAndAirLeak = true,
      fiberopticBronchoscopyGuidedIntubation = true,
      highPositivePressureVentilationStrictlyProhibited = true,
      blindIntubationStrictlyProhibited = true,
      thoracicSurgicalRepairAlerted = true,
      attemptedHighPressureVentilation = false,
      attemptedBlindIntubation = false,
    } = payload || {};

    if (attemptedHighPressureVentilation) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM thông khí áp lực dương cao (High Peak Inspiratory Pressure / PEEP cao) khi chưa kiểm soát được vị trí rách khí phế quản! Áp lực dương sẽ tống một lượng khí khổng lồ qua vết rách vào trung thất gây TRÀN KHÍ TRUNG THẤT ÁP LỰC CAO (Tension Pneumomediastinum), chèn ép ép chặt tim và tĩnh mạch chủ làm sụp đổ hoàn toàn huyết động ngừng tim tử vong tức thì!',
      );
    }

    if (attemptedBlindIntubation) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM đặt nội khí quản mò (Blind Intubation) khi nghi ngờ rách khí phế quản lớn! Đầu ống nội khí quản sẽ đâm xuyên qua vết rách nhu mô vào khoang trung thất hoặc màng phổi, biến vết rách bán phần thành đứt lìa hoàn toàn khí quản và tạo đường thở giả dẫn đến tử vong nhanh chóng!',
      );
    }

    incident.tracheobronchialRuptureCare = {
      isTracheobronchialRupture: true,
      massiveSubcutaneousEmphysemaAndAirLeak: Boolean(massiveSubcutaneousEmphysemaAndAirLeak),
      fiberopticBronchoscopyGuidedIntubation: Boolean(fiberopticBronchoscopyGuidedIntubation),
      highPositivePressureVentilationStrictlyProhibited: Boolean(highPositivePressureVentilationStrictlyProhibited),
      blindIntubationStrictlyProhibited: Boolean(blindIntubationStrictlyProhibited),
      thoracicSurgicalRepairAlerted: Boolean(thoracicSurgicalRepairAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.tracheobronchialRuptureCare && incident.markModified('tracheobronchialRuptureCare');

    incident.auditTrail.push({
      action: 'TRACHEOBRONCHIAL_RUPTURE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Rách khí phế quản lớn: Tràn khí dưới da/Xì khí liên tục=${massiveSubcutaneousEmphysemaAndAirLeak}, Soi phế quản đặt NKQ=${fiberopticBronchoscopyGuidedIntubation}, CẤM áp lực dương cao=${highPositivePressureVentilationStrictlyProhibited}, CẤM đặt NKQ mò=${blindIntubationStrictlyProhibited}, Phòng mổ Lồng ngực=${thoracicSurgicalRepairAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isTracheobronchialRupture: true,
      massiveSubcutaneousEmphysemaAndAirLeak: Boolean(massiveSubcutaneousEmphysemaAndAirLeak),
      fiberopticBronchoscopyGuidedIntubation: Boolean(fiberopticBronchoscopyGuidedIntubation),
      highPositivePressureVentilationStrictlyProhibited: Boolean(highPositivePressureVentilationStrictlyProhibited),
      blindIntubationStrictlyProhibited: Boolean(blindIntubationStrictlyProhibited),
      thoracicSurgicalRepairAlerted: Boolean(thoracicSurgicalRepairAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN CHẤN THƯƠNG RÁCH KHÍ PHẾ QUẢN LỚN (TRACHEOBRONCHIAL RUPTURE): Rách khí phế quản trong vòng 2.5cm quanh Carina, tràn khí dưới da khổng lồ lan nhanh lên cổ mặt ngực, ho ra máu tươi và đặt ống dẫn lưu màng phổi xì khí bọt liên tục không ngắt (${massiveSubcutaneousEmphysemaAndAirLeak ? "RÁCH ĐƯỜNG THỞ LỚN NGUY KỊCH TỔN THƯƠNG PHỔI" : "THEO DÕI"}).`,
        `TIÊU CHUẨN VÀNG: NỘI SOI PHẾ QUẢN ỐNG MỀM ĐỊNH VỊ & ĐẶT ỐNG NKQ CHỌN LỌC: Bắt buộc dùng ống soi phế quản sợi mềm luồn ống nội khí quản vượt qua vị trí rách vào phế quản bên lành hoặc dùng ống 2 nòng (Double-Lumen) thông khí chọn lọc (${fiberopticBronchoscopyGuidedIntubation ? "ĐÃ KIỂM SOÁT ĐƯỜNG THỞ BẰNG NỘI SOI PHẾ QUẢN ỐNG MỀM" : "CẦN KÍP SOI PHẾ QUẢN KHẨN CẤP"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM THÔNG KHÍ ÁP LỰC DƯƠNG CAO & CẤM ĐẶT NKQ MÒ: Khóa cấm thở máy PEEP/PIP cao (${highPositivePressureVentilationStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH TRÀN KHÍ TRUNG THẤT ÁP LỰC" : "CỰC KỲ NGUY HIỂM CHÈN ÉP TIM CẤP"}), áp lực dương tống khí xé toạc trung thất đè bẹp tim ngừng tuần hoàn! Khóa cấm đặt NKQ mò (${blindIntubationStrictlyProhibited ? "ĐÃ KHÓA CẤM ĐẶT NKQ MÒ" : "NGUY HIỂM ĐÂM XUYÊN RÁCH TOÁC KHÍ QUẢN"}).`,
        `ĐIỀU PHỐI TRUNG TÂM PHẪU THUẬT LỒNG NGỰC ĐẦU NGÀNH: Báo động phòng mổ Cấp cứu Ngoại Lồng ngực BV Chợ Rẫy / BV 115 / BV Bình Dân mở ngực khâu nối phục hồi tổn thương khí phế quản trong khung giờ vàng (${thoracicSurgicalRepairAlerted ? "PHÒNG MỔ LỒNG NGỰC ĐÃ SẴN SÀNG" : "CHỜ BÁO ĐỘNG"}).`,
      ],
    };
  }

  /**
   * Cấp Cứu Ngộ Độc Cấp Thuốc Chống Trầm Cảm 3 Vòng & Kiềm Hóa Natri Bicarbonate 8.4% (Phân hệ 103)
   */
  async manageTcaToxicity(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      wideQrsAndAnticholinergicToxidrome = true,
      sodiumBicarbonateHypertonicAlkalinization = true,
      classIaAndIcAndAmiodaroneStrictlyProhibited = true,
      physostigmineStrictlyProhibited = true,
      intralipid20PercentRescueAlerted = true,
      attemptedClassIaOrIcOrAmiodarone = false,
      attemptedPhysostigmine = false,
    } = payload || {};

    if (attemptedClassIaOrIcOrAmiodarone) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM sử dụng thuốc chống loạn nhịp nhóm IA (Quinidine, Procainamide), nhóm IC (Flecainide) hoặc Amiodarone (nhóm III)! Các thuốc này làm phong bế thêm kênh Natri và kéo dài khoảng QT, hiệp đồng độc tính với TCA gây giãn rộng QRS bùng phát, xoắn đỉnh TdP và ngừng tim trơ không thể sốc điện khử rung!',
      );
    }

    if (attemptedPhysostigmine) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng Physostigmine để điều trị mê sảng kháng cholinergic trong ngộ độc TCA! Physostigmine gây kích thích phế vị dữ dội, dẫn đến co thắt phế quản, nhịp chậm sâu, block nhĩ thất hoàn toàn và ngừng tim vô tâm thu (Asystole) đột ngột không thể hồi phục!',
      );
    }

    incident.tcaToxicityCare = {
      isTcaToxicity: true,
      wideQrsAndAnticholinergicToxidrome: Boolean(wideQrsAndAnticholinergicToxidrome),
      sodiumBicarbonateHypertonicAlkalinization: Boolean(sodiumBicarbonateHypertonicAlkalinization),
      classIaAndIcAndAmiodaroneStrictlyProhibited: Boolean(classIaAndIcAndAmiodaroneStrictlyProhibited),
      physostigmineStrictlyProhibited: Boolean(physostigmineStrictlyProhibited),
      intralipid20PercentRescueAlerted: Boolean(intralipid20PercentRescueAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.tcaToxicityCare && incident.markModified('tcaToxicityCare');

    incident.auditTrail.push({
      action: 'TCA_TOXICITY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc TCA Amitriptyline: QRS giãn rộng/Kháng cholinergic=${wideQrsAndAnticholinergicToxidrome}, Kiềm hóa NaHCO3 8.4%=${sodiumBicarbonateHypertonicAlkalinization}, CẤM thuốc chống loạn nhịp nhóm IA/IC/Amiodarone=${classIaAndIcAndAmiodaroneStrictlyProhibited}, CẤM Physostigmine=${physostigmineStrictlyProhibited}, Nhũ dịch Intralipid 20%=${intralipid20PercentRescueAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isTcaToxicity: true,
      wideQrsAndAnticholinergicToxidrome: Boolean(wideQrsAndAnticholinergicToxidrome),
      sodiumBicarbonateHypertonicAlkalinization: Boolean(sodiumBicarbonateHypertonicAlkalinization),
      classIaAndIcAndAmiodaroneStrictlyProhibited: Boolean(classIaAndIcAndAmiodaroneStrictlyProhibited),
      physostigmineStrictlyProhibited: Boolean(physostigmineStrictlyProhibited),
      intralipid20PercentRescueAlerted: Boolean(intralipid20PercentRescueAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN NGỘ ĐỘC THUỐC CHỐNG TRẦM CẢM 3 VÒNG (TCA AMITRIPTYLINE TOXICITY): Ức chế kênh Natri nhanh ở cơ tim gây phức bộ QRS giãn rộng >= 100ms (co giật) hoặc >= 160ms (loạn nhịp thất VT/VF), sóng R ở chuyển đạo aVR >= 3mm kèm triệu chứng kháng Cholinergic mê sảng, đồng tử giãn, tụt huyết áp (${wideQrsAndAnticholinergicToxidrome ? "NGỘ ĐỘC TCA NẶNG NGUY CƠ LOẠN NHỊP THẤT TỬ VONG" : "THEO DÕI"}).`,
        `PHÁC ĐỒ TIÊU CHUẨN VÀNG: KIỀM HÓA MÁU BẰNG NATRI BICARBONATE (NAHCO3 8.4%): Tiêm tĩnh mạch bolus NaHCO3 8.4% liều 1-2 mEq/kg mỗi 3-5 phút cho đến khi QRS hẹp lại < 100ms và duy trì pH máu mục tiêu 7.45 - 7.55 (${sodiumBicarbonateHypertonicAlkalinization ? "ĐÃ KIỀM HÓA BẰNG NAHCO3 8.4% THEO PHÁC ĐỒ" : "CẦN TIÊM BOLUS NAHCO3 NGAY"}). Ion Na+ nồng độ cao cạnh tranh đẩy TCA ra khỏi kênh Natri cơ tim.`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM THUỐC CHỐNG LOẠN NHỊP IA/IC/AMIODARONE & CẤM PHYSOSTIGMINE: Khóa cấm Procainamide/Flecainide/Amiodarone (${classIaAndIcAndAmiodaroneStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH LOẠN NHỊP TRƠ TỬ VONG" : "CỰC KỲ NGUY HIỂM"}), các thuốc này làm tăng độc tính kênh Natri và kéo dài QT gây ngừng tim không hồi phục! Khóa cấm Physostigmine (${physostigmineStrictlyProhibited ? "ĐÃ KHÓA CẤM PHYSOSTIGMINE" : "NGUY HIỂM VÔ TÂM THU ASYSTOLE"}).`,
        `HỒI SỨC SỐC KHÁNG TRỊ & NHŨ DỊCH LIPID 20% (INTRALIPID): Nếu tụt huyết áp và loạn nhịp thất trơ với Bicarbonate và Norepinephrine, khởi động liệu pháp Lipid Rescue bằng Nhũ dịch Lipid 20% bolus 1.5 mL/kg (${intralipid20PercentRescueAlerted ? "SẴN SÀNG INTRALIPID 20% RESCUE" : "THEO DÕI"}); chuyển khẩn cấp ICU Chống độc BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Hội Chứng Thuyên Tắc Ối Tối Cấp & Phác Đồ A-OK (Phân hệ 104)
   */
  async manageAmnioticFluidEmbolism(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      suddenHypoxiaCollapseAndDic = true,
      aOkProtocolAdministered = true,
      fluidOverloadStrictlyProhibited = true,
      delayedPmcdStrictlyProhibited = true,
      massiveTransfusionMtpWithCryoAlerted = true,
      attemptedFluidOverload = false,
      attemptedDelayedPmcd = false,
    } = payload || {};

    if (attemptedFluidOverload) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM bù dịch tinh thể quá tải (Fluid Overload) trong thuyên tắc ối AFE! Thất phải của người mẹ đang bị quá tải áp lực cấp tính và suy sụp do co thắt mạch phổi dữ dội; truyền nhiều dịch sẽ làm thất phải giãn to đè bẹp vách liên thất sang trái (D-shape Septum), triệt tiêu hoàn toàn lưu lượng tim và gây ngừng tuần hoàn tử vong tức khắc!',
      );
    }

    if (attemptedDelayedPmcd) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM trì hoãn phẫu thuật mổ bắt con cấp cứu cứu mẹ (Perimortem Cesarean Delivery - PMCD) khi người mẹ ngừng tuần hoàn quá 4 phút! Việc mổ lấy thai trong vòng 4-5 phút vàng là biện pháp sống còn vừa cứu đứa trẻ vừa giải phóng sự chèn ép tĩnh mạch chủ dưới của tử cung giúp hồi sinh tim phổi cho mẹ!',
      );
    }

    incident.amnioticFluidEmbolismCare = {
      isAmnioticFluidEmbolism: true,
      suddenHypoxiaCollapseAndDic: Boolean(suddenHypoxiaCollapseAndDic),
      aOkProtocolAdministered: Boolean(aOkProtocolAdministered),
      fluidOverloadStrictlyProhibited: Boolean(fluidOverloadStrictlyProhibited),
      delayedPmcdStrictlyProhibited: Boolean(delayedPmcdStrictlyProhibited),
      massiveTransfusionMtpWithCryoAlerted: Boolean(massiveTransfusionMtpWithCryoAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.amnioticFluidEmbolismCare && incident.markModified('amnioticFluidEmbolismCare');

    incident.auditTrail.push({
      action: 'AMNIOTIC_FLUID_EMBOLISM_CARE_RECORDED',
      timestamp: new Date(),
      details: `Thuyên tắc ối AFE: Suy hô hấp/Trụy mạch/DIC=${suddenHypoxiaCollapseAndDic}, Phác đồ A-OK=${aOkProtocolAdministered}, CẤM bù dịch quá tải=${fluidOverloadStrictlyProhibited}, CẤM trì hoãn PMCD 4-5 phút=${delayedPmcdStrictlyProhibited}, MTP truyền máu + Cryo/Fibrinogen=${massiveTransfusionMtpWithCryoAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAmnioticFluidEmbolism: true,
      suddenHypoxiaCollapseAndDic: Boolean(suddenHypoxiaCollapseAndDic),
      aOkProtocolAdministered: Boolean(aOkProtocolAdministered),
      fluidOverloadStrictlyProhibited: Boolean(fluidOverloadStrictlyProhibited),
      delayedPmcdStrictlyProhibited: Boolean(delayedPmcdStrictlyProhibited),
      massiveTransfusionMtpWithCryoAlerted: Boolean(massiveTransfusionMtpWithCryoAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN THUYÊN TẮC ỐI TỐI CẤP (AMNIOTIC FLUID EMBOLISM - AFE): Tai biến sản khoa thảm họa do nước ối lọt vào tuần hoàn người mẹ kích hoạt bão miễn dịch: Tam chứng suy hô hấp đột ngột (Hypoxia) + Tụt HA trụy tuần hoàn suy thất phải cấp + Rối loạn đông máu DIC bùng phát máu chảy xối xả không đông (${suddenHypoxiaCollapseAndDic ? "THUYÊN TẮC ỐI CỰC KỲ NGUY KỊCH TỬ VONG MẸ VÀ CON" : "THEO DÕI"}).`,
        `PHÁC ĐỒ SỐNG CÒN A-OK (ATROPINE - ONDANSETRON - KETOROLAC): Kích hoạt bộ 3 thuốc cấp cứu tĩnh mạch: Atropine 0.2-1mg IV (chặn phản xạ phế vị nhịp chậm) + Ondansetron 8mg IV (ức chế 5-HT3 chống co mạch phổi và phản xạ Bezold-Jarisch) + Ketorolac 15-30mg IV (ức chế Thromboxane A2 chặn bão tắc mạch phổi) (${aOkProtocolAdministered ? "ĐÃ TIÊM PHÁC ĐỒ A-OK CHUẨN QUỐC TẾ" : "CẦN TIÊM BỘ 3 A-OK NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM BÙ DỊCH QUÁ TẢI & CẤM TRÌ HOÃN MỔ CỨU CON CỨU MẸ PMCD 4 PHÚT: Khóa cấm bù dịch quá mức (${fluidOverloadStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BẸP THẤT TRÁI" : "CỰC KỲ NGUY HIỂM SUY THẤT PHẢI CẤP"}), thất phải đang giãn to quá tải áp lực, truyền nhiều dịch làm ngừng tim ngay! Khóa cấm hoãn mổ PMCD (${delayedPmcdStrictlyProhibited ? "ĐÃ KHÓA CẤM HOÃN PMCD TRONG 4-5 PHÚT VÀNG" : "NGUY HIỂM TỬ VONG CẢ HAI"}).`,
        `HỒI SỨC ĐÔNG MÁU NỘI MẠCH RẢI RÁC (DIC) & MTP TỶ LỆ 1:1:1: Kích hoạt quy trình truyền máu ồ ạt MTP kèm Tủa lạnh Cryoprecipitate, Fibrinogen cô đặc bù đắp tiêu thụ yếu tố đông máu và Tranexamic Acid TXA 1g IV (${massiveTransfusionMtpWithCryoAlerted ? "KÍP TRUYỀN MÁU MTP & CRYO SẴN SÀNG" : "CHỜ BÁO ĐỘNG"}); chuyển Bệnh viện Từ Dũ / BV Chợ Rẫy / BV 115 sẵn sàng ECMO hỗ trợ tuần hoàn ngoài cơ thể.`,
      ],
    };
  }

  /**
   * Cấp Cứu Hội Chứng Hít Phân Su Sơ Sinh Tối Cấp & Thở Máy Rung Cao Tần / Surfactant (Phân hệ 105)
   */
  async manageMeconiumAspiration(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      peaSoupMeconiumAndSevereDistress = true,
      surfactantAndHfovAdministered = true,
      routineDeepSuctioningStrictlyProhibited = true,
      uncontrolledHighPressureBaggingStrictlyProhibited = true,
      inhaledNitricOxideAndEcmoAlerted = true,
      attemptedRoutineDeepSuctioning = false,
      attemptedHighPressureBagging = false,
    } = payload || {};

    if (attemptedRoutineDeepSuctioning) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM hút đàm nhớt sâu qua khí quản thường quy (Routine Deep Endotracheal Suctioning) khi trẻ đã khóc và thở! Theo phác đồ NRP mới nhất, việc cố luồn ống hút sâu vào khí quản ở trẻ có trương lực cơ sẽ kích thích dữ dội phản xạ phế vị gây chậm nhịp tim kịch phát, co thắt thanh quản, chấn thương dây thanh âm và thiếu oxy não cấp tính!',
      );
    }

    if (attemptedHighPressureBagging) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM bóp bóng áp lực cao bừa bãi khi chưa giải áp bẫy khí (Overzealous High-Pressure Bagging)! Cơ chế van 1 chiều của nút nhầy phân su làm khí vào được nhưng không ra được; bóp bóng áp lực cao liên tục không kiểm soát áp lực đỉnh PIP sẽ xé rách toạc phế nang gây Tràn khí màng phổi áp lực cao (Tension Pneumothorax) đè bẹp tim phổi làm trẻ ngừng tuần hoàn ngay tức thì!',
      );
    }

    incident.meconiumAspirationCare = {
      isMeconiumAspiration: true,
      peaSoupMeconiumAndSevereDistress: Boolean(peaSoupMeconiumAndSevereDistress),
      surfactantAndHfovAdministered: Boolean(surfactantAndHfovAdministered),
      routineDeepSuctioningStrictlyProhibited: Boolean(routineDeepSuctioningStrictlyProhibited),
      uncontrolledHighPressureBaggingStrictlyProhibited: Boolean(uncontrolledHighPressureBaggingStrictlyProhibited),
      inhaledNitricOxideAndEcmoAlerted: Boolean(inhaledNitricOxideAndEcmoAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.meconiumAspirationCare && incident.markModified('meconiumAspirationCare');

    incident.auditTrail.push({
      action: 'MECONIUM_ASPIRATION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hít phân su sơ sinh MAS: Ối sệt pea-soup/Ngạt thở=${peaSoupMeconiumAndSevereDistress}, HFOV + Surfactant=${surfactantAndHfovAdministered}, CẤM hút sâu mò mẫm khi trẻ thở=${routineDeepSuctioningStrictlyProhibited}, CẤM bóp bóng áp lực cao=${uncontrolledHighPressureBaggingStrictlyProhibited}, iNO 20ppm + NICU ECMO=${inhaledNitricOxideAndEcmoAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isMeconiumAspiration: true,
      peaSoupMeconiumAndSevereDistress: Boolean(peaSoupMeconiumAndSevereDistress),
      surfactantAndHfovAdministered: Boolean(surfactantAndHfovAdministered),
      routineDeepSuctioningStrictlyProhibited: Boolean(routineDeepSuctioningStrictlyProhibited),
      uncontrolledHighPressureBaggingStrictlyProhibited: Boolean(uncontrolledHighPressureBaggingStrictlyProhibited),
      inhaledNitricOxideAndEcmoAlerted: Boolean(inhaledNitricOxideAndEcmoAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN HỘI CHỨNG HÍT PHÂN SU SƠ SINH TỐI CẤP (MECONIUM ASPIRATION SYNDROME - MAS): Trẻ sơ sinh ra đời nước ối lẫn phân su sệt (pea-soup meconium), tắc nghẽn cơ học đường thở nhỏ tạo bẫy khí phế nang, bất hoạt surfactant và tăng áp lực động mạch phổi tồn tại dai dẳng sơ sinh (PPHN) (${peaSoupMeconiumAndSevereDistress ? "NGUY CƠ SUY HÔ HẤP DỘI NGƯỢC NẶNG" : "THEO DÕI"}).`,
        `KỸ THUẬT TIÊU CHUẨN VÀNG: THỞ MÁY RUNG CAO TẦN (HFOV) & BƠM SURFACTANT NGOẠI SINH: Áp dụng thở máy HFOV tần số 10-15 Hz với thể tích lưu thông nhỏ giúp giải bẫy khí và chống chấn thương áp lực phổi (Barotrauma); bơm Surfactant ngoại sinh liều 100-200 mg/kg nội khí quản thay thế surfactant bị hủy hoại (${surfactantAndHfovAdministered ? "ĐÃ THỰC HIỆN HFOV VÀ BƠM SURFACTANT CHUẨN" : "CẦN TRIỂN KHAI HFOV NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM HÚT KHÍ QUẢN SÂU KHI TRẺ ĐÃ THỞ & CẤM BÓP BÓNG ÁP LỰC CAO: Khóa an toàn cấm hút sâu mù quáng (${routineDeepSuctioningStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH CHẬM TIM LIỆT HÔ HẤP" : "CỰC KỲ NGUY HIỂM"}), cấm bóp bóng áp lực cao (${uncontrolledHighPressureBaggingStrictlyProhibited ? "ĐÃ KHÓA TRÁNH TRÀN KHÍ MÀNG PHỔI ÁP LỰC" : "NGUY HIỂM VỠ PHẾ NANG"}).`,
        `KIỂM SOÁT TĂNG ÁP PHỔI PPHN & VA-ECMO SƠ SINH: Kích hoạt khí thở giãn mạch phổi chọn lọc iNO 20 ppm để hạ áp lực động mạch phổi và đóng shunt phải - trái; sẵn sàng hệ thống tuần hoàn ngoài cơ thể ECMO Sơ sinh (${inhaledNitricOxideAndEcmoAlerted ? "SẴN SÀNG iNO VÀ KÍP NICU LEVEL IV" : "CHỜ BÁO ĐỘNG"}); chuyển Bệnh viện Nhi Đồng 1 / BV Nhi Đồng 2 / BV Từ Dũ.`,
      ],
    };
  }

  /**
   * Cấp Cứu Ngộ Độc Methemoglobinemia Tối Cấp & Phác Đồ Methylene Blue 1-2 mg/kg (Phân hệ 106)
   */
  async manageMethemoglobinemia(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      refractoryCyanosisAndChocolateBlood = true,
      methyleneBlueAdministered = true,
      methyleneBlueInG6pdDeficiencyStrictlyProhibited = true,
      excessiveMethyleneBlueOver7mgStrictlyProhibited = true,
      ascorbicAcidAndExchangeTransfusionAlerted = true,
      attemptedMethyleneBlueInG6pdDeficiency = false,
      attemptedExcessiveMethyleneBlue = false,
    } = payload || {};

    if (attemptedMethyleneBlueInG6pdDeficiency) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM tiêm Xanh Methylen (Methylene Blue) ở bệnh nhân thiếu men G6PD (Glucose-6-Phosphate Dehydrogenase Deficiency)! Ở người thiếu G6PD, tế bào hồng cầu không sản xuất đủ NADPH để khử Xanh methylen; khi tiêm vào, Xanh methylen sẽ đóng vai trò như một chất oxy hóa cực mạnh kích hoạt cơn Tan máu nội mạch ồ ạt (Massive Intravascular Hemolysis) gây suy thận cấp vô niệu và trụy tim mạch tử vong tức thì! Trường hợp này bắt buộc dùng Axit Ascorbic liều cao hoặc thay máu toàn phần!',
      );
    }

    if (attemptedExcessiveMethyleneBlue) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng quá liều Xanh Methylen tích lũy vượt quá 7 mg/kg! Liều cao tích lũy sẽ gây tác dụng nghịch lý (Paradoxical Methemoglobinemia) làm oxy hóa ngược Hemoglobin tạo thêm MetHb, đồng thời gây ức chế dẫn truyền cơ tim, co thắt mạch vành và hội chứng bão Serotonin thần kinh nguy hiểm tính mạng!',
      );
    }

    incident.methemoglobinemiaCare = {
      isMethemoglobinemia: true,
      refractoryCyanosisAndChocolateBlood: Boolean(refractoryCyanosisAndChocolateBlood),
      methyleneBlueAdministered: Boolean(methyleneBlueAdministered),
      methyleneBlueInG6pdDeficiencyStrictlyProhibited: Boolean(methyleneBlueInG6pdDeficiencyStrictlyProhibited),
      excessiveMethyleneBlueOver7mgStrictlyProhibited: Boolean(excessiveMethyleneBlueOver7mgStrictlyProhibited),
      ascorbicAcidAndExchangeTransfusionAlerted: Boolean(ascorbicAcidAndExchangeTransfusionAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.methemoglobinemiaCare && incident.markModified('methemoglobinemiaCare');

    incident.auditTrail.push({
      action: 'METHEMOGLOBINEMIA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Methemoglobinemia: Tím tái kháng trị/Máu socola=${refractoryCyanosisAndChocolateBlood}, Xanh Methylen 1% 1-2mg/kg=${methyleneBlueAdministered}, CẤM Xanh Methylen ở thiếu G6PD=${methyleneBlueInG6pdDeficiencyStrictlyProhibited}, CẤM liều tích lũy > 7mg/kg=${excessiveMethyleneBlueOver7mgStrictlyProhibited}, Vitamin C + Thay máu=${ascorbicAcidAndExchangeTransfusionAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isMethemoglobinemia: true,
      refractoryCyanosisAndChocolateBlood: Boolean(refractoryCyanosisAndChocolateBlood),
      methyleneBlueAdministered: Boolean(methyleneBlueAdministered),
      methyleneBlueInG6pdDeficiencyStrictlyProhibited: Boolean(methyleneBlueInG6pdDeficiencyStrictlyProhibited),
      excessiveMethyleneBlueOver7mgStrictlyProhibited: Boolean(excessiveMethyleneBlueOver7mgStrictlyProhibited),
      ascorbicAcidAndExchangeTransfusionAlerted: Boolean(ascorbicAcidAndExchangeTransfusionAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN NGỘ ĐỘC METHEMOGLOBINEMIA TỐI CẤP DO HÓA CHẤT / THUỐC: Bệnh nhân tiếp xúc Nitrit, Anilin, thuốc trừ sâu hoặc Dapsone bị tím tái toàn thân không đáp ứng thở oxy 100%, máu tĩnh mạch rút ra có màu socola sẫm không đổi màu, SpO2 xung mạch kẹt quanh mức 85% do bước sóng kép (${refractoryCyanosisAndChocolateBlood ? "NGỘ ĐỘC METHEMOGLOBINEMIA NẶNG NGUY KỊCH TÍNH MẠNG" : "THEO DÕI"}).`,
        `THUỐC GIẢI ĐỘC ĐẶC HIỆU TIÊU CHUẨN VÀNG: XANH METHYLEN (METHYLENE BLUE 1%): Tiêm tĩnh mạch chậm dung dịch Xanh Methylen 1% với liều 1-2 mg/kg (0.1-0.2 mL/kg) trong 5-10 phút để kích hoạt men NADPH-MetHb reductase khử Fe3+ về Fe2+ (${methyleneBlueAdministered ? "ĐÃ DÙNG XANH METHYLEN ĐÚNG PHÁC ĐỒ" : "CẦN TIÊM XANH METHYLEN NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI XANH METHYLEN Ở BỆNH NHÂN THIẾU MEN G6PD: Khóa cấm dùng ở người thiếu men G6PD (${methyleneBlueInG6pdDeficiencyStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH TAN MÁU NỘI MẠCH TỬ VONG" : "CỰC KỲ NGUY HIỂM"}), nếu tiêm vào sẽ gây tan máu bùng phát và suy thận cấp! Khóa cấm quá liều tích lũy > 7 mg/kg (${excessiveMethyleneBlueOver7mgStrictlyProhibited ? "ĐÃ KHÓA CẤM LIỀU CAO TRÁNH TẠO THÊM MetHb" : "NGUY HIỂM ĐỘC TÍNH TIM MẠCH"}).`,
        `PHÁC ĐỒ THAY THẾ CHO BỆNH NHÂN THIẾU G6PD & THAY MÁU TOÀN PHẦN CẤP CỨU: Khi bệnh nhân thiếu men G6PD hoặc ngộ độc kháng trị, sử dụng Vitamin C Axit Ascorbic liều cao 1-2g IV hoặc kích hoạt kíp lọc máu / thay máu toàn phần khẩn cấp (${ascorbicAcidAndExchangeTransfusionAlerted ? "PHÁC ĐỒ VITAMIN C VÀ THAY MÁU SẴN SÀNG" : "CHỜ CHỈ ĐỊNH"}); chuyển Trung tâm Chống độc BV Chợ Rẫy / BV 115 / BV Nhi Đồng 1.`,
      ],
    };
  }

  /**
   * Cấp Cứu Vỡ Túi Phình Động Mạch Tạng Tối Cấp & Can Thiệp Nút Mạch DSA / Stent-Graft (Phân hệ 107)
   */
  async manageVisceralAneurysm(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      doubleRupturePhenomenonIdentified = true,
      permissiveHypotensionAndMtpActivated = true,
      forcefulEpigastricPalpationStrictlyProhibited = true,
      fluidOverloadSbpOver100StrictlyProhibited = true,
      dsaCoilEmbolizationOrStentAlerted = true,
      attemptedForcefulEpigastricPalpation = false,
      attemptedFluidOverloadSbpOver100 = false,
    } = payload || {};

    if (attemptedForcefulEpigastricPalpation) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM ấn nắn thô bạo vùng thượng vị hoặc chọc hút mò vào khối máu tụ mạc nối! Trong vỡ túi phình động mạch lách/gan, khối máu tụ hậu cung mạc nối (lesser sac) đang đóng vai trò nút chặn cầm máu tạm thời ở Thì 1; thao tác ấn chẩn mạnh hoặc chọc dò mò sẽ làm bục toác thì 2 (Free Peritoneal Rupture), xả hàng lít máu ồ ạt vào toàn bộ ổ phúc mạc làm huyết áp tụt dốc không phanh tử vong ngay tại chỗ!',
      );
    }

    if (attemptedFluidOverloadSbpOver100) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM bù dịch tinh thể quá tải nâng huyết áp tâm thu SBP > 100 mmHg trước can thiệp nút mạch! Áp lực dòng máu dâng cao kết hợp với việc pha loãng yếu tố đông máu và hạ thân nhiệt sẽ làm bung bật nút đông máu mong manh tại cổ túi phình (Pop-the-clot phenomenon), gây tái xuất huyết xối xả không thể cầm được!',
      );
    }

    incident.visceralAneurysmCare = {
      isVisceralAneurysm: true,
      doubleRupturePhenomenonIdentified: Boolean(doubleRupturePhenomenonIdentified),
      permissiveHypotensionAndMtpActivated: Boolean(permissiveHypotensionAndMtpActivated),
      forcefulEpigastricPalpationStrictlyProhibited: Boolean(forcefulEpigastricPalpationStrictlyProhibited),
      fluidOverloadSbpOver100StrictlyProhibited: Boolean(fluidOverloadSbpOver100StrictlyProhibited),
      dsaCoilEmbolizationOrStentAlerted: Boolean(dsaCoilEmbolizationOrStentAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.visceralAneurysmCare && incident.markModified('visceralAneurysmCare');

    incident.auditTrail.push({
      action: 'VISCERAL_ANEURYSM_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ túi phình ĐM tạng: Vỡ 2 thì lách/gan=${doubleRupturePhenomenonIdentified}, DCR HA 80-90 + MTP/TXA=${permissiveHypotensionAndMtpActivated}, CẤM ấn nắn thượng vị thô bạo=${forcefulEpigastricPalpationStrictlyProhibited}, CẤM bù dịch SBP>100=${fluidOverloadSbpOver100StrictlyProhibited}, DSA Coiling sandwich/Stent-graft=${dsaCoilEmbolizationOrStentAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isVisceralAneurysm: true,
      doubleRupturePhenomenonIdentified: Boolean(doubleRupturePhenomenonIdentified),
      permissiveHypotensionAndMtpActivated: Boolean(permissiveHypotensionAndMtpActivated),
      forcefulEpigastricPalpationStrictlyProhibited: Boolean(forcefulEpigastricPalpationStrictlyProhibited),
      fluidOverloadSbpOver100StrictlyProhibited: Boolean(fluidOverloadSbpOver100StrictlyProhibited),
      dsaCoilEmbolizationOrStentAlerted: Boolean(dsaCoilEmbolizationOrStentAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN VỠ TÚI PHÌNH ĐỘNG MẠCH TẠNG TỐI CẤP (VISCERAL ARTERY ANEURYSM RUPTURE): Thường gặp túi phình ĐM lách (ở thai phụ quý 3 hoặc xơ gan) hoặc ĐM gan vỡ theo hiện tượng "Vỡ hai thì" kinh điển: Thì 1 máu chảy vào hậu cung mạc nối tạm thời -> Thì 2 vỡ toạc vào ổ bụng tự do gây sốc mất máu trụy mạch sụp đổ (${doubleRupturePhenomenonIdentified ? "CẢNH BÁO NGUY CƠ BÙNG PHÁT VỠ THÌ HAI TỬ VONG" : "THEO DÕI"}).`,
        `HỒI SỨC KIỂM SOÁT TỔN THƯƠNG (DCR) & HẠ HUYẾT ÁP CHỈ HUY (PERMISSIVE HYPOTENSION): Duy trì huyết áp tâm thu SBP 80-90 mmHg để bảo vệ cục máu đông non; kích hoạt quy trình truyền máu khối lượng lớn MTP tỷ lệ 1:1:1 và Tranexamic Acid TXA 1g IV (${permissiveHypotensionAndMtpActivated ? "ĐÃ THIẾT LẬP DCR VÀ MTP 1:1:1" : "CẦN HỒI SỨC DCR NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM ẤN NẮN THƯỢNG VỊ THÔ BẠO & CẤM BÙ DỊCH QUÁ TẢI SBP > 100 mmHg: Khóa an toàn cấm ấn nắn chọc dò mò (${forcefulEpigastricPalpationStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH VỠ TOÁC THÌ HAI KHỐI MÁU TỤ" : "CỰC KỲ NGUY HIỂM"}), khóa cấm bù dịch quá mức (${fluidOverloadSbpOver100StrictlyProhibited ? "ĐÃ KHÓA TRÁNH THỔI BAY CỤC MÁU ĐÔNG" : "NGUY HIỂM XUẤT HUYẾT TÁI PHÁT"}).`,
        `CAN THIỆP NÚT MẠCH QUA ỐNG THÔNG (DSA TAE) & STENT-GRAFT NỘI MẠCH: Chuyển thẳng phòng can thiệp mạch DSA / Hybrid OR để nút mạch sandwich chặn trước sau cổ túi phình bằng Coils hoặc thả Stent-graft có màng bọc phủ kín lỗ vỡ (${dsaCoilEmbolizationOrStentAlerted ? "PHÒNG DSA HYBRID VÀ NGOẠI MẠCH MÁU SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển BV Chợ Rẫy / BV Bình Dân / BV 115 / BV Từ Dũ.`,
      ],
    };
  }

  /**
   * Cấp Cứu Cơn Hạ Canxi Máu Tối Cấp Kèm Co Thắt Thanh Quản & Dấu Hiệu Trousseau (Phân hệ 108)
   */
  async manageAcuteHypocalcemia(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      tetanyStridorAndProlongedQtc = true,
      slowIvCalciumGluconateAdministered = true,
      rapidPeripheralCalciumChlorideStrictlyProhibited = true,
      coInfusionWithPhosphateOrBicarbonateStrictlyProhibited = true,
      concurrentMagnesiumSulfateAlerted = true,
      attemptedRapidPeripheralCalciumChloride = false,
      attemptedCoInfusionWithPhosphateOrBicarbonate = false,
    } = payload || {};

    if (attemptedRapidPeripheralCalciumChloride) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM tiêm tĩnh mạch nhanh Calcium Chloride 10% qua đường ngoại vi thông thường! Calcium Chloride có độ thẩm thấu cực cao (~2040 mOsm/L); thoát mạch dù chỉ vài giọt cũng gây bỏng cháy, hoại tử bong tróc toàn bộ mô cơ sâu (Severe Extravasation Tissue Necrosis) phải cắt cụt chi; đồng thời tiêm IV nhanh làm tăng canxi cơ tim đột ngột gây nhịp chậm xoang sâu, rung thất và ngừng tim vô tâm thu (Asystole) tức thì! Bắt buộc dùng Calcium Gluconate 10% tiêm truyền chậm trong 10-20 phút!',
      );
    }

    if (attemptedCoInfusionWithPhosphateOrBicarbonate) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM tiêm chung Calci với dung dịch chứa Phosphat hoặc Natri Bicarbonate trong cùng một đường truyền tĩnh mạch! Canxi sẽ phản ứng tức thì với Bicarbonate/Phosphat tạo thành muối kết tủa Canxi Carbonat / Canxi Phosphat màu trắng đục không tan, gây tắc kim, đông vón catheter và nếu lọt vào tuần hoàn sẽ gây thuyên tắc vi mạch phổi (Pulmonary Microembolism) dẫn đến suy hô hấp và suy tim cấp tử vong!',
      );
    }

    incident.acuteHypocalcemiaCare = {
      isAcuteHypocalcemia: true,
      tetanyStridorAndProlongedQtc: Boolean(tetanyStridorAndProlongedQtc),
      slowIvCalciumGluconateAdministered: Boolean(slowIvCalciumGluconateAdministered),
      rapidPeripheralCalciumChlorideStrictlyProhibited: Boolean(rapidPeripheralCalciumChlorideStrictlyProhibited),
      coInfusionWithPhosphateOrBicarbonateStrictlyProhibited: Boolean(coInfusionWithPhosphateOrBicarbonateStrictlyProhibited),
      concurrentMagnesiumSulfateAlerted: Boolean(concurrentMagnesiumSulfateAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.acuteHypocalcemiaCare && incident.markModified('acuteHypocalcemiaCare');

    incident.auditTrail.push({
      action: 'ACUTE_HYPOCALCEMIA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hạ canxi máu tối cấp: Tetany/Stridor thanh quản/QTc kéo dài=${tetanyStridorAndProlongedQtc}, Calcium Gluconate 10% tiêm chậm=${slowIvCalciumGluconateAdministered}, CẤM tiêm nhanh Calcium Chloride ngoại vi=${rapidPeripheralCalciumChlorideStrictlyProhibited}, CẤM tiêm chung Bicarbonate/Phosphat=${coInfusionWithPhosphateOrBicarbonateStrictlyProhibited}, Bù Magie Sulfat 1-2g IV=${concurrentMagnesiumSulfateAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAcuteHypocalcemia: true,
      tetanyStridorAndProlongedQtc: Boolean(tetanyStridorAndProlongedQtc),
      slowIvCalciumGluconateAdministered: Boolean(slowIvCalciumGluconateAdministered),
      rapidPeripheralCalciumChlorideStrictlyProhibited: Boolean(rapidPeripheralCalciumChlorideStrictlyProhibited),
      coInfusionWithPhosphateOrBicarbonateStrictlyProhibited: Boolean(coInfusionWithPhosphateOrBicarbonateStrictlyProhibited),
      concurrentMagnesiumSulfateAlerted: Boolean(concurrentMagnesiumSulfateAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN CƠN HẠ CANXI MÁU TỐI CẤP (ACUTE HYPOCALCEMIA TETANY & STRIDOR): Biến chứng sau cắt giáp, viêm tụy cấp hoặc truyền máu ồ ạt chứa Citrate: Dấu hiệu Trousseau bàn tay người đỡ đẻ, Chvostek cơ mặt, co thắt thanh quản Stridor gây ngạt thở kịch phát và điện tim khoảng QTc kéo dài nguy cơ xoắn đỉnh TdP rung thất (${tetanyStridorAndProlongedQtc ? "CƠN TETANY NGUY KỊCH TÍNH MẠNG" : "THEO DÕI"}).`,
        `KỸ THUẬT TIÊU CHUẨN VÀNG: CALCIUM GLUCONATE 10% TIÊM TRUYỀN TĨNH MẠCH CHẬM: Tiêm truyền IV chậm 10-20 mL Calcium Gluconate 10% pha loãng trong 50-100 mL Glucose 5% trong 10-20 phút dưới máy theo dõi monitor ECG liên tục; duy trì truyền liên tục 0.5-1.5 mg/kg/h (${slowIvCalciumGluconateAdministered ? "ĐÃ TIÊM TRUYỀN CALCIUM GLUCONATE CHẬM AN TOÀN" : "CẦN TIÊM CALCIUM GLUCONATE NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM TIÊM NHANH CALCIUM CHLORIDE NGOẠI VI & CẤM TIÊM CHUNG BICARBONATE: Khóa cấm tiêm nhanh Calcium Chloride ngoại vi (${rapidPeripheralCalciumChlorideStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH HOẠI TỬ MÔ SÂU VÀ NGỪNG TIM" : "CỰC KỲ NGUY HIỂM"}), khóa cấm tiêm chung đường truyền với Bicarbonate/Phosphat (${coInfusionWithPhosphateOrBicarbonateStrictlyProhibited ? "ĐÃ KHÓA TRÁNH KẾT TỦA TẮC MẠCH PHỔI" : "NGUY HIỂM KẾT TỦA CẶN TRẮNG"}).`,
        `BÙ ĐỒNG THỜI MAGNESIUM SULFATE 1-2g IV CHỐNG TRƠ THỤ THỂ PTH: Phải luôn kiểm tra và tiêm bù Magie Sulfat 1-2g IV vì thiếu Magie máu sẽ gây trơ hoàn toàn thụ thể của hoóc-môn PTH khiến hạ canxi máu không thể điều chỉnh được (${concurrentMagnesiumSulfateAlerted ? "ĐÃ KẾT HỢP BÙ MAGIE VÀ DUY TRÌ TRUYỀN CANXI" : "CẦN BÙ MAGIE SULFATE"}); chuyển ICU BV Chợ Rẫy / BV 115 / BV Bình Dân.`,
      ],
    };
  }

  /**
   * Cấp Cứu Sốc Phản Vệ Tối Cấp Do Thuốc Cản Quang Chứa Iod & Phác Đồ Adrenaline IM (Phân hệ 109)
   */
  async manageContrastAnaphylaxis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      iodinatedContrastAdministeredWithCirculatoryCollapse = true,
      adrenalineImAnterolateralThighAdministered = true,
      unalteredPureAdrenalineIvStrictlyProhibited = true,
      antihistamineSteroidDelayStrictlyProhibited = true,
      massiveIsotonicVolumeExpansionAlerted = true,
      attemptedUnalteredPureAdrenalineIv = false,
      attemptedAntihistamineSteroidDelay = false,
    } = payload || {};

    if (attemptedUnalteredPureAdrenalineIv) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM tiêm tĩnh mạch trực tiếp Adrenaline ống nguyên chất 1:1,000 (1mg/mL) không pha loãng! Tiêm IV trực tiếp Adrenaline đậm đặc sẽ gây cơn tăng huyết áp kịch phát làm vỡ toạc phình mạch não (Xuất huyết nội sọ bùng phát), bóc tách động mạch chủ, co thắt tiểu động mạch vành gây hoại tử cơ tim cấp tính và kích phát rung thất (Ventricular Fibrillation) ngừng tim tử vong ngay tức khắc! Chỉ được tiêm bắp (IM) mặt trước-ngoài đùi liều 0.5mg (1:1,000); đường tĩnh mạch chỉ dùng khi đã pha loãng 1:10,000 hoặc truyền qua bơm tiêm điện có monitor chuyên sâu!',
      );
    }

    if (attemptedAntihistamineSteroidDelay) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng Kháng Histamin hoặc Corticoid (Hydrocortisone/Methylprednisolone) để thay thế cho Adrenaline trong sốc phản vệ tối cấp! Kháng Histamin và Steroid có khởi phát tác dụng rất chậm (từ 30 phút đến 4-6 giờ sau) và hoàn toàn KHÔNG CÓ TÁC DỤNG nâng huyết áp hay chống phù thanh quản cấp cứu. Việc chần chừ tìm ven truyền Corticoid mà không tiêm bắp Adrenaline ngay mặt ngoài đùi là nguyên nhân hàng đầu khiến bệnh nhân tắc đường thở và ngừng tim không hồi phục!',
      );
    }

    incident.severeContrastAnaphylaxisCare = {
      isSevereContrastAnaphylaxis: true,
      iodinatedContrastAdministeredWithCirculatoryCollapse: Boolean(iodinatedContrastAdministeredWithCirculatoryCollapse),
      adrenalineImAnterolateralThighAdministered: Boolean(adrenalineImAnterolateralThighAdministered),
      unalteredPureAdrenalineIvStrictlyProhibited: Boolean(unalteredPureAdrenalineIvStrictlyProhibited),
      antihistamineSteroidDelayStrictlyProhibited: Boolean(antihistamineSteroidDelayStrictlyProhibited),
      massiveIsotonicVolumeExpansionAlerted: Boolean(massiveIsotonicVolumeExpansionAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.severeContrastAnaphylaxisCare && incident.markModified('severeContrastAnaphylaxisCare');

    incident.auditTrail.push({
      action: 'CONTRAST_ANAPHYLAXIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Sốc phản vệ cản quang iod: Trụy tuần hoàn/phù Quincke=${iodinatedContrastAdministeredWithCirculatoryCollapse}, Adrenaline IM mặt ngoài đùi=${adrenalineImAnterolateralThighAdministered}, CẤM tiêm IV trực tiếp Adrenaline đậm đặc=${unalteredPureAdrenalineIvStrictlyProhibited}, CẤM dùng Kháng histamin/Steroid thay thế Adrenaline=${antihistamineSteroidDelayStrictlyProhibited}, Bolus dịch tinh thể 1-2L + khí dung Budesonide=${massiveIsotonicVolumeExpansionAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isSevereContrastAnaphylaxis: true,
      iodinatedContrastAdministeredWithCirculatoryCollapse: Boolean(iodinatedContrastAdministeredWithCirculatoryCollapse),
      adrenalineImAnterolateralThighAdministered: Boolean(adrenalineImAnterolateralThighAdministered),
      unalteredPureAdrenalineIvStrictlyProhibited: Boolean(unalteredPureAdrenalineIvStrictlyProhibited),
      antihistamineSteroidDelayStrictlyProhibited: Boolean(antihistamineSteroidDelayStrictlyProhibited),
      massiveIsotonicVolumeExpansionAlerted: Boolean(massiveIsotonicVolumeExpansionAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN SỐC PHẢN VỆ TỐI CẤP DO THUỐC CẢN QUANG CHỨA IOD (CONTRAST-INDUCED ANAPHYLAXIS): Sốc phản vệ độ III/IV bùng phát tức thì sau tiêm cản quang CT/DSA: Huyết áp tâm thu SBP tụt sâu < 70 mmHg, mạch nhanh nhỏ khó bắt, thở rít phù Quincke tắc nghẽn thanh môn (${iodinatedContrastAdministeredWithCirculatoryCollapse ? "TRỤY TUẦN HOÀN & NGUY CƠ TẮC ĐƯỜNG THỞ TỐI CẤP" : "THEO DÕI"}).`,
        `TIÊU CHUẨN VÀNG CỨU MẠNG: ADRENALINE TIÊM BẮP (IM) MẶT TRƯỚC-NGOÀI 1/3 GIỮA ĐÙI: Tiêm bắp ngay lập tức Adrenaline 1:1,000 liều 0.5mg (người lớn) hoặc 0.01 mg/kg (trẻ em) tại mặt trước-ngoài đùi (vùng hấp thu nhanh nhất đạt đỉnh 8 phút); lặp lại mỗi 5-10 phút nếu huyết áp chưa phục hồi (${adrenalineImAnterolateralThighAdministered ? "ĐÃ TIÊM BẮP ADRENALINE ĐÚNG VỊ TRÍ VÀ THỜI GIAN VÀNG" : "TIÊM BẮP ADRENALINE NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM TIÊM IV ADRENALINE ĐẬM ĐẶC & CẤM THAY THẾ BẰNG CORTICOID: Khóa cấm tiêm IV trực tiếp Adrenaline 1:1,000 không pha loãng (${unalteredPureAdrenalineIvStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH RUNG THẤT VÀ XUẤT HUYẾT NÃO" : "CỰC KỲ NGUY HIỂM"}), khóa cấm trì hoãn Adrenaline để chờ truyền Corticoid/Kháng Histamin (${antihistamineSteroidDelayStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN KHÔNG LÀM MẤT THỜI GIAN VÀNG CẤP CỨU" : "NGUY HIỂM TẮC ĐƯỜNG THỞ TỬ VONG"}).`,
        `HỒI SỨC THỂ TÍCH MẢNG LỚN & KHÍ DUNG GIÃN PHẾ QUẢN: Đặt 2 đường truyền ngoại vi cỡ lớn (14-16G), bolus nhanh 1-2 lít dung dịch tinh thể đẳng trương bù trừ thoát huyết tương; phối hợp khí dung Salbutamol + Budesonide (${massiveIsotonicVolumeExpansionAlerted ? "ĐÃ THIẾT LẬP BÙ THỂ TÍCH VÀ KHÍ DUNG ĐƯỜNG THỞ" : "CẦN LẬP ĐƯỜNG TRUYỀN LỚN"}); chuyển ICU BV Chợ Rẫy / BV 115 / BV Quân Y 175.`,
      ],
    };
  }

  /**
   * Cấp Cứu Chấn Thương Vỡ Toác Khung Chậu Mất Vững & Cố Định Khẩn Cấp Pelvic Binder (Phân hệ 110)
   */
  async managePelvicFracture(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      openBookOrVerticalShearFractureIdentified = true,
      pelvicBinderAtGreaterTrochantersApplied = true,
      highPlacementAtIliacCrestsStrictlyProhibited = true,
      repetitiveLogRollPelvicSpringingStrictlyProhibited = true,
      damageControlResuscitationAndAngioAlerted = true,
      attemptedHighPlacementAtIliacCrests = false,
      attemptedRepetitiveLogRollPelvicSpringing = false,
    } = payload || {};

    if (attemptedHighPlacementAtIliacCrests) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM đặt đai nẹp cố định khung chậu cao ở vị trí mào chậu (Iliac Crests)! Mào chậu nằm phía trên khớp mu và khớp háng; khi siết đai tại mào chậu sẽ tạo hiệu ứng đòn bẩy nghịch lý (fulcrum effect) bửa rộng toác thêm đáy khung chậu, làm rách nát mạng tĩnh mạch chậu trước cùng và các nhánh động mạch chậu trong, dẫn đến xả máu ồ ạt vào khoang sau phúc mạc gây tử vong tức thì! Bắt buộc đặt đai nẹp chính xác ngang hai Mấu chuyển lớn xương đùi (Greater Trochanters)!',
      );
    }

    if (attemptedRepetitiveLogRollPelvicSpringing) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM lật trở bệnh nhân liên tục (repetitive log-roll) hoặc ấn lắc thử độ vững của khung chậu nhiều lần (springing the pelvis)! Khoang sau phúc mạc sau khi vỡ chậu đang hình thành cục máu đông non bít kín màng tĩnh mạch bị rách; bất kỳ động tác lật lắc thô bạo nào cũng sẽ xé toạc cục máu đông non, tái phát xuất huyết nội ồ ạt mất bù không thể kiểm soát!',
      );
    }

    incident.unstablePelvicFractureCare = {
      isUnstablePelvicFracture: true,
      openBookOrVerticalShearFractureIdentified: Boolean(openBookOrVerticalShearFractureIdentified),
      pelvicBinderAtGreaterTrochantersApplied: Boolean(pelvicBinderAtGreaterTrochantersApplied),
      highPlacementAtIliacCrestsStrictlyProhibited: Boolean(highPlacementAtIliacCrestsStrictlyProhibited),
      repetitiveLogRollPelvicSpringingStrictlyProhibited: Boolean(repetitiveLogRollPelvicSpringingStrictlyProhibited),
      damageControlResuscitationAndAngioAlerted: Boolean(damageControlResuscitationAndAngioAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.unstablePelvicFractureCare && incident.markModified('unstablePelvicFractureCare');

    incident.auditTrail.push({
      action: 'PELVIC_FRACTURE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vỡ khung chậu mất vững: Thể vỡ cuốn sách mở/trượt đứng=${openBookOrVerticalShearFractureIdentified}, Đai nẹp chậu ngang mấu chuyển lớn=${pelvicBinderAtGreaterTrochantersApplied}, CẤM đặt đai cao mào chậu=${highPlacementAtIliacCrestsStrictlyProhibited}, CẤM lật trở ấn lắc khung chậu=${repetitiveLogRollPelvicSpringingStrictlyProhibited}, DCR SBP 80-90 + MTP 1:1:1 + Angio DSA=${damageControlResuscitationAndAngioAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isUnstablePelvicFracture: true,
      openBookOrVerticalShearFractureIdentified: Boolean(openBookOrVerticalShearFractureIdentified),
      pelvicBinderAtGreaterTrochantersApplied: Boolean(pelvicBinderAtGreaterTrochantersApplied),
      highPlacementAtIliacCrestsStrictlyProhibited: Boolean(highPlacementAtIliacCrestsStrictlyProhibited),
      repetitiveLogRollPelvicSpringingStrictlyProhibited: Boolean(repetitiveLogRollPelvicSpringingStrictlyProhibited),
      damageControlResuscitationAndAngioAlerted: Boolean(damageControlResuscitationAndAngioAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN VỠ TOÁC KHUNG CHẬU MẤT VỮNG (UNSTABLE PELVIC FRACTURE): Tổn thương kiểu "cuốn sách mở" (Open-book toác khớp mu > 2.5cm) hoặc gãy trượt đứng (Vertical shear) gây đứt mạng tĩnh mạch chậu trước cùng và động mạch chậu trong, chảy máu ngầm 2-3 lít vào khoang sau phúc mạc (${openBookOrVerticalShearFractureIdentified ? "XUẤT HUYẾT NỘI KHỐI LƯỢNG LỚN SAU PHÚC MẠC" : "THEO DÕI"}).`,
        `CỐ ĐỊNH KHẨN CẤP: ĐAI NẸP CHẬU (SAM PELVIC SLING II) NGANG MẤU CHUYỂN LỚN: Đặt đai nẹp chậu chính xác ngang hai Mấu chuyển lớn xương đùi (Greater Trochanters) và siết chặt để ép khép thể tích tiểu khung, tạo hiệu ứng tamponade cơ học cầm máu màng tĩnh mạch (${pelvicBinderAtGreaterTrochantersApplied ? "ĐÃ NẸP CHẬU ĐÚNG GIẢI PHẪU MẤU CHUYỂN LỚN" : "CẦN ĐẶT NẸP CHẬU NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM ĐẶT NẸP CAO Ở MÀO CHẬU & CẤM LẬT TRỞ RUNG LẮC: Khóa cấm đặt nẹp ở mào chậu (${highPlacementAtIliacCrestsStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH LỰC ĐÒN BẨY BỬA TOÁC KHUNG CHẬU" : "CỰC KỲ NGUY HIỂM"}), khóa cấm lật trở log-roll nhiều lần và cấm ấn rung lắc khớp mu (${repetitiveLogRollPelvicSpringingStrictlyProhibited ? "ĐÃ KHÓA TRÁNH PHÁ VỠ CỤC MÁU ĐÔNG NON" : "NGUY HIỂM TÁI XUẤT HUYẾT XỐI XẢ"}).`,
        `HỒI SỨC KIỂM SOÁT TỔN THƯƠNG (DCR) & CAN THIỆP NÚT MẠCH DSA KHẨN CẤP: Duy trì SBP 80-90 mmHg (hạ HA chỉ huy), kích hoạt gói truyền máu khối lượng lớn MTP 1:1:1 + TXA 1g; chuyển thẳng phòng DSA nút tắc động mạch chậu trong hoặc phòng mổ chèn gạc khung chậu Pelvic Packing (${damageControlResuscitationAndAngioAlerted ? "PHÒNG DSA CAN THIỆP VÀ MỔ CHẤN THƯƠNG SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển BV Chợ Rẫy / BV Chấn Thương Chỉnh Hình / BV 115.`,
      ],
    };
  }

  /**
   * Cấp Cứu Ngộ Độc Vũ Khí Hóa Học Thần Kinh Ức Chế Cholinesterase & DuoDote Mark I (Phân hệ 111)
   */
  async manageCholinesteraseInhibitorToxicity(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      cholinergicCrisisKillerBsIdentified = true,
      duoDoteAtropineAndPralidoximeAdministered = true,
      pralidoximeAloneWithoutAtropineStrictlyProhibited = true,
      entryWithoutLevelAbPpeStrictlyProhibited = true,
      decontaminationAndBenzodiazepineAlerted = true,
      attemptedPralidoximeAloneWithoutAtropine = false,
      attemptedEntryWithoutLevelAbPpe = false,
    } = payload || {};

    if (attemptedPralidoximeAloneWithoutAtropine) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng Pralidoxime (2-PAM) đơn độc mà không có Atropine trong ngộ độc chất ức chế Cholinesterase! Pralidoxime chỉ tái hoạt hóa men AChE ở thụ thể Nicotinic và hoàn toàn không đối kháng được thụ thể Muscarinic; nếu dùng đơn độc khi chưa ức chế muscarinic bằng Atropine sẽ làm bùng phát cơn tăng huyết áp kịch phát dữ dội, co thắt thanh khí phế quản cấp tính, tăng trương lực co thắt cơ hoành và loạn nhịp tim chết người! Bắt buộc tiêm Atropine trước hoặc dùng phối hợp đồng thời trong phác đồ DuoDote!',
      );
    }

    if (attemptedEntryWithoutLevelAbPpe) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM nhân viên cứu nạn tiếp cận vùng nóng (Hot Zone) khi chưa trang bị đầy đủ bộ đồ bảo hộ phòng hóa cấp độ A hoặc B (Level A/B PPE with SCBA)! Hơi độc Sarin/VX ngấm qua da và xâm nhập niêm mạc đường thở trong vòng vài giây; tiếp cận hiện trường không bảo hộ sẽ dẫn đến ngộ độc chéo (Cross-contamination) làm tê liệt và tử vong toàn bộ kíp cứu nạn ngay tại chỗ! Bắt buộc tiêu tẩy khẩn cấp trước khi đưa nạn nhân vào buồng cấp cứu sạch!',
      );
    }

    incident.cholinesteraseInhibitorToxicityCare = {
      isCholinesteraseInhibitorToxicity: true,
      cholinergicCrisisKillerBsIdentified: Boolean(cholinergicCrisisKillerBsIdentified),
      duoDoteAtropineAndPralidoximeAdministered: Boolean(duoDoteAtropineAndPralidoximeAdministered),
      pralidoximeAloneWithoutAtropineStrictlyProhibited: Boolean(pralidoximeAloneWithoutAtropineStrictlyProhibited),
      entryWithoutLevelAbPpeStrictlyProhibited: Boolean(entryWithoutLevelAbPpeStrictlyProhibited),
      decontaminationAndBenzodiazepineAlerted: Boolean(decontaminationAndBenzodiazepineAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.cholinesteraseInhibitorToxicityCare && incident.markModified('cholinesteraseInhibitorToxicityCare');

    incident.auditTrail.push({
      action: 'CHOLINESTERASE_INHIBITOR_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc chất độc thần kinh/ức chế AChE: Tam chứng Killer B's/SLUDGE=${cholinergicCrisisKillerBsIdentified}, Bộ đôi Atropine + 2-PAM=${duoDoteAtropineAndPralidoximeAdministered}, CẤM dùng 2-PAM đơn độc không Atropine=${pralidoximeAloneWithoutAtropineStrictlyProhibited}, CẤM vào hiện trường không PPE cấp A/B=${entryWithoutLevelAbPpeStrictlyProhibited}, Tiêu tẩy Decontamination + Diazepam co giật=${decontaminationAndBenzodiazepineAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isCholinesteraseInhibitorToxicity: true,
      cholinergicCrisisKillerBsIdentified: Boolean(cholinergicCrisisKillerBsIdentified),
      duoDoteAtropineAndPralidoximeAdministered: Boolean(duoDoteAtropineAndPralidoximeAdministered),
      pralidoximeAloneWithoutAtropineStrictlyProhibited: Boolean(pralidoximeAloneWithoutAtropineStrictlyProhibited),
      entryWithoutLevelAbPpeStrictlyProhibited: Boolean(entryWithoutLevelAbPpeStrictlyProhibited),
      decontaminationAndBenzodiazepineAlerted: Boolean(decontaminationAndBenzodiazepineAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN BÃO CHOLINERGIC TỐI CẤP DO VŨ KHÍ HÓA HỌC THẦN KINH (NERVE AGENTS - SARIN/VX): Tam chứng đe dọa mạng sống "Killer B's" (Bronchorrhea ngập đàm phế quản, Bronchospasm co thắt ngạt thở, Bradycardia chậm nhịp kịch phát) kèm SLUDGE, co đồng tử kim chọc và giật bó cơ toàn thân (${cholinergicCrisisKillerBsIdentified ? "CƠN BÃO CHOLINERGIC ĐE DỌA TỬ VONG TRONG VÀI PHÚT" : "THEO DÕI"}).`,
        `PHÁC ĐỒ GIẢI ĐỘC ĐẶC HIỆU DUODOTE: ATROPINE TĂNG LIỀU + PRALIDOXIME (2-PAM): Tiêm Atropine liều khởi đầu 2-4 mg IV/IM, lặp lại tăng gấp đôi mỗi 5-10 phút cho đến khi đạt tiêu chuẩn khô phổi (Atropinization: phổi hết ran, tim > 80 bpm); phối hợp Pralidoxime (2-PAM) 1-2g IV trong 30-60 phút để giải phóng AChE trước khi enzym bị "lão hóa" vĩnh viễn (${duoDoteAtropineAndPralidoximeAdministered ? "ĐÃ THIẾT LẬP BỘ ĐÔI ATROPINE VÀ 2-PAM" : "CẦN TIÊM ATROPINE NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM DÙNG 2-PAM ĐƠN ĐỘC & CẤM TIẾP CẬN KHÔNG PPE CẤP A/B: Khóa cấm dùng Pralidoxime đơn độc không có Atropine (${pralidoximeAloneWithoutAtropineStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BÙNG PHÁT CO THẮT VÀ CAO HUYẾT ÁP TỬ VONG" : "CỰC KỲ NGUY HIỂM"}), khóa cấm nhân viên cứu hộ tiếp cận khi chưa mang đồ phòng hộ cấp A/B (${entryWithoutLevelAbPpeStrictlyProhibited ? "ĐÃ KHÓA TRÁNH NHIỄM ĐỘC CHÉO KÍP CỨU HỘ" : "NGUY CƠ TỬ VONG TẬP THỂ"}).`,
        `TIÊU TẨY HÓA CHẤT (DECONTAMINATION) & CẮT CƠN CO GIẬT: Cởi bỏ ngay toàn bộ quần áo nạn nhân (loại bỏ 80-90% chất độc bám ngoài), rửa bằng nước xà phòng hoặc dung dịch kiềm nhẹ; tiêm tĩnh mạch Diazepam 10mg hoặc Midazolam 5-10mg dập tắt co giật và bảo vệ tế bào não (${decontaminationAndBenzodiazepineAlerted ? "TRẠM TIÊU TẨY VÀ BENZODIAZEPINE SẴN SÀNG" : "CẦN TIÊU TẨY KHẨN CẤP"}); chuyển Trung tâm Chống độc BV Chợ Rẫy / BV Quân Y 175.`,
      ],
    };
  }

  /**
   * Cấp Cứu Ngưng Tim Do Hạ Thân Nhiệt Sâu Dưới 30°C & ECLS Rewarming (Phân hệ 112)
   */
  async manageHypothermicCardiacArrest(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      coreTemperatureBelow30WithArrest = true,
      gentleHandlingAndContinuousCprEnforced = true,
      declarationOfDeathBeforeRewarming35StrictlyProhibited = true,
      peripheralActiveRewarmingBeforeCoreStrictlyProhibited = true,
      eclsVaEcmoRewarmingAlerted = true,
      attemptedDeclarationOfDeathBeforeRewarming35 = false,
      attemptedPeripheralActiveRewarmingBeforeCore = false,
    } = payload || {};

    if (attemptedDeclarationOfDeathBeforeRewarming35) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM công bố tử vong khi nạn nhân hạ thân nhiệt sâu chưa được làm ấm lên trên 32-35°C ("No one is dead until warm and dead")! Hạ thân nhiệt nặng làm giảm chuyển hóa oxy não 6% mỗi độ C, tạo trạng thái chết lâm sàng giả định (apparent death) với đồng tử giãn cố định, mất phản xạ gân xương, nhịp tim cực chậm không bắt được và điện tim đường thẳng vô tâm thu; rất nhiều bệnh nhân đã hồi sinh và bảo tồn nguyên vẹn chức năng thần kinh sau 4-6 giờ CPR liên tục khi được sưởi ấm qua máy ECMO!',
      );
    }

    if (attemptedPeripheralActiveRewarmingBeforeCore) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM sưởi ấm tích cực tứ chi ngoại vi trước bằng nước nóng, đèn hồng ngoại hoặc chăn ấm tập trung ở tay chân! Sưởi ấm ngoại vi trước sẽ làm giãn mạch máu ngoại biên đột ngột, dồn một lượng lớn máu lạnh chứa đầy Axit Lactic, Ion Kali và CO2 từ các chi trở về tim, kích phát hiện tượng "Hạ nhiệt thứ phát" (Afterdrop Phenomenon) làm thân nhiệt quả tim tụt sâu thêm 2-3°C nữa và gây sốc trụy mạch tái tưới máu (Rewarming Collapse) dẫn đến ngừng tim vô phương cứu chữa! Bắt buộc làm ấm trung tâm lõi (Core Rewarming) trước bằng VA-ECMO hoặc dịch rửa ấm khoang ngực/bụng!',
      );
    }

    incident.severeHypothermicCardiacArrestCare = {
      isSevereHypothermicCardiacArrest: true,
      coreTemperatureBelow30WithArrest: Boolean(coreTemperatureBelow30WithArrest),
      gentleHandlingAndContinuousCprEnforced: Boolean(gentleHandlingAndContinuousCprEnforced),
      declarationOfDeathBeforeRewarming35StrictlyProhibited: Boolean(declarationOfDeathBeforeRewarming35StrictlyProhibited),
      peripheralActiveRewarmingBeforeCoreStrictlyProhibited: Boolean(peripheralActiveRewarmingBeforeCoreStrictlyProhibited),
      eclsVaEcmoRewarmingAlerted: Boolean(eclsVaEcmoRewarmingAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.severeHypothermicCardiacArrestCare && incident.markModified('severeHypothermicCardiacArrestCare');

    incident.auditTrail.push({
      action: 'HYPOTHERMIC_CARDIAC_ARREST_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngừng tim hạ thân nhiệt sâu < 30°C: Thân nhiệt lõi cực thấp=${coreTemperatureBelow30WithArrest}, Quy trình Gentle Handling + CPR liên tục=${gentleHandlingAndContinuousCprEnforced}, CẤM công bố tử vong khi chưa ấm > 35°C=${declarationOfDeathBeforeRewarming35StrictlyProhibited}, CẤM sưởi ấm tứ chi trước (Afterdrop)=${peripheralActiveRewarmingBeforeCoreStrictlyProhibited}, Hệ thống VA-ECMO ECLS làm ấm trung tâm=${eclsVaEcmoRewarmingAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isSevereHypothermicCardiacArrest: true,
      coreTemperatureBelow30WithArrest: Boolean(coreTemperatureBelow30WithArrest),
      gentleHandlingAndContinuousCprEnforced: Boolean(gentleHandlingAndContinuousCprEnforced),
      declarationOfDeathBeforeRewarming35StrictlyProhibited: Boolean(declarationOfDeathBeforeRewarming35StrictlyProhibited),
      peripheralActiveRewarmingBeforeCoreStrictlyProhibited: Boolean(peripheralActiveRewarmingBeforeCoreStrictlyProhibited),
      eclsVaEcmoRewarmingAlerted: Boolean(eclsVaEcmoRewarmingAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN NGƯNG TIM DO HẠ THÂN NHIỆT SÂU DƯỚI 30°C (SEVERE HYPOTHERMIC ARREST): Thân nhiệt trung tâm lõi < 30°C đo qua thực quản/màng nhĩ, cơ tim dễ kích thích cực đoan, rung thất trơ hoặc vô tâm thu giả định (${coreTemperatureBelow30WithArrest ? "TÌNH TRẠNG CHẾT LÂM SÀNG GIẢ ĐỊNH DO HẠ NHIỆT SÂU" : "THEO DÕI"}).`,
        `QUY TRÌNH GENTLE HANDLING & CPR KÉO DÀI LIÊN TỤC: Di chuyển nạn nhân cực kỳ nhẹ nhàng tránh kích phát rung thất; CPR chất lượng cao liên tục không ngắt quãng; chỉ sốc điện tối đa 3 lần và HOÃN toàn bộ thuốc vận mạch (Adrenaline/Amiodarone) cho đến khi làm ấm thân nhiệt lõi > 30°C (${gentleHandlingAndContinuousCprEnforced ? "ĐÃ TUÂN THỦ GENTLE HANDLING VÀ CPR CHẤT LƯỢNG CAO" : "CẦN CPR LIÊN TỤC"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM TUYÊN BỐ TỬ VONG TRƯỚC 35°C & CẤM SƯỞI ẤM TỨ CHI TRƯỚC: Khóa cấm công bố tử vong trước khi sưởi ấm trên 32-35°C ("No one is dead until warm and dead") (${declarationOfDeathBeforeRewarming35StrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BỎ RƠI NẠN NHÂN CÒN CƠ HỘI HỒI SINH" : "CỰC KỲ NGUY HIỂM"}), khóa cấm sưởi ấm ngoại vi bằng nước nóng gây hiện tượng tụt nhiệt Afterdrop (${peripheralActiveRewarmingBeforeCoreStrictlyProhibited ? "ĐÃ KHÓA TRÁNH SỐC TRỤY MẠCH TÁI TƯỚI MÁU" : "NGUY HIỂM TỤT NHIỆT TIM TỬ VONG"}).`,
        `PHƯƠNG PHÁP SƯỞI ẤM LỰA CHỌN SỐ 1: HỆ THỐNG VA-ECMO / ECLS LÀM ẤM TRUNG TÂM: Kích hoạt đội ECMO cấp cứu đặt cannula mạch đùi chạy hệ thống trao đổi oxy và làm ấm máu trung tâm với tốc độ 2-3°C/giờ (${eclsVaEcmoRewarmingAlerted ? "HỆ THỐNG VA-ECMO ECLS TRUNG TÂM SẴN SÀNG" : "CHỜ ĐIỀU PHỐI ECMO"}); chuyển ICU BV Chợ Rẫy / BV 115 / BV Quân Y 175.`,
      ],
    };
  }

  /**
   * Phân hệ 114: Cấp cứu Sốc phản vệ ngừng tim do nọc côn trùng rừng / ong vò vẽ đốt hàng loạt & Phác đồ phối hợp Vasopressin / Methylene Blue
   */
  async manageBeeStingAnaphylacticArrest(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      multipleBeeStingsWithArrest = true,
      adrenalineImAndVasopressinIvEnforced = true,
      pinchingVenomSacStrictlyProhibited = true,
      hotCompressApplicationStrictlyProhibited = true,
      crrtBloodPurificationAlerted = true,
      attemptedPinchingVenomSac = false,
      attemptedHotCompressApplication = false,
    } = payload || {};

    if (attemptedPinchingVenomSac) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM dùng nhíp bóp nặn túi nọc ong hoặc chà xát cọ xát vết đốt! Hành vi bóp nặn túi nọc sẽ vô tình bơm toàn bộ lượng độc tố Melittin, Apamin và Phospholipase A2 còn sót lại trong túi độc vào trực tiếp dòng máu, gây bùng phát cơn sốc phản vệ tối cấp, tan máu nội mạch ồ ạt, suy thận cấp do myoglobin niệu và ngừng tim đột ngột! Bắt buộc dùng thẻ nhựa cứng (thẻ ATM/CCCD) hoặc lưỡi dao gạt nhẹ ngang mặt da để hất ngòi độc ra ngoài!',
      );
    }

    if (attemptedHotCompressApplication) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM chườm nóng, ngâm nước ấm hoặc hơ lửa các vết ong đốt! Nhiệt độ cao làm giãn nở các mao mạch toàn thân dữ dội, thúc đẩy nọc độc ong khuếch tán vào đại tuần hoàn với tốc độ gấp hàng chục lần, làm tụt huyết áp kịch phát, phù thanh quản cấp tính nghẹt thở và trụy tuần hoàn dẫn đến tử vong trong vài phút! Bắt buộc chườm lạnh cục bộ để co mạch làm chậm hấp thu nọc độc!',
      );
    }

    incident.beeStingAnaphylacticArrestCare = {
      isBeeStingAnaphylacticArrest: true,
      multipleBeeStingsWithArrest: Boolean(multipleBeeStingsWithArrest),
      adrenalineImAndVasopressinIvEnforced: Boolean(adrenalineImAndVasopressinIvEnforced),
      pinchingVenomSacStrictlyProhibited: Boolean(pinchingVenomSacStrictlyProhibited),
      hotCompressApplicationStrictlyProhibited: Boolean(hotCompressApplicationStrictlyProhibited),
      crrtBloodPurificationAlerted: Boolean(crrtBloodPurificationAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.beeStingAnaphylacticArrestCare && incident.markModified('beeStingAnaphylacticArrestCare');

    incident.auditTrail.push({
      action: 'BEE_STING_ANAPHYLACTIC_ARREST_CARE_RECORDED',
      timestamp: new Date(),
      details: `Sốc phản vệ ngừng tim do ong vò vẽ đốt: Hàng chục nốt đốt=${multipleBeeStingsWithArrest}, Adrenaline IM + Vasopressin IV kháng trị=${adrenalineImAndVasopressinIvEnforced}, CẤM bóp nặn túi nọc=${pinchingVenomSacStrictlyProhibited}, CẤM chườm nóng=${hotCompressApplicationStrictlyProhibited}, Lọc máu CRRT hấp phụ nọc độc=${crrtBloodPurificationAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isBeeStingAnaphylacticArrest: true,
      multipleBeeStingsWithArrest: Boolean(multipleBeeStingsWithArrest),
      adrenalineImAndVasopressinIvEnforced: Boolean(adrenalineImAndVasopressinIvEnforced),
      pinchingVenomSacStrictlyProhibited: Boolean(pinchingVenomSacStrictlyProhibited),
      hotCompressApplicationStrictlyProhibited: Boolean(hotCompressApplicationStrictlyProhibited),
      crrtBloodPurificationAlerted: Boolean(crrtBloodPurificationAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN SỐC PHẢN VỆ NGỪNG TIM DO ONG VÒ VẼ ĐỐT: Hàng chục nốt đốt giải phóng Melittin/Apamin, sốc phản vệ độ IV, phù nề đường thở cấp và ngừng tim kháng trị Adrenaline (${multipleBeeStingsWithArrest ? "SỐC PHẢN VỆ NGUY KỊCH TÍNH MẠNG" : "THEO DÕI"}).`,
        `PHÁC ĐỒ VASOPRESSIN & METHYLENE BLUE KHÁNG TRỊ: Tiêm Adrenaline 0.5mg IM mặt ngoài đùi; khi ngừng tim kháng trị phối hợp Vasopressin 20-40 IU IV kích thích thụ thể V1 duy trì tưới máu mạch vành và Methylene Blue 1-2 mg/kg IV ức chế NO dập tắt giãn mạch trơ (${adrenalineImAndVasopressinIvEnforced ? "ĐÃ THIẾT LẬP PHÁC ĐỒ HỒI SỨC TIM MẠCH NÂNG CAO" : "CẦN ÁP DỤNG NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM BÓP NẶN TÚI NỌC & CẤM CHƯỜM NÓNG: Khóa cấm bóp nặn túi nọc bằng nhíp tránh bơm thêm nọc độc (${pinchingVenomSacStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BƠM THÊM ĐỘC TỐ" : "CỰC KỲ NGUY HIỂM"}), khóa cấm chườm nóng tránh giãn mạch khuếch tán nọc gây trụy mạch (${hotCompressApplicationStrictlyProhibited ? "ĐÃ KHÓA TRÁNH KHUẾCH TÁN NỌC ĐỘC" : "NGUY HIỂM TỤT HA TỬ VONG"}).`,
        `PHƯƠNG PHÁP HỖ TRỢ SỐ 1: LỌC MÁU LIÊN TỤC CRRT HẤP PHỤ NỌC ĐỘC: Điều chuyển khẩn cấp tới Khoa Hồi sức Chống độc để triển khai CRRT quả lọc hấp phụ nọc ong và thay huyết tương bảo tồn chức năng thận (${crrtBloodPurificationAlerted ? "TRUNG TÂM CHỐNG ĐỘC CRRT SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển BV Chợ Rẫy / BV Bệnh Nhiệt Đới / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 115: Cứu hộ Không gian kín khí độc đô thị / Cống ngầm / Bể Biogas & Quy trình SCBA Buddy System
   */
  async manageConfinedSpaceAtmosphericRescue(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      toxicAtmosphereAndHypoxiaPresent = true,
      scbaHarnessAndLifelineEnforced = true,
      entryWithoutScbaStrictlyProhibited = true,
      openFlameOrNonExEquipmentStrictlyProhibited = true,
      positivePressureVentilationAlerted = true,
      attemptedEntryWithoutScba = false,
      attemptedOpenFlameOrNonExEquipment = false,
    } = payload || {};

    if (attemptedEntryWithoutScba) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM bước xuống không gian kín (cống ngầm, bể biogas, hầm tàu cá, giếng sâu) cứu nạn khi chưa trang bị mặt nạ dưỡng khí độc lập áp lực dương (SCBA) hoặc hệ thống thông gió cưỡng bức khí tươi liên tục tối thiểu 15-30 phút! Khí độc Hydro Sulfua (H2S), Khí Mê-tan (CH4) và nồng độ Oxy cực thấp (< 16%) làm tê liệt khứu giác và gây hiện tượng "Knockdown" ngất lịm tức khắc chỉ sau 1-2 nhịp thở; đây là nguyên nhân số 1 dẫn đến các vụ tử vong kép dây chuyền của nhân viên cứu hộ!',
      );
    }

    if (attemptedOpenFlameOrNonExEquipment) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM sử dụng bật lửa, diêm quẹt, nguồn nhiệt hoặc đèn pin không đạt chuẩn an toàn phòng nổ (Non-Intrinsically Safe) trong không gian kín cống ngầm/bể biogas! Khí Mê-tan (CH4) nồng độ 5-15% kết hợp H2S tạo thành hỗn hợp nổ cực mạnh; một tia lửa điện nhỏ từ công tắc đèn pin thông thường sẽ kích hoạt vụ nổ hầm khí thiêu rụi và thổi bay toàn bộ hiện trường cùng nhân viên cứu nạn!',
      );
    }

    incident.confinedSpaceAtmosphericRescueCare = {
      isConfinedSpaceAtmosphericRescue: true,
      toxicAtmosphereAndHypoxiaPresent: Boolean(toxicAtmosphereAndHypoxiaPresent),
      scbaHarnessAndLifelineEnforced: Boolean(scbaHarnessAndLifelineEnforced),
      entryWithoutScbaStrictlyProhibited: Boolean(entryWithoutScbaStrictlyProhibited),
      openFlameOrNonExEquipmentStrictlyProhibited: Boolean(openFlameOrNonExEquipmentStrictlyProhibited),
      positivePressureVentilationAlerted: Boolean(positivePressureVentilationAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.confinedSpaceAtmosphericRescueCare && incident.markModified('confinedSpaceAtmosphericRescueCare');

    incident.auditTrail.push({
      action: 'CONFINED_SPACE_ATMOSPHERIC_RESCUE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Cứu hộ không gian kín khí độc: Môi trường độc thiếu oxy=${toxicAtmosphereAndHypoxiaPresent}, Bình dưỡng khí SCBA + Dây cứu sinh Lifeline=${scbaHarnessAndLifelineEnforced}, CẤM xuống cứu khi không có SCBA=${entryWithoutScbaStrictlyProhibited}, CẤM nguồn lửa/thiết bị không chống nổ=${openFlameOrNonExEquipmentStrictlyProhibited}, Quạt thông gió áp lực dương=${positivePressureVentilationAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isConfinedSpaceAtmosphericRescue: true,
      toxicAtmosphereAndHypoxiaPresent: Boolean(toxicAtmosphereAndHypoxiaPresent),
      scbaHarnessAndLifelineEnforced: Boolean(scbaHarnessAndLifelineEnforced),
      entryWithoutScbaStrictlyProhibited: Boolean(entryWithoutScbaStrictlyProhibited),
      openFlameOrNonExEquipmentStrictlyProhibited: Boolean(openFlameOrNonExEquipmentStrictlyProhibited),
      positivePressureVentilationAlerted: Boolean(positivePressureVentilationAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN NGUY HIỂM KHÔNG GIAN KÍN (CONFINED SPACE TOXIC THREAT): Khí độc H2S, CO, Mê-tan và nồng độ O2 < 19.5% gây ngạt thở và tê liệt thần kinh trung ương (${toxicAtmosphereAndHypoxiaPresent ? "NGUY HIỂM TỬ VONG TRONG VÀI GIÂY" : "THEO DÕI"}).`,
        `QUY TRÌNH BUDDY SYSTEM & TRANG BỊ BẮT BUỘC SCBA: Phải có 1 người trực trên miệng hầm giữ dây cứu sinh Lifeline nối ròng rọc; người xuống bắt buộc mang bình thở dưỡng khí áp lực dương SCBA và máy đo khí đa chỉ tiêu 4-Gas Detector (${scbaHarnessAndLifelineEnforced ? "ĐÃ TUÂN THỦ QUY TRÌNH AN TOÀN CHUẨN OSHA" : "CẦN THỰC THI NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM XUỐNG CỨU MÒ KHÔNG SCBA & CẤM DÙNG NGUỒN PHÁT TIA LỬ: Khóa cấm tuyệt đối nhảy xuống cứu khi chưa có SCBA tránh tai nạn kép (${entryWithoutScbaStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH TỬ VONG DÂY CHUYỀN" : "CỰC KỲ NGUY HIỂM"}), khóa cấm dùng đèn pin thường hay bật lửa tránh nổ khí (${openFlameOrNonExEquipmentStrictlyProhibited ? "ĐÃ KHÓA TRÁNH NỔ HẦM KHÍ" : "NGUY HIỂM KÍCH NỔ"}).`,
        `BIỆN PHÁP CỨU NẠN TIÊU CHUẨN: THÔNG GIÓ CƯỠNG BỨC ÁP LỰC DƯƠNG & OXY CAO ÁP: Kích hoạt quạt thổi khí tươi công nghiệp giải tỏa nồng độ khí độc và chuẩn bị buồng oxy cao áp HBOT cấp cứu nhiễm độc khí (${positivePressureVentilationAlerted ? "QUẠT THÔNG GIÓ ÁP LỰC DƯƠNG ĐÃ SẴN SÀNG" : "CHỜ CẤP KHÍ"}); chuyển lực lượng Cảnh sát PCCC & CNCH 114 / BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 116: Cấp cứu Hoại tử cân mạc vi khuẩn ăn thịt người thủy sản nước mặn Vibrio Vulnificus & Phác đồ Doxycycline giờ vàng
   */
  async manageVibrioVulnificusInfection(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      marineExposureWithHemorrhagicBullae = true,
      doxycyclineCeftriaxoneHour1Enforced = true,
      saltwaterSoakingOrHerbalPoulticeProhibited = true,
      delayingSurgicalFasciotomyProhibited = true,
      emergentFasciotomySurgicalAlerted = true,
      attemptedSaltwaterSoakingOrHerbalPoultice = false,
      attemptedDelayingFasciotomyForCulture = false,
    } = payload || {};

    if (attemptedSaltwaterSoakingOrHerbalPoultice) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM ngâm vết thương vào nước muối, nước ấm hoặc đắp các loại lá cây, thuốc nam theo kinh nghiệm dân gian! Vi khuẩn Vibrio vulnificus là vi khuẩn ưa mặn (halophilic) phát triển cực nhanh trong môi trường nước biển và muối; ngâm nước muối hoặc đắp lá cây sẽ kích hoạt vi khuẩn nhân lên ồ ạt, phá hủy mô cân cơ và đưa độc tố vi khuẩn vào máu gây sốc nhiễm trùng tử vong!',
      );
    }

    if (attemptedDelayingFasciotomyForCulture) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM trì hoãn phẫu thuật mở cân mạc giải áp và cắt lọc mô hoại tử để chờ kết quả xét nghiệm vi sinh hoặc chờ kháng sinh ngấm! Vi khuẩn Vibrio vulnificus lan dọc theo các lớp cân cơ với tốc độ 2-3 cm/giờ gây hoại tử toàn chi và sốc nhiễm trùng không hồi phục; chần chừ phẫu thuật quá 6-12 giờ làm tăng tỷ lệ tử vong lên trên 80%! Bắt buộc phẫu thuật rạch mở cân mạc cấp cứu ngay lập tức!',
      );
    }

    incident.vibrioVulnificusInfectionCare = {
      isVibrioVulnificusInfection: true,
      marineExposureWithHemorrhagicBullae: Boolean(marineExposureWithHemorrhagicBullae),
      doxycyclineCeftriaxoneHour1Enforced: Boolean(doxycyclineCeftriaxoneHour1Enforced),
      saltwaterSoakingOrHerbalPoulticeProhibited: Boolean(saltwaterSoakingOrHerbalPoulticeProhibited),
      delayingSurgicalFasciotomyProhibited: Boolean(delayingSurgicalFasciotomyProhibited),
      emergentFasciotomySurgicalAlerted: Boolean(emergentFasciotomySurgicalAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.vibrioVulnificusInfectionCare && incident.markModified('vibrioVulnificusInfectionCare');

    incident.auditTrail.push({
      action: 'VIBRIO_VULNIFICUS_INFECTION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Nhiễm trùng vi khuẩn ăn thịt người Vibrio vulnificus: Tiếp xúc hải sản/nước mặn + Bọng nước tím đen=${marineExposureWithHemorrhagicBullae}, Doxycycline + Ceftriaxone Giờ Vàng=${doxycyclineCeftriaxoneHour1Enforced}, CẤM ngâm nước muối/đắp lá cây=${saltwaterSoakingOrHerbalPoulticeProhibited}, CẤM hoãn mổ mở cân mạc=${delayingSurgicalFasciotomyProhibited}, Kíp phẫu thuật cắt lọc giải áp=${emergentFasciotomySurgicalAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isVibrioVulnificusInfection: true,
      marineExposureWithHemorrhagicBullae: Boolean(marineExposureWithHemorrhagicBullae),
      doxycyclineCeftriaxoneHour1Enforced: Boolean(doxycyclineCeftriaxoneHour1Enforced),
      saltwaterSoakingOrHerbalPoulticeProhibited: Boolean(saltwaterSoakingOrHerbalPoulticeProhibited),
      delayingSurgicalFasciotomyProhibited: Boolean(delayingSurgicalFasciotomyProhibited),
      emergentFasciotomySurgicalAlerted: Boolean(emergentFasciotomySurgicalAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN HOẠI TỬ CÂN MẠC VIBRIO VULNIFICUS: Bị gai cá ngát, tôm cua đâm hoặc vết thương hở lội nước biển kèm đau dữ dội, bọng nước xuất huyết tím đen và tụt huyết áp (${marineExposureWithHemorrhagicBullae ? "NGUY CƠ HOẠI TỬ CÂN CƠ CẤP TÍNH" : "THEO DÕI"}).`,
        `GÓI KHÁNG SINH KÉP GIỜ VÀNG (HOUR-1 BUNDLE): Khởi động ngay Doxycycline 100mg IV q12h kết hợp Ceftriaxone 2g IV q24h (hoặc Levofloxacin 750mg IV) trong vòng 60 phút đầu tiên (${doxycyclineCeftriaxoneHour1Enforced ? "ĐÃ THIẾT LẬP KHÁNG SINH KÉP ĐẶC HIỆU" : "CẦN DÙNG KHÁNG SINH NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM NGÂM NƯỚC MUỐI/ĐẮP THUỐC NAM & CẤM HOÃN MỔ MỞ CÂN: Khóa cấm ngâm nước muối hoặc đắp lá cây tránh nuôi cấy vi khuẩn ưa mặn bùng phát (${saltwaterSoakingOrHerbalPoulticeProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BÙNG PHÁT VI KHUẨN" : "CỰC KỲ NGUY HIỂM"}), khóa cấm trì hoãn mổ mở cân giải áp (${delayingSurgicalFasciotomyProhibited ? "ĐÃ KHÓA TRÁNH HOÃN PHẪU THUẬT" : "NGUY HIỂM TỬ VONG DO SỐC"}).`,
        `PHƯƠNG PHÁP ĐIỀU TRỊ CỐT LÕI: PHẪU THUẬT MỞ CÂN MẠC GIẢI ÁP & CẮT LỌC KHẨN CẤP: Chuyển thẳng phòng mổ cấp cứu để rạch mở rộng cân mạc giải áp hội chứng khoang và cắt lọc triệt để mô hoại tử (${emergentFasciotomySurgicalAlerted ? "PHÒNG MỔ CẤP CỨU SẴN SÀNG" : "CHỜ ĐIỀU PHỐI NGOẠI KHOA"}); chuyển BV Bệnh Nhiệt Đới / BV Chợ Rẫy / BV Chấn Thương Chỉnh Hình.`,
      ],
    };
  }

  /**
   * Phân hệ 117: Cấp cứu Toan ceton nặng & Hôn mê tăng áp lực thẩm thấu DKA/HHS ở người độc thân
   */
  async manageSevereDkaMetabolicCrisis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const {
      severeDkaCrisisAndDehydrationPresent = true,
      normalSalineFluidResuscitationEnforced = true,
      highDoseInsulinWithoutPotassiumProhibited = true,
      rapidHypotonicInfusionInHour1Prohibited = true,
      endocrineIcuContinuousInfusionAlerted = true,
      attemptedHighDoseInsulinBeforePotassium = false,
      attemptedRapidHypotonicInfusionInHour1 = false,
    } = payload || {};

    if (attemptedHighDoseInsulinBeforePotassium) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM bolus Insulin tĩnh mạch liều cao khi nồng độ Kali máu chưa được xác định hoặc Kali máu < 3.3 mEq/L! Insulin kích thích bơm Na+/K+-ATPase đẩy Kali từ huyết tương vào nội bào ồ ạt, gây hạ kali máu kịch phát dẫn đến loạn nhịp thất chết người (Xoắn đỉnh, Rung thất) và ngừng tim đột ngột! Bắt buộc bù Kali (KCl 20-30 mEq/L dịch truyền) đưa K+ lên trên 3.3 mEq/L trước khi khởi động liệu pháp Insulin!',
      );
    }

    if (attemptedRapidHypotonicInfusionInHour1) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: TUYỆT ĐỐI CẤM truyền nhanh dung dịch nhược trương (NaCl 0.45% hoặc Glucose 5%) trong giờ cấp cứu đầu tiên! Hạ áp lực thẩm thấu huyết tương quá nhanh sẽ làm nước ồ ạt di chuyển vào khoang nội bào não theo gradient thẩm thấu, kích phát hiện tượng Phù Não Cấp (Cerebral Edema) và tụt kẹt hạnh nhân tiểu não tử vong, đặc biệt nguy hiểm ở bệnh nhân trẻ tuổi! Giờ đầu tiên bắt buộc bù thể tích bằng dung dịch tinh thể đẳng trương NaCl 0.9% 1,000-1,500 mL!',
      );
    }

    incident.severeDkaMetabolicCrisisCare = {
      isSevereDkaMetabolicCrisis: true,
      severeDkaCrisisAndDehydrationPresent: Boolean(severeDkaCrisisAndDehydrationPresent),
      normalSalineFluidResuscitationEnforced: Boolean(normalSalineFluidResuscitationEnforced),
      highDoseInsulinWithoutPotassiumProhibited: Boolean(highDoseInsulinWithoutPotassiumProhibited),
      rapidHypotonicInfusionInHour1Prohibited: Boolean(rapidHypotonicInfusionInHour1Prohibited),
      endocrineIcuContinuousInfusionAlerted: Boolean(endocrineIcuContinuousInfusionAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.severeDkaMetabolicCrisisCare && incident.markModified('severeDkaMetabolicCrisisCare');

    incident.auditTrail.push({
      action: 'SEVERE_DKA_METABOLIC_CRISIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Toan ceton nặng DKA/HHS: Thở Kussmaul + Mất nước nặng=${severeDkaCrisisAndDehydrationPresent}, Bù dịch đẳng trương NaCl 0.9% 1-1.5L=${normalSalineFluidResuscitationEnforced}, CẤM bolus Insulin khi K+ < 3.3 mEq/L=${highDoseInsulinWithoutPotassiumProhibited}, CẤM truyền nhanh dịch nhược trương (chống phù não)=${rapidHypotonicInfusionInHour1Prohibited}, Khoa Hồi sức Nội tiết theo dõi=${endocrineIcuContinuousInfusionAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isSevereDkaMetabolicCrisis: true,
      severeDkaCrisisAndDehydrationPresent: Boolean(severeDkaCrisisAndDehydrationPresent),
      normalSalineFluidResuscitationEnforced: Boolean(normalSalineFluidResuscitationEnforced),
      highDoseInsulinWithoutPotassiumProhibited: Boolean(highDoseInsulinWithoutPotassiumProhibited),
      rapidHypotonicInfusionInHour1Prohibited: Boolean(rapidHypotonicInfusionInHour1Prohibited),
      endocrineIcuContinuousInfusionAlerted: Boolean(endocrineIcuContinuousInfusionAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN CƠN TOAN CETON NẶNG & HÔN MÊ TĂNG ÁP LỰC THẨM THẤU (DKA/HHS): Người độc thân đái tháo đường bỏ liều tiêm, thở sâu Kussmaul mùi táo chín, mất nước 5-10 lít và toan chuyển hóa nặng (${severeDkaCrisisAndDehydrationPresent ? "HÔN MÊ TOAN CHUYỂN HÓA NẶNG" : "THEO DÕI"}).`,
        `BÙ THỂ TÍCH ĐẲNG TRƯƠNG GIỜ ĐẦU TIÊN: Truyền ngay dung dịch NaCl 0.9% 1,000 - 1,500 mL trong 60 phút đầu nhằm khôi phục thể tích tuần hoàn hiệu dụng và bảo tồn tưới máu thận (${normalSalineFluidResuscitationEnforced ? "ĐÃ THIẾT LẬP BÙ DỊCH ĐẲNG TRƯƠNG TÍCH CỰC" : "CẦN TRUYỀN DỊCH NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM BOLUS INSULIN KHI K+ < 3.3 VÀ CẤM TRUYỀN DỊCH NHƯỢC TRƯƠNG SỚM: Khóa cấm bolus Insulin khi chưa bù đủ Kali tránh ngừng tim rung thất (${highDoseInsulinWithoutPotassiumProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH LOẠN NHỊP THẤT HẠ KALI" : "CỰC KỲ NGUY HIỂM"}), khóa cấm truyền nhanh dịch nhược trương chống phù não tụt kẹt (${rapidHypotonicInfusionInHour1Prohibited ? "ĐÃ KHÓA TRÁNH PHÙ NÃO CẤP TỬ VONG" : "NGUY HIỂM PHÙ NÃO"}).`,
        `QUY TRÌNH HỒI SỨC NỘI TIẾT LIÊN TỤC: Khi K+ > 3.3 mEq/L, khởi động truyền Insulin regular liều thấp 0.1 UI/kg/h kết hợp monitor đường huyết và điện giải đồ mỗi giờ (${endocrineIcuContinuousInfusionAlerted ? "ICU NỘI TIẾT SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển ICU BV Chợ Rẫy / BV 115 / BV Đại học Y Dược.`,
      ],
    };
  }

  /**
   * Phân hệ 119: Cấp Cứu Hội Chứng Kích Thích Thần Kinh Giao Cảm Cấp / Quá Liều Ma Túy Đá MDMA (Sympathomimetic Toxidrome Crisis & Excited Delirium)
   * Phác đồ: Hạ nhiệt vật lý tích cực + Benzodiazepine (Diazepam/Midazolam) liều cao an thần hạ nhịp tim + Bù dịch chống tiêu cơ vân
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM DÙNG THUỐC CHẸN BETA ĐƠN ĐỘC (Gây co mạch không đối kháng Unopposed Alpha Vasoconstriction bùng phát cơn tăng huyết áp ác tính, xuất huyết não & nhồi máu cơ tim tử vong)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM DÙNG THUỐC KHÁNG DOPAMIN HALOPERIDOL / CHLORPROMAZINE (Hạ ngưỡng co giật, nặng thêm rối loạn thân nhiệt và kéo dài QTc xoắn đỉnh Torsades de Pointes tử vong)
   */
  async manageSympathomimeticToxidromeCrisis(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      hyperthermiaAgitationTachycardiaPresent = true,
      benzodiazepineAndActiveCoolingEnforced = true,
      unopposedAlphaBetaBlockerStrictlyProhibited = true,
      antipsychoticHaloperidolStrictlyProhibited = true,
      rhabdomyolysisRenalProtectionAlerted = true,
    } = payload || {};

    incident.sympathomimeticToxidromeCrisisCare = {
      isSympathomimeticToxidromeCrisis: true,
      hyperthermiaAgitationTachycardiaPresent: Boolean(hyperthermiaAgitationTachycardiaPresent),
      benzodiazepineAndActiveCoolingEnforced: Boolean(benzodiazepineAndActiveCoolingEnforced),
      unopposedAlphaBetaBlockerStrictlyProhibited: Boolean(unopposedAlphaBetaBlockerStrictlyProhibited),
      antipsychoticHaloperidolStrictlyProhibited: Boolean(antipsychoticHaloperidolStrictlyProhibited),
      rhabdomyolysisRenalProtectionAlerted: Boolean(rhabdomyolysisRenalProtectionAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.sympathomimeticToxidromeCrisisCare && incident.markModified('sympathomimeticToxidromeCrisisCare');

    incident.auditTrail.push({
      action: 'SYMPATHOMIMETIC_TOXIDROME_CRISIS_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hội chứng giao cảm cấp do ma túy đá/MDMA: Kích động mê sảng cuồng loạn + Sốt cao ác tính=${hyperthermiaAgitationTachycardiaPresent}, Benzodiazepine liều cao & Hạ nhiệt tích cực=${benzodiazepineAndActiveCoolingEnforced}, CẤM chẹn Beta đơn độc (chống Unopposed Alpha co mạch tử vong)=${unopposedAlphaBetaBlockerStrictlyProhibited}, CẤM Haloperidol (chống xoắn đỉnh/co giật)=${antipsychoticHaloperidolStrictlyProhibited}, Bù dịch kiềm hóa chống tiêu cơ vân suy thận=${rhabdomyolysisRenalProtectionAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isSympathomimeticToxidromeCrisis: true,
      hyperthermiaAgitationTachycardiaPresent: Boolean(hyperthermiaAgitationTachycardiaPresent),
      benzodiazepineAndActiveCoolingEnforced: Boolean(benzodiazepineAndActiveCoolingEnforced),
      unopposedAlphaBetaBlockerStrictlyProhibited: Boolean(unopposedAlphaBetaBlockerStrictlyProhibited),
      antipsychoticHaloperidolStrictlyProhibited: Boolean(antipsychoticHaloperidolStrictlyProhibited),
      rhabdomyolysisRenalProtectionAlerted: Boolean(rhabdomyolysisRenalProtectionAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN CƠN KÍCH THÍCH GIAO CẢM ÁC TÍNH (SYMPATHOMIMETIC CRISIS & EXCITED DELIRIUM): Người trẻ sống đơn độc dùng quá liều ma túy đá/thuốc lắc, đồng tử giãn to, tim đập nhanh > 140 bpm, vã mồ hôi đầm đìa, kích động cuồng loạn và sốt cao đe dọa tổn thương não (${hyperthermiaAgitationTachycardiaPresent ? "BÁO ĐỘNG NGỘ ĐỘC GIAO CẢM NẶNG" : "THEO DÕI"}).`,
        `HẠ NHIỆT TÍCH CỰC & AN THẦN BENZODIAZEPINE: Tiêm tĩnh mạch Diazepam 5 - 10 mg hoặc Midazolam lặp lại mỗi 5-10 phút để cắt cơn kích động và hạ nhịp tim; phun sương nước mát quạt gió chườm đá nách bẹn (${benzodiazepineAndActiveCoolingEnforced ? "ĐÃ THIẾT LẬP AN THẦN VÀ HẠ NHIỆT" : "CẦN HẠ NHIỆT VÀ TIÊM BENZO NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM CHẸN BETA ĐƠN ĐỘC VÀ CẤM HALOPERIDOL: Khóa cấm dùng thuốc chẹn Beta đơn độc (Propranolol/Atenolol) vì gây hiệu ứng co mạch Alpha không đối kháng làm bùng phát cơn tăng huyết áp ác tính xuất huyết não tử vong (${unopposedAlphaBetaBlockerStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH CO MẠCH ALPHA ÁC TÍNH" : "CỰC KỲ NGUY HIỂM"}), khóa cấm dùng thuốc an thần kinh Haloperidol/Chlorpromazine vì hạ ngưỡng co giật và kéo dài QTc gây xoắn đỉnh tử vong (${antipsychoticHaloperidolStrictlyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH XOẮN ĐỈNH TORSAIDES" : "NGUY CƠ NGỪNG TIM ĐỘT NGỘT"}).`,
        `BẢO VỆ THẬN CHỐNG TIÊU CƠ VÂN CẤP (RHABDOMYOLYSIS): Truyền dịch đẳng trương NaCl 0.9% tốc độ 200 - 300 mL/h kết hợp Natri Bicarbonat kiềm hóa nước tiểu mục tiêu pH > 6.5 ngăn lắng đọng Myoglobin tại ống thận (${rhabdomyolysisRenalProtectionAlerted ? "PHÁC ĐỒ BẢO VỆ THẬN SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển ICU Trung tâm Chống độc BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 120: Cứu Hộ Kẹt Thang Máy Cao Ốc & Sập Đổ Công Trình Solo Bằng Sóng Âm Siêu Tần (Ultrasound Acoustic Beacon) & Định Vị Khí Áp Trọng Lực
   * Phác đồ: Sóng âm cứu hộ Morse SOS + Siêu âm 18-20 kHz định vị máy dò địa chấn PCCC + Cảm biến áp kế Barometer ước tính tầng kẹt
   * CHỐNG CHỈ ĐỊNH CỨU HỘ 1: TUYỆT ĐỐI CẤM CẠY CỬA CABIN NHẢY RA NGOÀI KHI CHƯA KHÓA HÃM CƠ KHÍ (Tránh cabin trôi đứt cáp cắt ngang người)
   * CHỐNG CHỈ ĐỊNH CỨU HỘ 2: TUYỆT ĐỐI CẤM ĐỐT LỬA TRONG GIẾNG THANG MÁY (Tránh cháy dầu bôi trơn cáp và cạn kiệt oxy buồng kín)
   */
  async manageHighRiseElevatorCollapseRescue(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      elevatorEntrapmentConfirmed = true,
      acousticBeaconAndBarometerLocationActive = true,
      pryingElevatorDoorEscapeProhibited = true,
      openFlameInElevatorShaftProhibited = true,
      usarHydraulicJawsDeploymentAlerted = true,
    } = payload || {};

    incident.highRiseElevatorCollapseCare = {
      isHighRiseElevatorCollapse: true,
      elevatorEntrapmentConfirmed: Boolean(elevatorEntrapmentConfirmed),
      acousticBeaconAndBarometerLocationActive: Boolean(acousticBeaconAndBarometerLocationActive),
      pryingElevatorDoorEscapeProhibited: Boolean(pryingElevatorDoorEscapeProhibited),
      openFlameInElevatorShaftProhibited: Boolean(openFlameInElevatorShaftProhibited),
      usarHydraulicJawsDeploymentAlerted: Boolean(usarHydraulicJawsDeploymentAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.highRiseElevatorCollapseCare && incident.markModified('highRiseElevatorCollapseCare');

    incident.auditTrail.push({
      action: 'HIGH_RISE_ELEVATOR_COLLAPSE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Kẹt thang máy cao ốc/Sập đổ đô thị: Xác nhận buồng kẹt=${elevatorEntrapmentConfirmed}, Beacon sóng âm siêu tần & Áp kế tầng kẹt=${acousticBeaconAndBarometerLocationActive}, CẤM cạy cửa cabin nhảy ra ngoài khi chưa chốt hãm=${pryingElevatorDoorEscapeProhibited}, CẤM đốt lửa trong buồng thang máy=${openFlameInElevatorShaftProhibited}, Đội cứu hộ PCCC kìm thủy lực phá dỡ=${usarHydraulicJawsDeploymentAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isHighRiseElevatorCollapse: true,
      elevatorEntrapmentConfirmed: Boolean(elevatorEntrapmentConfirmed),
      acousticBeaconAndBarometerLocationActive: Boolean(acousticBeaconAndBarometerLocationActive),
      pryingElevatorDoorEscapeProhibited: Boolean(pryingElevatorDoorEscapeProhibited),
      openFlameInElevatorShaftProhibited: Boolean(openFlameInElevatorShaftProhibited),
      usarHydraulicJawsDeploymentAlerted: Boolean(usarHydraulicJawsDeploymentAlerted),
      rescueDirectives: [
        `NHẬN DIỆN KẸT THANG MÁY CAO ỐC / SẬP ĐỔ CÔNG TRÌNH: Người sống đơn thân bị kẹt buồng thang máy mất điện, mất sóng 4G/GPS, đứt cáp hãm hoặc chấn động sập đổ kết cấu đô thị (${elevatorEntrapmentConfirmed ? "XÁC NHẬN KẸT BUỒNG KÍN NGUY HIỂM" : "THEO DÕI"}).`,
        `KÍCH HOẠT BEACON SÓNG ÂM SIÊU TẦN & KHÍ ÁP ĐỊNH VỊ TẦNG: Tự động phát âm thanh cứu hộ đa tần 18-20 kHz + SOS Morse 120dB dẫn đường máy dò địa chấn PCCC và cảm biến Barometer ước tính tầng kẹt (${acousticBeaconAndBarometerLocationActive ? "ĐÃ BẬT BEACON SÓNG ÂM & ĐỊNH VỊ KHÍ ÁP" : "CẦN KÍCH HOẠT BEACON"}).`,
        `CHỐNG CHỈ ĐỊNH CỨU HỘ SINH TỬ: CẤM CẠY CỬA CABIN NHẢY RA VÀ CẤM NGUỒN LỬA TRONG THANG: Khóa cấm tự ý cạy cửa cabin nhảy ra ngoài khi chốt cơ khí an toàn chưa khóa tránh thang trôi cắt ngang thân thể (${pryingElevatorDoorEscapeProhibited ? "ĐÃ KHÓA AN TOÀN CẤM CẠY CỬA TRÔI CABIN" : "NGUY HIỂM TỬ VONG"}), khóa cấm đốt nến/bật lửa trong giếng thang tránh bén cháy dầu cáp và cạn kiệt oxy (${openFlameInElevatorShaftProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH HỎA HOẠN BUỒNG KÍN" : "NGUY CƠ NGẠT KHÍ"}).`,
        `ĐIỀU ĐỘNG ĐỘI PCCC & CỨU NẠN CỨU HỘ CHUYÊN DỤNG (USAR): Lực lượng 114 triển khai kìm cắt mở thủy lực banh cửa cabin và tiếp cận buồng thang an toàn (${usarHydraulicJawsDeploymentAlerted ? "ĐỘI PCCC 114 SẴN SÀNG TRIỂN KHAI" : "CHỜ ĐIỀU PHỐI"}); chuyển viện cấp cứu Chấn thương chỉnh hình BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 121: Cấp cứu Tăng Kali Máu Tối Cấp Đe Dọa Ngừng Tim (K+ >= 6.5 mEq/L & Sóng T Nhọn Khổng Lồ) ở Bệnh Nhân Chạy Thận / Suy Thận Solo
   * Phác đồ: Calcium Gluconate 10% tĩnh mạch chậm ổn định màng tim trong 2-3 phút + Đẩy Kali vào nội bào bằng Insulin-Glucose & Khí dung Salbutamol
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM TRÌ HOÃN TIÊM CALCIUM GLUCONATE KHI QRS ĐÃ GIÃN RỘNG (Canxi là vũ khí duy nhất đối kháng điện sinh học bảo vệ màng tim khỏi rung thất tức thì)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM DÙNG SỢI TRAO ĐỔI ION ĐƯỜNG UỐNG ĐƠN ĐỘC (RESONIUM/LOKELMA) CHO CẤP CỨU TỐI CẤP (Thuốc mất 2-6 giờ mới phát huy tác dụng)
   */
  async manageHyperkalemiaCardiacEmergency(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      hyperkalemiaSevereArrhythmiaPresent = true,
      calciumGluconateMembraneStabilizationEnforced = true,
      delayingCalciumWithoutEkgProhibited = true,
      oralResinMonotherapyProhibited = true,
      insulinGlucoseShiftAndHemodialysisAlerted = true,
    } = payload || {};

    incident.hyperkalemiaCardiacEmergencyCare = {
      isHyperkalemiaCardiacEmergency: true,
      hyperkalemiaSevereArrhythmiaPresent: Boolean(hyperkalemiaSevereArrhythmiaPresent),
      calciumGluconateMembraneStabilizationEnforced: Boolean(calciumGluconateMembraneStabilizationEnforced),
      delayingCalciumWithoutEkgProhibited: Boolean(delayingCalciumWithoutEkgProhibited),
      oralResinMonotherapyProhibited: Boolean(oralResinMonotherapyProhibited),
      insulinGlucoseShiftAndHemodialysisAlerted: Boolean(insulinGlucoseShiftAndHemodialysisAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.hyperkalemiaCardiacEmergencyCare && incident.markModified('hyperkalemiaCardiacEmergencyCare');

    incident.auditTrail.push({
      action: 'HYPERKALEMIA_CARDIAC_EMERGENCY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Tăng Kali máu tối cấp (K+ >= 6.5 mEq/L): Loạn nhịp sóng T nhọn/QRS giãn=${hyperkalemiaSevereArrhythmiaPresent}, Calcium Gluconate 10% IV ổn định màng tim=${calciumGluconateMembraneStabilizationEnforced}, CẤM trì hoãn Canxi chờ xét nghiệm máu lại=${delayingCalciumWithoutEkgProhibited}, CẤM dùng đơn độc thuốc hạ Kali đường uống Resonium=${oralResinMonotherapyProhibited}, Đẩy Kali bằng Insulin-Glucose & Lọc máu cấp cứu=${insulinGlucoseShiftAndHemodialysisAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isHyperkalemiaCardiacEmergency: true,
      hyperkalemiaSevereArrhythmiaPresent: Boolean(hyperkalemiaSevereArrhythmiaPresent),
      calciumGluconateMembraneStabilizationEnforced: Boolean(calciumGluconateMembraneStabilizationEnforced),
      delayingCalciumWithoutEkgProhibited: Boolean(delayingCalciumWithoutEkgProhibited),
      oralResinMonotherapyProhibited: Boolean(oralResinMonotherapyProhibited),
      insulinGlucoseShiftAndHemodialysisAlerted: Boolean(insulinGlucoseShiftAndHemodialysisAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN CƠN TĂNG KALI MÁU TỐI CẤP ĐE DỌA NGỪNG TIM: Bệnh nhân chạy thận mạn sống một mình bỏ cữ lọc hoặc ăn hoa quả nhiều Kali, tê bì đầu chi, yếu liệt cơ tứ chi, sóng T nhọn cao đối xứng và QRS giãn rộng hình sin (${hyperkalemiaSevereArrhythmiaPresent ? "NGUY CƠ RUNG THẤT TỬ VONG TRONG VÀI PHÚT" : "THEO DÕI"}).`,
        `TIÊM CALCIUM GLUCONATE 10% ỔN ĐỊNH MÀNG TẾ BÀO CƠ TIM: Tiêm tĩnh mạch chậm 10 - 20 mL Calcium Gluconate 10% trong 2-3 phút dưới monitor theo dõi nhịp tim nhằm đối kháng tức thì độc tính Kali trên điện thế hoạt động cơ tim (${calciumGluconateMembraneStabilizationEnforced ? "ĐÃ TIÊM CALCIUM GLUCONATE ỔN ĐỊNH MÀNG TIM" : "CẦN TIÊM CANXI NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM TRÌ HOÃN CANXI VÀ CẤM CHỈ DÙNG THUỐC UỐNG HẠ KALI ĐƠN ĐỘC: Khóa cấm trì hoãn tiêm Canxi khi QRS đã biến dạng để chờ kết quả xét nghiệm lại tránh tim ngừng đập trước khi có kết quả (${delayingCalciumWithoutEkgProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH TRÌ HOÃN CANXI" : "NGUY CƠ NGỪNG TIM ĐỘT NGỘT"}), khóa cấm chỉ cho uống Resonium đơn độc trong cấp cứu tối cấp vì thuốc tác dụng quá chậm (${oralResinMonotherapyProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH PHÁC ĐỒ CHẬM TRỄ" : "CỰC KỲ NGUY HIỂM"}).`,
        `PHÁC ĐỒ CHUYỂN KALI VÀO TẾ BÀO & LỌC MÁU CẤP CỨU: Tiêm tĩnh mạch Insulin regular 10 UI pha trong Glucose 20-50% 50 mL kết hợp khí dung Salbutamol 10-20 mg; kích hoạt phòng lọc máu chạy thận nhân tạo cấp cứu khẩn cấp (${insulinGlucoseShiftAndHemodialysisAlerted ? "KHOA THẬN NHÂN TẠO SẴN SÀNG LỌC MÁU" : "CHỜ ĐIỀU PHỐI"}); chuyển ICU BV Chợ Rẫy / BV 115 / BV Bình Dân.`,
      ],
    };
  }

  /**
   * Phân hệ 122: Cấp Cứu Co Thắt Khí Quản Ác Tính / Phù Mạch Quinke Thanh Quản Đột Ngột Tắc Nghẽn Đường Thở Trên 100% (Tình Huống CICO)
   * Phác đồ: Chọc kim màng nhẫn giáp cấp cứu (Needle Cricothyroidotomy) 12G/14G + Adrenaline tiêm bắp & khí dung co mạch
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM CỐ GẮNG ĐẶT NỘI KHÍ QUẢN MÙ LẶP LẠI QUÁ 3 LẦN TRONG TÌNH HUỐNG CICO (Mỗi lần thọc đèn soi hay que mù sẽ gây rách nát thanh môn bít tắc vĩnh viễn)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM TIÊM THUỐC GIÃN CƠ KHI CHƯA SẴN SÀNG MỞ MÀNG NHẪN GIÁP (Giãn cơ làm mất nhịp thở bù trừ tự nhiên gây ngừng thở tử vong ngay tức khắc)
   */
  async manageAcuteAngioedemaCricothyroidotomy(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      acuteStridorAndAngioedemaAirwayCrisis = true,
      emergencyNeedleCricothyroidotomyEnforced = true,
      repeatedBlindIntubationAttemptsProhibited = true,
      paralyticAgentWithoutAirwayPlanProhibited = true,
      adrenalineImAndNebulizedEnforced = true,
    } = payload || {};

    incident.acuteAngioedemaCricothyroidotomyCare = {
      isAcuteAngioedemaCricothyroidotomy: true,
      acuteStridorAndAngioedemaAirwayCrisis: Boolean(acuteStridorAndAngioedemaAirwayCrisis),
      emergencyNeedleCricothyroidotomyEnforced: Boolean(emergencyNeedleCricothyroidotomyEnforced),
      repeatedBlindIntubationAttemptsProhibited: Boolean(repeatedBlindIntubationAttemptsProhibited),
      paralyticAgentWithoutAirwayPlanProhibited: Boolean(paralyticAgentWithoutAirwayPlanProhibited),
      adrenalineImAndNebulizedEnforced: Boolean(adrenalineImAndNebulizedEnforced),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.acuteAngioedemaCricothyroidotomyCare && incident.markModified('acuteAngioedemaCricothyroidotomyCare');

    incident.auditTrail.push({
      action: 'ACUTE_ANGIOEDEMA_CRICOTHYROIDOTOMY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Co thắt khí quản ác tính/Phù mạch Quinke thanh quản (CICO): Thở rít Stridor thanh quản kịch phát=${acuteStridorAndAngioedemaAirwayCrisis}, Chọc kim màng nhẫn giáp cấp cứu=${emergencyNeedleCricothyroidotomyEnforced}, CẤM đặt NKQ mù lặp lại quá 3 lần gây bít đường thở=${repeatedBlindIntubationAttemptsProhibited}, CẤM tiêm thuốc giãn cơ khi chưa chuẩn bị mở màng nhẫn giáp=${paralyticAgentWithoutAirwayPlanProhibited}, Tiêm bắp Adrenaline 0.5mg & Khí dung Adrenaline=${adrenalineImAndNebulizedEnforced}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAcuteAngioedemaCricothyroidotomy: true,
      acuteStridorAndAngioedemaAirwayCrisis: Boolean(acuteStridorAndAngioedemaAirwayCrisis),
      emergencyNeedleCricothyroidotomyEnforced: Boolean(emergencyNeedleCricothyroidotomyEnforced),
      repeatedBlindIntubationAttemptsProhibited: Boolean(repeatedBlindIntubationAttemptsProhibited),
      paralyticAgentWithoutAirwayPlanProhibited: Boolean(paralyticAgentWithoutAirwayPlanProhibited),
      adrenalineImAndNebulizedEnforced: Boolean(adrenalineImAndNebulizedEnforced),
      clinicalDirectives: [
        `NHẬN DIỆN CƠN CO THẮT KHÍ QUẢN ÁC TÍNH & PHÙ MẠCH QUINKE CICO: Nạn nhân phù môi lưỡi cấp tính, thở rít Stridor thì hít vào, co kéo hõm ức, thiếu oxy tím tái và không thể đặt nội khí quản thông thường ("Cannot Intubate, Cannot Oxygenate - CICO") (${acuteStridorAndAngioedemaAirwayCrisis ? "BÁO ĐỘNG ĐỎ ĐƯỜNG THỞ NGUY KỊCH" : "THEO DÕI"}).`,
        `MỞ MÀNG NHẪN GIÁP CẤP CỨU NGOẠI VIỆN (CRICOTHYROIDOTOMY): Chọc kim luồn 12G - 14G xuyên qua màng nhẫn - giáp góc 45 độ hướng đuôi hoặc dùng dao mổ phác đồ Scalpel-Bougie-Tube thiết lập đường thở tức thì trong vòng 60 giây cứu não (${emergencyNeedleCricothyroidotomyEnforced ? "ĐÃ THIẾT LẬP ĐƯỜNG THỞ MÀNG NHẪN GIÁP CẤP CỨU" : "CẦN THỰC HIỆN NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM ĐẶT NỘI KHÍ QUẢN MÙ QUÁ 3 LẦN VÀ CẤM TIÊM GIÃN CƠ: Khóa cấm cố thọc ống nội khí quản mù lặp lại quá 3 lần làm phù nề và rách nát thanh môn tắc hoàn toàn (${repeatedBlindIntubationAttemptsProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BÍ RÁCH THANH MÔN" : "CỰC KỲ NGUY HIỂM"}), khóa cấm tiêm thuốc giãn cơ làm tê liệt nhịp thở tự nhiên biến nghẹt một phần thành tử vong tức khắc (${paralyticAgentWithoutAirwayPlanProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH LIỆT THỞ" : "NGUY CƠ NGỪNG THỞ ĐỘT NGỘT"}).`,
        `PHÁC ĐỒ ADRENALINE CO MẠCH THANH QUẢN & CHUYỂN VIỆN TAI MŨI HỌNG: Tiêm bắp ngay Adrenaline 0.5 mg mặt trước ngoài đùi kết hợp khí dung Adrenaline 1:1,000 co mạch niêm mạc thanh quản (${adrenalineImAndNebulizedEnforced ? "ĐÃ DÙNG ADRENALINE CO MẠCH" : "CẦN TIÊM BẮP ADRENALINE NGAY"}); chuyển khẩn cấp Khoa Tai Mũi Họng & ICU BV Tai Mũi Họng / BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 123: Hộ Tống Thông Minh Chống Đuối Nước Trẻ Em & Thợ Lặn Solo (Hydrostatic Apnea Watchdog & Submersion Geofencing)
   * Phác đồ: Cảm biến áp suất thủy tĩnh nhận diện chìm sâu > 0.5m quá 30s + Tự bung phao khí CO2 cứu sinh cổ tay + Hồi sức 5 Breaths First
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM DỐC NGƯỢC NẠN NHÂN LÊN VAI HOẶC ÉP BỤNG ĐỂ "ĐỔ NƯỚC RA" (Nước dạ dày trào ngược vào phổi gây sặc hít ngạt thở và lãng phí thời gian vàng)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI BẮT BUỘC THỔI NGẠT 5 NHỊP CỨU NẠN TRƯỚC TIÊN KHI BẮT ĐẦU CPR (Cơ chế tử vong do đuối nước là thiếu oxy não trầm trọng, bắt buộc thổi ngạt trước ép tim)
   */
  async manageHydrostaticSubmersionRescue(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      submersionDepthAndDurationAlarm = true,
      inflatableSafetyBuoyTriggered = true,
      inversionShoulderWaterDrainageProhibited = true,
      fiveRescueBreathsFirstEnforced = true,
      waterGeofencePerimeterAlerted = true,
    } = payload || {};

    incident.hydrostaticSubmersionRescueCare = {
      isHydrostaticSubmersionRescue: true,
      submersionDepthAndDurationAlarm: Boolean(submersionDepthAndDurationAlarm),
      inflatableSafetyBuoyTriggered: Boolean(inflatableSafetyBuoyTriggered),
      inversionShoulderWaterDrainageProhibited: Boolean(inversionShoulderWaterDrainageProhibited),
      fiveRescueBreathsFirstEnforced: Boolean(fiveRescueBreathsFirstEnforced),
      waterGeofencePerimeterAlerted: Boolean(waterGeofencePerimeterAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.hydrostaticSubmersionRescueCare && incident.markModified('hydrostaticSubmersionRescueCare');

    incident.auditTrail.push({
      action: 'HYDROSTATIC_SUBMERSION_RESCUE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Chống đuối nước thông minh (Hydrostatic Watchdog): Báo động ngập nước sâu > 0.5m quá 30s=${submersionDepthAndDurationAlarm}, Bung phao khí CO2 cứu sinh cổ tay=${inflatableSafetyBuoyTriggered}, CẤM dốc ngược xốc nước lên vai gây sặc hít=${inversionShoulderWaterDrainageProhibited}, BẮT BUỘC thổi ngạt 5 nhịp trước tiên khi CPR=${fiveRescueBreathsFirstEnforced}, Cảnh báo Water Geofence bán kính 200m=${waterGeofencePerimeterAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isHydrostaticSubmersionRescue: true,
      submersionDepthAndDurationAlarm: Boolean(submersionDepthAndDurationAlarm),
      inflatableSafetyBuoyTriggered: Boolean(inflatableSafetyBuoyTriggered),
      inversionShoulderWaterDrainageProhibited: Boolean(inversionShoulderWaterDrainageProhibited),
      fiveRescueBreathsFirstEnforced: Boolean(fiveRescueBreathsFirstEnforced),
      waterGeofencePerimeterAlerted: Boolean(waterGeofencePerimeterAlerted),
      rescueDirectives: [
        `NHẬN DIỆN NGUY CƠ ĐUỐI NƯỚC IM LẶNG (SILENT DROWNING): Cảm biến áp suất thủy tĩnh trên Smartwatch phát hiện người bơi chìm sâu > 0.5m liên tục quá 30 giây mà không có cử động vẫy tay bơi lội (${submersionDepthAndDurationAlarm ? "PHÁT HIỆN ĐUỐI NƯỚC IM LẶNG NGUY CẤP" : "THEO DÕI"}).`,
        `KÍCH BUNG PHAO KHÍ CO2 & PHÁT CẢNH BÁO BÁN KÍNH 200M: Cơ cấu vi nổ kích hoạt capsule CO2 bung phao cứu sinh tự nâng nạn nhân lên mặt nước và phát sóng Water Geofence báo động hiệp sĩ/bảo vệ hồ bơi (${inflatableSafetyBuoyTriggered ? "ĐÃ BUNG PHAO CỨU SINH CỔ TAY TỰ ĐỘNG" : "CẦN KÍCH HOẠT PHAO NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM DỐC NGƯỢC XỐC NƯỚC VÀ BẮT BUỘC 5 NHỊP THỔI NGẠT ĐẦU TIÊN: Khóa cấm dốc ngược nạn nhân lên vai chạy vòng quanh làm nước dạ dày trào ngược vào phổi gây sặc sáp tử vong (${inversionShoulderWaterDrainageProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH TRÀO NGƯỢC PHỔI" : "CỰC KỲ NGUY HIỂM"}), bắt buộc thổi ngạt 5 nhịp cứu nạn trước khi ép tim cung cấp oxy tức thì cho não (${fiveRescueBreathsFirstEnforced ? "ĐÃ THỰC HIỆN 5 NHỊP THỔI NGẠT CỨU NẠN TRƯỚC TIÊN" : "THIẾU OXY TẾ BÀO NÃO"}).`,
        `HỒI SỨC SƯỞI ẤM CHỐNG HẠ THÂN NHIỆT & CHUYỂN ICU: Lau khô người ủ ấm bằng chăn nhiệt, duy trì CPR 30:2 và oxy 100% qua mask (${waterGeofencePerimeterAlerted ? "ĐỘI CỨU HỘ VÀ TRUNG TÂM CẤP CỨU SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển viện ICU Hồi sức Nhi Đồng 1 / BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 124: Cấp Cứu Hội Chứng Bão Cytokine & Sốc Phản Phệ Do Ong Bắp Cày Khổng Lồ Đốt Hàng Chục Nốt (Giant Hornet Cytokine Storm & DIC)
   * Phác đồ: Hồi sức dịch lớn + Kiềm hóa nước tiểu + Methylprednisolone 1-2 mg/kg + Lọc máu hấp phụ than hoạt HA330 / PLEX trong 6-12h đầu
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM TRÌ HOÃN LỌC MÁU HẤP PHỤ / THAY HUYẾT TƯƠNG KHI NƯỚC TIỂU ĐÃ CHUYỂN MÀU NƯỚC VỐI / NÂU SẪM (Dấu hiệu Myoglobin và Hemoglobin phá hủy thận cấp vô niệu, chậm trễ tử vong 80%)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM ĐẮP VÔI TÔI NÓNG HOẶC THUỐC LÁ DÂN GIAN LÊN VẾT ĐỐT (Gây bỏng kiềm nhiệt thứ phát và tạo đường vào cho vi khuẩn uốn ván Clostridium phát triển)
   */
  async manageGiantHornetCytokineStorm(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      multipleStingsAndDarkUrineIdentified = true,
      earlyHemoperfusionAndCrrtEnforced = true,
      delayingHemoperfusionUntilAnuriaProhibited = true,
      hotLimeOrHerbalPoulticeProhibited = true,
      methylprednisoloneAndFluidExpansionAlerted = true,
    } = payload || {};

    incident.giantHornetCytokineStormCare = {
      isGiantHornetCytokineStorm: true,
      multipleStingsAndDarkUrineIdentified: Boolean(multipleStingsAndDarkUrineIdentified),
      earlyHemoperfusionAndCrrtEnforced: Boolean(earlyHemoperfusionAndCrrtEnforced),
      delayingHemoperfusionUntilAnuriaProhibited: Boolean(delayingHemoperfusionUntilAnuriaProhibited),
      hotLimeOrHerbalPoulticeProhibited: Boolean(hotLimeOrHerbalPoulticeProhibited),
      methylprednisoloneAndFluidExpansionAlerted: Boolean(methylprednisoloneAndFluidExpansionAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.giantHornetCytokineStormCare && incident.markModified('giantHornetCytokineStormCare');

    incident.auditTrail.push({
      action: 'GIANT_HORNET_CYTOKINE_STORM_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ong bắp cày đốt hàng chục nốt & Bão Cytokine: Đốt > 30 nốt + Nước tiểu nước vối=${multipleStingsAndDarkUrineIdentified}, Lọc máu hấp phụ HA330 & CRRT=${earlyHemoperfusionAndCrrtEnforced}, CẤM hoãn lọc máu chờ vô niệu=${delayingHemoperfusionUntilAnuriaProhibited}, CẤM đắp vôi nóng/lá cây=${hotLimeOrHerbalPoulticeProhibited}, Methylprednisolone & Bù dịch kiềm hóa=${methylprednisoloneAndFluidExpansionAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isGiantHornetCytokineStorm: true,
      multipleStingsAndDarkUrineIdentified: Boolean(multipleStingsAndDarkUrineIdentified),
      earlyHemoperfusionAndCrrtEnforced: Boolean(earlyHemoperfusionAndCrrtEnforced),
      delayingHemoperfusionUntilAnuriaProhibited: Boolean(delayingHemoperfusionUntilAnuriaProhibited),
      hotLimeOrHerbalPoulticeProhibited: Boolean(hotLimeOrHerbalPoulticeProhibited),
      methylprednisoloneAndFluidExpansionAlerted: Boolean(methylprednisoloneAndFluidExpansionAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN BÃO CYTOKINE & ĐÔNG MÁU NỘI MẠCH DIC DO ONG BẮP CÀY ĐỐT: Nạn nhân bị ong bắp cày khổng lồ đốt trên 30-50 nốt, sưng phù toàn thân, nước tiểu chuyển màu đỏ nâu/nước vối do tiêu cơ vân giải phóng Myoglobin ồ ạt (${multipleStingsAndDarkUrineIdentified ? "BÁO ĐỘNG SUY ĐA TẠNG TỐI CẤP" : "THEO DÕI"}).`,
        `CHỈ ĐỊNH LỌC MÁU HẤP PHỤ THAN HOẠT (HA330) & THAY HUYẾT TƯƠNG PLEX SỚM: Khởi động lọc máu hấp phụ trong 6-12 giờ đầu để dọn sạch nọc độc Mandaratoxin và các chất trung gian gây viêm IL-6, TNF-alpha (${earlyHemoperfusionAndCrrtEnforced ? "ĐÃ THIẾT LẬP LỌC MÁU HẤP PHỤ SỚM" : "CẦN LỌC MÁU NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM HOÃN LỌC MÁU VÀ CẤM ĐẮP VÔI NÓNG/LÁ CÂY: Khóa cấm trì hoãn lọc máu để chờ nạn nhân vô niệu hoàn toàn tránh hoại tử ống thận cấp tử vong (${delayingHemoperfusionUntilAnuriaProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH TRÌ HOÃN LỌC MÁU" : "CỰC KỲ NGUY HIỂM"}), khóa cấm đắp vôi tôi sinh nhiệt hoặc lá cây dân gian gây bỏng kiềm hoại tử và nhiễm trùng uốn ván (${hotLimeOrHerbalPoulticeProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BỎNG VÀ NHIỄM TRÙNG" : "NGUY CƠ BỎNG KIỀM TỬ VONG"}).`,
        `HỒI SỨC DỊCH KIỀM HÓA & KHÁNG VIÊM LIỀU CAO: Truyền tĩnh mạch NaCl 0.9% tốc độ 200 - 300 mL/h kết hợp Natri Bicarbonat kiềm hóa nước tiểu (pH > 6.5) ngăn lắng đọng trụ Myoglobin; tiêm tĩnh mạch Methylprednisolone 1-2 mg/kg (${methylprednisoloneAndFluidExpansionAlerted ? "PHÁC ĐỒ HỒI SỨC SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển Trung tâm Chống độc BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 125: Cứu Hộ Đắm Thuyền / Rơi Xuống Biển Đêm Solo & Phác Đồ H.E.L.P + Đèn Chớp Strobe SOS
   * Phác đồ: Tư thế H.E.L.P bảo tồn thân nhiệt + Đèn chớp Strobe SOS OLED 100% độ sáng định vị trực thăng SAR + Báo động hàng hải MRCC
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM CỞI BỎ QUẦN ÁO ĐỂ "BƠI CHO NHẸ" (Quần áo giữ lớp nước mỏng được sưởi ấm cách nhiệt, cởi bỏ làm thân nhiệt tụt dốc chết cóng sau 45 phút)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM UỐNG NƯỚC BIỂN DÙ KHÁT CHÁY CỔ (Nước biển nồng độ muối 3.5% hút nước tế bào não gây mê sảng, co giật và tử vong do suy thận cấp)
   */
  async manageMaritimeImmersionSurvival(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      offshoreDriftAndNightfallIdentified = true,
      heatEscapeLesseningPostureAndStrobeEnforced = true,
      sheddingClothesToSwimLightProhibited = true,
      drinkingSeawaterThirstProhibited = true,
      maritimeSarHelicopterBeaconAlerted = true,
    } = payload || {};

    incident.maritimeImmersionSurvivalCare = {
      isMaritimeImmersionSurvival: true,
      offshoreDriftAndNightfallIdentified: Boolean(offshoreDriftAndNightfallIdentified),
      heatEscapeLesseningPostureAndStrobeEnforced: Boolean(heatEscapeLesseningPostureAndStrobeEnforced),
      sheddingClothesToSwimLightProhibited: Boolean(sheddingClothesToSwimLightProhibited),
      drinkingSeawaterThirstProhibited: Boolean(drinkingSeawaterThirstProhibited),
      maritimeSarHelicopterBeaconAlerted: Boolean(maritimeSarHelicopterBeaconAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.maritimeImmersionSurvivalCare && incident.markModified('maritimeImmersionSurvivalCare');

    incident.auditTrail.push({
      action: 'MARITIME_IMMERSION_SURVIVAL_CARE_RECORDED',
      timestamp: new Date(),
      details: `Rơi xuống biển sâu/Đắm thuyền ban đêm: Trôi dạt biển xa ban đêm=${offshoreDriftAndNightfallIdentified}, Tư thế H.E.L.P & Đèn chớp Strobe SOS=${heatEscapeLesseningPostureAndStrobeEnforced}, CẤM cởi bỏ quần áo bơi cho nhẹ=${sheddingClothesToSwimLightProhibited}, CẤM uống nước biển khi khát=${drinkingSeawaterThirstProhibited}, Báo động Tìm kiếm Cứu nạn Hàng hải MRCC & SAR=${maritimeSarHelicopterBeaconAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isMaritimeImmersionSurvival: true,
      offshoreDriftAndNightfallIdentified: Boolean(offshoreDriftAndNightfallIdentified),
      heatEscapeLesseningPostureAndStrobeEnforced: Boolean(heatEscapeLesseningPostureAndStrobeEnforced),
      sheddingClothesToSwimLightProhibited: Boolean(sheddingClothesToSwimLightProhibited),
      drinkingSeawaterThirstProhibited: Boolean(drinkingSeawaterThirstProhibited),
      maritimeSarHelicopterBeaconAlerted: Boolean(maritimeSarHelicopterBeaconAlerted),
      survivalDirectives: [
        `NHẬN DIỆN NGUY CƠ RƠI XUỐNG BIỂN SÂU BAN ĐÊM: Ngư dân/thuyền viên trôi dạt trên biển trong đêm tối, mất phương hướng, hạ thân nhiệt và nguy cơ kiệt sức chìm sâu (${offshoreDriftAndNightfallIdentified ? "BÁO ĐỘNG SINH TỒN HÀNG HẢI KHẨN CẤP" : "THEO DÕI"}).`,
        `KÍCH HOẠT TƯ THẾ H.E.L.P & ĐÈN CHỚP STROBE SOS: Hướng dẫn co hai gối ép sát ngực, hai tay ôm chặt sườn che 3 vùng mất nhiệt (ngực, nách, háng) kéo dài thời gian sống sót gấp 3 lần; màn hình Smartwatch chớp nháy Strobe SOS định vị quang học xa 1-2 hải lý (${heatEscapeLesseningPostureAndStrobeEnforced ? "ĐÃ THIẾT LẬP TƯ THẾ H.E.L.P VÀ ĐÈN STROBE SOS" : "CẦN KÍCH HOẠT NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG SINH TỬ: CẤM CỞI QUẦN ÁO VÀ CẤM UỐNG NƯỚC BIỂN: Khóa cảnh báo cấm cởi bỏ quần áo để bơi vì làm mất lớp nước đệm nhiệt khiến thân nhiệt tụt dốc tử vong sau 45 phút (${sheddingClothesToSwimLightProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH CHẾT CÓNG NHANH" : "CỰC KỲ NGUY HIỂM"}), khóa cảnh báo cấm uống nước biển mặn 3.5% gây hút nước não mê sảng phù não co giật tử vong (${drinkingSeawaterThirstProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH NHIỄM ĐỘC MUỐI NÃO" : "NGUY CƠ CO GIẬT TỬ VONG"}).`,
        `PHỐI HỢP CỨU NẠN HÀNG HẢI TRỰC THĂNG SAR: Phát tọa độ GPS trôi dạt theo dòng hải lưu tới Trung tâm Phối hợp Tìm kiếm Cứu nạn Hàng hải (Vietnam MRCC) và các tàu cá xung quanh (${maritimeSarHelicopterBeaconAlerted ? "ĐÃ BÁO ĐỘNG MRCC VÀ TÀU SAR" : "CHỜ ĐIỀU PHỐI"}); chuyển viện cấp cứu hồi sức hạ thân nhiệt sâu BV Quân Y 175 / BV Chợ Rẫy.`,
      ],
    };
  }

  /**
   * Phân hệ 126: Cấp Cứu Cơn Hạ Thân Nhiệt Nghịch Lý "Cởi Bỏ Quần Áo Tử Thần" (Paradoxical Undressing Hypothermia & Terminal Burrowing)
   * Phác đồ: Báo động loa cực đại ngăn cản hành vi cởi đồ + Hướng dẫn tìm nơi trú ẩn tránh gió + Làm ấm thụ động trung tâm
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM UỐNG RƯỢU ĐỂ "SƯỞI ẤM" (Rượu làm giãn mạch ngoại vi, đẩy nhanh mất nhiệt trung tâm gấp 3 lần và ức chế trung tâm run tạo nhiệt não)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM CỌ XÁT BẰNG TUYẾT HOẶC MÁT-XA MẠNH TỨ CHI (Gây tổn thương rách nát mô lạnh và kích thích dòng máu lạnh toan hóa tràn về tim gây rung thất ngừng tim)
   */
  async manageParadoxicalUndressingHypothermia(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      terminalBurrowingAndDeliriumIdentified = true,
      voiceEmergencyLoudspeakerAlertEnforced = true,
      drinkingAlcoholToWarmUpProhibited = true,
      snowFrictionOrVigorousMassageProhibited = true,
      gradualCoreRewarmingAndVacuumMattressAlerted = true,
    } = payload || {};

    incident.paradoxicalUndressingHypothermiaCare = {
      isParadoxicalUndressingHypothermia: true,
      terminalBurrowingAndDeliriumIdentified: Boolean(terminalBurrowingAndDeliriumIdentified),
      voiceEmergencyLoudspeakerAlertEnforced: Boolean(voiceEmergencyLoudspeakerAlertEnforced),
      drinkingAlcoholToWarmUpProhibited: Boolean(drinkingAlcoholToWarmUpProhibited),
      snowFrictionOrVigorousMassageProhibited: Boolean(snowFrictionOrVigorousMassageProhibited),
      gradualCoreRewarmingAndVacuumMattressAlerted: Boolean(gradualCoreRewarmingAndVacuumMattressAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.paradoxicalUndressingHypothermiaCare && incident.markModified('paradoxicalUndressingHypothermiaCare');

    incident.auditTrail.push({
      action: 'PARADOXICAL_UNDRESSING_HYPOTHERMIA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hạ thân nhiệt nghịch lý (Paradoxical Undressing): Ảo giác nóng bừng cởi quần áo + Chui rúc hốc đá=${terminalBurrowingAndDeliriumIdentified}, Còi loa khẩn cấp ngăn cởi đồ=${voiceEmergencyLoudspeakerAlertEnforced}, CẤM uống rượu sưởi ấm=${drinkingAlcoholToWarmUpProhibited}, CẤM cọ xát bằng tuyết/mát-xa mạnh=${snowFrictionOrVigorousMassageProhibited}, Làm ấm trung tâm & Đệm chân không=${gradualCoreRewarmingAndVacuumMattressAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isParadoxicalUndressingHypothermia: true,
      terminalBurrowingAndDeliriumIdentified: Boolean(terminalBurrowingAndDeliriumIdentified),
      voiceEmergencyLoudspeakerAlertEnforced: Boolean(voiceEmergencyLoudspeakerAlertEnforced),
      drinkingAlcoholToWarmUpProhibited: Boolean(drinkingAlcoholToWarmUpProhibited),
      snowFrictionOrVigorousMassageProhibited: Boolean(snowFrictionOrVigorousMassageProhibited),
      gradualCoreRewarmingAndVacuumMattressAlerted: Boolean(gradualCoreRewarmingAndVacuumMattressAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN CƠN HẠ THÂN NHIỆT NGHỊCH LÝ "CỞI BỎ QUẦN ÁO TỬ THẦN": Người đi rừng núi lạnh giá thân nhiệt tụt dưới 30°C, liệt vận mạch ngoại vi tạo cảm giác ảo giác nóng như thiêu đốt, bắt đầu cởi bỏ hết quần áo và chui rúc vào hốc cây kẹt đá (${terminalBurrowingAndDeliriumIdentified ? "ẢO GIÁC HẠ THÂN NHIỆT ÁC TÍNH ĐE DỌA TỬ VONG" : "THEO DÕI"}).`,
        `KÍCH HOẠT CÒI LOA CỰC ĐẠI NGĂN CẢN CỞI QUẦN ÁO: Loa Smartwatch và điện thoại phát cảnh báo khẩn cấp âm lượng lớn: "BẠN ĐANG BỊ ẢO GIÁC NÓNG DO HẠ THÂN NHIỆT ÁC TÍNH! TUYỆT ĐỐI KHÔNG CỞI ĐỒ! MẶC THÊM ÁO ẤM VÀ TÌM NƠI TRÁNH GIÓ NGAY!" (${voiceEmergencyLoudspeakerAlertEnforced ? "ĐÃ PHÁT CẢNH BÁO GIỌNG NÓI LOA NGOÀI CỰC ĐẠI" : "CẦN PHÁT CẢNH BÁO NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM UỐNG RƯỢU VÀ CẤM CỌ XÁT BẰNG TUYẾT: Khóa cảnh báo cấm uống rượu vì rượu gây giãn mạch ngoại vi làm nhiệt trung tâm quả tim tụt sâu gấp 3 lần (${drinkingAlcoholToWarmUpProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH GIÃN MẠCH MẤT NHIỆT" : "CỰC KỲ NGUY HIỂM"}), khóa cấm chà xát bằng tuyết hoặc xoa bóp mạnh tứ chi tránh làm rách nát mô lạnh và tràn máu lạnh toan hóa về tim gây rung thất ngừng tim (${snowFrictionOrVigorousMassageProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH KÍCH THÍCH RUNG THẤT" : "NGUY CƠ NGỪNG TIM ĐỘT NGỘT"}).`,
        `SƯỞI ẤM TRUNG TÂM THỤ ĐỘNG & ĐỆM CHÂN KHÔNG: Bọc kín nạn nhân bằng chăn cách nhiệt nhôm phản xạ, truyền dịch tinh thể làm ấm 40-42°C, vận chuyển bằng đệm hút chân không Vacuum Mattress di chuyển cực nhẹ (${gradualCoreRewarmingAndVacuumMattressAlerted ? "PHÁC ĐỒ Ủ ẤM TRUNG TÂM SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển ICU BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 127: Cấp Cứu Ngộ Độc Cấp Thuốc Diệt Cỏ Paraquat / Diquat & Phác Đồ Lọc Máu Hấp Phụ Sớm Cửa Sổ Vàng (Paraquat Poisoning Hemoperfusion)
   * Phác đồ: Uống đất sét Fuller's Earth / Than hoạt tính + Lọc máu hấp phụ Hemoperfusion kép than hoạt HA330 trong cửa sổ vàng 2-4h + Truyền NAC liều cao
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM THỞ OXY LIỀU CAO KHI SpO2 >= 85% (Oxy dòng cao xúc tác bùng nổ phản ứng oxy hóa Fenton tạo gốc tự do superoxide phá hủy xơ hóa toàn bộ phổi tử vong)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM TRÌ HOÃN LỌC MÁU HẤP PHỤ QUA CỬA SỔ VÀNG 4 GIỜ ĐẦU (Paraquat ngấm vào mô phổi đạt nồng độ gấp 10-20 lần máu, lọc máu muộn không còn tác dụng cứu sống)
   */
  async manageParaquatPoisoningHemoperfusion(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      paraquatHerbicideIngestionIdentified = true,
      fullersEarthAndHemoperfusionEnforced = true,
      highFlowOxygenWhenSpO2Above85Prohibited = true,
      delayingHemoperfusionBeyondGoldenWindowProhibited = true,
      nacAntioxidantAndCrrtCenterAlerted = true,
    } = payload || {};

    incident.paraquatPoisoningHemoperfusionCare = {
      isParaquatPoisoning: true,
      paraquatHerbicideIngestionIdentified: Boolean(paraquatHerbicideIngestionIdentified),
      fullersEarthAndHemoperfusionEnforced: Boolean(fullersEarthAndHemoperfusionEnforced),
      highFlowOxygenWhenSpO2Above85Prohibited: Boolean(highFlowOxygenWhenSpO2Above85Prohibited),
      delayingHemoperfusionBeyondGoldenWindowProhibited: Boolean(delayingHemoperfusionBeyondGoldenWindowProhibited),
      nacAntioxidantAndCrrtCenterAlerted: Boolean(nacAntioxidantAndCrrtCenterAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.paraquatPoisoningHemoperfusionCare && incident.markModified('paraquatPoisoningHemoperfusionCare');

    incident.auditTrail.push({
      action: 'PARAQUAT_POISONING_HEMOPERFUSION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc thuốc diệt cỏ Paraquat: Xác nhận uống Paraquat/Diquat=${paraquatHerbicideIngestionIdentified}, Đất sét Fuller's Earth & Lọc máu hấp phụ kép=${fullersEarthAndHemoperfusionEnforced}, CẤM thở oxy liều cao khi SpO2 >= 85%=${highFlowOxygenWhenSpO2Above85Prohibited}, CẤM hoãn lọc máu qua cửa sổ vàng 4h=${delayingHemoperfusionBeyondGoldenWindowProhibited}, Truyền NAC liều cao & Lọc CRRT=${nacAntioxidantAndCrrtCenterAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isParaquatPoisoning: true,
      paraquatHerbicideIngestionIdentified: Boolean(paraquatHerbicideIngestionIdentified),
      fullersEarthAndHemoperfusionEnforced: Boolean(fullersEarthAndHemoperfusionEnforced),
      highFlowOxygenWhenSpO2Above85Prohibited: Boolean(highFlowOxygenWhenSpO2Above85Prohibited),
      delayingHemoperfusionBeyondGoldenWindowProhibited: Boolean(delayingHemoperfusionBeyondGoldenWindowProhibited),
      nacAntioxidantAndCrrtCenterAlerted: Boolean(nacAntioxidantAndCrrtCenterAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN NGỘ ĐỘC CẤP THUỐC DIỆT CỎ PARAQUAT / DIQUAT: Nạn nhân uống thuốc trừ cỏ màu xanh lam/xanh lục, bỏng loét niêm mạc miệng thực quản, nguy cơ xơ hóa phổi tiến triển và suy đa tạng tử vong (${paraquatHerbicideIngestionIdentified ? "BÁO ĐỘNG NGỘ ĐỘC PARAQUAT NGUY KỊCH TỬ VONG" : "THEO DÕI"}).`,
        `HẤP THỤ ĐƯỜNG TIÊU HÓA BẰNG ĐẤT SÉT FULLER'S EARTH & LỌC MÁU HẤP PHỤ KÉP SỚM: Cho uống ngay hỗn dịch Fuller's Earth 100-150g hoặc than hoạt tính bao bọc đường tiêu hóa; kích hoạt ngay hệ thống lọc máu hấp phụ Hemoperfusion kép cột than hoạt trong cửa sổ vàng 2-4 giờ đầu (${fullersEarthAndHemoperfusionEnforced ? "ĐÃ THIẾT LẬP HẤP PHỤ TIÊU HÓA VÀ LỌC MÁU" : "CẦN LỌC MÁU HẤP PHỤ NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM THỞ OXY LIỀU CAO VÀ CẤM TRÌ HOÃN LỌC MÁU: Khóa cấm thở oxy liều cao khi SpO2 >= 85% vì oxy là chất xúc tác sinh hàng tỷ gốc tự do superoxide phá hủy xơ hóa phổi không thể đảo ngược (${highFlowOxygenWhenSpO2Above85Prohibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BÙNG NỔ XƠ PHỔI" : "CỰC KỲ NGUY HIỂM"}), khóa cấm trì hoãn lọc máu qua mốc 4 giờ đầu vì sau đó độc chất ngấm sâu vào phế nang làm lọc máu mất tác dụng (${delayingHemoperfusionBeyondGoldenWindowProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH CHẬM TRỄ CỬA SỔ VÀNG" : "NGUY CƠ XƠ PHỔI TỬ VONG"}).`,
        `PHÁC ĐỒ CHỐNG OXY HÓA BẢO VỆ PHỔI BẰNG NAC LIỀU CAO: Truyền tĩnh mạch liên tục N-acetylcysteine (NAC) 150 mg/kg kết hợp Vitamin C và Vitamin E liều cao dập tắt các gốc tự do (${nacAntioxidantAndCrrtCenterAlerted ? "PHÁC ĐỒ NAC VÀ LỌC CRRT SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển Trung tâm Chống độc BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 128: Cấp Cứu Xoắn Tinh Hoàn Cấp Tính & Phục Hồi Tưới Máu Cửa Sổ Vàng Dưới 6 Giờ (Acute Testicular Torsion Golden Window < 6h)
   * Phác đồ: Siêu âm cấp cứu Doppler mạch máu bìu + Nghiệm pháp tháo xoắn thủ công Open-Book (từ trong ra ngoài) + Mổ cấp cứu cố định 2 bên
   * CHỐNG CHỈ ĐỊNH HOẠI TỬ SỐ 1: TUYỆT ĐỐI CẤM CHƯỜM NÓNG HOẶC DÙNG THUỐC GIẢM ĐAU MẠNH TRƯỚC KHI KHÁM (Chườm nóng làm tăng chuyển hóa gây hoại tử nhanh hơn, giảm đau làm lu mờ triệu chứng qua cửa sổ vàng 6h dẫn đến cắt bỏ tinh hoàn)
   * CHỐNG CHỈ ĐỊNH HOẠI TỬ SỐ 2: TUYỆT ĐỐI CẤM XOAY SAI CHIỀU VÀO TRONG VÀ CẤM TRÌ HOÃN PHẪU THUẬT (Xoay sai chiều siết chặt thêm thừng tinh tắc tử động mạch, trì hoãn > 6h tỷ lệ hoại tử cắt bỏ lên tới 90%)
   */
  async manageAcuteTesticularTorsion(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy ca cấp cứu');

    const {
      scrotalPainAndBellClapperDeformityIdentified = true,
      openBookManualDetorsionAndUrgentEchoEnforced = true,
      hotCompressAndStrongAnalgesicBeforeExamProhibited = true,
      inwardRotationAndDelayedSurgeryProhibited = true,
      emergencyUrologicOrchiopexyAlerted = true,
    } = payload || {};

    incident.acuteTesticularTorsionCare = {
      isAcuteTesticularTorsion: true,
      scrotalPainAndBellClapperDeformityIdentified: Boolean(scrotalPainAndBellClapperDeformityIdentified),
      openBookManualDetorsionAndUrgentEchoEnforced: Boolean(openBookManualDetorsionAndUrgentEchoEnforced),
      hotCompressAndStrongAnalgesicBeforeExamProhibited: Boolean(hotCompressAndStrongAnalgesicBeforeExamProhibited),
      inwardRotationAndDelayedSurgeryProhibited: Boolean(inwardRotationAndDelayedSurgeryProhibited),
      emergencyUrologicOrchiopexyAlerted: Boolean(emergencyUrologicOrchiopexyAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };
    incident.acuteTesticularTorsionCare && incident.markModified('acuteTesticularTorsionCare');

    incident.auditTrail.push({
      action: 'ACUTE_TESTICULAR_TORSION_CARE_RECORDED',
      timestamp: new Date(),
      details: `Xoắn tinh hoàn cấp tính: Đau bẹn bìu dữ dội + Mất phản xạ cơ bìu=${scrotalPainAndBellClapperDeformityIdentified}, Nghiệm pháp tháo xoắn Open-Book & Siêu âm Doppler=${openBookManualDetorsionAndUrgentEchoEnforced}, CẤM chườm nóng & CẤM giảm đau che triệu chứng=${hotCompressAndStrongAnalgesicBeforeExamProhibited}, CẤM xoay sai chiều & CẤM hoãn mổ=${inwardRotationAndDelayedSurgeryProhibited}, Báo động Ngoại Tiết niệu mổ tháo xoắn < 6h=${emergencyUrologicOrchiopexyAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isAcuteTesticularTorsion: true,
      scrotalPainAndBellClapperDeformityIdentified: Boolean(scrotalPainAndBellClapperDeformityIdentified),
      openBookManualDetorsionAndUrgentEchoEnforced: Boolean(openBookManualDetorsionAndUrgentEchoEnforced),
      hotCompressAndStrongAnalgesicBeforeExamProhibited: Boolean(hotCompressAndStrongAnalgesicBeforeExamProhibited),
      inwardRotationAndDelayedSurgeryProhibited: Boolean(inwardRotationAndDelayedSurgeryProhibited),
      emergencyUrologicOrchiopexyAlerted: Boolean(emergencyUrologicOrchiopexyAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN CƠN XOẮN TINH HOÀN CẤP TÍNH CỬA SỔ VÀNG < 6 GIỜ: Nam giới độc thân đau dữ dội bìu bẹn đột ngột khi ngủ dậy hoặc chấn thương, tinh hoàn treo cao nằm ngang (dấu hiệu quả chuông xoay ngang), mất hoàn toàn phản xạ cơ bìu (${scrotalPainAndBellClapperDeformityIdentified ? "BÁO ĐỘNG ĐỎ NGOẠI TIẾN NIỆU CỬA SỔ VÀNG 6H" : "THEO DÕI"}).`,
        `SIÊU ÂM DOPPLER MẠCH MÁU & NGHIỆM PHÁP THÁO XOẮN OPEN-BOOK: Siêu âm cấp cứu đánh giá phổ mạch Doppler triệt tiêu; kíp cấp cứu thực hiện thao tác tháo xoắn thủ công "mở cuốn sách" xoay từ trong ra ngoài góc 180-360 độ nhằm tái tưới máu tức thì cứu mô (${openBookManualDetorsionAndUrgentEchoEnforced ? "ĐÃ THỰC HIỆN THÁO XOẮN THỦ CÔNG VÀ SIÊU ÂM" : "CẦN SIÊU ÂM DOPPLER NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH HOẠI TỬ CẮT BỎ: CẤM CHƯỜM NÓNG VÀ CẤM XOAY SAI CHIỀU VÀO TRONG: Khóa cấm chườm nóng và cấm dùng giảm đau mạnh trước khi khám làm lu mờ triệu chứng khiến bệnh nhân ngủ quên qua cửa sổ vàng 6h dẫn đến hoại tử mô cắt bỏ vĩnh viễn (${hotCompressAndStrongAnalgesicBeforeExamProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH CHE DẤU TRIỆU CHỨNG" : "CỰC KỲ NGUY HIỂM"}), khóa cấm xoay vặn sai chiều vào trong làm siết nghẽn động mạch tinh hoàn tắc tử (${inwardRotationAndDelayedSurgeryProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH SIẾT TẮC MẠCH" : "NGUY CƠ HOẠI TỬ TINH HOÀN"}).`,
        `PHẪU THUẬT NGOẠI TIẾT NIỆU THÁO XOẮN & CỐ ĐỊNH 2 BÊN (BILATERAL ORCHIOPEXY): Chuyển thẳng phòng mổ cấp cứu Ngoại Tiết niệu tháo xoắn giải áp và bắt buộc khâu cố định cả 2 bên tinh hoàn ngăn ngừa tái phát (${emergencyUrologicOrchiopexyAlerted ? "PHÒNG MỔ TIẾT NIỆU SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển viện cấp cứu BV Bình Dân / BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 129: Cấp Cứu Ngộ Độc Khí Carbon Monoxide (CO) Phòng Kín & Buồng Oxy Cao Áp HBOT (Acute Carbon Monoxide Poisoning & Hyperbaric Oxygen Therapy Protocol)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM DỰA VÀO CHỈ SỐ MÁY ĐO SpO2 THÔNG THƯỜNG (SpO2 xung thông thường không phân biệt được Carboxyhemoglobin HbCO và Oxyhemoglobin HbO2, hiển thị 98-100% giả tạo che giấu tình trạng ngạt tế bào nặng)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM TRÌ HOÃN CHUYỂN VIỆN BUỒNG OXY CAO ÁP QUA CỬA SỔ VÀNG 6H ĐẦU (Gây hội chứng di chứng thần kinh tâm thần muộn không thể phục hồi)
   */
  async manageCarbonMonoxidePoisoningHbot(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Rescue incident not found');

    const {
      enclosedSpaceCoExposureIdentified = true,
      highFlowNormobaricO2NonRebreatherEnforced = true,
      relyingSolelyOnPulseOximetryProhibited = true,
      delayingTransferToHyperbaricChamberProhibited = true,
      hyperbaricOxygenTherapyHbotAlerted = true,
    } = payload;

    if (relyingSolelyOnPulseOximetryProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối CẤM chỉ dựa vào máy đo SpO2 xung thông thường vì máy không phân biệt được HbCO và HbO2, hiển thị 98-100% giả tạo che giấu ngạt mô thiếu oxy não!'
      );
    }

    if (delayingTransferToHyperbaricChamberProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối CẤM trì hoãn chuyển viện buồng Oxy cao áp HBOT qua mốc 6 giờ vàng ở bệnh nhân có tổn thương thần kinh, hôn mê hoặc HbCO > 25%!'
      );
    }

    incident.carbonMonoxidePoisoningHbotCare = {
      isCarbonMonoxidePoisoning: true,
      enclosedSpaceCoExposureIdentified: Boolean(enclosedSpaceCoExposureIdentified),
      highFlowNormobaricO2NonRebreatherEnforced: Boolean(highFlowNormobaricO2NonRebreatherEnforced),
      relyingSolelyOnPulseOximetryProhibited: Boolean(relyingSolelyOnPulseOximetryProhibited),
      delayingTransferToHyperbaricChamberProhibited: Boolean(delayingTransferToHyperbaricChamberProhibited),
      hyperbaricOxygenTherapyHbotAlerted: Boolean(hyperbaricOxygenTherapyHbotAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };

    incident.carbonMonoxidePoisoningHbotCare && incident.markModified('carbonMonoxidePoisoningHbotCare');

    incident.auditTrail.push({
      action: 'CARBON_MONOXIDE_POISONING_HBOT_CARE_RECORDED',
      timestamp: new Date(),
      details: `Ngộ độc khí CO phòng kín: Tiếp xúc CO phòng kín=${enclosedSpaceCoExposureIdentified}, Thở Oxy 100% túi không thở lại=${highFlowNormobaricO2NonRebreatherEnforced}, CẤM tin SpO2 thông thường=${relyingSolelyOnPulseOximetryProhibited}, CẤM hoãn chuyển buồng HBOT=${delayingTransferToHyperbaricChamberProhibited}, Báo động Buồng Oxy Cao Áp HBOT 2.5-3.0 ATA=${hyperbaricOxygenTherapyHbotAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isCarbonMonoxidePoisoning: true,
      enclosedSpaceCoExposureIdentified: Boolean(enclosedSpaceCoExposureIdentified),
      highFlowNormobaricO2NonRebreatherEnforced: Boolean(highFlowNormobaricO2NonRebreatherEnforced),
      relyingSolelyOnPulseOximetryProhibited: Boolean(relyingSolelyOnPulseOximetryProhibited),
      delayingTransferToHyperbaricChamberProhibited: Boolean(delayingTransferToHyperbaricChamberProhibited),
      hyperbaricOxygenTherapyHbotAlerted: Boolean(hyperbaricOxygenTherapyHbotAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN NGỘ ĐỘC KHÍ CO PHÒNG KÍN / XE HƠI: Hôn mê, đau đầu, buồn nôn, thở dốc, da hồng quả đào muộn trong môi trường đốt than sưởi, phòng xông hơi, xe hơi bật máy lạnh kín (${enclosedSpaceCoExposureIdentified ? "BÁO ĐỘNG NGỘ ĐỘC CO CẤP" : "THEO DÕI"}).`,
        `THỞ OXY 100% MẶT NẠ TÚI KHÔNG THỞ LẠI (NRB) 15L/PHÚT: Tăng tốc độ đào thải HbCO từ t1/2 320 phút xuống 80 phút tức thì (${highFlowNormobaricO2NonRebreatherEnforced ? "ĐÃ THỞ OXY LIỀU CAO NRB" : "CẦN THỞ OXY NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM TIN SpO2 XUNG VÀ CẤM HOÃN CHUYỂN HBOT: Khóa cấm dựa vào SpO2 xung thông thường đọc 100% giả tạo (${relyingSolelyOnPulseOximetryProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BỎ SÓT CHẨN ĐOÁN" : "CỰC KỲ NGUY HIỂM"}), khóa cấm hoãn chuyển buồng HBOT qua mốc 6 giờ vàng (${delayingTransferToHyperbaricChamberProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH DI CHỨNG THẦN KINH" : "NGUY CƠ TỔN THƯƠNG NÃO VĨNH VIỄN"}).`,
        `ĐIỀU TRỊ BUỒNG OXY CAO ÁP (HBOT 2.5 - 3.0 ATA): Đẩy nhanh đào thải CO khỏi tế bào trong 23 phút và phục hồi enzyme hô hấp Cytochrome c Oxidase (${hyperbaricOxygenTherapyHbotAlerted ? "TRUNG TÂM OXY CAO ÁP SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển viện Trung tâm Oxy Cao Áp TP.HCM / BV 115 / BV Chợ Rẫy.`,
      ],
    };
  }

  /**
   * Phân hệ 130: Cấp Cứu Vết Thương Đứt Rách Động Mạch Cảnh & Mạch Máu Cổ Ngoại Viện (Penetrating Carotid Artery & Neck Vascular Hemorrhage Control)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM DÙNG DÂY GARROT QUẤN SIẾT VÒNG QUANH CỔ (Gây ngạt thở cơ học và ngưng dòng máu nuôi não toàn bộ tức thì)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM CHÈN ÉP ĐỒNG THỜI CẢ 2 BÊN ĐỘNG MẠCH CẢNH (Kích thích xoang cảnh gây ngưng tim phản xạ và thiếu máu não cấp)
   */
  async managePenetratingCarotidNeckHemorrhage(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Rescue incident not found');

    const {
      pulsatileCarotidHemorrhageIdentified = true,
      directDigitalPressureAndWoundPackingEnforced = true,
      circumferentialNeckTourniquetProhibited = true,
      bilateralCarotidCompressionProhibited = true,
      cardiovascularSurgeryCenterAlerted = true,
    } = payload;

    if (circumferentialNeckTourniquetProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối CẤM dùng garrot hoặc dây thắt siết chặt vòng quanh cổ gây ngạt thở cơ học và cắt đứt tuần hoàn não tức thì!'
      );
    }

    if (bilateralCarotidCompressionProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối CẤM chèn ép đồng thời cả hai bên động mạch cảnh gây thiếu máu não toàn phần và kích thích xoang cảnh ngừng tim phản xạ!'
      );
    }

    incident.penetratingCarotidNeckHemorrhageCare = {
      isPenetratingCarotidNeckHemorrhage: true,
      pulsatileCarotidHemorrhageIdentified: Boolean(pulsatileCarotidHemorrhageIdentified),
      directDigitalPressureAndWoundPackingEnforced: Boolean(directDigitalPressureAndWoundPackingEnforced),
      circumferentialNeckTourniquetProhibited: Boolean(circumferentialNeckTourniquetProhibited),
      bilateralCarotidCompressionProhibited: Boolean(bilateralCarotidCompressionProhibited),
      cardiovascularSurgeryCenterAlerted: Boolean(cardiovascularSurgeryCenterAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };

    incident.penetratingCarotidNeckHemorrhageCare && incident.markModified('penetratingCarotidNeckHemorrhageCare');

    incident.auditTrail.push({
      action: 'PENETRATING_CAROTID_NECK_HEMORRHAGE_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vết thương động mạch cảnh cổ: Máu phun vòi pulsatile=${pulsatileCarotidHemorrhageIdentified}, Ấn trực tiếp & Nhét gạc chéo nách=${directDigitalPressureAndWoundPackingEnforced}, CẤM garrot quanh cổ=${circumferentialNeckTourniquetProhibited}, CẤM ép 2 bên cổ=${bilateralCarotidCompressionProhibited}, Báo động Phẫu thuật Tim Mạch & Truyền máu MTP=${cardiovascularSurgeryCenterAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isPenetratingCarotidNeckHemorrhage: true,
      pulsatileCarotidHemorrhageIdentified: Boolean(pulsatileCarotidHemorrhageIdentified),
      directDigitalPressureAndWoundPackingEnforced: Boolean(directDigitalPressureAndWoundPackingEnforced),
      circumferentialNeckTourniquetProhibited: Boolean(circumferentialNeckTourniquetProhibited),
      bilateralCarotidCompressionProhibited: Boolean(bilateralCarotidCompressionProhibited),
      cardiovascularSurgeryCenterAlerted: Boolean(cardiovascularSurgeryCenterAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN VẾT THƯƠNG ĐỨT RÁCH ĐỘNG MẠCH CẢNH / CỔ: Nạn nhân bị cứa cổ do tôn, kính vỡ, hung khí, máu đỏ tươi phun theo nhịp tim, sốc mất máu tử vong trong 60-90 giây (${pulsatileCarotidHemorrhageIdentified ? "BÁO ĐỘNG ĐỎ XUẤT HUYẾT TỐI CẤP" : "THEO DÕI"}).`,
        `CẦM MÁU BẰNG ẤN CHÈN TRỰC TIẾP & BĂNG VÒNG QUA NÁCH ĐỐI DIỆN: Dùng ngón tay ấn trực tiếp lên điểm chảy máu hoặc nhét chặt gạc cầm máu tẩm Celox/QuikClot vào ổ vết thương, băng chéo qua nách bên đối diện để không chèn ép đường thở (${directDigitalPressureAndWoundPackingEnforced ? "ĐÃ CẦM MÁU ĐÚNG KỸ THUẬT NGOẠI KHOA" : "CẦN ẤN CHÈN ÉP NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM GARROT QUANH CỔ VÀ CẤM ÉP CẢ 2 BÊN ĐỘNG MẠCH: Khóa cấm tuyệt đối dùng dây quấn garrot quanh cổ gây nghẹt thở tử vong tức thì (${circumferentialNeckTourniquetProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH NGẠT THỞ" : "CỰC KỲ NGUY HIỂM"}), khóa cấm ép 2 bên động mạch cảnh gây ngưng tim phản xạ (${bilateralCarotidCompressionProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH THIẾU MÁU NÃO" : "NGUY CƠ NGƯNG TIM"}).`,
        `PHẪU THUẬT MẠCH MÁU NGOẠI KHOA TUYẾN CUỐI & GÓI TRUYỀN MÁU TỐI CẤP (MTP): Kích hoạt kíp mổ phẫu thuật mạch máu khâu nối tái lập lưu thông động mạch cảnh và truyền máu tỷ lệ 1:1:1 (${cardiovascularSurgeryCenterAlerted ? "PHÒNG MỔ MẠCH MÁU SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển viện cấp cứu BV Chợ Rẫy / BV 115 / BV Bình Dân.`,
      ],
    };
  }

  /**
   * Phân hệ 131: Cấp Cứu Tổn Thương Do Điện Cao Thế Phóng Trực Tiếp & Rung Thất Muộn Kèm Tiêu Cơ Vân (High-Voltage Electrical Injury & Delayed V-Fib Protocol)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM TIẾP CẬN KHI NGUỒN ĐIỆN CAO THẾ CHƯA ĐƯỢC NGẮT (Nguy cơ phóng điện hồ quang và điện thế bước giật tử vong người cứu nạn)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM CHO NẠN NHÂN XUẤT VIỆN SỚM KHI CHƯA THEO DÕI MONITOR ECG LIÊN TỤC 24 GIỜ (Nguy cơ rung thất và loạn nhịp ác tính xuất hiện muộn gây đột tử)
   */
  async manageHighVoltageElectricalShockInjury(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Rescue incident not found');

    const {
      highVoltageArcFlashContactIdentified = true,
      highRateRingerLactateAndUrineOutputEnforced = true,
      approachingVictimBeforePowerCutoffProhibited = true,
      dischargingPatientWithout24hEcgMonitoringProhibited = true,
      burnAndNephrologyIcuCenterAlerted = true,
    } = payload;

    if (approachingVictimBeforePowerCutoffProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối CẤM tiếp cận hoặc chạm vào nạn nhân khi nguồn điện cao thế chưa được ngắt và chưa đảm bảo an toàn điện thế bước!'
      );
    }

    if (dischargingPatientWithout24hEcgMonitoringProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối CẤM cho nạn nhân xuất viện sớm khi chưa theo dõi monitor ECG liên tục đủ 24 giờ do nguy cơ rung thất và loạn nhịp ác tính xuất hiện muộn!'
      );
    }

    incident.highVoltageElectricalShockCare = {
      isHighVoltageElectricalShock: true,
      highVoltageArcFlashContactIdentified: Boolean(highVoltageArcFlashContactIdentified),
      highRateRingerLactateAndUrineOutputEnforced: Boolean(highRateRingerLactateAndUrineOutputEnforced),
      approachingVictimBeforePowerCutoffProhibited: Boolean(approachingVictimBeforePowerCutoffProhibited),
      dischargingPatientWithout24hEcgMonitoringProhibited: Boolean(dischargingPatientWithout24hEcgMonitoringProhibited),
      burnAndNephrologyIcuCenterAlerted: Boolean(burnAndNephrologyIcuCenterAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };

    incident.highVoltageElectricalShockCare && incident.markModified('highVoltageElectricalShockCare');

    incident.auditTrail.push({
      action: 'HIGH_VOLTAGE_ELECTRICAL_SHOCK_CARE_RECORDED',
      timestamp: new Date(),
      details: `Tổn thương điện cao thế: Điện giật > 1000V/Hồ quang=${highVoltageArcFlashContactIdentified}, Bù dịch tốc độ cao nước tiểu 1.5-2.0 mL/kg/h + NaHCO3=${highRateRingerLactateAndUrineOutputEnforced}, CẤM tiếp cận khi chưa ngắt điện=${approachingVictimBeforePowerCutoffProhibited}, CẤM xuất viện sớm thiếu ECG 24h=${dischargingPatientWithout24hEcgMonitoringProhibited}, Báo động Hồi sức Bỏng & Thận Lọc Máu=${burnAndNephrologyIcuCenterAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isHighVoltageElectricalShock: true,
      highVoltageArcFlashContactIdentified: Boolean(highVoltageArcFlashContactIdentified),
      highRateRingerLactateAndUrineOutputEnforced: Boolean(highRateRingerLactateAndUrineOutputEnforced),
      approachingVictimBeforePowerCutoffProhibited: Boolean(approachingVictimBeforePowerCutoffProhibited),
      dischargingPatientWithout24hEcgMonitoringProhibited: Boolean(dischargingPatientWithout24hEcgMonitoringProhibited),
      burnAndNephrologyIcuCenterAlerted: Boolean(burnAndNephrologyIcuCenterAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN ĐIỆN GIẬT CAO THẾ & BỎNG TẢNG BĂNG CHÌM: Nạn nhân bị chạm điện trung/cao thế > 1000V hoặc sét đánh, bỏng sâu cơ bắp tảng băng chìm, hoại tử cơ giải phóng Myoglobin gây suy thận cấp (${highVoltageArcFlashContactIdentified ? "BÁO ĐỘNG ĐỎ ĐIỆN CAO THẾ" : "THEO DÕI"}).`,
        `HỒI SỨC DỊCH RINGER LACTATE TỐC ĐỘ CAO & KIỀM HÓA NƯỚC TIỂU: Bù dịch duy trì lượng nước tiểu tối thiểu 1.5 - 2.0 mL/kg/giờ (100-150 mL/h) kết hợp truyền Natri Bicarbonate 8.4% nâng pH nước tiểu > 6.5 chống trụ Myoglobin tắc ống thận (${highRateRingerLactateAndUrineOutputEnforced ? "ĐÃ HỒI SỨC DỊCH VÀ KIỀM HÓA ĐẠT CHUẨN" : "CẦN BÙ DỊCH TỐC ĐỘ CAO"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM TIẾP CẬN KHI CHƯA NGẮT ĐIỆN VÀ CẤM VỀ SỚM THIẾU ECG 24H: Khóa cấm tiếp cận khi chưa ngắt điện bảo vệ tính mạng đội cứu hộ (${approachingVictimBeforePowerCutoffProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH ĐIỆN THẾ BƯỚC" : "CỰC KỲ NGUY HIỂM"}), khóa cấm cho về sớm bắt buộc theo dõi monitor ECG 24h ngăn ngừa rung thất muộn (${dischargingPatientWithout24hEcgMonitoringProhibited ? "ĐÃ KHÓA AN TOÀN THEO DÕI RUNG THẤT 24H" : "NGUY CƠ ĐỘT TỬ DO LOẠN NHỊP"}).`,
        `TRUNG TÂM BỎNG, PHẪU THUẬT RẠCH GIẢI ÁP KHOANG & LỌC MÁU CRRT: Đánh giá áp lực khoang cơ bắp thực hiện phẫu thuật rạch mở cân (Fasciotomy) tránh hoại tử chi và chuẩn bị lọc máu hấp phụ CRRT (${burnAndNephrologyIcuCenterAlerted ? "TRUNG TÂM BỎNG & HỒI SỨC THẬN SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển viện BV Chợ Rẫy / BV 115.`,
      ],
    };
  }

  /**
   * Phân hệ 132: Cấp Cứu Trẻ Em Hóc Dị Vật Đường Thở Tắc Nghẽn Hoàn Toàn Dưới 1 Tuổi (Pediatric Complete Foreign Body Airway Obstruction - FBAO Protocol)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 1: TUYỆT ĐỐI CẤM DÙNG NGÓN TAY MÓC MÒ MÙ TRONG HỌNG TRẺ (Đẩy dị vật tụt sâu hơn vào nắp thanh môn gây bít tắc đường thở hoàn toàn)
   * CHỐNG CHỈ ĐỊNH TỬ VONG 2: TUYỆT ĐỐI CẤM DÙNG NGHIỆM PHÁP ÉP BỤNG HEIMLICH CHO TRẺ DƯỚI 1 TUỔI (Nguy cơ vỡ gan, dập lách và tổn thương tạng rỗng non nớt trong ổ bụng)
   */
  async managePediatricCompleteFbaoAirway(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Rescue incident not found');

    const {
      infantCompleteAirwayObstructionIdentified = true,
      backBlowsAndChestThrustsCycleEnforced = true,
      blindFingerSweepProhibited = true,
      abdominalHeimlichUnderOneYearProhibited = true,
      pediatricEmergencyIcuCenterAlerted = true,
    } = payload;

    if (blindFingerSweepProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối CẤM dùng ngón tay móc mù trong miệng họng trẻ vì đẩy dị vật tụt sâu hơn vào nắp thanh môn gây bít tắc đường thở hoàn toàn!'
      );
    }

    if (abdominalHeimlichUnderOneYearProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG: Tuyệt đối CẤM dùng nghiệm pháp ép bụng Heimlich cho trẻ dưới 1 tuổi vì nguy cơ vỡ gan, dập lách và tổn thương tạng rỗng non nớt!'
      );
    }

    incident.pediatricCompleteFbaoAirwayCare = {
      isPediatricCompleteFbao: true,
      infantCompleteAirwayObstructionIdentified: Boolean(infantCompleteAirwayObstructionIdentified),
      backBlowsAndChestThrustsCycleEnforced: Boolean(backBlowsAndChestThrustsCycleEnforced),
      blindFingerSweepProhibited: Boolean(blindFingerSweepProhibited),
      abdominalHeimlichUnderOneYearProhibited: Boolean(abdominalHeimlichUnderOneYearProhibited),
      pediatricEmergencyIcuCenterAlerted: Boolean(pediatricEmergencyIcuCenterAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };

    incident.pediatricCompleteFbaoAirwayCare && incident.markModified('pediatricCompleteFbaoAirwayCare');

    incident.auditTrail.push({
      action: 'PEDIATRIC_COMPLETE_FBAO_AIRWAY_CARE_RECORDED',
      timestamp: new Date(),
      details: `Hóc dị vật đường thở trẻ < 1 tuổi: Tắc thở hoàn toàn infant FBAO=${infantCompleteAirwayObstructionIdentified}, Chu kỳ 5 vỗ lưng + 5 ấn ngực=${backBlowsAndChestThrustsCycleEnforced}, CẤM móc họng mù=${blindFingerSweepProhibited}, CẤM ép bụng Heimlich trẻ < 1 tuổi=${abdominalHeimlichUnderOneYearProhibited}, Báo động Hồi sức Cấp cứu Nhi Đồng gắp dị vật=${pediatricEmergencyIcuCenterAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isPediatricCompleteFbao: true,
      infantCompleteAirwayObstructionIdentified: Boolean(infantCompleteAirwayObstructionIdentified),
      backBlowsAndChestThrustsCycleEnforced: Boolean(backBlowsAndChestThrustsCycleEnforced),
      blindFingerSweepProhibited: Boolean(blindFingerSweepProhibited),
      abdominalHeimlichUnderOneYearProhibited: Boolean(abdominalHeimlichUnderOneYearProhibited),
      pediatricEmergencyIcuCenterAlerted: Boolean(pediatricEmergencyIcuCenterAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN TRẺ NHŨ NHI (< 1 TUỔI) HÓC DỊ VẬT ĐƯỜNG THỞ TẮC NGHẼN HOÀN TOÀN: Trẻ đột ngột tím tái, mắt trợn trừng, không khóc thành tiếng, không ho được, nguy cơ ngưng thở ngưng tim não sau 3 phút (${infantCompleteAirwayObstructionIdentified ? "BÁO ĐỘNG ĐỎ HÓC DỊ VẬT NHI ĐỒNG" : "THEO DÕI"}).`,
        `CHU KỲ 5 VỖ LƯNG & 5 ẤN NGỰC CHUẨN AHA/ERC: Đặt trẻ nằm sấp đầu thấp dốc trên cẳng tay người cứu nạn, vỗ 5 nhịp dứt khoát bằng gót bàn tay vào giữa 2 xương bả vai; lật ngửa ấn 5 nhịp bằng 2 ngón tay tại nửa dưới xương ức (${backBlowsAndChestThrustsCycleEnforced ? "ĐÃ THỰC HIỆN ĐÚNG CHU KỲ VỖ LƯNG ẤN NGỰC" : "CẦN SƠ CỨU NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH TỬ VONG: CẤM MÓC MÙ VÀ CẤM ÉP BỤNG HEIMLICH CHO TRẺ < 1 TUỔI: Khóa cấm dùng ngón tay móc mù trong họng đẩy dị vật bít kín thanh môn (${blindFingerSweepProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH BÍT TẮC THANH MÔN" : "CỰC KỲ NGUY HIỂM"}), khóa cấm ép bụng Heimlich tránh vỡ gan lách trẻ nhỏ (${abdominalHeimlichUnderOneYearProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH CHẤN THƯƠNG TẠNG BỤNG" : "NGUY CƠ VỠ GAN LÁCH"}).`,
        `BÁO ĐỘNG HỒI SỨC CẤP CỨU & NỘI SOI PHẾ QUẢN NHI ĐỒNG TUYẾN CUỐI: Kíp Bác sĩ Cấp cứu Nhi chuẩn bị máy nội soi phế quản ống mềm/cứng gắp dị vật khẩn cấp và máy thở cao tần (${pediatricEmergencyIcuCenterAlerted ? "TRUNG TÂM CẤP CỨU NHI SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển viện BV Nhi Đồng 1 / BV Nhi Đồng 2 / BV Nhi Đồng TP.`,
      ],
    };
  }

  /**
   * Phân hệ 133: Cấp Cứu Vết Thương Xuyên Thấu Mắt & Chống Chỉ Định Tụt Thể Pha Lê (Penetrating Open Globe Eye Trauma & Extrusion Prevention)
   * CHỐNG CHỈ ĐỊNH TỬ VONG & MÙ LÒA 1: TUYỆT ĐỐI CẤM TÌ ĐÈ, CHƯỜM ÉP HOẶC BĂNG ÉP TRỰC TIẾP LÊN NHÃN CẦU HỞ (Gây phụt toàn bộ thể pha lê và thủy tinh thể ra ngoài dẫn đến mù vĩnh viễn không thể phục hồi)
   * CHỐNG CHỈ ĐỊNH TỬ VONG & MÙ LÒA 2: TUYỆT ĐỐI CẤM TỰ Ý RÚT DỊ VẬT CẮM TRONG MẮT VÀ CẤM TRA THUỐC MỠ BỪA BÃI (Nguy cơ gây rách rộng cấu trúc nội nhãn và nhiễm trùng viêm nội nhãn mủ tối cấp phải múc bỏ mắt)
   */
  async managePenetratingOpenGlobeEyeTrauma(incidentId, heroId, payload) {
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Rescue incident not found');

    const {
      openGlobePenetratingInjuryIdentified = true,
      rigidEyeShieldAndBilateralPatchingEnforced = true,
      directPressureOrCompressToEyeProhibited = true,
      removingImpaledObjectOrTopicalOintmentProhibited = true,
      ophthalmicMicrosurgeryCenterAlerted = true,
    } = payload;

    if (directPressureOrCompressToEyeProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG & MÙ LÒA: Tuyệt đối CẤM tì đè, chườm ép hoặc dán băng gạc chặt trực tiếp lên nhãn cầu hở làm phụt toàn bộ thể pha lê và thủy tinh thể ra ngoài mù vĩnh viễn!'
      );
    }

    if (removingImpaledObjectOrTopicalOintmentProhibited === false) {
      throw new Error(
        'CHỐNG CHỈ ĐỊNH TỬ VONG & MÙ LÒA: Tuyệt đối CẤM tự ý rút dị vật đang cắm sâu trong mắt và CẤM tra thuốc mỡ, nhỏ thuốc bừa bãi vào mắt hở gây nhiễm trùng nội nhãn mủ tối cấp!'
      );
    }

    incident.penetratingOpenGlobeEyeTraumaCare = {
      isPenetratingOpenGlobeEyeTrauma: true,
      openGlobePenetratingInjuryIdentified: Boolean(openGlobePenetratingInjuryIdentified),
      rigidEyeShieldAndBilateralPatchingEnforced: Boolean(rigidEyeShieldAndBilateralPatchingEnforced),
      directPressureOrCompressToEyeProhibited: Boolean(directPressureOrCompressToEyeProhibited),
      removingImpaledObjectOrTopicalOintmentProhibited: Boolean(removingImpaledObjectOrTopicalOintmentProhibited),
      ophthalmicMicrosurgeryCenterAlerted: Boolean(ophthalmicMicrosurgeryCenterAlerted),
      evaluatedAt: new Date(),
      administeredBy: heroId,
    };

    incident.penetratingOpenGlobeEyeTraumaCare && incident.markModified('penetratingOpenGlobeEyeTraumaCare');

    incident.auditTrail.push({
      action: 'PENETRATING_OPEN_GLOBE_EYE_TRAUMA_CARE_RECORDED',
      timestamp: new Date(),
      details: `Vết thương xuyên thấu mắt: Tổn thương nhãn cầu hở open globe=${openGlobePenetratingInjuryIdentified}, Úp vỏ cứng Rigid Eye Shield & Băng 2 mắt=${rigidEyeShieldAndBilateralPatchingEnforced}, CẤM tì đè ép lên mắt hở=${directPressureOrCompressToEyeProhibited}, CẤM rút dị vật cắm trong mắt hoặc tra thuốc mỡ=${removingImpaledObjectOrTopicalOintmentProhibited}, Báo động Vi Phẫu Mắt khâu phục hồi nhãn cầu 12-24h=${ophthalmicMicrosurgeryCenterAlerted}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      isPenetratingOpenGlobeEyeTrauma: true,
      openGlobePenetratingInjuryIdentified: Boolean(openGlobePenetratingInjuryIdentified),
      rigidEyeShieldAndBilateralPatchingEnforced: Boolean(rigidEyeShieldAndBilateralPatchingEnforced),
      directPressureOrCompressToEyeProhibited: Boolean(directPressureOrCompressToEyeProhibited),
      removingImpaledObjectOrTopicalOintmentProhibited: Boolean(removingImpaledObjectOrTopicalOintmentProhibited),
      ophthalmicMicrosurgeryCenterAlerted: Boolean(ophthalmicMicrosurgeryCenterAlerted),
      clinicalDirectives: [
        `NHẬN DIỆN VẾT THƯƠNG XUYÊN THẤU NHÃN CẦU HỞ (OPEN GLOBE): Nạn nhân bị dị vật kim loại, kính vỡ, cành cây đâm rách giác mạc/củng mạc, rỉ dịch tiền phòng, phòi màng bồ đào, nguy cơ mù vĩnh viễn nếu sơ cứu sai (${openGlobePenetratingInjuryIdentified ? "BÁO ĐỘNG ĐỎ NHÃN KHOA CẤP CỨU" : "THEO DÕI"}).`,
        `ÚP VỎ BẢO VỆ CỨNG (RIGID EYE SHIELD) & BĂNG CHE CẢ HAI MẮT: Úp nắp chắn cứng tì đè lên bờ xương hốc mắt xung quanh (không chạm nhãn cầu), băng che cả 2 mắt để triệt tiêu chuyển động liên hợp của nhãn cầu và cho thuốc chống nôn tránh tăng áp lực nội nhãn (${rigidEyeShieldAndBilateralPatchingEnforced ? "ĐÃ BẢO VỆ NHÃN CẦU ĐÚNG CHUẨN NHÃN KHOA" : "CẦN ÚP EYE SHIELD NGAY"}).`,
        `CHỐNG CHỈ ĐỊNH MÙ LÒA: CẤM TÌ ĐÈ ÉP MẮT VÀ CẤM RÚT DỊ VẬT HOẶC TRA THUỐC MỠ: Khóa cấm tuyệt đối ấn gạc hoặc chườm ép lên mắt hở làm phụt thể pha lê ra ngoài gây teo nhãn cầu mù vĩnh viễn (${directPressureOrCompressToEyeProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH PHỤT THỂ PHA LÊ" : "CỰC KỲ NGUY HIỂM"}), khóa cấm rút dị vật đang cắm và cấm tra thuốc mỡ gây viêm mủ nội nhãn (${removingImpaledObjectOrTopicalOintmentProhibited ? "ĐÃ KHÓA AN TOÀN TRÁNH NHIỄM TRÙNG NỘI NHÃN" : "NGUY CƠ MÚC BỎ NHÃN CẦU"}).`,
        `VI PHẪU NHÃN KHOA KHÂU PHỤC HỒI NHÃN CẦU CỬA SỔ VÀNG 12-24 GIỜ: Kíp Bác sĩ Vi phẫu Mắt chuẩn bị kính hiển vi phẫu thuật khâu bảo tồn nhãn cầu và tiêm kháng sinh nội nhãn (${ophthalmicMicrosurgeryCenterAlerted ? "PHÒNG MỔ VI PHẪU MẮT SẴN SÀNG" : "CHỜ ĐIỀU PHỐI"}); chuyển viện BV Mắt TP.HCM / BV Chợ Rẫy.`,
      ],
    };
  }
}

module.exports = new EmergencyService();
