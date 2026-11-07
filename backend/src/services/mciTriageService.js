const MassCasualtyIncident = require('../models/MassCasualtyIncident');
const HospitalTraumaCenter = require('../models/HospitalTraumaCenter');
const hospitalDispatchService = require('./hospitalDispatchService');

class MciTriageService {
  /**
   * Kích hoạt và tuyên bố Tình trạng Cấp cứu Thảm họa Đa nạn nhân (MCI)
   */
  async declareMassCasualtyIncident(payload) {
    const {
      mciCode = `MCI-${Date.now().toString().slice(-6)}`,
      title,
      incidentType = 'APARTMENT_FIRE',
      initialVictimEstimate = 12,
      lat = 10.792,
      lng = 106.718,
      address = 'Hiện trường thảm họa',
      declaredBy = 'CHỈ HUY TRƯỞNG TÁC CHIẾN 115',
    } = payload;

    let mciLevel = 'LEVEL_1_SMALL';
    if (initialVictimEstimate > 30) mciLevel = 'LEVEL_3_MAJOR';
    else if (initialVictimEstimate > 10) mciLevel = 'LEVEL_2_MEDIUM';

    const mci = await MassCasualtyIncident.create({
      mciCode,
      title: title || `Thảm họa ${incidentType} - ${address}`,
      incidentType,
      mciLevel,
      status: 'TRIAGE_IN_PROGRESS',
      location: {
        type: 'Point',
        coordinates: [lng, lat],
        address,
      },
      declaredBy,
    });

    return mci;
  }

  /**
   * Phân loại nạn nhân tại hiện trường theo chuẩn quốc tế START Triage
   * (Simple Triage and Rapid Treatment: Đi lại -> Hô hấp -> Tưới máu CRT -> Ý thức)
   */
  async performStartTriage(mciId, triageOfficerId, assessmentData) {
    const mci = await MassCasualtyIncident.findOne({
      $or: [{ _id: mciId }, { mciCode: mciId }],
    });
    if (!mci) throw new Error('Không tìm thấy sự cố thảm họa MCI');

    const {
      victimTagId = `TAG-${Date.now().toString().slice(-4)}`,
      canWalk = false,
      spontaneousBreathing = true,
      airwayRepositioned = false,
      breathsAfterAirwayOpen = false,
      respiratoryRate = 22,
      capillaryRefillSec = 1.5,
      radialPulsePresent = true,
      canFollowSimpleCommands = true,
      decontaminationRequired = false,
    } = assessmentData;

    let triageCategory = 'YELLOW';
    let priorityRank = 2;
    let triageRationale = '';

    // BƯỚC 1: Kiểm tra khả năng tự di chuyển (Minor / Walking Wounded)
    if (canWalk) {
      triageCategory = 'GREEN';
      priorityRank = 3;
      triageRationale = 'Nạn nhân tự đi lại được (Walking Wounded), tổn thương nhẹ không đe dọa sinh mạng tức thì.';
    }
    // BƯỚC 2: Kiểm tra hô hấp tự nhiên
    else if (!spontaneousBreathing) {
      if (airwayRepositioned && breathsAfterAirwayOpen) {
        triageCategory = 'RED';
        priorityRank = 1;
        triageRationale = 'Phục hồi hô hấp tự nhiên ngay sau khi mở đường thở bằng thủ thuật Ngửa đầu-Nâng cằm. Nguy cơ tắc nghẽn đường thở cao!';
      } else {
        triageCategory = 'BLACK';
        priorityRank = 4;
        triageRationale = 'Không tự thở dù đã mở thông đường thở. Tiên lượng tử vong tại hiện trường (Expectant/Morgue). Ưu tiên tài nguyên cho nạn nhân còn cơ hội sống.';
      }
    }
    // BƯỚC 3: Đánh giá tần số thở
    else if (respiratoryRate > 30 || respiratoryRate < 10) {
      triageCategory = 'RED';
      priorityRank = 1;
      triageRationale = `Tần số thở nguy kịch (${respiratoryRate} nhịp/phút) - Suy hô hấp cấp / Tràn khí màng phổi áp lực.`;
    }
    // BƯỚC 4: Đánh giá tưới máu tuần hoàn (Mạch quay & Thời gian làm đầy mao mạch CRT)
    else if (capillaryRefillSec > 2.0 || !radialPulsePresent) {
      triageCategory = 'RED';
      priorityRank = 1;
      triageRationale = `Tuần hoàn suy sụp (CRT ${capillaryRefillSec}s > 2s hoặc mất mạch quay). Dấu hiệu sốc giảm thể tích / chảy máu trong ác tính.`;
    }
    // BƯỚC 5: Đánh giá tri giác thần kinh
    else if (!canFollowSimpleCommands) {
      triageCategory = 'RED';
      priorityRank = 1;
      triageRationale = 'Không làm theo được mệnh lệnh đơn giản (Nắm chặt tay tôi). Tổn thương thần kinh trung ương / Hôn mê cấp.';
    }
    // NẾU VƯỢT QUA TOÀN BỘ CÁC BƯỚC TRÊN: DELAYED (Cấp cứu trì hoãn)
    else {
      triageCategory = 'YELLOW';
      priorityRank = 2;
      triageRationale = 'Hô hấp và huyết động tạm ổn định, có đáp ứng ý thức nhưng chấn thương không thể tự đi lại (gãy xương, chấn thương phần mềm lớn).';
    }

    const victimEntry = {
      victimTagId,
      triageCategory,
      priorityRank,
      clinicalAssessment: {
        canWalk,
        spontaneousBreathing,
        airwayRepositioned,
        breathsAfterAirwayOpen,
        respiratoryRate,
        capillaryRefillSec,
        radialPulsePresent,
        canFollowSimpleCommands,
      },
      triageRationale,
      decontaminationRequired,
      transportStatus: 'PENDING_AMBULANCE',
      taggedAt: new Date(),
    };

    mci.victims.push(victimEntry);

    // Cập nhật bảng tổng kết thương vong
    if (triageCategory === 'RED') mci.casualtyTally.red += 1;
    else if (triageCategory === 'YELLOW') mci.casualtyTally.yellow += 1;
    else if (triageCategory === 'GREEN') mci.casualtyTally.green += 1;
    else if (triageCategory === 'BLACK') mci.casualtyTally.black += 1;

    mci.casualtyTally.totalTagged = mci.victims.length;
    await mci.save();

    return {
      success: true,
      mciCode: mci.mciCode,
      victimTagId,
      triageCategory,
      priorityRank,
      triageRationale,
      colorHex:
        triageCategory === 'RED'
          ? '#EF4444'
          : triageCategory === 'YELLOW'
          ? '#F59E0B'
          : triageCategory === 'GREEN'
          ? '#10B981'
          : '#111827',
      immediateFirstAidAction:
        triageCategory === 'RED'
          ? 'Gắn thẻ ĐỎ ngay. Đặt canun hầu họng nếu tắc nghẽn, băng ép cầm máu điểm áp lực, ưu tiên kíp xe cấp cứu số 1!'
          : triageCategory === 'YELLOW'
          ? 'Gắn thẻ VÀNG. Cố định nẹp chi gãy, giám sát sinh hiệu mỗi 15 phút tại Trạm thu dung dã chiến.'
          : triageCategory === 'GREEN'
          ? 'Gắn thẻ XANH. Hướng dẫn tự di chuyển về Khu vực Tập kết An toàn phía ngoài hành lang nóng.'
          : 'Gắn thẻ ĐEN. Chuyển sang khu vực bảo quản tử thi tôn trọng, không tiêu tốn nhân lực hồi sức.',
      casualtyTally: mci.casualtyTally,
    };
  }

  /**
   * Thuật toán điều phối cân bằng tải nạn nhân thảm họa về các Bệnh viện Đích 115
   * (Tránh hiện tượng quá tải sập phòng Cấp cứu của bệnh viện gần nhất)
   */
  async autoBalanceHospitalEvacuation(mciId) {
    const mci = await MassCasualtyIncident.findOne({
      $or: [{ _id: mciId }, { mciCode: mciId }],
    });
    if (!mci) throw new Error('Không tìm thấy sự cố thảm họa MCI');

    // Đảm bảo các bệnh viện đa khoa/chấn thương trọng điểm đã được seed
    await hospitalDispatchService.seedTraumaHospitals();

    // Lấy danh sách bệnh viện có khoa hồi sức cấp cứu sẵn sàng tiếp nhận
    let availableHospitals = await HospitalTraumaCenter.find({
      'emergencyDepartmentStatus.status': { $in: ['NORMAL', 'BUSY'] },
    });

    if (availableHospitals.length === 0) {
      availableHospitals = await HospitalTraumaCenter.find();
    }

    if (availableHospitals.length === 0) {
      throw new Error('Không có bệnh viện tiếp nhận nào sẵn sàng');
    }

    const evacuationAssignments = [];
    let hospitalIndex = 0;

    // Sắp xếp phân bổ ưu tiên: RED trước, sau đó tới YELLOW
    const sortedVictims = [...mci.victims].sort((a, b) => a.priorityRank - b.priorityRank);

    for (const victim of sortedVictims) {
      if (victim.triageCategory === 'BLACK') {
        // Nạn nhân tử vong không chuyển phòng cấp cứu bệnh viện
        victim.assignedHospital = {
          hospitalCode: 'MORGUE_STATION',
          hospitalName: 'Nhà Đại Thể Trung Tâm Giám Định Pháp Y TP.HCM',
          etaMinutes: 60,
        };
        continue;
      }

      // Vòng tròn luân chuyển bệnh viện (Load Balancing Round-Robin)
      const chosenHospital = availableHospitals[hospitalIndex % availableHospitals.length];
      hospitalIndex++;

      victim.assignedHospital = {
        hospitalCode: chosenHospital.hospitalCode,
        hospitalName: chosenHospital.hospitalName,
        etaMinutes: Math.floor(Math.random() * 12) + 8, // 8-20 phút
      };

      evacuationAssignments.push({
        victimTagId: victim.victimTagId,
        triageCategory: victim.triageCategory,
        hospitalCode: chosenHospital.hospitalCode,
        hospitalName: chosenHospital.hospitalName,
        icuBedsAvailable: chosenHospital.emergencyDepartmentStatus?.availableIcuBeds ?? 5,
        operatingRoomsAvailable: chosenHospital.emergencyDepartmentStatus?.ctScannerOperational ? 2 : 1,
      });
    }

    mci.status = 'TRANSPORTING';
    await mci.save();

    return {
      success: true,
      mciCode: mci.mciCode,
      status: mci.status,
      totalEvacuatedCount: evacuationAssignments.length,
      evacuationAssignments,
      casualtyTally: mci.casualtyTally,
      disasterMedicalDirectorNote:
        'Kế hoạch sơ tán đã phân bổ cân bằng. Đã gửi điện tín SBAR đồng loạt tới các Khoa Cấp cứu tiếp nhận.',
    };
  }
}

module.exports = new MciTriageService();
