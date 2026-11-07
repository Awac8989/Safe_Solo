const RescueIncident = require('../models/RescueIncident');
const VolunteerResponse = require('../models/VolunteerResponse');
const User = require('../models/User');
const radarService = require('../services/radarService');
const trustService = require('../services/trustService');
const { createAlertEvent } = require('../services/alertEventService');
const { getIo } = require('../sockets/socketServer');
const { sanitizeUser } = require('../lib/utils');

let workerIntervalId = null;
let isProcessing = false;

// Cấu hình thời gian (Timeouts)
const RING_1_TIMEOUT_MS = 30 * 1000; // 30 giây: Hết hạn Vòng 1 (1.2km) -> Dãn sang Vòng 2 (4.5km)
const RING_2_TIMEOUT_MS = 60 * 1000; // 60 giây: Hết hạn Vòng 2 -> Kích hoạt 115 & báo động người nhà
const WATCHDOG_TIMEOUT_MS = 90 * 1000; // 90 giây: Hiệp sĩ nhận nhưng đứng im -> Phạt & Re-dispatch

// Ngưỡng thích ứng tăng tốc cho ca nguy kịch P1_CRITICAL (CPR/AED, đột quỵ, chấn thương nặng)
const P1_RING_1_TIMEOUT_MS = 15 * 1000; // 15 giây dãn vòng nếu ca khẩn cấp chưa có ai nhận
const P1_RING_2_TIMEOUT_MS = 35 * 1000; // 35 giây kết nối 115 nếu ca khẩn cấp không tìm thấy hiệp sĩ
const P1_WATCHDOG_TIMEOUT_MS = 45 * 1000; // 45 giây phát hiện đứng im cho ca khẩn cấp

async function processDispatchLifecycle() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    let io = null;
    try {
      io = getIo();
    } catch (_e) {
      // Socket not yet ready
    }

    // =========================================================================
    // 1. GIAI ĐOẠN DÃN BÁN KÍNH: VÒNG 1 (1.2km) -> VÒNG 2 (4.5km)
    // =========================================================================
    const ring1Candidates = await RescueIncident.find({
      status: 'DISPATCHING_R1',
      assignedVolunteerId: null,
      $or: [
        {
          severityLevel: 'P1_CRITICAL',
          createdAt: { $lte: new Date(now.getTime() - P1_RING_1_TIMEOUT_MS) },
        },
        {
          createdAt: { $lte: new Date(now.getTime() - RING_1_TIMEOUT_MS) },
        },
      ],
    });

    for (const incident of ring1Candidates) {
      try {
        incident.status = 'DISPATCHING_R2';
        incident.dispatchRadiusKm = 4.5;
        incident.auditTrail.push({
          action: 'DISPATCH_RING_EXPANDED',
          timestamp: new Date(),
          metadata: {
            previousRadiusKm: 1.2,
            newRadiusKm: 4.5,
            elapsedSeconds: Math.round(
              (now.getTime() - incident.createdAt.getTime()) / 1000,
            ),
          },
        });
        await incident.save();

        // Tìm thêm hiệp sĩ trong bán kính mở rộng 4.5km theo năng lực chuyên môn
        const nearbyVolunteers = await radarService.findNearbyVolunteers(
          incident.exactLat,
          incident.exactLng,
          incident.victimId,
          4.5,
          {
            requiredSkillTier: incident.requiredSkillTier,
            requiredSkills: incident.requiredSkills,
          },
        );

        // Lấy danh sách đã được alert từ trước
        const existingResponses = await VolunteerResponse.find({
          incidentId: incident._id,
        }).lean();
        const existingVolunteerIds = new Set(
          existingResponses.map((r) => r.volunteerId),
        );

        const newCandidates = nearbyVolunteers
          .filter((v) => !existingVolunteerIds.has(v.id))
          .slice(0, 5);
        const victim = await User.findById(incident.victimId).lean();

        await Promise.allSettled(
          newCandidates.map(async (volunteer) => {
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
                  victimName: victim
                    ? sanitizeUser(victim).fullName
                    : 'Nạn nhân SafeSolo',
                  incidentType: incident.incidentType,
                  severity: incident.severity,
                  severityLevel: incident.severityLevel,
                  distanceKm: volunteer.distanceKm,
                  approxAddress: incident.approxAddress,
                  medicalSnapshot: incident.medicalSnapshot,
                  isRingExpanded: true,
                  createdAt: incident.createdAt,
                };

                io.to(`user:${volunteer.id}`).emit('HERO_DISPATCH_REQUEST', heroPayload);
                io.to(volunteer.id).emit('HERO_DISPATCH_REQUEST', heroPayload);
              }
            } catch (_candErr) {
              // non-blocking
            }
          }),
        );

        if (io) {
          io.to(`incident:${incident._id}`).emit('INCIDENT_RING_EXPANDED', {
            incidentId: incident._id,
            newRadiusKm: 4.5,
            newCandidatesCount: newCandidates.length,
          });
        }

        console.log(
          `[DispatchWorker] Incident ${incident._id} expanded to Ring 2 (4.5km), alerted ${newCandidates.length} new heroes`,
        );
      } catch (incErr) {
        console.error(
          `[DispatchWorker] Error expanding incident ${incident._id}:`,
          incErr.message,
        );
      }
    }

    // =========================================================================
    // 2. GIAI ĐOẠN KHẨN CẤP 115: VÒNG 2 HẾT HẠN KHÔNG CÓ HIỆP SĨ (35s P1 / 60s STANDARD)
    // =========================================================================
    const ring2Timeouts = await RescueIncident.find({
      status: 'DISPATCHING_R2',
      assignedVolunteerId: null,
      createdAt: { $lte: new Date(now.getTime() - RING_2_TIMEOUT_MS) },
    });

    for (const incident of ring2Timeouts) {
      try {
        incident.status = 'ESCALATED_115';
        incident.auditTrail.push({
          action: 'ESCALATED_115_NO_VOLUNTEERS',
          timestamp: new Date(),
          metadata: {
            reason: 'Không có hiệp sĩ phản hồi trong thời gian vàng',
            elapsedSeconds: Math.round(
              (now.getTime() - incident.createdAt.getTime()) / 1000,
            ),
          },
        });
        await incident.save();

        await createAlertEvent({
          userId: incident.victimId,
          level: 'CRITICAL',
          status: 'ESCALATED_115',
          source: 'AUTO_DISPATCH',
          title: 'Đã tự động kết nối Cấp cứu 115',
          message:
            'Không tìm thấy hiệp sĩ rảnh trong khu vực. Hệ thống tự động chuyển hồ sơ tới trung tâm cấp cứu 115 và báo động người nhà!',
          metadata: { incidentId: incident._id },
        });

        if (io) {
          io.to(`incident:${incident._id}`).emit('INCIDENT_ESCALATED_115', {
            incidentId: incident._id,
            message:
              'Đã kết nối Cấp cứu 115 tự động. Người nhà vui lòng theo dõi trực tiếp!',
          });
          io.to(incident.victimId).emit('INCIDENT_ESCALATED_115', {
            incidentId: incident._id,
          });
        }

        console.log(
          `[DispatchWorker] Incident ${incident._id} escalated to 115 emergency services`,
        );
      } catch (escErr) {
        console.error(
          `[DispatchWorker] Error escalating incident ${incident._id}:`,
          escErr.message,
        );
      }
    }

    // =========================================================================
    // 3. WATCHDOG PHÁT HIỆN HIỆP SĨ ĐỨNG IM / XE HỎNG / BỎ CUỘC (> 45s P1 / > 90s P2)
    // =========================================================================
    const inProgressIncidents = await RescueIncident.find({
      status: { $in: ['ACCEPTED', 'EN_ROUTE'] },
      assignedVolunteerId: { $ne: null },
    });

    for (const incident of inProgressIncidents) {
      try {
        const volunteerId = incident.assignedVolunteerId;
        const response = await VolunteerResponse.findOne({
          incidentId: incident._id,
          volunteerId,
        });

        if (!response) continue;

        const lastActivityTime =
          incident.telemetry?.lastHeroMovementAt ||
          response.updatedAt ||
          response.createdAt;

        const inactiveDurationMs =
          now.getTime() - new Date(lastActivityTime).getTime();

        const effectiveWatchdogTimeout =
          incident.severityLevel === 'P1_CRITICAL'
            ? P1_WATCHDOG_TIMEOUT_MS
            : WATCHDOG_TIMEOUT_MS;

        if (inactiveDurationMs >= effectiveWatchdogTimeout) {
          console.warn(
            `[DispatchWorker] Watchdog alert: Hero ${volunteerId} inactive for ${Math.round(inactiveDurationMs / 1000)}s on incident ${incident._id}`,
          );

          response.status = 'ABANDONED_TIMEOUT';
          response.rejectionReason =
            'Hệ thống tự động thu hồi ca do không di chuyển trong thời gian vàng';
          await response.save();

          // Trừ 20 điểm uy tín vì bỏ ca khẩn cấp
          await trustService.calculateAndUpdateTrustScore(volunteerId, -20);

          // Gỡ bỏ hiệp sĩ và chuyển trạng thái về DISPATCHING_R2 để tái điều phối ngay
          incident.assignedVolunteerId = null;
          incident.status = 'DISPATCHING_R2';
          incident.auditTrail.push({
            action: 'HERO_ABANDONED_TIMEOUT',
            actorId: volunteerId,
            timestamp: new Date(),
            metadata: {
              inactiveDurationSeconds: Math.round(inactiveDurationMs / 1000),
              penalizedScore: -20,
            },
          });
          await incident.save();

          if (io) {
            io.to(`user:${volunteerId}`).emit('HERO_MISSION_CANCELLED_TIMEOUT', {
              incidentId: incident._id,
              reason:
                'Bạn đã bị thu hồi nhiệm vụ do không di chuyển quá thời gian quy định (-20 điểm uy tín)',
            });

            io.to(`incident:${incident._id}`).emit('HERO_REASSIGNED', {
              incidentId: incident._id,
              previousVolunteerId: volunteerId,
              message:
                'Hiệp sĩ gặp sự cố di chuyển. Hệ thống đang tự động điều phối hiệp sĩ khác...',
            });
          }

          // Tự động quét và bắn nhiệm vụ cho các Hiệp sĩ khác ngay lập tức theo chuyên môn
          const newNearbyVolunteers = await radarService.findNearbyVolunteers(
            incident.exactLat,
            incident.exactLng,
            incident.victimId,
            4.5,
            {
              requiredSkillTier: incident.requiredSkillTier,
              requiredSkills: incident.requiredSkills,
            },
          );
          const candidateVolunteers = newNearbyVolunteers
            .filter((v) => v.id !== volunteerId)
            .slice(0, 3);
          const victim = await User.findById(incident.victimId).lean();

          await Promise.allSettled(
            candidateVolunteers.map(async (newVol) => {
              try {
                await VolunteerResponse.findOneAndUpdate(
                  { incidentId: incident._id, volunteerId: newVol.id },
                  {
                    $setOnInsert: {
                      incidentId: incident._id,
                      volunteerId: newVol.id,
                      status: 'ALERTED',
                      heroTierAtDispatch: newVol.heroTier || 'TIER_1_BLS',
                      skillMatchScore: newVol.skillMatchScore ?? 100,
                      goodSamaritanAgreementSigned: true,
                      distanceMeters: Math.round(newVol.distanceKm * 1000),
                    },
                  },
                  { upsert: true, new: true },
                );

                if (io) {
                  io.to(`user:${newVol.id}`).emit('HERO_DISPATCH_REQUEST', {
                    incidentId: incident._id,
                    victimId: incident.victimId,
                    victimName: victim
                      ? sanitizeUser(victim).fullName
                      : 'Nạn nhân SafeSolo',
                    incidentType: incident.incidentType,
                    severity: incident.severity,
                    severityLevel: incident.severityLevel,
                    distanceKm: newVol.distanceKm,
                    approxAddress: incident.approxAddress,
                    medicalSnapshot: incident.medicalSnapshot,
                    isReassigned: true,
                    createdAt: incident.createdAt,
                  });
                }
              } catch (_redispatchErr) {
                // non-blocking
              }
            }),
          );
        }
      } catch (watchErr) {
        console.error(
          `[DispatchWorker] Error in watchdog for incident ${incident._id}:`,
          watchErr.message,
        );
      }
    }

    // =========================================================================
    // 4. WATCHDOG GIÁM SÁT THỜI GIAN THẮT GARÔ C-A-T CHỐNG HOẠI TỬ CHI (PHTLS)
    // =========================================================================
    const activeTourniquetIncidents = await RescueIncident.find({
      status: { $in: ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'] },
      'clinicalAssessment.tourniquet.isApplied': true,
      'clinicalAssessment.tourniquet.appliedAt': { $ne: null },
    });

    for (const incident of activeTourniquetIncidents) {
      try {
        const tourniquet = incident.clinicalAssessment.tourniquet;
        const appliedTime = new Date(tourniquet.appliedAt).getTime();
        const elapsedMinutes = Math.floor((now.getTime() - appliedTime) / (60 * 1000));
        const maxSafeMinutes = Number(tourniquet.maxSafeMinutes || 120);

        if (elapsedMinutes >= 90 && elapsedMinutes < maxSafeMinutes) {
          const alreadyWarned90 = incident.auditTrail.some(
            (a) => a.action === 'TOURNIQUET_ISCHEMIA_WARNING_90M',
          );
          if (!alreadyWarned90) {
            incident.auditTrail.push({
              action: 'TOURNIQUET_ISCHEMIA_WARNING_90M',
              timestamp: new Date(),
              metadata: {
                elapsedMinutes,
                limbLocation: tourniquet.limbLocation,
                remainingSafeMinutes: Math.max(0, maxSafeMinutes - elapsedMinutes),
              },
            });
            await incident.save();

            if (io) {
              io.to(`incident:${incident._id}`).emit('TOURNIQUET_ALERT', {
                incidentId: incident._id,
                alertLevel: 'WARNING_90M',
                elapsedMinutes,
                limbLocation: tourniquet.limbLocation,
                message: `CẢNH BÁO Y KHOA PHTLS: Garô tại ${tourniquet.limbLocation || 'chi'} đã thắt ${elapsedMinutes} phút. Vui lòng kiểm tra mạch ngoại vi và khẩn trương liên hệ bác sĩ 115!`,
              });
            }
          }
        } else if (elapsedMinutes >= maxSafeMinutes) {
          const alreadyAlerted120 = incident.auditTrail.some(
            (a) => a.action === 'TOURNIQUET_CRITICAL_NECROSIS_ALERT_120M',
          );
          if (!alreadyAlerted120) {
            incident.auditTrail.push({
              action: 'TOURNIQUET_CRITICAL_NECROSIS_ALERT_120M',
              timestamp: new Date(),
              metadata: {
                elapsedMinutes,
                limbLocation: tourniquet.limbLocation,
                isPastMaxSafeTime: true,
              },
            });
            await incident.save();

            if (io) {
              io.to(`incident:${incident._id}`).emit('TOURNIQUET_ALERT', {
                incidentId: incident._id,
                alertLevel: 'CRITICAL_120M',
                elapsedMinutes,
                limbLocation: tourniquet.limbLocation,
                message: `BÁO ĐỘNG ĐỎ NGUY KỊCH: Garô đã vượt quá ${maxSafeMinutes} phút! Nguy cơ hoại tử chi không hồi phục! KHÔNG tự ý tháo mở nếu không có kíp cấp cứu 115 hồi sức!`,
              });
            }
          }
        }
      } catch (tourniquetErr) {
        console.error(
          `[DispatchWorker] Error in tourniquet watchdog for incident ${incident._id}:`,
          tourniquetErr.message,
        );
      }
    }
  } catch (loopError) {
    console.error('[DispatchWorker] Global loop error:', loopError.message);
  } finally {
    isProcessing = false;
  }
}

function startDispatchWorker(_io) {
  if (workerIntervalId) {
    console.log('[DispatchWorker] Already running');
    return;
  }

  const intervalMs = Number(process.env.DISPATCH_WORKER_INTERVAL_MS || 3000);
  workerIntervalId = setInterval(processDispatchLifecycle, intervalMs);
  console.log(
    `[DispatchWorker] Autonomous dispatch worker started (interval=${intervalMs}ms)`,
  );
}

function stopDispatchWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('[DispatchWorker] Stopped');
  }
}

module.exports = {
  startDispatchWorker,
  stopDispatchWorker,
  processDispatchLifecycle,
};
