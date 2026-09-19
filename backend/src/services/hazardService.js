const HazardReport = require('../models/HazardReport');
const DisasterAlert = require('../models/DisasterAlert');
const SafeMoment = require('../models/SafeMoment');
const User = require('../models/User');
const { ensure } = require('../lib/errors');
const { haversineKm } = require('../lib/utils');
const { getIo } = require('../sockets/socketServer');

class HazardService {
  async createHazard(userId, payload) {
    ensure(payload.title, 'Tiêu đề cảnh báo không được để trống', 400);
    ensure(payload.lat != null && payload.lng != null, 'Tọa độ GPS là bắt buộc', 400);

    const user = await User.findById(userId);
    const authorName = payload.isAnonymous ? 'Hiệp sĩ ẩn danh' : (user?.name || user?.fullName || 'Người dùng SafeSolo');

    const report = await HazardReport.create({
      userId,
      authorName,
      title: payload.title,
      description: payload.description || '',
      category: payload.category || 'ACCIDENT',
      lat: Number(payload.lat),
      lng: Number(payload.lng),
      address: payload.address || '',
      isAnonymous: Boolean(payload.isAnonymous),
      confirmCount: 1,
      upvotedUserIds: [userId],
      timemarkPhotoUrl: payload.timemarkPhotoUrl || payload.imageUrl || '',
      timemarkMeta: payload.timemarkMeta || null,
      severity: payload.severity || 'P2_URGENT',
      victimCount: payload.victimCount || '1 người',
      victimCondition: payload.victimCondition || '',
      reportedByPhone: payload.reportedByPhone || user?.phoneNumber || '',
    });

    const io = getIo();
    if (io) {
      io.emit('community:hazard_created', {
        hazard: report.toObject(),
      });
    }

    return report;
  }

  async listHazards({ lat, lng, radiusKm = 10, category }) {
    const query = { status: 'ACTIVE' };
    if (category && category !== 'ALL') {
      query.category = category;
    }

    const list = await HazardReport.find(query).sort({ createdAt: -1 }).limit(50);

    if (lat != null && lng != null) {
      const originLat = Number(lat);
      const originLng = Number(lng);
      return list
        .map((doc) => {
          const item = doc.toObject();
          item.distanceKm = haversineKm(originLat, originLng, item.lat, item.lng);
          return item;
        })
        .filter((item) => item.distanceKm <= Number(radiusKm))
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return list.map((doc) => ({
      ...doc.toObject(),
      distanceKm: 0.5,
    }));
  }

  async verifyHazard(hazardId, userId, action) {
    const report = await HazardReport.findById(hazardId);
    ensure(report, 'Báo cáo cảnh báo không tồn tại', 404);

    if (action === 'RESOLVE') {
      report.resolvedCount += 1;
      if (report.resolvedCount >= 3) {
        report.status = 'RESOLVED';
      }
    } else {
      if (!report.upvotedUserIds.includes(userId)) {
        report.confirmCount += 1;
        report.upvotedUserIds.push(userId);
      }
    }

    await report.save();
    return report;
  }

  async createSafeMoment(userId, payload) {
    const user = await User.findById(userId);
    const authorName = user?.name || user?.fullName || 'Người thân';

    const moment = await SafeMoment.create({
      userId,
      authorName,
      mood: payload.mood || 'calm',
      voiceNoteUrl: payload.voiceNoteUrl || null,
      photoUrl: payload.photoUrl || null,
      caption: payload.caption || '',
    });

    return moment;
  }

  async listSafeMoments(userId) {
    const now = new Date();
    return SafeMoment.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(20);
  }

  async listActiveDisasterAlerts({ lat, lng }) {
    let alerts = await DisasterAlert.find({ status: 'ACTIVE' }).sort({ createdAt: -1 });
    if (!alerts || alerts.length === 0) {
      // Auto seed if empty
      try {
        const seedAlerts = [
          {
            title: 'CẢNH BÁO SẠT LỞ ĐẤT ĐÈO BẢO LỘC - NGUY HIỂM',
            description: 'Mưa lớn kéo dài gây sạt trượt taluy dương tại Km 104+200, đất đá tràn mặt đường, nguy cơ sạt lở thứ cấp cao.',
            category: 'LANDSLIDE',
            severity: 'CRITICAL',
            lat: 11.4720,
            lng: 107.7260,
            radiusMeters: 5000,
            address: 'Đèo Bảo Lộc, Quốc lộ 20, Tỉnh Lâm Đồng',
            safetyAdvice: 'Tuyệt đối không lưu thông qua đèo trong lúc mưa lớn. Tìm nơi dừng đỗ an toàn tại chân đèo hoặc đi vòng theo hướng Tỉnh lộ 725.',
            evacuationRouteTip: 'Đường tránh Tỉnh lộ 725 qua Huyện Đạ Tẻh ➔ Bảo Lâm.',
            imageUrl: 'https://images.unsplash.com/photo-1578885136359-16c8bd4d3a8e?auto=format&fit=crop&w=800&q=80',
            status: 'ACTIVE',
            issuedBy: 'Ban Chỉ Huy PCTT & TKCN / Trực ban SafeSolo',
            broadcastCount: 142,
          },
          {
            title: 'NGẬP NƯỚC SÂU 0.7M ĐƯỜNG TRẦN XUÂN SOẠN TRIỀU CƯỜNG ĐỈNH ĐIỂM',
            description: 'Triều cường sông Sài Gòn vượt mức báo động 3, nước tràn ngập đường sâu trên 60-70cm, nhiều xe chết máy, nguy cơ rò rỉ điện.',
            category: 'FLOODING',
            severity: 'CRITICAL',
            lat: 10.7420,
            lng: 106.6840,
            radiusMeters: 1500,
            address: 'Đường Trần Xuân Soạn (từ Cầu Rạch Ông đến Cầu Tân Thuận), Quận 7, TP.HCM',
            safetyAdvice: 'Không cố đi xe qua vùng nước ngập quá bánh xe. Tránh xa các trạm biến áp, tủ điện ven đường.',
            evacuationRouteTip: 'Di chuyển theo trục Đường Nguyễn Thị Thập hoặc Cầu Kênh Tẻ.',
            imageUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
            status: 'ACTIVE',
            issuedBy: 'Trung tâm Điều phối Cứu hộ SafeSolo Q7',
            broadcastCount: 385,
          },
          {
            title: 'BÃO SỐ 4 GIẬT CẤP 12 GÂY LŨ QUÉT VÀ NGẬP SÂU',
            description: 'Tâm bão tiếp cận vùng ven biển, mưa đặc biệt to gây ngập úng diện rộng và nguy cơ lũ quét cục bộ vùng trũng thấp.',
            category: 'STORM_SURGE',
            severity: 'CRITICAL',
            lat: 16.0544,
            lng: 108.2022,
            radiusMeters: 8000,
            address: 'Vùng hạ du sông Thu Bồn & Ven biển Đà Nẵng - Quảng Nam',
            safetyAdvice: 'Sơ tán khẩn cấp khỏi khu vực trũng thấp, chằng chống nhà cửa và ngắt nguồn điện chính.',
            evacuationRouteTip: 'Di chuyển về các điểm trường học kiên cố hoặc nhà văn hóa xã trên cao.',
            imageUrl: 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=800&q=80',
            status: 'ACTIVE',
            issuedBy: 'Ban Chỉ Đạo Quốc Gia PCTT / Admin SafeSolo 115',
            broadcastCount: 620,
          },
        ];
        alerts = await DisasterAlert.insertMany(seedAlerts);
      } catch (_) {}
    }

    const originLat = lat != null ? Number(lat) : null;
    const originLng = lng != null ? Number(lng) : null;

    return (alerts || []).map((doc) => {
      const item = doc.toObject ? doc.toObject() : doc;
      if (originLat != null && originLng != null) {
        item.distanceKm = Number(haversineKm(originLat, originLng, item.lat, item.lng).toFixed(2));
        item.isNearby = (item.radiusMeters != null && item.radiusMeters > 0)
          ? item.distanceKm <= (item.radiusMeters / 1000)
          : true;
      } else {
        item.distanceKm = 0;
        item.isNearby = true;
      }
      return item;
    });
  }
}

module.exports = new HazardService();
