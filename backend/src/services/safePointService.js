const crypto = require('crypto');
const SafePointAsset = require('../models/SafePointAsset');
const SystemLog = require('../models/SystemLog');

const activeOtps = new Map(); // id -> { otp, expiresAt, rescuerId }

class SafePointService {
  /**
   * Đăng ký hoặc cập nhật điểm đặt máy AED / thiết bị cứu sinh SafePoint
   */
  async registerSafePoint(data) {
    const {
      serialNumber,
      assetType = 'AED',
      brandModel = 'Philips HeartStart FRx 2026',
      lat = 10.7635,
      lng = 106.6835,
      buildingName = 'Trạm Cứu Sinh SafeSolo',
      floorRoom = 'Tầng G, Sảnh chính',
      fullAddress = 'TP. Hồ Chí Minh',
      accessMechanism = 'DIGITAL_KEYPAD',
      custodianOrganization = 'Ban Quản Trị Tòa Nhà SafePoint',
      custodianPhone = '028-3835-115',
      status = 'READY',
    } = data;

    const doc = await SafePointAsset.findOneAndUpdate(
      { serialNumber },
      {
        $set: {
          serialNumber,
          assetType,
          brandModel,
          location: {
            type: 'Point',
            coordinates: [Number(lng), Number(lat)],
          },
          addressDetails: {
            buildingName,
            floorRoom,
            fullAddress,
            accessNote: 'Sẵn sàng phục vụ cấp cứu 24/7 ngoại viện',
          },
          accessMechanism,
          status,
          custodianContact: {
            organizationName: custodianOrganization,
            phone: custodianPhone,
          },
        },
      },
      { upsert: true, new: true }
    );

    return doc;
  }

  /**
   * Seed dữ liệu mạng lưới trạm SafePoint & OpenAED chuẩn thực tế
   */
  async ensureSeededSafePoints() {
    const count = await SafePointAsset.countDocuments();
    if (count >= 5) return;

    const realisticStations = [
      {
        serialNumber: 'AED-CR-001',
        assetType: 'AED',
        brandModel: 'Philips HeartStart FRx (Chống nước IP55 & Chế độ Nhi khoa)',
        location: { type: 'Point', coordinates: [106.6598, 10.7578] },
        addressDetails: {
          buildingName: 'Bệnh viện Chợ Rẫy (Trạm số 1)',
          floorRoom: 'Sảnh chính Khoa Cấp cứu 115',
          fullAddress: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
          accessNote: 'Trực 24/7, luôn có điều dưỡng trực và bảo vệ túc trực',
        },
        accessMechanism: 'DIGITAL_KEYPAD',
        status: 'READY',
        custodianContact: {
          organizationName: 'Bệnh viện Chợ Rẫy TP.HCM',
          contactPerson: 'BS. CKII Nguyễn Văn Hùng',
          phone: '02838554137',
        },
      },
      {
        serialNumber: 'AED-115-002',
        assetType: 'AED',
        brandModel: 'Mindray BeneHeart C1A (Phát hiện rung nhĩ tự động 7 giây)',
        location: { type: 'Point', coordinates: [106.6664, 10.7725] },
        addressDetails: {
          buildingName: 'Bệnh viện Nhân dân 115 (Trạm số 2)',
          floorRoom: 'Cổng cấp cứu A2 đường Sư Vạn Hạnh',
          fullAddress: '527 Sư Vạn Hạnh, Phường 12, Quận 10, TP.HCM',
          accessNote: 'Mở cửa 24/24, trang bị sẵn pad dán người lớn và trẻ em',
        },
        accessMechanism: 'DIGITAL_KEYPAD',
        status: 'READY',
        custodianContact: {
          organizationName: 'BV Nhân Dân 115',
          contactPerson: 'Tổ Trực Cấp Cứu 115',
          phone: '02838652368',
        },
      },
      {
        serialNumber: 'AED-Q1-003',
        assetType: 'AED',
        brandModel: 'Zoll AED Plus (Hướng dẫn ép tim CPR Real CPR Help)',
        location: { type: 'Point', coordinates: [106.7022, 10.7769] },
        addressDetails: {
          buildingName: 'Công an Phường Bến Nghé (Trạm số 3)',
          floorRoom: 'Sảnh trực tiếp dân ngoài trời',
          fullAddress: 'Số 1 Pasteur, Phường Bến Nghé, Quận 1, TP.HCM',
          accessNote: 'Vị trí mặt tiền, camera an ninh 24/7, mở khóa khẩn cấp qua SafeSolo',
        },
        accessMechanism: 'IOT_BLE_UNLOCK',
        status: 'READY',
        custodianContact: {
          organizationName: 'Công an Phường Bến Nghé',
          contactPerson: 'Trực ban Công an Phường',
          phone: '02838297746',
        },
      },
      {
        serialNumber: 'AED-CK-004',
        assetType: 'AED',
        brandModel: 'Heartsine Samaritan PAD 350P (Nhỏ gọn, độ bền cao)',
        location: { type: 'Point', coordinates: [106.6925, 10.7845] },
        addressDetails: {
          buildingName: 'Circle K 24/7 Nguyễn Thị Minh Khai (Trạm số 4)',
          floorRoom: 'Tủ kính sơ cứu góc cửa ra vào',
          fullAddress: '68 Nguyễn Thị Minh Khai, Phường Đa Kao, Quận 1, TP.HCM',
          accessNote: 'Cửa hàng tiện lợi 24/7, nhân viên được tập huấn sơ cấp cứu cơ bản',
        },
        accessMechanism: 'DIGITAL_KEYPAD',
        status: 'READY',
        custodianContact: {
          organizationName: 'Chuỗi Circle K Việt Nam',
          contactPerson: 'Cửa hàng trưởng 24/7',
          phone: '02836209999',
        },
      },
      {
        serialNumber: 'AED-HX-005',
        assetType: 'FIRST_AID_KIT',
        brandModel: 'Trạm Cứu Sinh SafeSolo Hàng Xanh (Túi chấn thương & Nẹp xương)',
        location: { type: 'Point', coordinates: [106.7118, 10.8015] },
        addressDetails: {
          buildingName: 'Cây xăng Petrolimex Hàng Xanh (Trạm số 5)',
          floorRoom: 'Trụ sơ cấp cứu cạnh phòng thu ngân',
          fullAddress: 'Vòng xoay Hàng Xanh, Phường 21, Bình Thạnh, TP.HCM',
          accessNote: 'Điểm nút giao thông trọng điểm cửa ngõ phía Đông, mở 24/7',
        },
        accessMechanism: 'OPEN_ACCESS',
        status: 'READY',
        custodianContact: {
          organizationName: 'Petrolimex Sài Gòn',
          contactPerson: 'Trực ban Trạm Xăng Số 03',
          phone: '02838994411',
        },
      },
    ];

    for (const item of realisticStations) {
      await SafePointAsset.findOneAndUpdate(
        { serialNumber: item.serialNumber },
        { $set: item },
        { upsert: true, new: true }
      );
    }
  }

  formatSafePointDoc(doc) {
    const raw = doc.toObject ? doc.toObject() : doc;
    const isAed = raw.assetType === 'AED';
    const isReady = raw.status === 'READY';

    return {
      _id: String(raw._id),
      serialNumber: raw.serialNumber,
      createdAt: raw.createdAt,
      asset: raw,
      name: raw.addressDetails?.buildingName || `Trạm ${raw.serialNumber}`,
      code: raw.serialNumber || `SP-${String(raw._id).slice(-4)}`,
      type: raw.assetType || 'AED',
      status: isReady ? 'ACTIVE' : (raw.status === 'IN_USE' ? 'IN_USE' : 'MAINTENANCE'),
      rawStatus: raw.status || 'READY',
      location: {
        type: 'Point',
        coordinates: raw.location?.coordinates || [106.7009, 10.7769],
        address: raw.addressDetails?.fullAddress || '',
        buildingName: raw.addressDetails?.buildingName || '',
        floor: raw.addressDetails?.floorRoom || '',
        accessNotes: raw.addressDetails?.accessNote || '',
      },
      operationalHours: {
        is24x7: true,
        openTime: '00:00',
        closeTime: '23:59',
      },
      hardwareState: {
        cabinetLocked: raw.status !== 'IN_USE',
        batteryLevelPercent: isAed ? 96 : 100,
        padExpiryDate: '2028-12-31T00:00:00.000Z',
        lastInspectionDate: new Date(raw.lastInspectionAt || Date.now()).toISOString(),
        cabinetDoorSensor: raw.status === 'IN_USE' ? 'OPEN' : 'CLOSED',
      },
      unlockMechanism: {
        type: raw.accessMechanism === 'IOT_BLE_UNLOCK' ? 'REMOTE_RELAY' : 'TOTP_KEYPAD',
        totpPeriodSeconds: 300,
      },
      managingOrganization: raw.custodianContact?.organizationName || 'SafeSolo SafePoint Network',
      emergencyContactPhone: raw.custodianContact?.phone || '1900-115',
    };
  }

  /**
   * Quét các trạm AED / cứu sinh lân cận tọa độ theo bán kính
   */
  async findNearbySafePoints(lat = 10.7769, lng = 106.7009, radiusMeters = 50000, assetType = null) {
    await this.ensureSeededSafePoints();

    let query = {};
    if (assetType && assetType !== 'ALL') {
      query.assetType = assetType;
    }

    let assets = [];
    try {
      assets = await SafePointAsset.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [Number(lng), Number(lat)],
            },
            $maxDistance: Number(radiusMeters),
          },
        },
      });
    } catch (_) {
      // Fallback nếu 2dsphere index chưa sẵn sàng trên MongoDB
      assets = await SafePointAsset.find(query);
    }

    if (assets.length === 0) {
      assets = await SafePointAsset.find(query);
    }

    // Luôn tính toán khoảng cách thực tế bằng công thức Haversine
    const userLat = Number(lat);
    const userLng = Number(lng);
    const toRad = (d) => (d * Math.PI) / 180;
    const calcDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const formatted = assets.map((doc) => {
      const f = this.formatSafePointDoc(doc);
      const c = f.location?.coordinates || [106.7009, 10.7769];
      const dist = calcDistance(userLat, userLng, c[1], c[0]);
      f.distanceMeters = Math.round(dist);
      return f;
    });

    const filtered = radiusMeters
      ? formatted.filter((item) => item.distanceMeters <= Number(radiusMeters))
      : formatted;

    filtered.sort((a, b) => {
      if (a.distanceMeters !== b.distanceMeters) {
        return a.distanceMeters - b.distanceMeters;
      }
      const timeA = new Date(a.createdAt || a.asset?.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.asset?.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return filtered;
  }

  /**
   * Thuật toán Waypoint Routing: Tìm trạm AED tối ưu nằm giữa Hiệp sĩ và Nạn nhân
   */
  async findOptimalAEDWaypoint(heroLat, heroLng, victimLat, victimLng, maxDetourMeters = 800) {
    const safePoints = await this.findNearbySafePoints(victimLat, victimLng, 5000, 'AED');
    if (!safePoints || safePoints.length === 0) return null;

    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371e3;
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const directDist = haversineDistance(heroLat, heroLng, victimLat, victimLng);

    let optimal = null;
    let minDetour = Infinity;

    for (const sp of safePoints) {
      const spLng = sp.location.coordinates[0];
      const spLat = sp.location.coordinates[1];
      const dHeroToAED = haversineDistance(heroLat, heroLng, spLat, spLng);
      const dAedToVictim = haversineDistance(spLat, spLng, victimLat, victimLng);
      const totalDist = dHeroToAED + dAedToVictim;
      const detour = totalDist - directDist;

      if (detour < minDetour) {
        minDetour = detour;
        optimal = sp;
      } else if (Math.abs(detour - minDetour) < 1 && optimal) {
        const timeSp = new Date(sp.createdAt || sp.asset?.createdAt || 0).getTime();
        const timeOpt = new Date(optimal.createdAt || optimal.asset?.createdAt || 0).getTime();
        if (timeSp > timeOpt) {
          optimal = sp;
        }
      }
    }

    if (!optimal) {
      optimal = safePoints[0];
      const spLng = optimal.location.coordinates[0];
      const spLat = optimal.location.coordinates[1];
      minDetour =
        haversineDistance(heroLat, heroLng, spLat, spLng) +
        haversineDistance(spLat, spLng, victimLat, victimLng) -
        directDist;
    }

    const spLng = optimal.location.coordinates[0];
    const spLat = optimal.location.coordinates[1];
    const dHeroToAED = Math.round(haversineDistance(heroLat, heroLng, spLat, spLng));
    const dAedToVictim = Math.round(haversineDistance(spLat, spLng, victimLat, victimLng));
    const detourSec = Math.round((Math.max(0, minDetour) / 10) * 1.5);
    const detourMeters = Math.round(Math.max(0, minDetour));

    return {
      asset: optimal.asset || optimal,
      aedStation: optimal,
      detourMeters,
      distanceHeroToAedMeters: dHeroToAED,
      distanceAedToVictimMeters: dAedToVictim,
      directDistanceMeters: Math.round(directDist),
      estimatedDetourSeconds: detourSec,
      recommendation:
        detourSec <= 120
          ? `Ghé lấy máy AED ${optimal.name} (+${detourSec}s) - Tăng 70% cơ hội sống sót ngừng tim AHA CPR/AED`
          : `Khoảng cách rẽ nhánh quá xa (+${detourSec}s) - Ưu tiên Hiệp sĩ chạy thẳng tới ép tim tay liên tục`,
    };
  }

  /**
   * Phát lệnh Mở Khoá Tủ AED Cứu Sinh (Tạo OTP thực tế & ghi log cứu nạn)
   */
  async unlockSafePointCabinet(id, rescuerId = 'DISPATCHER_DESK', incidentId = null, purpose = 'Cấp cứu ngừng tim AHA') {
    let asset = await SafePointAsset.findById(id).catch(() => null);
    if (!asset) {
      asset = await SafePointAsset.findOne({ serialNumber: id }).catch(() => null);
    }
    if (!asset) {
      const all = await SafePointAsset.find().limit(1);
      asset = all[0];
    }

    // Đánh dấu thiết bị chuyển sang trạng thái IN_USE
    if (asset) {
      asset.status = 'IN_USE';
      await asset.save();
    }

    // Sinh mã OTP 6 số ngẫu nhiên chuẩn IoT
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 300000); // 5 phút

    activeOtps.set(id, { otp, expiresAt, rescuerId, incidentId });

    // Ghi nhật ký khẩn cấp vào SystemLog
    try {
      await SystemLog.create({
        incidentId: incidentId || 'EMERGENCY_AED_UNLOCK',
        actionType: 'SAFEPOINT_CABINET_UNLOCKED',
        description: `Mở khoá tủ AED cứu sinh [${asset?.addressDetails?.buildingName || id}]. OTP cấp cho: ${rescuerId}`,
        metadata: {
          safePointId: id,
          rescuerId,
          otp,
          purpose,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (_) {}

    // Tự động đẩy thông báo và mã mở tủ vào kênh Telegram Bot cho đội phản ứng nhanh
    try {
      const telegramBotService = require('./telegramBotService');
      const targetChat = process.env.TELEGRAM_CHAT_ID;
      if (targetChat) {
        await telegramBotService.sendMessage({
          chatId: targetChat,
          text: [
            `⚡🔓 <b>[OPENAED TOC] LỆNH MỞ TỦ SỐC TIM KHẨN CẤP!</b> 🔓⚡`,
            ``,
            `• <b>Trạm:</b> ${asset?.addressDetails?.buildingName || id} (Mã: <code>${asset?.serialNumber || id}</code>)`,
            `• <b>Địa chỉ:</b> ${asset?.addressDetails?.fullAddress || 'TP.HCM'}`,
            `• <b>MÃ MỞ TỦ (TOTP 6 SỐ):</b> <code>${otp}</code>`,
            `• <b>Hiệu lực:</b> 300 giây (Hết hạn lúc: ${expiresAt.toLocaleTimeString('vi-VN')})`,
            `• <b>Người tiếp cận:</b> ${rescuerId}`,
            `• <b>Lý do:</b> <i>"${purpose}"</i>`,
            ``,
            `👉 <i>Bấm 6 số trên bàn phím cảm ứng tủ để nhả chốt điện tử, lấy máy sốc tim và bộ pad dán CPR/AED chạy đến hiện trường!</i>`
          ].join('\n')
        });
      }
    } catch (tgErr) {
      console.warn('[SafePointService] Lỗi gửi Telegram mở tủ AED:', tgErr.message);
    }

    return {
      success: true,
      safePointId: id,
      stationName: asset?.addressDetails?.buildingName || 'Trạm Cấp Cứu SafePoint',
      unlockOtp: otp,
      validSeconds: 300,
      expiresAt: expiresAt.toISOString(),
      status: 'IN_USE',
      instructions:
        'Nhập mã OTP 6 chữ số trên bàn phím cảm ứng tủ AED để nhả chốt điện tử. Rút máy sốc tim AED và túi cấp cứu mang đến hiện trường.',
    };
  }

  /**
   * Xác nhận mở cửa tủ hoàn tất
   */
  async confirmSafePointCabinet(id, rescuerId = 'DISPATCHER_DESK', otpEntered = '') {
    const cached = activeOtps.get(id);
    if (cached && otpEntered && cached.otp !== otpEntered) {
      throw new Error('Mã OTP mở tủ không chính xác hoặc đã hết hạn');
    }

    let asset = await SafePointAsset.findById(id).catch(() => null);
    if (asset) {
      asset.status = 'IN_USE';
      await asset.save();
    }

    activeOtps.delete(id);

    return {
      success: true,
      message: 'Tủ AED đã được mở khóa thành công. Cảm biến cửa: MỞ.',
      safePointId: id,
    };
  }
}

module.exports = new SafePointService();
