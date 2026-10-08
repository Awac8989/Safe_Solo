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
    const nearbyVolunteers = await this.findNearbyVolunteers(
      exactLat,
      exactLng,
      victimId,
      initialRadius,
      { requiredSkillTier, requiredSkills },
    );

    // 2. Gửi PUSH BÁO ĐỘNG ĐỎ tới Top ứng viên phù hợp nhất (tối đa 5 người)
    const topCandidates = nearbyVolunteers.slice(0, 5);
    for (const volunteer of topCandidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
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

        // BẮN SỰ KIỆN KHẨN CẤP ĐÍCH DANH VÀO SOCKET CỦA HIỆP SĨ
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

        const io = getIo();
        io.to(`user:${volunteer.id}`).emit('HERO_DISPATCH_REQUEST', heroPayload);
        io.to(volunteer.id).emit('HERO_DISPATCH_REQUEST', heroPayload);
      } catch (_err) {
        // socket optional
      }
    }

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

    // Bắn socket thông báo cho Nạn nhân và Người nhà biết Hiệp sĩ đã nhận ca
    try {
      const io = getIo();
      io.to(`incident:${incidentId}`).emit('HERO_ACCEPTED', {
        incidentId,
        volunteer: sanitizeUser(volunteer),
        response: mapResponse(response),
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
    incident.handoffRecord = {
      ambulancePlate: handoffData.ambulancePlate || null,
      paramedicName: handoffData.paramedicName || null,
      handedOverAt: new Date(),
      qrVerificationHash: handoffData.qrVerificationHash || null,
      notes: handoffData.notes || '',
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
}

module.exports = new RadarService();
