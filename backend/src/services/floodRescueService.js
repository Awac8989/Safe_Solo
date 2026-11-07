const UrbanFloodZone = require('../models/UrbanFloodZone');
const RescueIncident = require('../models/RescueIncident');
const User = require('../models/User');

class FloodRescueService {
  /**
   * Khởi tạo các điểm ngập đô thị trọng điểm tại TP.HCM
   */
  async seedUrbanFloodSensors() {
    const defaultZones = [
      {
        zoneCode: 'HCMC_Q7_HUYNH_TAN_PHAT',
        zoneName: 'Đường Huỳnh Tấn Phát - Điểm ngập Cầu Phú Xuân',
        district: 'Quận 7',
        location: { type: 'Point', coordinates: [106.7320, 10.7420] },
        currentWaterDepthCm: 18,
        tideState: 'RISING_HIGH_TIDE',
        passabilityStatus: 'MOTORBIKE_CAUTION',
        electrocutionRisk: false,
      },
      {
        zoneCode: 'HCMC_THU_DUC_NGUYEN_VAN_HUONG',
        zoneName: 'Đường Nguyễn Văn Hưởng - Thảo Điền',
        district: 'TP. Thủ Đức',
        location: { type: 'Point', coordinates: [106.7350, 10.8050] },
        currentWaterDepthCm: 45,
        tideState: 'PEAK_TIDE',
        passabilityStatus: 'SUV_ONLY',
        electrocutionRisk: false,
      },
      {
        zoneCode: 'HCMC_BINH_THANH_NGUYEN_HUU_CANH',
        zoneName: 'Đường Nguyễn Hữu Cảnh - Chân Cầu Sài Gòn',
        district: 'Quận Bình Thạnh',
        location: { type: 'Point', coordinates: [106.7180, 10.7920] },
        currentWaterDepthCm: 32,
        tideState: 'STAGNANT_RAINWATER',
        passabilityStatus: 'CAR_SEDAN_BLOCKED',
        electrocutionRisk: false,
      },
      {
        zoneCode: 'HCMC_Q8_ME_COC',
        zoneName: 'Khu vực Mễ Cốc - Bến Phú Định (Vỡ đê bao)',
        district: 'Quận 8',
        location: { type: 'Point', coordinates: [106.6380, 10.7300] },
        currentWaterDepthCm: 65,
        tideState: 'PEAK_TIDE',
        passabilityStatus: 'IMPASSABLE_BOAT_ONLY',
        electrocutionRisk: true,
        groundTransformerSubmerged: true,
        activeWarnings: ['CẢNH BÁO NGUY CƠ RÒ ĐIỆN TỬ VONG: Trạm hạ thế bị chìm trong nước. CẤM LỘI BỘ!'],
      },
      {
        zoneCode: 'HCMC_NHA_BE_LE_VAN_LUONG',
        zoneName: 'Đường Lê Văn Lương - Cầu Rạch Đĩa / Cầu Long Kiểng',
        district: 'Huyện Nhà Bè',
        location: { type: 'Point', coordinates: [106.7020, 10.7100] },
        currentWaterDepthCm: 28,
        tideState: 'RISING_HIGH_TIDE',
        passabilityStatus: 'CAR_SEDAN_BLOCKED',
        electrocutionRisk: false,
      },
    ];

    for (const zone of defaultZones) {
      await UrbanFloodZone.findOneAndUpdate(
        { zoneCode: zone.zoneCode },
        { $set: zone },
        { upsert: true, new: true }
      );
    }

    return await UrbanFloodZone.find();
  }

  /**
   * Cập nhật đo đạc mực nước theo cảm biến IoT hoặc báo cáo thực địa
   */
  async updateFloodSensorDepth(zoneCode, payload) {
    const {
      depthCm = 0,
      tideState = 'PEAK_TIDE',
      electrocutionRisk = false,
      groundTransformerSubmerged = false,
      reportedBy = 'IOT_ULTRASONIC_SENSOR',
    } = payload;

    let passabilityStatus = 'PASSABLE_ALL';
    if (depthCm >= 55) passabilityStatus = 'IMPASSABLE_BOAT_ONLY';
    else if (depthCm >= 40) passabilityStatus = 'SUV_ONLY';
    else if (depthCm >= 25) passabilityStatus = 'CAR_SEDAN_BLOCKED';
    else if (depthCm >= 15) passabilityStatus = 'MOTORBIKE_CAUTION';

    const activeWarnings = [];
    if (electrocutionRisk || groundTransformerSubmerged) {
      activeWarnings.push('CẢNH BÁO NGUY HIỂM TỬ VONG: Rò rỉ điện lưới do ngập trạm biến áp/hộp phân phối. Cấm lội bộ!');
    }
    if (depthCm >= 25) {
      activeWarnings.push(`CẢNH BÁO THỦY KÍCH: Mực nước ngập ${depthCm}cm làm chết máy và hư hỏng động cơ xe sedan.`);
    }

    const zone = await UrbanFloodZone.findOneAndUpdate(
      { zoneCode },
      {
        $set: {
          currentWaterDepthCm: depthCm,
          tideState,
          passabilityStatus,
          electrocutionRisk,
          groundTransformerSubmerged,
          reportedBy,
          lastReportedAt: new Date(),
          activeWarnings,
        },
        $max: { historicalMaxDepthCm: depthCm },
      },
      { new: true, upsert: true }
    );

    return zone;
  }

  /**
   * Thuật toán định tuyến cứu hộ né tránh ngập lụt đô thị
   */
  async calculateFloodSafeRoute({ origin, destination, vehicleType = 'AMBULANCE_VAN' }) {
    await this.seedUrbanFloodSensors();

    const maxWadingLimits = {
      RESCUE_MOTORBIKE: 20,          // Xe máy cứu trợ: tối đa 20cm
      AMBULANCE_VAN: 30,             // Xe cứu thương 115 tiêu chuẩn: tối đa 30cm
      SPECIALIZED_4X4_AMBULANCE: 60, // Xe cứu thương dã chiến 2 cầu gầm cao: tối đa 60cm
      EVACUATION_INFLATABLE_BOAT: 999,// Xuồng hơi cứu sinh: cần ngập > 15cm, không giới hạn trần
    };

    const maxSafeDepth = maxWadingLimits[vehicleType] || 30;

    // Tìm tất cả các điểm ngập đang hoạt động
    const allFloodZones = await UrbanFloodZone.find();

    // Tính toán kiểm tra hành lang di chuyển
    const midLat = (origin.lat + destination.lat) / 2;
    const midLng = (origin.lng + destination.lng) / 2;

    const blockedZones = [];
    let maxEncounteredDepth = 0;

    for (const zone of allFloodZones) {
      const zLng = zone.location.coordinates[0];
      const zLat = zone.location.coordinates[1];
      const distKm = this._calculateHaversineDistance(midLat, midLng, zLat, zLng);

      // Nếu điểm ngập nằm trong bán kính hành lang 5km
      if (distKm <= 5.0) {
        if (zone.currentWaterDepthCm > maxEncounteredDepth) {
          maxEncounteredDepth = zone.currentWaterDepthCm;
        }

        if (zone.currentWaterDepthCm > maxSafeDepth || zone.electrocutionRisk) {
          blockedZones.push({
            zoneCode: zone.zoneCode,
            zoneName: zone.zoneName,
            waterDepthCm: zone.currentWaterDepthCm,
            maxSafeWadingAllowedCm: maxSafeDepth,
            electrocutionRisk: zone.electrocutionRisk,
            reason: zone.electrocutionRisk
              ? 'Rò rỉ điện lưới nguy hiểm tính mạng'
              : `Mực nước ${zone.currentWaterDepthCm}cm vượt quá khả năng lội nước của ${vehicleType} (${maxSafeDepth}cm)`,
          });
        }
      }
    }

    const isDirectPassable = blockedZones.length === 0;
    const detourPenaltyMinutes = isDirectPassable ? 0 : Math.min(30, blockedZones.length * 8 + 6);

    const safeCorridorGuidance = isDirectPassable
      ? 'Tuyến đường thẳng an toàn, các điểm ngập đều nằm trong ngưỡng chịu đựng của phương tiện.'
      : `ĐỀ XUẤT ĐỔI HƯỚNG: Tránh hoàn toàn ${blockedZones.length} điểm ngập nguy hiểm. Chuyển hướng ưu tiên qua cầu vượt và trục đường trên cao.`;

    return {
      vehicleType,
      maxSafeWadingAllowedCm: maxSafeDepth,
      isDirectPassable,
      detourRecommended: !isDirectPassable,
      detourPenaltyMinutes,
      maxEncounteredDepthCm: maxEncounteredDepth,
      blockedZonesCount: blockedZones.length,
      blockedZones,
      safeCorridorGuidance,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Kích hoạt SOS khẩn cấp do Nước ngập cô lập trong nhà & Nguy cơ giật điện
   */
  async triggerLoneDwellerFloodSOS(userId, payload) {
    const {
      lat,
      lng,
      address = 'Khu vực ngập lụt trũng thấp',
      indoorWaterDepthCm = 35,
      electrocutionHazard = true,
      floorLevel = 'GROUND_FLOOR',
      powerOutletSubmerged = true,
    } = payload;

    const user = await User.findById(userId);

    // Tạo sự cố khẩn cấp P0
    const incident = await RescueIncident.create({
      victimId: userId,
      victimName: user?.fullName || 'Người dân độc thân',
      victimPhone: user?.phoneNumber || '0900000000',
      exactLat: lat,
      exactLng: lng,
      fuzzedLat: lat,
      fuzzedLng: lng,
      incidentType: 'OTHER',
      location: {
        type: 'Point',
        coordinates: [lng, lat],
        addressDetails: address,
      },
      category: 'FLOOD_TRAPPED_ELECTROCUTION_RISK',
      priority: 'P0_CRITICAL_LIFE_THREAT',
      status: 'ACTIVE',
      notes: `Khẩn cấp: Nước ngập tràn vào nhà sâu ${indoorWaterDepthCm}cm tầng trệt. Ổ điện có nguy cơ chìm gây phóng điện!`,
    });

    const evnAlertDispatched = powerOutletSubmerged || electrocutionHazard;

    return {
      success: true,
      incidentId: incident.id,
      category: 'FLOOD_TRAPPED_ELECTROCUTION_RISK',
      indoorWaterDepthCm,
      electrocutionHazard,
      evnGridShutdownNoticeDispatched: evnAlertDispatched,
      safetyInstructionsForVictim: [
        '1. Đứng ngay lên vị trí cao ráo (giường ngủ, bàn cao, gác lửng). TUYỆT ĐỐI KHÔNG CHÂN TRẦN CHẠM NƯỚC.',
        '2. Không chạm tay vào các thiết bị điện tử, tủ lạnh hay ổ cắm dưới nước.',
        '3. Đội cứu hộ đường thủy và Điện lực địa phương đang ngắt cầu dao trạm và tiếp cận bằng thuyền hơi.',
      ],
      firstResponderDirective: 'Kíp cứu hộ bắt buộc mang ủng cao su cách điện 10kV và phao cứu hộ trước khi lội vào nhà nạn nhân.',
    };
  }

  _calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

module.exports = new FloodRescueService();
