const crypto = require('crypto');
const SafePointAsset = require('../models/SafePointAsset');

class SafePointService {
  /**
   * Đăng ký mới một điểm thiết bị cứu sinh công cộng (AED / First Aid Station)
   */
  async registerSafePoint(payload) {
    const {
      serialNumber,
      assetType = 'AED',
      brandModel,
      lat,
      lng,
      buildingName,
      floorRoom,
      fullAddress,
      accessNote,
      accessMechanism = 'OPEN_ACCESS',
      custodianOrganization,
      custodianPhone,
    } = payload;

    if (!serialNumber || lat === undefined || lng === undefined || !buildingName || !fullAddress) {
      throw new Error('Thiếu thông tin bắt buộc để định vị trạm cứu sinh');
    }

    const safePoint = await SafePointAsset.create({
      serialNumber,
      assetType,
      brandModel,
      location: {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)],
      },
      addressDetails: {
        buildingName,
        floorRoom: floorRoom || 'Tầng G / Sảnh chính',
        fullAddress,
        accessNote,
      },
      accessMechanism,
      custodianContact: {
        organizationName: custodianOrganization || 'Ban Quản Lý Tòa Nhà',
        phone: custodianPhone || '1900-115',
      },
      status: 'READY',
    });

    return safePoint;
  }

  /**
   * Quét các trạm AED / cứu sinh lân cận tọa độ theo bán kính mét (GeoJSON 2dsphere)
   */
  async findNearbySafePoints(lat, lng, radiusMeters = 1000, assetType = null) {
    const query = {
      status: 'READY',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(lng), Number(lat)],
          },
          $maxDistance: Number(radiusMeters),
        },
      },
    };

    if (assetType) {
      query.assetType = assetType;
    }

    const assets = await SafePointAsset.find(query).limit(10);
    return assets;
  }

  /**
   * Thuật toán Waypoint Routing: Tìm trạm AED tối ưu nằm giữa Hiệp sĩ và Nạn nhân
   * để Hiệp sĩ ghé lấy mà không làm chậm quá 2 phút tiếp cận
   */
  async findOptimalAEDWaypoint(heroLat, heroLng, victimLat, victimLng, maxDetourMeters = 600) {
    // 1. Quét toàn bộ AED sẵn sàng trong bán kính 1km quanh nạn nhân
    const nearbyAEDs = await this.findNearbySafePoints(victimLat, victimLng, 1000, 'AED');
    if (!nearbyAEDs || nearbyAEDs.length === 0) return null;

    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371e3; // mét
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const directDist = haversineDistance(heroLat, heroLng, victimLat, victimLng);

    let optimalAED = null;
    let minDetour = Infinity;

    for (const aed of nearbyAEDs) {
      const [aedLng, aedLat] = aed.location.coordinates;
      const distHeroToAED = haversineDistance(heroLat, heroLng, aedLat, aedLng);
      const distAEDToVictim = haversineDistance(aedLat, aedLng, victimLat, victimLng);
      const totalDetour = distHeroToAED + distAEDToVictim - directDist;

      if (totalDetour <= maxDetourMeters && totalDetour < minDetour) {
        minDetour = totalDetour;
        optimalAED = {
          asset: aed,
          detourMeters: Math.round(totalDetour),
          distanceHeroToAED: Math.round(distHeroToAED),
          distanceAEDToVictim: Math.round(distAEDToVictim),
        };
      }
    }

    return optimalAED;
  }

  /**
   * Mở khóa tủ đựng máy AED khẩn cấp
   */
  async unlockSafePointCabinet(assetId, userId, incidentId) {
    const asset = await SafePointAsset.findById(assetId);
    if (!asset) {
      throw new Error('Không tìm thấy thiết bị cứu sinh');
    }

    // Sinh mã OTP mở khóa tủ dùng một lần (TOTP / Emergency Passcode)
    const unlockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    asset.status = 'IN_USE';
    await asset.save();

    return {
      success: true,
      assetId: asset._id,
      brandModel: asset.brandModel,
      addressDetails: asset.addressDetails,
      unlockOtp,
      unlockInstructions:
        asset.accessMechanism === 'DIGITAL_KEYPAD'
          ? `Nhập mã ${unlockOtp} trên bàn phím số của tủ đựng AED`
          : 'Mở nắp tủ trực tiếp, còi cảnh báo tủ sẽ kêu để báo hiệu người xung quanh hỗ trợ.',
      unlockedAt: new Date(),
    };
  }

  /**
   * Kiểm định kỹ thuật định kỳ cho máy AED (Pads, Pin)
   */
  async inspectSafePoint(assetId, inspectorUserId, inspectionData = {}) {
    const asset = await SafePointAsset.findById(assetId);
    if (!asset) throw new Error('Không tìm thấy thiết bị');

    asset.lastInspectionAt = new Date();
    asset.verifiedByUserId = inspectorUserId;
    if (inspectionData.batteryExpiryDate) asset.batteryExpiryDate = new Date(inspectionData.batteryExpiryDate);
    if (inspectionData.padsExpiryDate) asset.padsExpiryDate = new Date(inspectionData.padsExpiryDate);
    asset.status = 'READY';

    await asset.save();
    return asset;
  }
}

module.exports = new SafePointService();
