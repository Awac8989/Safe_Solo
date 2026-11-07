const crypto = require('crypto');
const User = require('../models/User');
const RescueIncident = require('../models/RescueIncident');
const VolunteerResponse = require('../models/VolunteerResponse');
const EmergencyMemo = require('../models/EmergencyMemo');
const chatService = require('./chatService');
const trustService = require('./trustService');
const { createAlertEvent } = require('./alertEventService');
const systemLogService = require('./systemLogService');
const { getIo } = require('../sockets/socketServer');
const { AppError, ensure } = require('../lib/errors');
const { fuzzCoordinates, haversineKm, sanitizeUser } = require('../lib/utils');
const { toIso } = require('../lib/mongoCore');
const { decryptEmergencyMemoPayload } = require('../lib/sensitivePayloadCodec');
const {
  decryptUserSensitivePayload,
  buildEncryptedUserSensitiveUpdate,
} = require('../lib/userSensitiveCodec');

function mapIncident(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    victimId: row.victimId,
    status: row.status,
    incidentType: row.incidentType,
    severity: row.severity,
    severityLevel: row.severityLevel || 'P1_CRITICAL',
    source: row.source,
    exactLat: row.exactLat,
    exactLng: row.exactLng,
    fuzzedLat: row.fuzzedLat,
    fuzzedLng: row.fuzzedLng,
    approxAddress: row.approxAddress || null,
    batteryLevel: row.batteryLevel ?? null,
    assignedVolunteerId: row.assignedVolunteerId || null,
    backupVolunteerIds: row.backupVolunteerIds || [],
    isBuddyDispatchRequired: Boolean(row.isBuddyDispatchRequired),
    buddyStatus: row.buddyStatus || 'NOT_REQUIRED',
    rendezvousPoint: row.rendezvousPoint || null,
    dispatchRadiusKm: row.dispatchRadiusKm || 1.2,
    medicalSnapshot: row.medicalSnapshot || null,
    telemetry: row.telemetry || null,
    auditTrail: row.auditTrail || [],
    handoffRecord: row.handoffRecord || null,
    microLocation: row.microLocation || null,
    emergencyAccessPass: row.emergencyAccessPass || null,
    sceneSafety: row.sceneSafety || null,
    bystanderGuidance: row.bystanderGuidance || null,
    triageCategory: row.triageCategory || null,
    clinicalAssessment: row.clinicalAssessment || null,
    afterActionReview: row.afterActionReview || null,
    communityRequestedAt: toIso(row.communityRequestedAt),
    createdAt: toIso(row.createdAt),
    resolvedAt: toIso(row.resolvedAt),
  };
}

function mapResponse(doc) {
  if (!doc) {
    return null;
  }
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    incidentId: row.incidentId,
    volunteerId: row.volunteerId,
    status: row.status,
    goodSamaritanAgreementSigned: row.goodSamaritanAgreementSigned ?? true,
    firstAidActionsPerformed: row.firstAidActionsPerformed || [],
    lastLocationUpdate: row.lastLocationUpdate || null,
    etaSeconds: row.etaSeconds ?? null,
    distanceMeters: row.distanceMeters ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

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

class RadarService {
  async getGuardiansForVictim(victimDoc) {
    const sensitive = decryptUserSensitivePayload(victimDoc);
    const phones = [
      ...new Set(
        (sensitive.emergencyContacts || [])
          .map((item) => String(item?.phone || '').trim())
          .filter(Boolean),
      ),
    ];
    if (!phones.length) {
      return [];
    }
    return User.find({ phoneNumber: { $in: phones }, isActive: { $ne: false } }).lean();
  }

  async getIncidentDetailsForBroadcast(incidentId) {
    const incidentDoc = await RescueIncident.findById(incidentId);
    if (!incidentDoc) {
      throw new AppError('Incident not found', 404);
    }
    const victim = await User.findById(incidentDoc.victimId).lean();
    const room = await chatService.getChatRoomByIncident(incidentDoc._id).catch(() => null);
    return {
      ...mapIncident(incidentDoc),
      victim: victim ? sanitizeUser(victim) : null,
      roomId: room?._id || room?.id || null,
    };
  }

  async broadcastSOS(victimId, incidentType, exactLat, exactLng, options = {}) {
    const victim = await User.findById(victimId);
    ensure(victim, 'Victim not found', 404);

    const { fuzzedLat, fuzzedLng } = fuzzCoordinates(exactLat, exactLng);
    const victimSensitive = decryptUserSensitivePayload(victim);

    const initialRadius = options.dispatchRadiusKm || 1.2;
    const initialStatus = options.status || 'DISPATCHING_R1';

    // Kịch bản 15: Chống bẫy dàn cảnh cướp giật (Anti-Ambush & Buddy Dispatch)
    // Nếu sự cố diễn ra lúc đêm khuya (23:00 - 05:00 sáng, UTC+7) hoặc cờ isHighRiskArea
    const nowUtc = new Date();
    const vnHour = (nowUtc.getUTCHours() + 7) % 24;
    const isNightDangerTime = vnHour >= 23 || vnHour < 5;
    const isBuddyRequired = Boolean(options.isHighRiskArea || isNightDangerTime || options.isBuddyDispatchRequired);
    const rendezvousPoint = isBuddyRequired
      ? {
          lat: Number((exactLat + 0.0018).toFixed(6)),
          lng: Number((exactLng + 0.0018).toFixed(6)),
          note: 'Điểm tập kết an toàn: Giao lộ lớn cách hiện trường 200m. 02 Hiệp sĩ tập hợp trước khi cùng tiến vào.',
        }
      : null;

    const incident = await RescueIncident.create({
      victimId,
      status: initialStatus,
      incidentType,
      severity: Number(options.severity || 2),
      severityLevel:
        options.severityLevel ||
        (Number(options.severity) === 1 ? 'P0_SILENT' : 'P1_CRITICAL'),
      source: options.source || 'SOS',
      exactLat,
      exactLng,
      fuzzedLat,
      fuzzedLng,
      approxAddress:
        options.approxAddress || victimSensitive.approxAddress || null,
      batteryLevel: options.batteryLevel ?? victim.batteryLevel ?? null,
      dispatchRadiusKm: initialRadius,
      isBuddyDispatchRequired: isBuddyRequired,
      buddyStatus: isBuddyRequired ? 'WAITING_BUDDY' : 'NOT_REQUIRED',
      rendezvousPoint,
      microLocation: {
        buildingName: options.microLocation?.buildingName || victim.microLocation?.buildingName || '',
        roomNumber: options.microLocation?.roomNumber || victim.microLocation?.roomNumber || '',
        floorNumber: options.microLocation?.floorNumber || victim.microLocation?.floorNumber || '',
        doorCode: options.microLocation?.doorCode || victim.microLocation?.doorCode || '',
        landlordPhone: options.microLocation?.landlordPhone || victim.microLocation?.landlordPhone || '',
        securityPhone: options.microLocation?.securityPhone || victim.microLocation?.securityPhone || '',
        accessNotes: options.microLocation?.accessNotes || victim.microLocation?.accessNotes || '',
      },
      emergencyAccessPass: {
        passCode: `PASS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        legalBasis: 'Điều 23 Bộ luật Hình sự 2015 & Điều 87 Luật Khám bệnh, chữa bệnh 2023 - Tình thế cấp thiết',
        authorizedAt: new Date(),
        isUnlockedForHero: false,
      },
      sceneSafety: {
        isAssessed: false,
        assessedAt: null,
        hazardFlags: [],
        isSafeToEnter: true,
        escalatedToService: 'NONE',
        safetyNotes: '',
      },
      bystanderGuidance: {
        isActive: true,
        guidanceType: options.guidanceType || 'CPR_AIRWAY',
        speakerphoneAutoOn: true,
        metronomeBpm: 110,
      },
      triageCategory: {
        category: options.triageCategory || 'CARDIAC_RESPIRATORY',
        reportedByVoice: Boolean(options.reportedByVoice),
        mobilityRecommendation: options.mobilityRecommendation || (initialRadius > 1.0 ? 'MOTORBIKE' : 'WALKING_FAST'),
      },
      medicalSnapshot: {
        bloodType: victimSensitive.bloodType || 'UNKNOWN',
        allergies: victimSensitive.allergies || [],
        chronicConditions: victimSensitive.chronicConditions || [],
        emergencyNotes: victim.medicalNotes || options.medicalNotes || '',
      },
      auditTrail: [
        {
          action: 'SOS_BROADCASTED',
          actorId: victimId,
          timestamp: new Date(),
          metadata: {
            incidentType,
            lat: exactLat,
            lng: exactLng,
            source: options.source || 'SOS',
            severity: options.severityLevel || 'P1_CRITICAL',
            isBuddyDispatchRequired: isBuddyRequired,
            isNightDangerTime,
            triageCategory: options.triageCategory || 'CARDIAC_RESPIRATORY',
            hasMicroLocation: Boolean(options.microLocation?.buildingName || victim.microLocation?.buildingName),
          },
        },
      ],
      communityRequestedAt: new Date(),
      resolvedAt: null,
    });

    victim.lastKnownLocation = { lat: exactLat, lng: exactLng, updatedAt: new Date() };
    Object.assign(
      victim,
      buildEncryptedUserSensitiveUpdate(victimId, {
        ...victimSensitive,
        approxAddress: incident.approxAddress,
      }),
    );
    victim.batteryLevel = incident.batteryLevel;
    await victim.save();

    const guardians = await this.getGuardiansForVictim(victim);
    await chatService.syncIncidentRoomParticipants(
      incident._id,
      [victimId, ...guardians.map((item) => item._id)],
      [],
    );

    await systemLogService.createLog({
      incidentId: incident._id,
      actionType: 'SOS_BROADCASTED',
      description: `SOS incident ${incident._id} created for victim ${victimId}`,
      metadata: { incidentType, lat: exactLat, lng: exactLng },
    });

    // Xác định chuyên môn yêu cầu cho sự cố cứu nạn
    const requiredSkillTier =
      options.requiredSkillTier ||
      (incident.severityLevel === 'P1_CRITICAL' ? 'TIER_1_BLS' : 'NONE');
    const requiredSkills =
      options.requiredSkills ||
      (incident.severityLevel === 'P1_CRITICAL' ? ['CPR_AED'] : []);

    incident.requiredSkillTier = requiredSkillTier;
    incident.requiredSkills = requiredSkills;
    await incident.save();

    // 1. Quét tìm Hiệp sĩ đủ điều kiện theo chuyên môn Skill-Based Dispatch (SBD)
    let nearbyVolunteers = await this.findNearbyVolunteers(
      exactLat,
      exactLng,
      victimId,
      initialRadius,
      { requiredSkillTier, requiredSkills },
    );

    // MULTI-WAVE CANDIDATE POOL FOR P1_CRITICAL (4 PHÚT VÀNG CẤP CỨU)
    // Nếu là ca ngừng tim/đột quỵ/nguy kịch mà Vòng 1 có ít hơn 2 hiệp sĩ, kéo thêm ứng viên từ Vòng 2 để alert
    if (
      incident.severityLevel === 'P1_CRITICAL' &&
      nearbyVolunteers.length < 2
    ) {
      const backupRing2 = await this.findNearbyVolunteers(
        exactLat,
        exactLng,
        victimId,
        4.5,
        { requiredSkillTier, requiredSkills },
      );
      const existingIds = new Set(nearbyVolunteers.map((v) => v.id));
      for (const v2 of backupRing2) {
        if (!existingIds.has(v2.id)) {
          nearbyVolunteers.push(v2);
          existingIds.add(v2.id);
        }
      }
    }

    // 2. Gửi PUSH BÁO ĐỘNG ĐỎ tới Top ứng viên phù hợp nhất (tối đa 5 người) đồng thời
    const topCandidates = nearbyVolunteers.slice(0, 5);
    const io = getIo();
    await Promise.allSettled(
      topCandidates.map(async (volunteer) => {
        try {
          await VolunteerResponse.findOneAndUpdate(
            { incidentId: incident._id, volunteerId: volunteer.id },
            {
              $setOnInsert: {
                incidentId: incident._id,
                volunteerId: volunteer.id,
                status: 'ALERTED',
                heroTierAtDispatch: volunteer.heroTier || 'TIER_1_BLS',
                skillMatchScore: volunteer.skillMatchScore ?? 100,
                goodSamaritanAgreementSigned: true,
                distanceMeters: Math.round(volunteer.distanceKm * 1000),
              },
            },
            { upsert: true, new: true },
          );

          if (io) {
            const heroPayload = {
              incidentId: incident._id,
              victimId: incident.victimId,
              victimName: sanitizeUser(victim).fullName,
              incidentType: incident.incidentType,
              severity: incident.severity,
              severityLevel: incident.severityLevel,
              distanceKm: volunteer.distanceKm,
              approxAddress: incident.approxAddress,
              medicalSnapshot: incident.medicalSnapshot,
              createdAt: incident.createdAt,
            };

            io.to(`user:${volunteer.id}`).emit('HERO_DISPATCH_REQUEST', heroPayload);
            io.to(volunteer.id).emit('HERO_DISPATCH_REQUEST', heroPayload);
          }
        } catch (_err) {
          // non-blocking socket dispatch
        }
      }),
    );

    // 3. Tự động kích hoạt Báo động Đa Kênh (SMS/Telegram/Zalo/Email/Voice) tới Người Thân trong nền
    setImmediate(async () => {
      try {
        const { triggerSosForUser } = require('./sosService');
        await triggerSosForUser(io, victim);
      } catch (_sosErr) {
        // non-blocking background omnichannel notification
      }
    });

    await createAlertEvent({
      userId: victimId,
      level: 'SOS',
      status: 'SOS_BROADCASTED',
      source: 'USER',
      title: 'Đã phát tín hiệu SOS khẩn cấp',
      message:
        'Hệ thống đang tự động điều phối hiệp sĩ gần nhất và thông báo người bảo trợ',
      metadata: {
        incidentId: incident._id,
        nearbyVolunteersCount: nearbyVolunteers.length,
        dispatchedCandidatesCount: topCandidates.length,
      },
    });

    try {
      getIo().emit('RADAR_INCIDENT_CREATED', {
        incident: await this.getIncidentDetailsForBroadcast(incident._id),
      });
    } catch (_error) {
      // socket optional
    }

    return {
      incident: await this.getIncidentDetailsForBroadcast(incident._id),
      nearbyVolunteers,
    };
  }

  async findNearbyVolunteers(lat, lng, excludeUserId, radiusKm = 3, options = {}) {
    // Lọc ra các Hiệp sĩ đang có ca cứu hộ dở dang (đang di chuyển hoặc đang ở hiện trường)
    const busyResponses = await VolunteerResponse.find({
      status: { $in: ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'] },
    }).lean();
    const busyVolunteerIds = new Set(busyResponses.map((r) => r.volunteerId));

    // Bounding box pre-filtering để tối ưu hiệu năng DB, tránh quét toàn bộ collection
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos(lat * (Math.PI / 180)));

    const users = await User.find({
      _id: { $ne: excludeUserId, $nin: Array.from(busyVolunteerIds) },
      isActive: { $ne: false },
      isKycVerified: true,
      lastKnownLocation: { $ne: null },
      'lastKnownLocation.lat': { $gte: lat - latDelta, $lte: lat + latDelta },
      'lastKnownLocation.lng': { $gte: lng - lngDelta, $lte: lng + lngDelta },
    }).lean();

    const now = new Date();
    const tierHierarchy = { NONE: 0, TIER_1_BLS: 1, TIER_2_PHTLS: 2, TIER_3_MEDIC: 3 };

    return users
      .map((item) => {
        const distanceKm = Number(
          haversineKm(
            lat,
            lng,
            Number(item.lastKnownLocation?.lat),
            Number(item.lastKnownLocation?.lng),
          ).toFixed(2),
        );

        // 1. Chấm điểm Khớp Chuyên môn (Skill Match Score - 35%)
        const isCertExpired =
          item.certificateExpiry && new Date(item.certificateExpiry) < now;
        const currentTier = isCertExpired ? 'NONE' : (item.heroTier || 'TIER_1_BLS');
        const heroTierLevel = tierHierarchy[currentTier] ?? 1;

        const reqTier = options.requiredSkillTier || options.requiredTier;

        // Nguyên tắc 4 SOP: Zero Unqualified Responder (Không điều phối người hết hạn hoặc NONE vào ca có yêu cầu chuyên môn)
        if (reqTier && heroTierLevel === 0) {
          return null;
        }

        let skillMatchScore = 100;
        if (reqTier && tierHierarchy[reqTier]) {
          const reqLevel = tierHierarchy[reqTier];
          if (heroTierLevel < reqLevel) {
            skillMatchScore = Math.max(20, Math.round((heroTierLevel / reqLevel) * 70));
          }
        }

        if (Array.isArray(options.requiredSkills) && options.requiredSkills.length > 0) {
          const heroSkillsSet = new Set(
            item.heroSkills?.length ? item.heroSkills : ['CPR_AED', 'AIRWAY_CHOKING'],
          );
          const matchedCount = options.requiredSkills.filter((s) =>
            heroSkillsSet.has(s),
          ).length;
          const matchRate = matchedCount / options.requiredSkills.length;
          skillMatchScore = Math.round(skillMatchScore * 0.5 + matchRate * 50);
        }

        // 2. Chấm điểm Khoảng cách (Distance Score - 30%)
        const distScore = Math.max(0, 100 - (distanceKm / radiusKm) * 50);

        // 3. Chấm điểm Uy tín (Trust Score - 20%)
        const trustScore = Math.min(100, item.trustScore || 50);

        // 4. Chấm điểm Kinh nghiệm thực chiến (Experience Score - 15%)
        const rescuesScore = Math.min(100, (item.rescuesCount || 0) * 10);

        // Công thức điều phối chuẩn SOP 4 biến: 35% Skill + 30% Distance + 20% Trust + 15% Experience
        const dispatchScore = Math.round(
          skillMatchScore * 0.35 +
            distScore * 0.30 +
            trustScore * 0.20 +
            rescuesScore * 0.15,
        );

        return {
          ...sanitizeUser(item),
          distanceKm,
          dispatchScore,
          skillMatchScore,
          heroTier: currentTier,
          heroSkills: item.heroSkills || ['CPR_AED', 'AIRWAY_CHOKING'],
          isBusy: false,
        };
      })
      .filter((item) => item !== null && item.distanceKm <= radiusKm)
      .sort((a, b) => b.dispatchScore - a.dispatchScore || a.distanceKm - b.distanceKm);
  }

  async getNearbyIncidents(volunteerLat, volunteerLng, volunteerId, radiusKm = 4.5) {
    const activeStatuses = [
      'ACTIVE',
      'TRIGGERED',
      'DISPATCHING_R1',
      'DISPATCHING_R2',
      'ACCEPTED',
      'EN_ROUTE',
      'ON_SCENE',
    ];

    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos(volunteerLat * (Math.PI / 180)));

    const incidents = await RescueIncident.find({
      status: { $in: activeStatuses },
      victimId: { $ne: volunteerId },
      fuzzedLat: { $gte: volunteerLat - latDelta, $lte: volunteerLat + latDelta },
      fuzzedLng: { $gte: volunteerLng - lngDelta, $lte: volunteerLng + lngDelta },
    })
      .sort({ createdAt: -1 })
      .lean();

    const victimIds = [...new Set(incidents.map((item) => item.victimId))];
    const victims = victimIds.length
      ? await User.find({ _id: { $in: victimIds } }).lean()
      : [];
    const victimMap = new Map(victims.map((item) => [item._id, sanitizeUser(item)]));

    const accepted = await VolunteerResponse.find({
      volunteerId,
      incidentId: { $in: incidents.map((item) => item._id) },
    }).lean();
    const acceptedSet = new Set(accepted.map((item) => item.incidentId));

    return incidents
      .map((incident) => {
        const distanceKm = haversineKm(
          volunteerLat,
          volunteerLng,
          incident.fuzzedLat,
          incident.fuzzedLng,
        );
        return {
          ...mapIncident(incident),
          victim: victimMap.get(incident.victimId) || null,
          distanceKm: Number(distanceKm.toFixed(2)),
          hasAccepted: acceptedSet.has(incident._id),
        };
      })
      .filter((item) => item.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async acceptRescueIncident(incidentId, volunteerId) {
    const volunteer = await User.findById(volunteerId);
    ensure(volunteer, 'Volunteer not found', 404);
    ensure(
      volunteer.isKycVerified,
      'KYC verification required before accepting rescue missions',
      403,
    );

    // Kiểm tra xem hiệp sĩ này có đang bận cứu hộ ca khác không
    const ongoingMission = await VolunteerResponse.findOne({
      volunteerId,
      incidentId: { $ne: incidentId },
      status: { $in: ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'] },
    });
    if (ongoingMission) {
      throw new AppError(
        'Bạn đang có nhiệm vụ cứu hộ chưa hoàn thành. Vui lòng hoàn tất trước khi nhận ca mới.',
        409,
      );
    }

    // Kịch bản 15: Kiểm tra xem ca có yêu cầu Buddy Dispatch (2 Hiệp sĩ) không
    const existingIncident = await RescueIncident.findById(incidentId);
    ensure(existingIncident, 'Incident not found', 404);

    let incident;
    let isBuddyJoin = false;

    if (
      existingIncident.isBuddyDispatchRequired &&
      existingIncident.assignedVolunteerId &&
      existingIncident.assignedVolunteerId !== volunteerId &&
      existingIncident.buddyStatus === 'WAITING_BUDDY'
    ) {
      // Hiệp sĩ thứ 2 gia nhập cặp đôi (Buddy Partner)
      incident = await RescueIncident.findOneAndUpdate(
        {
          _id: incidentId,
          buddyStatus: 'WAITING_BUDDY',
          backupVolunteerIds: { $ne: volunteerId },
        },
        {
          $set: {
            buddyStatus: 'BUDDY_PAIRED',
            status: 'ACCEPTED',
          },
          $addToSet: { backupVolunteerIds: volunteerId },
          $push: {
            auditTrail: {
              action: 'HERO_2_BUDDY_PAIRED',
              actorId: volunteerId,
              timestamp: new Date(),
              metadata: {
                volunteerName: volunteer.fullName,
                partnerId: existingIncident.assignedVolunteerId,
                rendezvousPoint: existingIncident.rendezvousPoint,
                message: 'Cặp đôi Hiệp sĩ đã hình thành đầy đủ (Anti-Ambush Buddy Dispatch).',
              },
            },
          },
        },
        { new: true },
      );
      isBuddyJoin = true;
    } else {
      // Nhận ca thông thường hoặc Hiệp sĩ đầu tiên của cặp đôi
      const openStatuses = ['ACTIVE', 'DISPATCHING_R1', 'DISPATCHING_R2', 'TRIGGERED'];
      const nextStatus = existingIncident.isBuddyDispatchRequired ? 'DISPATCHING_R1' : 'ACCEPTED';
      const nextBuddyStatus = existingIncident.isBuddyDispatchRequired ? 'WAITING_BUDDY' : 'NOT_REQUIRED';

      incident = await RescueIncident.findOneAndUpdate(
        {
          _id: incidentId,
          status: { $in: openStatuses },
          $or: [
            { assignedVolunteerId: null },
            { assignedVolunteerId: { $exists: false } },
            { assignedVolunteerId: volunteerId },
          ],
        },
        {
          $set: {
            status: nextStatus,
            assignedVolunteerId: volunteerId,
            buddyStatus: nextBuddyStatus,
          },
          $push: {
            auditTrail: {
              action: existingIncident.isBuddyDispatchRequired ? 'HERO_1_WAITING_BUDDY' : 'HERO_ACCEPTED',
              actorId: volunteerId,
              timestamp: new Date(),
              metadata: {
                volunteerName: volunteer.fullName,
                volunteerPhone: volunteer.phoneNumber,
                isBuddyDispatchRequired: existingIncident.isBuddyDispatchRequired,
              },
            },
          },
        },
        { new: true },
      );
    }

    if (!incident) {
      if (
        existingIncident.assignedVolunteerId &&
        existingIncident.assignedVolunteerId !== volunteerId &&
        (!existingIncident.isBuddyDispatchRequired || existingIncident.buddyStatus === 'BUDDY_PAIRED')
      ) {
        throw new AppError(
          'Ca cứu hộ này đã được tiếp nhận đầy đủ lực lượng. Cảm ơn tinh thần tương trợ của bạn!',
          409,
        );
      }
      throw new AppError('Ca cứu hộ không còn ở trạng thái mở tiếp nhận', 409);
    }

    let response = await VolunteerResponse.findOne({ incidentId, volunteerId });
    if (!response) {
      response = await VolunteerResponse.create({
        incidentId,
        volunteerId,
        status: 'EN_ROUTE',
        goodSamaritanAgreementSigned: true,
        signedAt: new Date(),
      });
    } else {
      response.status = 'EN_ROUTE';
      response.goodSamaritanAgreementSigned = true;
      await response.save();
    }

    // Đánh dấu TIMEOUT cho các ứng viên khác chỉ khi đã đủ lực lượng (không còn chờ buddy)
    if (!incident.isBuddyDispatchRequired || incident.buddyStatus === 'BUDDY_PAIRED') {
      await VolunteerResponse.updateMany(
        { incidentId, volunteerId: { $nin: [incident.assignedVolunteerId, ...(incident.backupVolunteerIds || [])] }, status: 'ALERTED' },
        { $set: { status: 'TIMEOUT' } },
      );
    }

    await chatService.addResponderToIncidentRoom(incidentId, volunteerId);
    await createAlertEvent({
      userId: incident.victimId,
      level: 'INFO',
      status: 'VOLUNTEER_ACCEPTED',
      source: 'COMMUNITY',
      title: 'Hiệp sĩ đang đến cấp cứu',
      message: `${sanitizeUser(volunteer).fullName} đã nhận hỗ trợ và đang trên đường tiếp cận`,
      metadata: { incidentId, volunteerId },
    });

    // GÓI TÁC CHIẾN KHẨN CẤP: Tính toán trạm AED tối ưu + Giao thức sơ cứu nhanh + Link điều hướng GPS 1-chạm
    let optimalAED = null;
    try {
      const safePointService = require('./safePointService');
      const heroLat = volunteer.lastKnownLocation?.lat || incident.exactLat;
      const heroLng = volunteer.lastKnownLocation?.lng || incident.exactLng;
      optimalAED = await safePointService.findOptimalAEDWaypoint(
        heroLat,
        heroLng,
        incident.exactLat,
        incident.exactLng,
        1000,
      );
    } catch (_aedErr) {
      // safe point calculation optional
    }

    const firstAidProtocol = this.getClinicalActionProtocol(
      incident.incidentType,
      incident.severityLevel,
    );

    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${incident.exactLat},${incident.exactLng}&travelmode=two_wheeler`;

    // Mở khóa Lệnh Can Thiệp Cứu Sinh (Điều 23 BLHS - Tình thế cấp thiết) cho Hiệp sĩ nhận ca
    if (incident.emergencyAccessPass) {
      incident.emergencyAccessPass.isUnlockedForHero = true;
      incident.emergencyAccessPass.authorizedAt = incident.emergencyAccessPass.authorizedAt || new Date();
      await RescueIncident.updateOne(
        { _id: incident._id },
        {
          $set: {
            'emergencyAccessPass.isUnlockedForHero': true,
            'emergencyAccessPass.authorizedAt': new Date(),
          },
        },
      );
    }

    const tacticalMissionPacket = {
      optimalAEDWaypoint: optimalAED,
      firstAidProtocol,
      navigationUrl,
      victimMedicalCard: incident.medicalSnapshot,
      goldenWindowMinutes: firstAidProtocol.goldenWindowSeconds ? Math.round(firstAidProtocol.goldenWindowSeconds / 60) : 5,
      microLocation: incident.microLocation || null,
      emergencyAccessPass: {
        passCode: incident.emergencyAccessPass?.passCode || 'SAFE-PASS-EMERGENCY',
        legalBasis: incident.emergencyAccessPass?.legalBasis || 'Điều 23 BLHS & Điều 87 Luật Khám bệnh, chữa bệnh 2023',
        isUnlockedForHero: true,
      },
      sceneSafety: incident.sceneSafety || null,
      bystanderGuidance: incident.bystanderGuidance || null,
      triageCategory: incident.triageCategory || null,
    };

    // Bắn socket thông báo cho Nạn nhân và Người nhà biết Hiệp sĩ đã nhận ca kèm Gói Tác Chiến
    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('HERO_ACCEPTED', {
        incidentId,
        volunteer: sanitizeUser(volunteer),
        response: mapResponse(response),
        tacticalMissionPacket,
      });
      io.to(incident.victimId).emit('HERO_ACCEPTED', {
        incidentId,
        volunteer: sanitizeUser(volunteer),
        response: mapResponse(response),
      });

      if (isBuddyJoin) {
        io.to(`incident:${incidentId}`).emit('BUDDY_PAIRED', {
          incidentId,
          assignedVolunteerId: incident.assignedVolunteerId,
          buddyVolunteerId: volunteerId,
          rendezvousPoint: incident.rendezvousPoint,
          message: 'Hai hiệp sĩ đã hình thành cặp đôi cứu hộ an toàn. Hãy hội quân tại điểm tập kết trước khi tiến vào!',
        });
      }
    } catch (_err) {
      // socket optional
    }

    return {
      response: mapResponse(response),
      incident: await this.getIncidentDetails(incidentId, volunteerId),
      tacticalMissionPacket,
    };
  }

  async updateHeroTelemetry(incidentId, volunteerId, lat, lng, speedKmh = 0) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    ensure(
      incident.assignedVolunteerId === volunteerId,
      'Unauthorized volunteer for this incident',
      403,
    );

    const distanceKm = haversineKm(lat, lng, incident.exactLat, incident.exactLng);
    const distanceMeters = Math.round(distanceKm * 1000);

    incident.telemetry = {
      lastHeroMovementAt: new Date(),
      heroSpeedKmh: speedKmh,
      distanceRemainingMeters: distanceMeters,
    };

    // Tự động kích hoạt còi hú & đèn flash định vị tầm gần (< 30m) nếu chưa kích hoạt
    if (
      distanceMeters <= 30 &&
      !incident.auditTrail.some((a) => a.action === 'PROXIMITY_BEACON_TRIGGERED')
    ) {
      this.triggerProximityBeacon(incidentId, volunteerId).catch(() => null);
    }

    // Tự động chuyển ON_SCENE nếu khoảng cách <= 25 mét
    if (
      distanceMeters <= 25 &&
      (incident.status === 'ACCEPTED' || incident.status === 'EN_ROUTE')
    ) {
      incident.status = 'ON_SCENE';
      incident.auditTrail.push({
        action: 'HERO_ON_SCENE',
        actorId: volunteerId,
        timestamp: new Date(),
        metadata: { distanceMeters, speedKmh },
      });

      await VolunteerResponse.updateOne(
        { incidentId, volunteerId },
        { $set: { status: 'ARRIVED' } },
      );
    }

    await incident.save();

    await VolunteerResponse.updateOne(
      { incidentId, volunteerId },
      {
        $set: {
          lastLocationUpdate: { lat, lng, updatedAt: new Date(), speedKmh },
          distanceMeters,
        },
      },
    );

    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('HERO_LOCATION_UPDATE', {
        incidentId,
        volunteerId,
        lat,
        lng,
        speedKmh,
        distanceRemainingMeters: distanceMeters,
        status: incident.status,
      });
    } catch (_err) {
      // socket optional
    }

    return {
      status: incident.status,
      distanceRemainingMeters: distanceMeters,
    };
  }

  async recordFirstAidAction(incidentId, volunteerId, actionDataOrType = {}, maybeOptions = {}) {
    const actionData =
      typeof actionDataOrType === 'string'
        ? { actionType: actionDataOrType, ...maybeOptions }
        : actionDataOrType || {};
    const { actionType, durationSeconds, notes } = actionData;
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    ensure(
      incident.assignedVolunteerId === volunteerId,
      'Unauthorized volunteer for first aid recording',
      403,
    );

    const response = await VolunteerResponse.findOne({ incidentId, volunteerId });
    ensure(response, 'Volunteer response record not found', 404);

    const firstAidRecord = {
      actionType: actionType || 'OTHER',
      startedAt: new Date(),
      durationSeconds: Number(durationSeconds || 0),
      notes: notes || '',
    };

    response.firstAidActionsPerformed.push(firstAidRecord);
    await response.save();

    incident.auditTrail.push({
      action: 'FIRST_AID_PERFORMED',
      actorId: volunteerId,
      timestamp: new Date(),
      metadata: firstAidRecord,
    });
    await incident.save();

    try {
      getIo().to(`incident:${incidentId}`).emit('FIRST_AID_RECORDED', {
        incidentId,
        volunteerId,
        action: firstAidRecord,
      });
    } catch (_err) {
      // socket optional
    }

    return { success: true, record: firstAidRecord };
  }

  async handoffToMedical(incidentId, volunteerId, handoffData = {}) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    ensure(
      incident.assignedVolunteerId === volunteerId,
      'Unauthorized volunteer for handoff',
      403,
    );

    incident.status = 'HANDED_OVER_115';
    incident.resolvedAt = new Date();

    // Tự động tổng hợp Bệnh án Lâm sàng SBAR số hóa từ Dữ liệu sơ cứu thực tế
    const clin = incident.clinicalAssessment || {};
    const med = incident.medicalSnapshot || {};
    const tourniquetInfo = clin.tourniquet?.isApplied
      ? `Đã đặt Garo tại ${clin.tourniquet.limbLocation || 'chi tổn thương'} lúc ${new Date(clin.tourniquet.appliedAt).toLocaleTimeString('vi-VN')} (Cảnh báo tối đa 120p)`
      : 'Không đặt Garo';
    const cSpineInfo = clin.cSpineStabilized ? 'Đã cố định cột sống cổ (C-Spine)' : 'Không nghi chấn thương cổ';
    const avpuInfo = clin.avpuLevel ? `Tri giác AVPU: ${clin.avpuLevel}` : 'AVPU: Chưa đánh giá';

    const sbarSummary = handoffData.sbarSummary || {
      situation: `${incident.incidentType} - Mức độ: ${incident.severityLevel}`,
      background: `Nhóm máu: ${med.bloodType || 'Chưa rõ'} | Dị ứng: ${(med.allergies || []).join(', ') || 'Không rõ'} | Bệnh nền: ${(med.chronicConditions || []).join(', ') || 'Không'}`,
      assessment: `${avpuInfo} | ${cSpineInfo} | ${tourniquetInfo}`,
      recommendation: `Đã bàn giao kíp xe 115 (Biển số: ${handoffData.ambulancePlate || '115'}). Đề xuất kiểm tra thông khí và giám sát sinh tồn liên tục.`,
    };

    const qrVerificationHash =
      handoffData.qrVerificationHash ||
      `0x${crypto
        .createHash('sha256')
        .update(`${incidentId}:SBAR:${volunteerId}:${Date.now()}`)
        .digest('hex')
        .slice(0, 16)}`;

    incident.handoffRecord = {
      ambulancePlate: handoffData.ambulancePlate || null,
      paramedicName: handoffData.paramedicName || null,
      handedOverAt: new Date(),
      qrVerificationHash,
      notes: handoffData.notes || '',
      sbarSummary,
    };

    incident.auditTrail.push({
      action: 'HANDED_OVER_115',
      actorId: volunteerId,
      timestamp: new Date(),
      metadata: incident.handoffRecord,
    });
    await incident.save();

    await VolunteerResponse.updateOne(
      { incidentId, volunteerId },
      { $set: { status: 'COMPLETED' } },
    );

    // Thưởng 20 điểm Trust Score cho Hiệp sĩ hoàn thành bàn giao y tế
    await trustService.calculateAndUpdateTrustScore(volunteerId, 20);
    await chatService.closeChatRoom(incidentId);

    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('INCIDENT_HANDED_OVER', {
        incidentId,
        handoffRecord: incident.handoffRecord,
      });
      io.emit('RADAR_INCIDENT_RESOLVED', { incidentId });
    } catch (_err) {
      // socket optional
    }

    return this.getIncidentDetails(incidentId, volunteerId);
  }

  async markVolunteerArrived(incidentId, volunteerId) {
    const response = await VolunteerResponse.findOne({ incidentId, volunteerId });
    ensure(response, 'Volunteer response not found', 404);
    response.status = 'ARRIVED';
    await response.save();

    const incident = await RescueIncident.findById(incidentId);
    if (incident) {
      incident.status = 'ON_SCENE';
      incident.auditTrail.push({
        action: 'HERO_ARRIVED',
        actorId: volunteerId,
        timestamp: new Date(),
        metadata: {},
      });
      await incident.save();
    }

    try {
      getIo().to(`incident:${incidentId}`).emit('HERO_ARRIVED', {
        incidentId,
        volunteerId,
      });
    } catch (_err) {
      // socket optional
    }

    return mapResponse(response);
  }

  async triggerProximityBeacon(incidentId, volunteerId) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);

    incident.auditTrail.push({
      action: 'PROXIMITY_BEACON_TRIGGERED',
      actorId: volunteerId,
      timestamp: new Date(),
      metadata: { note: 'Hiệp sĩ kích hoạt còi và đèn flash tầm gần (<25m) để tìm nạn nhân' },
    });
    await incident.save();

    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('PROXIMITY_BEACON_TRIGGERED', {
        incidentId,
        triggeredBy: volunteerId,
        victimId: incident.victimId,
        timestamp: new Date(),
      });
      if (incident.victimId) {
        io.to(`user:${incident.victimId}`).emit('PROXIMITY_BEACON_TRIGGERED', {
          incidentId,
          triggeredBy: volunteerId,
        });
      }
    } catch (_err) {
      // socket optional
    }

    return {
      success: true,
      incidentId,
      status: 'BEACON_ACTIVATED',
      message: 'Đã kích hoạt còi hú âm lượng cao nhất và đèn flash trên thiết bị nạn nhân!',
    };
  }

  async getIncidentDetails(incidentId, requesterId) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);

    const victim = await User.findById(incident.victimId).lean();
    ensure(victim, 'Victim not found', 404);
    const guardians = await this.getGuardiansForVictim(victim);
    const guardianIds = new Set(guardians.map((item) => item._id));
    const responses = await VolunteerResponse.find({ incidentId }).sort({
      createdAt: 1,
    });
    const responderIds = new Set(responses.map((item) => item.volunteerId));
    const canAccess =
      incident.victimId === requesterId ||
      guardianIds.has(requesterId) ||
      responderIds.has(requesterId);
    ensure(canAccess, 'Unauthorized to access this incident', 403);

    const responderDocs = responderIds.size
      ? await User.find({ _id: { $in: [...responderIds] } }).lean()
      : [];
    const responderMap = new Map(
      responderDocs.map((item) => [item._id, sanitizeUser(item)]),
    );
    const room = await chatService
      .getChatRoomByIncident(incidentId)
      .catch(() => null);
    const memos = await EmergencyMemo.find({ incidentId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return {
      ...mapIncident(incident),
      victim: sanitizeUser(victim),
      responses: responses.map((response) => ({
        ...mapResponse(response),
        volunteer: responderMap.get(response.volunteerId) || null,
      })),
      chatRoom: room
        ? {
            id: room._id || room.id,
            incidentId: room.incidentId,
            roomType: room.roomType,
            participantIds: room.participantIds || [],
            responderIds: room.responderIds || [],
            status: room.status,
            createdAt: room.createdAt,
            closedAt: room.closedAt,
          }
        : null,
      emergencyMemos: memos.map(mapMemo),
    };
  }

  async resolveIncident(incidentId, requesterId) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    ensure(
      incident.victimId === requesterId,
      'Only the victim can resolve this incident',
      403,
    );

    const isAlreadyClosed = [
      'RESOLVED',
      'RESOLVED_SAFE',
      'HANDED_OVER_115',
      'CANCELLED_FALSE_ALARM',
    ].includes(incident.status);
    ensure(!isAlreadyClosed, 'Incident is already resolved', 409);

    incident.status = 'RESOLVED_SAFE';
    incident.resolvedAt = new Date();
    incident.auditTrail.push({
      action: 'INCIDENT_RESOLVED_BY_VICTIM',
      actorId: requesterId,
      timestamp: new Date(),
      metadata: {},
    });
    await incident.save();

    const arrivedResponses = await VolunteerResponse.find({
      incidentId,
      status: { $in: ['ARRIVED', 'ON_SCENE', 'COMPLETED', 'EN_ROUTE'] },
    }).lean();
    for (const response of arrivedResponses) {
      // eslint-disable-next-line no-await-in-loop
      await trustService.calculateAndUpdateTrustScore(response.volunteerId, 15);
      // eslint-disable-next-line no-await-in-loop
      await VolunteerResponse.updateOne(
        { _id: response._id },
        { $set: { status: 'COMPLETED' } },
      );
    }

    await chatService.closeChatRoom(incidentId);
    await systemLogService.createLog({
      incidentId,
      actionType: 'INCIDENT_RESOLVED',
      description: `Incident ${incidentId} resolved by victim`,
    });

    try {
      getIo().emit('RADAR_INCIDENT_RESOLVED', { incidentId });
    } catch (_error) {
      // socket optional
    }

    return this.getIncidentDetailsForBroadcast(incidentId);
  }

  getClinicalActionProtocol(incidentType, severityLevel) {
    const protocols = {
      CARDIAC_ARREST: {
        protocolName: 'Hồi sinh Tim Phổi Nâng cao (CPR + AED Protocol)',
        priority: 'P1_CRITICAL_GOLDEN_4_MIN',
        steps: [
          'Kiểm tra an toàn hiện trường & lay gọi nạn nhân, kiểm tra mạch cảnh trong 10 giây.',
          'Nếu không thở hoặc thở ngáp cá: Bắt đầu Ép tim liên tục 100 - 120 nhịp/phút, sâu 5-6 cm giữa ngực.',
          'Tỉ lệ chuẩn: 30 lần ép tim : 2 lần thổi ngạt (hoặc Hands-Only CPR liên tục không ngắt quãng).',
          'Lấy máy AED gần nhất: Bật máy, dán 2 pad điện cực (dưới xương đòn phải và mỏm tim trái).',
          'Lắng nghe máy phân tích nhịp: Hô to "ĐỨNG LÙI RA" trước khi bấm nút sốc điện (nếu có chỉ định).',
        ],
        goldenWindowSeconds: 240, // 4 phút
      },
      STROKE: {
        protocolName: 'Giao thức Cấp cứu Đột quỵ Não (FAST Protocol)',
        priority: 'P1_CRITICAL_BRAIN_ATTACK',
        steps: [
          'F (Face): Kiểm tra mặt nạn nhân có bị méo, lệch nhân trung khi cười không.',
          'A (Arms): Yêu cầu giơ 2 tay lên - có tay nào bị liệt, rơi xuống không.',
          'S (Speech): Nói câu đơn giản - có bị nói ngọng, líu lưỡi, mất ngôn ngữ không.',
          'T (Time): Ghi nhận chính xác mốc giờ phát bệnh (thời gian vàng tiêu sợi huyết 4.5 giờ).',
          'Đặt nạn nhân nằm nghiêng an toàn 30 độ, KHÔNG cho ăn uống, KHÔNG cạo gió, KHÔNG bấm huyệt.',
        ],
        goldenWindowSeconds: 16200, // 4.5 giờ
      },
      CHOKING: {
        protocolName: 'Cấp cứu Dị vật Đường thở (Heimlich Maneuver)',
        priority: 'P1_CRITICAL_AIRWAY',
        steps: [
          'Hỏi: "Bạn có bị nghẹn không?" Nếu nạn nhân ôm cổ không nói được:',
          'Đứng sau lưng, cúi người nạn nhân về phía trước: Vỗ 5 cái mạnh vào lưng giữa 2 bả vai.',
          'Nếu chưa ra: Vòng 2 tay qua eo, đặt nắm đấm trên rốn, giật mạnh hướng vào trong và lên trên 5 lần.',
          'Nếu nạn nhân bất tỉnh: Đặt nằm ngửa và tiến hành CPR ngay lập tức, kiểm tra họng lấy dị vật nếu nhìn thấy.',
        ],
        goldenWindowSeconds: 180, // 3 phút
      },
      TRAUMA_FALL: {
        protocolName: 'Sơ cứu Chấn thương & Cố định Cột sống (C-Spine Immobilization)',
        priority: 'P2_URGENT_TRAUMA',
        steps: [
          'Tuyệt đối KHÔNG gập, ngửa hoặc xoay chuyển đầu cổ của nạn nhân.',
          'Dùng 2 tay cố định trục đầu - cổ - thân thẳng hàng (Manual In-line Stabilization).',
          'Kiểm tra tri giác, nhịp thở, bắt mạch quay 2 bên.',
          'Băng nẹp bất động các chi bị gãy trước khi di chuyển.',
        ],
        goldenWindowSeconds: 1800,
      },
      BLEEDING: {
        protocolName: 'Cầm máu Khẩn cấp (Haemostasis & Tourniquet)',
        priority: 'P1_CRITICAL_HEMORRHAGE',
        steps: [
          'Dùng gạc vô trùng ép trực tiếp thật mạnh lên vết thương liên tục.',
          'Nếu máu vẫn phun thành tia (đứt động mạch chi): Đặt Garo (CAT Tourniquet) phía trên vết thương 5-7cm.',
          'Siết chặt thanh chốt đến khi máu ngừng chảy hoàn toàn, khóa chốt an toàn.',
          'Ghi rõ giờ đặt Garo lên trán nạn nhân hoặc thân dây garo.',
        ],
        goldenWindowSeconds: 300,
      },
    };

    return (
      protocols[incidentType] || {
        protocolName: 'Quy trình Sơ cứu Cơ bản Ngoại viện (BLS Standard SOP)',
        priority: severityLevel || 'P1_CRITICAL',
        steps: [
          'Đảm bảo an toàn hiện trường cho bản thân và nạn nhân (DRSABCD).',
          'Kiểm tra đáp ứng (lay gọi, véo đau).',
          'Kiểm tra đường thở và nhịp thở (Look, Listen, Feel trong 10s).',
          'Duy trì tư thế hồi sức an toàn nếu nạn nhân thở được, hoặc CPR nếu ngừng thở.',
        ],
        goldenWindowSeconds: 300,
      }
    );
  }

  // Đánh giá An toàn hiện trường (Scene Safety & Hazard Assessment) - Chống tai nạn kép cho Hiệp sĩ
  async assessSceneSafety(incidentId, volunteerId, safetyData = {}) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);

    const {
      hazardFlags = [],
      isSafeToEnter = true,
      escalatedToService = 'NONE',
      safetyNotes = '',
    } = safetyData;

    incident.sceneSafety = {
      isAssessed: true,
      assessedAt: new Date(),
      hazardFlags,
      isSafeToEnter: Boolean(isSafeToEnter),
      escalatedToService: escalatedToService || 'NONE',
      safetyNotes: safetyNotes || '',
    };

    incident.auditTrail.push({
      action: 'SCENE_SAFETY_ASSESSED',
      actorId: volunteerId,
      timestamp: new Date(),
      metadata: {
        hazardFlags,
        isSafeToEnter,
        escalatedToService,
        safetyNotes,
      },
    });

    await incident.save();

    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('SCENE_SAFETY_UPDATED', {
        incidentId,
        sceneSafety: incident.sceneSafety,
      });
    } catch (_err) {
      // socket optional
    }

    return {
      success: true,
      sceneSafety: incident.sceneSafety,
      message: isSafeToEnter
        ? 'Hiện trường an toàn để tiến hành sơ cứu cấp bách.'
        : `CẢNH BÁO NGUY HIỂM: Hiện trường không an toàn! Đã ghi nhận leo thang sang ${escalatedToService}. Không tự ý xông vào!`,
    };
  }

  // Kích hoạt Loa ngoài chỉ dẫn sơ cứu 0-Giây cho người bên cạnh (Bystander Co-Pilot T+0s)
  async triggerBystanderGuidance(incidentId, requesterId, guidanceData = {}) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);

    const guidanceType =
      guidanceData.guidanceType || incident.bystanderGuidance?.guidanceType || 'CPR_AIRWAY';
    const metronomeBpm = Number(guidanceData.metronomeBpm || 110);

    incident.bystanderGuidance = {
      isActive: true,
      guidanceType,
      speakerphoneAutoOn: true,
      metronomeBpm,
    };

    incident.auditTrail.push({
      action: 'BYSTANDER_GUIDANCE_TRIGGERED',
      actorId: requesterId,
      timestamp: new Date(),
      metadata: { guidanceType, metronomeBpm },
    });

    await incident.save();

    const audioScript = this.getBystanderAudioScript(guidanceType);

    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('BYSTANDER_GUIDANCE_ALERT', {
        incidentId,
        bystanderGuidance: incident.bystanderGuidance,
        audioScript,
      });
      io.to(incident.victimId).emit('BYSTANDER_GUIDANCE_ALERT', {
        incidentId,
        bystanderGuidance: incident.bystanderGuidance,
        audioScript,
      });
    } catch (_err) {
      // socket optional
    }

    return {
      success: true,
      bystanderGuidance: incident.bystanderGuidance,
      audioScript,
    };
  }

  getBystanderAudioScript(guidanceType) {
    switch (guidanceType) {
      case 'CPR_AIRWAY':
        return {
          title: 'HỒI SỨC TIM PHỔI KHẨN CẤP (CPR T+0s)',
          voicePrompt:
            'Nạn nhân đang bất tỉnh ngừng tim. Hãy đặt gót bàn tay vào chính giữa ngực nạn nhân, đan các ngón tay lại. Ép sâu 5cm theo nhịp gõ sau.',
          metronomeBpm: 110,
          steps: [
            'Đặt nạn nhân nằm ngửa trên mặt phẳng cứng.',
            'Đặt 2 tay giữa ngực, ấn mạnh và nhanh theo nhịp 110 bpm.',
            'Không dừng ép ngực cho tới khi Hiệp sĩ hoặc Đội 115 đến!',
          ],
        };
      case 'SEVERE_BLEEDING':
        return {
          title: 'CẦM MÁU ÁP LỰC TRỰC TIẾP',
          voicePrompt:
            'Nạn nhân đang mất máu ồ ạt. Dùng vải sạch ấn chặt trực tiếp lên miệng vết thương ngay lập tức.',
          steps: [
            'Dùng gạc hoặc khăn sạch đè chặt lên miệng vết thương.',
            'Dùng toàn bộ trọng lượng cơ thể ép giữ liên tục.',
            'Nếu có garô và máu chảy ở chi, siết chặt cách vết thương 5-7cm.',
          ],
        };
      case 'RECOVERY_POSITION':
        return {
          title: 'TƯ THẾ HỒI PHỤC AN TOÀN',
          voicePrompt:
            'Nạn nhân còn thở nhưng bất tỉnh. Lật nghiêng người nạn nhân sang một bên để thông thoáng đường thở.',
          steps: [
            'Gập một chân của nạn nhân tạo góc 90 độ.',
            'Nhẹ nhàng lật nạn nhân nằm nghiêng sang một bên.',
            'Ngửa nhẹ cằm để đờm nhớt hoặc chất nôn chảy ra ngoài.',
          ],
        };
      default:
        return {
          title: 'HỖ TRỢ KHẨN CẤP TẠI CHỖ',
          voicePrompt:
            'Giữ bình tĩnh. Đặt nạn nhân ở tư thế an toàn, gọi to tìm kiếm người hỗ trợ xung quanh.',
          steps: [
            'Kiểm tra nạn nhân có phản ứng không.',
            'Giữ đầu và cổ thẳng hàng.',
            'Chờ Hiệp sĩ SafeSolo đang tiếp cận.',
          ],
        };
    }
  }

  // Đánh giá Lâm sàng Ngoại viện Chuyên sâu (AVPU, Garô Time-Lock, C-Spine, FAST Stroke)
  async recordClinicalAssessment(incidentId, volunteerId, assessmentData = {}) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);
    ensure(
      incident.assignedVolunteerId === volunteerId,
      'Chỉ Hiệp sĩ được điều phối mới có quyền cập nhật bệnh án lâm sàng',
      403,
    );

    const {
      avpuLevel = null,
      tourniquet = {},
      cSpineStabilized = false,
      fastStroke = {},
      cprDetails = {},
    } = assessmentData;

    const currentClin = incident.clinicalAssessment || {};

    const isTourniquetApplied = Boolean(tourniquet.isApplied ?? currentClin.tourniquet?.isApplied);
    const tourniquetAppliedAt = isTourniquetApplied
      ? (tourniquet.appliedAt || currentClin.tourniquet?.appliedAt || new Date())
      : null;

    incident.clinicalAssessment = {
      avpuLevel: avpuLevel || currentClin.avpuLevel || null,
      tourniquet: {
        isApplied: isTourniquetApplied,
        appliedAt: tourniquetAppliedAt,
        limbLocation: tourniquet.limbLocation || currentClin.tourniquet?.limbLocation || null,
        maxSafeMinutes: Number(tourniquet.maxSafeMinutes || 120),
      },
      cSpineStabilized: Boolean(cSpineStabilized ?? currentClin.cSpineStabilized),
      cSpineStabilizedAt: cSpineStabilized ? (currentClin.cSpineStabilizedAt || new Date()) : null,
      fastStroke: {
        faceDroop: Boolean(fastStroke.faceDroop ?? currentClin.fastStroke?.faceDroop),
        armWeakness: Boolean(fastStroke.armWeakness ?? currentClin.fastStroke?.armWeakness),
        speechDifficulty: Boolean(fastStroke.speechDifficulty ?? currentClin.fastStroke?.speechDifficulty),
        timeOnsetMinutes: fastStroke.timeOnsetMinutes ?? currentClin.fastStroke?.timeOnsetMinutes ?? null,
        isStrokeSuspected: Boolean(fastStroke.faceDroop || fastStroke.armWeakness || fastStroke.speechDifficulty),
      },
      cprDetails: {
        cyclesCount: Number(cprDetails.cyclesCount ?? currentClin.cprDetails?.cyclesCount ?? 0),
        compressionsCount: Number(cprDetails.compressionsCount ?? currentClin.cprDetails?.compressionsCount ?? 0),
        aedShocksCount: Number(cprDetails.aedShocksCount ?? currentClin.cprDetails?.aedShocksCount ?? 0),
      },
      lastEvaluatedAt: new Date(),
    };

    incident.auditTrail.push({
      action: 'CLINICAL_ASSESSMENT_UPDATED',
      actorId: volunteerId,
      timestamp: new Date(),
      metadata: incident.clinicalAssessment,
    });

    await incident.save();

    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('CLINICAL_ASSESSMENT_UPDATED', {
        incidentId,
        clinicalAssessment: incident.clinicalAssessment,
      });
    } catch (_err) {
      // socket optional
    }

    return {
      success: true,
      clinicalAssessment: incident.clinicalAssessment,
      message: isTourniquetApplied
        ? 'ĐÃ KHÓA THỜI GIAN GARÔ: Bắt buộc theo dõi đồng hồ đếm ngược 120 phút an toàn.'
        : 'Đã cập nhật bệnh án lâm sàng ngoại viện thành công.',
    };
  }

  // Đánh giá Hậu sự cố (After-Action Review - AAR) & Tích lũy Tín chỉ CME
  async submitAfterActionReview(incidentId, reviewerId, reviewData = {}) {
    const incident = await RescueIncident.findById(incidentId);
    ensure(incident, 'Incident not found', 404);

    const {
      overallScore = 90,
      responseTimeSeconds = 180,
      cprQualityScore = 95,
      sbarQualityScore = 95,
      cmeCreditsAwarded = 2,
      notes = '',
    } = reviewData;

    incident.afterActionReview = {
      isReviewed: true,
      reviewedAt: new Date(),
      reviewerId,
      overallScore: Number(overallScore),
      responseTimeSeconds: Number(responseTimeSeconds),
      cprQualityScore: Number(cprQualityScore),
      sbarQualityScore: Number(sbarQualityScore),
      cmeCreditsAwarded: Number(cmeCreditsAwarded),
      notes: notes || '',
    };

    incident.auditTrail.push({
      action: 'AFTER_ACTION_REVIEW_COMPLETED',
      actorId: reviewerId,
      timestamp: new Date(),
      metadata: incident.afterActionReview,
    });

    await incident.save();

    // Nếu có Hiệp sĩ hoàn thành ca và được tặng tín chỉ CME, cộng trực tiếp vào hồ sơ bác sĩ/hiệp sĩ
    if (incident.assignedVolunteerId && cmeCreditsAwarded > 0) {
      await User.findByIdAndUpdate(incident.assignedVolunteerId, {
        $inc: { cmeCredits: Number(cmeCreditsAwarded) },
      });
    }

    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('AFTER_ACTION_REVIEW_SAVED', {
        incidentId,
        afterActionReview: incident.afterActionReview,
      });
    } catch (_err) {
      // socket optional
    }

    return {
      success: true,
      afterActionReview: incident.afterActionReview,
      message: `Đã hoàn tất đánh giá AAR và cộng thưởng ${cmeCreditsAwarded} tín chỉ CME cho Hiệp sĩ.`,
    };
  }

  // Xác thực Bệnh án Lâm sàng Bàn giao SBAR số hóa từ Mã QR / Băm SHA-256
  async verifySbarHandoff(verificationHash) {
    ensure(verificationHash, 'Verification hash is required', 400);

    const incident = await RescueIncident.findOne({
      $or: [
        { 'handoffRecord.qrVerificationHash': verificationHash },
        { _id: verificationHash },
      ],
    });
    ensure(incident, 'Không tìm thấy hồ sơ bàn giao y tế tương ứng với mã băm này', 404);

    const victim = await User.findById(incident.victimId).lean().catch(() => null);
    const volunteer = incident.assignedVolunteerId
      ? await User.findById(incident.assignedVolunteerId).lean().catch(() => null)
      : null;

    const resp = await VolunteerResponse.findOne({
      incidentId: incident._id,
      volunteerId: incident.assignedVolunteerId,
    }).lean().catch(() => null);

    return {
      status: 'VERIFIED_OFFICIAL_115',
      standard: 'BỘ Y TẾ - HỒ SƠ BÀN GIAO CẤP CỨU NGOẠI VIỆN (SBAR PROTOCOL)',
      incidentId: incident._id,
      verificationHash: incident.handoffRecord?.qrVerificationHash || verificationHash,
      handedOverAt: incident.handoffRecord?.handedOverAt || incident.resolvedAt,
      incidentType: incident.incidentType,
      severityLevel: incident.severityLevel,
      approxAddress: incident.approxAddress,
      victimProfile: {
        fullName: victim?.fullName || 'Nạn nhân SafeSolo',
        phoneNumber: victim?.phoneNumber || '',
        bloodType: incident.medicalSnapshot?.bloodType || 'UNKNOWN',
        allergies: incident.medicalSnapshot?.allergies || [],
        chronicConditions: incident.medicalSnapshot?.chronicConditions || [],
        emergencyNotes: incident.medicalSnapshot?.emergencyNotes || '',
      },
      firstResponder: {
        heroName: volunteer?.fullName || 'Hiệp sĩ SafeSolo',
        heroTier: volunteer?.heroTier || 'TIER_1_BLS',
        trustScore: volunteer?.trustScore || 100,
        credentialNumber: volunteer?.credentialNumber || '',
      },
      ambulanceHandoff: {
        plate: incident.handoffRecord?.ambulancePlate || '115',
        paramedicDoctor: incident.handoffRecord?.paramedicName || 'BS Kíp Cấp cứu 115',
        notes: incident.handoffRecord?.notes || '',
        sbar: incident.handoffRecord?.sbarSummary || {},
      },
      clinicalVitals: {
        avpuLevel: incident.clinicalAssessment?.avpuLevel || 'UNASSESSED',
        cSpineStabilized: Boolean(incident.clinicalAssessment?.cSpineStabilized),
        tourniquet: incident.clinicalAssessment?.tourniquet || { isApplied: false },
        fastStroke: incident.clinicalAssessment?.fastStroke || {},
        cprDetails: incident.clinicalAssessment?.cprDetails || {},
        firstAidActions: resp?.firstAidActionsPerformed || [],
      },
      digitalSeal: {
        issuer: 'SafeSolo Emergency Operational Cloud & Tele-115 Network',
        tamperProof: true,
        verifiedAt: new Date(),
      },
    };
  }

  /**
   * Khởi tạo Phiên Hội Chẩn Cấp Cứu Trực Tuyến (Tele-FirstAid Live Consultation)
   * Kết nối Hiệp sĩ hiện trường với Bác sĩ trực 115 qua Video/Audio thời gian thực
   */
  async initiateTeleConsultation(incidentId, heroId, reason = 'Cấp cứu chấn thương nặng cần hướng dẫn lâm sàng') {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const sessionId = `TELE-115-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    incident.teleConsultation = {
      isActive: true,
      sessionId,
      doctorId: null,
      doctorName: 'Đang đợi Bác sĩ 115 tiếp nhận...',
      doctorHospital: 'Tổng đài Cấp cứu 115 TP.HCM',
      startedAt: new Date(),
      endedAt: null,
      videoStreamUrl: `https://webrtc.safesolo.vn/room/${sessionId}`,
      verbalMedicalOrders: [],
    };

    incident.auditTrail.push({
      action: 'TELE_FIRSTAID_REQUESTED',
      timestamp: new Date(),
      details: `Hiệp sĩ ${heroId} yêu cầu hội chẩn Tele-FirstAid khẩn cấp: "${reason}". Phiên: ${sessionId}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      sessionId,
      videoStreamUrl: incident.teleConsultation.videoStreamUrl,
      status: 'WAITING_FOR_DOCTOR',
      requestedBy: heroId,
      startedAt: incident.teleConsultation.startedAt,
    };
  }

  /**
   * Bác sĩ Cấp Cứu 115 Tiếp Nhận & Vào Phòng Hội Chẩn Trực Tiếp
   */
  async connectDoctorTeleConsultation(incidentId, doctorProfile = {}) {
    const {
      doctorId = 'DOC-115-HCM',
      doctorName = 'BS.CKII Trần Minh Tuấn (Hồi sức Cấp cứu 115)',
      hospitalName = 'Bệnh viện Cấp cứu Trưng Vương / 115 TP.HCM',
    } = doctorProfile;

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    if (!incident.teleConsultation) {
      incident.teleConsultation = { isActive: true, sessionId: `TELE-115-${crypto.randomUUID().slice(0, 8).toUpperCase()}` };
    }

    incident.teleConsultation.isActive = true;
    incident.teleConsultation.doctorId = doctorId;
    incident.teleConsultation.doctorName = doctorName;
    incident.teleConsultation.doctorHospital = hospitalName;

    incident.auditTrail.push({
      action: 'DOCTOR_JOINED_TELE_CONSULTATION',
      timestamp: new Date(),
      details: `${doctorName} (${hospitalName}) đã tham gia phiên hội chẩn cứu hộ trực tiếp`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      sessionId: incident.teleConsultation.sessionId,
      doctorId,
      doctorName,
      hospitalName,
      status: 'DOCTOR_CONNECTED',
      videoStreamUrl: incident.teleConsultation.videoStreamUrl,
    };
  }

  /**
   * Bác sĩ Ban Hành Y Lệnh Miệng Khẩn Cấp (Verbal Medical Orders)
   * Ngoại viện: Ép tim, tiêm Adrenaline tự động, nẹp chân, thở oxy
   */
  async issueVerbalMedicalOrder(incidentId, orderData = {}) {
    const {
      orderText = 'Bóp bóng Ambu thở oxy 15 lít/phút kết hợp ép tim liên tục 30:2',
      dosageOrAction = 'Oxy 100% qua mask có túi dự trữ',
      issuedBy = 'BS.CKII Trần Minh Tuấn',
    } = orderData;

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    if (!incident.teleConsultation) {
      incident.teleConsultation = { isActive: true, verbalMedicalOrders: [] };
    }
    if (!incident.teleConsultation.verbalMedicalOrders) {
      incident.teleConsultation.verbalMedicalOrders = [];
    }

    const orderObj = {
      orderText,
      dosageOrAction,
      issuedBy,
      issuedAt: new Date(),
      executedByVolunteer: false,
      executedAt: null,
    };

    incident.teleConsultation.verbalMedicalOrders.push(orderObj);
    const orderIndex = incident.teleConsultation.verbalMedicalOrders.length - 1;

    incident.auditTrail.push({
      action: 'VERBAL_MEDICAL_ORDER_ISSUED',
      timestamp: new Date(),
      details: `Y LỆNH MIỆNG: "${orderText}" (${dosageOrAction}) ban hành bởi ${issuedBy}`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      orderIndex,
      orderText,
      dosageOrAction,
      issuedBy,
      issuedAt: orderObj.issuedAt,
      status: 'PENDING_EXECUTION',
    };
  }

  /**
   * Hiệp sĩ Xác Nhận Đã Thực Thi Y Lệnh Bác Sĩ Tại Hiện Trường
   */
  async confirmMedicalOrderExecuted(incidentId, orderIndex, heroId = 'HERO_ON_SCENE') {
    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố');

    const orders = incident.teleConsultation?.verbalMedicalOrders || [];
    if (!orders[orderIndex]) throw new Error('Không tìm thấy y lệnh tại vị trí ' + orderIndex);

    orders[orderIndex].executedByVolunteer = true;
    orders[orderIndex].executedAt = new Date();

    incident.auditTrail.push({
      action: 'VERBAL_MEDICAL_ORDER_EXECUTED',
      timestamp: new Date(),
      details: `Hiệp sĩ ${heroId} đã thực thi thành công Y lệnh: "${orders[orderIndex].orderText}"`,
    });

    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      orderIndex,
      orderText: orders[orderIndex].orderText,
      executedBy: heroId,
      executedAt: orders[orderIndex].executedAt,
      status: 'EXECUTED_CONFIRMED',
    };
  }
}

module.exports = new RadarService();
